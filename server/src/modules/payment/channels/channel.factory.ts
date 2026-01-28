import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IPaymentChannel } from './channel.interface';
import { WechatPayChannel } from './wechat-pay.channel';
import { AlipayChannel } from './alipay.channel';
import { ErrorCode, PaymentChannel } from '../../../common/constants';

@Injectable()
export class ChannelFactory {
  constructor(
    private readonly wechatPayChannel: WechatPayChannel,
    private readonly alipayChannel: AlipayChannel,
  ) {}

  getChannel(channelType: string): IPaymentChannel {
    switch (channelType) {
      case PaymentChannel.WECHAT:
        return this.wechatPayChannel;
      case PaymentChannel.ALIPAY:
        return this.alipayChannel;
      default:
        throw new HttpException(
          { code: ErrorCode.CHANNEL_NOT_SUPPORTED, message: `不支持的支付渠道: ${channelType}` },
          HttpStatus.BAD_REQUEST,
        );
    }
  }
}
