import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Merchant, MerchantDocument } from './merchant.schema';
import { CreateMerchantDto, UpdateMerchantDto, ConfigurePaymentDto } from './dto/create-merchant.dto';
import { ConfigureExternalDto } from './dto/external-config.dto';
import { IdGenerator } from '../../common/utils/id-generator.util';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { ErrorCode, MerchantStatus } from '../../common/constants';
import { QueryMerchantDto } from './dto/query-merchant.dto';

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
    private configService: ConfigService,
  ) {}

  async create(dto: CreateMerchantDto) {
    const merchantId = IdGenerator.generateMerchantId();
    const appKey = IdGenerator.generateAppKey();
    const appSecret = IdGenerator.generateAppSecret();
    const masterKey = this.configService.get<string>('masterEncryptionKey')!;

    const merchant = new this.merchantModel({
      merchantId,
      name: dto.name,
      appKey,
      appSecret: CryptoUtil.encrypt(appSecret, masterKey),
      status: MerchantStatus.ACTIVE,
      callbackUrl: dto.callbackUrl,
      ipWhitelist: dto.ipWhitelist || [],
    });

    await merchant.save();
    this.logger.log(JSON.stringify({ action: 'merchant.created', merchantId }));

    return {
      merchantId,
      name: dto.name,
      appKey,
      appSecret,
      status: MerchantStatus.ACTIVE,
    };
  }

  async list(query: QueryMerchantDto) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.keyword) {
      filter.$or = [
        { merchantId: query.keyword },
        { name: new RegExp(query.keyword, 'i') },
        { appKey: query.keyword },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, data] = await Promise.all([
      this.merchantModel.countDocuments(filter),
      this.merchantModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    // Mask secrets
    const masked = data.map((m: any) => ({
      ...m,
      appSecret: m.appSecret ? String(m.appSecret).substring(0, 8) + '****' : undefined,
      paymentConfig: m.paymentConfig
        ? {
            wechat: m.paymentConfig.wechat ? { ...m.paymentConfig.wechat, apiKeyV3: '****', privateKey: '****' } : undefined,
            alipay: m.paymentConfig.alipay ? { ...m.paymentConfig.alipay, privateKey: '****' } : undefined,
          }
        : undefined,
      externalConfig: m.externalConfig
        ? {
            ...m.externalConfig,
            appSecret: m.externalConfig.appSecret ? '****' : undefined,
            sharedSecret: m.externalConfig.sharedSecret ? '****' : undefined,
          }
        : undefined,
    }));

    return { total, page, pageSize, data: masked };
  }

  async findById(merchantId: string) {
    const merchant = await this.merchantModel.findOne({ merchantId }).lean();
    if (!merchant) {
      throw new HttpException(
        { code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    // Mask sensitive fields
    const result = { ...merchant } as any;
    if (result.appSecret) {
      result.appSecret = result.appSecret.substring(0, 8) + '****';
    }
    if (result.paymentConfig?.wechat?.apiKeyV3) result.paymentConfig.wechat.apiKeyV3 = '****';
    if (result.paymentConfig?.wechat?.privateKey) result.paymentConfig.wechat.privateKey = '****';
    if (result.paymentConfig?.alipay?.privateKey) result.paymentConfig.alipay.privateKey = '****';
    if (result.externalConfig?.appSecret) result.externalConfig.appSecret = '****';
    if (result.externalConfig?.sharedSecret) result.externalConfig.sharedSecret = '****';
    return result;
  }

  async update(merchantId: string, dto: UpdateMerchantDto) {
    const merchant = await this.merchantModel.findOneAndUpdate(
      { merchantId },
      { $set: dto },
      { new: true },
    ).lean();
    if (!merchant) {
      throw new HttpException(
        { code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    return merchant;
  }

  async configurePayment(merchantId: string, dto: ConfigurePaymentDto) {
    const masterKey = this.configService.get<string>('masterEncryptionKey')!;

    const update: any = {};
    if (dto.wechat) {
      update['paymentConfig.wechat'] = {
        mchId: dto.wechat.mchId,
        appId: dto.wechat.appId,
        apiKeyV3: CryptoUtil.encrypt(dto.wechat.apiKeyV3, masterKey),
        certSerialNo: dto.wechat.certSerialNo,
        privateKey: CryptoUtil.encrypt(dto.wechat.privateKey, masterKey),
      };
    }
    if (dto.alipay) {
      update['paymentConfig.alipay'] = {
        appId: dto.alipay.appId,
        privateKey: CryptoUtil.encrypt(dto.alipay.privateKey, masterKey),
        alipayPublicKey: dto.alipay.alipayPublicKey,
        signType: dto.alipay.signType || 'RSA2',
      };
    }

    const merchant = await this.merchantModel.findOneAndUpdate(
      { merchantId },
      { $set: update },
      { new: true },
    ).lean();

    if (!merchant) {
      throw new HttpException(
        { code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }

    this.logger.log(JSON.stringify({ action: 'merchant.payment_configured', merchantId }));
    return { merchantId, message: '支付渠道配置成功' };
  }

  async configureExternal(merchantId: string, dto: ConfigureExternalDto) {
    const masterKey = this.configService.get<string>('masterEncryptionKey')!;

    const update = {
      externalConfig: {
        baseUrl: dto.baseUrl,
        appKey: dto.appKey,
        appSecret: dto.appSecret ? CryptoUtil.encrypt(dto.appSecret, masterKey) : undefined,
        sharedSecret: CryptoUtil.encrypt(dto.sharedSecret, masterKey),
        orderDetailPath: dto.orderDetailPath || '/api/orders/:orderId',
      },
    };

    const merchant = await this.merchantModel.findOneAndUpdate({ merchantId }, { $set: update }, { new: true }).lean();
    if (!merchant) {
      throw new HttpException(
        { code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }

    this.logger.log(JSON.stringify({ action: 'merchant.external_configured', merchantId }));
    return { merchantId, message: '外部系统配置成功' };
  }

  async findByAppKey(appKey: string) {
    return this.merchantModel.findOne({ appKey }).lean();
  }
}
