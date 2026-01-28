import { Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';

import { PaymentService } from './payment.service';
import { ErrorCode, PaymentChannel } from '../../common/constants';

@Controller('/api/v1/callbacks')
export class CallbackController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('wechat')
  async wechat(@Req() req: Request) {
    const rawBody = Buffer.isBuffer((req as any).body)
      ? ((req as any).body as Buffer)
      : Buffer.from(JSON.stringify((req as any).body ?? {}));
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '').toString()]),
    ) as Record<string, string>;

    const ok = await this.paymentService.handleChannelCallback(PaymentChannel.WECHAT, rawBody, headers);
    if (!ok) {
      throw new HttpException({ code: ErrorCode.CALLBACK_SIGN_FAILED, message: '回调验签失败' }, HttpStatus.BAD_REQUEST);
    }
    return { success: true };
  }

  @Post('alipay')
  async alipay(@Req() req: Request) {
    const rawBody = Buffer.isBuffer((req as any).body)
      ? ((req as any).body as Buffer)
      : Buffer.from(JSON.stringify((req as any).body ?? {}));
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '').toString()]),
    ) as Record<string, string>;

    const ok = await this.paymentService.handleChannelCallback(PaymentChannel.ALIPAY, rawBody, headers);
    if (!ok) {
      throw new HttpException({ code: ErrorCode.CALLBACK_SIGN_FAILED, message: '回调验签失败' }, HttpStatus.BAD_REQUEST);
    }
    return { success: true };
  }
}

