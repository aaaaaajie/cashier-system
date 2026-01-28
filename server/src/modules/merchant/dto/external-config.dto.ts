import { IsOptional, IsString } from 'class-validator';

export class ConfigureExternalDto {
  @IsString()
  baseUrl: string;

  @IsOptional()
  @IsString()
  appKey?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsString()
  sharedSecret: string;

  @IsOptional()
  @IsString()
  orderDetailPath?: string;
}
