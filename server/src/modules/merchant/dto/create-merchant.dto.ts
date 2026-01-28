import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateMerchantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];
}

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];
}

export class ConfigurePaymentDto {
  @IsOptional()
  wechat?: {
    mchId: string;
    appId: string;
    apiKeyV3: string;
    certSerialNo: string;
    privateKey: string;
  };

  @IsOptional()
  alipay?: {
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    signType?: string;
  };
}
