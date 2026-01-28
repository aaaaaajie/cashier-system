import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentChannel } from '../../../common/constants';

export class CashierPayDto {
  @IsString()
  orderId: string;

  @IsString()
  token: string;

  @IsOptional()
  @IsEnum(PaymentChannel)
  channel?: PaymentChannel;

  @IsOptional()
  @IsString()
  openId?: string;
}

