import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ErrorCode,
  TIMESTAMP_TOLERANCE_MS,
  NONCE_TTL_SECONDS,
  MerchantStatus,
} from '../constants';
import { SignUtil } from '../utils/sign.util';
import { CryptoUtil } from '../utils/crypto.util';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class ApiSignGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel('Merchant') private readonly merchantModel: Model<any>,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const appKey = request.headers['x-app-key'] as string;
    const timestamp = request.headers['x-timestamp'] as string;
    const nonce = request.headers['x-nonce'] as string;
    const signature = request.headers['x-signature'] as string;

    if (!appKey || !timestamp || !nonce || !signature) {
      throw new HttpException(
        { code: ErrorCode.SIGN_VERIFY_FAILED, message: '缺少签名参数' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check timestamp tolerance
    const now = Date.now();
    const ts = parseInt(timestamp, 10) * 1000;
    if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_MS) {
      throw new HttpException(
        { code: ErrorCode.TIMESTAMP_EXPIRED, message: 'timestamp已过期' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check nonce uniqueness
    const nonceKey = `nonce:${nonce}`;
    const exists = await this.redis.exists(nonceKey);
    if (exists) {
      throw new HttpException(
        { code: ErrorCode.NONCE_DUPLICATED, message: 'nonce重复，疑似重放攻击' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    await this.redis.setex(nonceKey, NONCE_TTL_SECONDS, '1');

    // Find merchant
    const merchant: any = await this.merchantModel.findOne({ appKey }).lean();
    if (!merchant || merchant.status !== MerchantStatus.ACTIVE) {
      throw new HttpException(
        { code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在或已停用' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Rate limit (default 100/min/merchant, sliding window simplified as fixed window)
    const limitPerMinute =
      this.configService.get<number>('rateLimit.perMinute') ?? 100;
    const minuteBucket = Math.floor(Date.now() / 60000);
    const rateKey = `rate:${merchant.merchantId}:${minuteBucket}`;
    const current = await this.redis.incr(rateKey);
    if (current === 1) {
      await this.redis.expire(rateKey, 60);
    }
    if (current > limitPerMinute) {
      throw new HttpException(
        { code: ErrorCode.RATE_LIMIT_EXCEEDED, message: '请求频率超限' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check IP whitelist
    if (merchant.ipWhitelist && merchant.ipWhitelist.length > 0) {
      const clientIp = request.ip || request.socket.remoteAddress || '';
      // Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
      const normalizedIp = clientIp.replace(/^::ffff:/, '');
      const isAllowed =
        merchant.ipWhitelist.includes(clientIp) ||
        merchant.ipWhitelist.includes(normalizedIp) ||
        (normalizedIp === '::1' && merchant.ipWhitelist.includes('127.0.0.1')) ||
        (normalizedIp === '127.0.0.1' && merchant.ipWhitelist.includes('::1'));
      if (!isAllowed) {
        throw new HttpException(
          { code: ErrorCode.IP_NOT_IN_WHITELIST, message: 'IP不在白名单中' },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Verify signature
    const params = { ...(request.query as any), ...(request.body as any) };
    delete (params as any).signature;

    const masterKey = this.configService.get<string>('masterEncryptionKey')!;
    let appSecret = '';
    try {
      appSecret = merchant.appSecret ? CryptoUtil.decrypt(merchant.appSecret, masterKey) : '';
    } catch {
      throw new HttpException(
        { code: ErrorCode.SIGN_VERIFY_FAILED, message: '签名验证失败' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const valid = SignUtil.verifySignature(
      params,
      timestamp,
      nonce,
      appSecret,
      signature,
    );

    if (!valid) {
      throw new HttpException(
        { code: ErrorCode.SIGN_VERIFY_FAILED, message: '签名验证失败' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Attach merchant to request
    (request as any).merchant = merchant;
    return true;
  }
}
