import { IsOptional, IsString } from 'class-validator';

export class PreparePaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  channelHint?: string;
}
