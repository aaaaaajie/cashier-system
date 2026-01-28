import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateQrcodeDto {
  @IsString()
  orderId: string;
}

export class CreateJsapiPaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  openId: string;
}

export class CreateH5PaymentDto {
  @IsString()
  orderId: string;
}
