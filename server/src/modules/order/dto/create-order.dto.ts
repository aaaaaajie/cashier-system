import { IsString, IsNumber, IsOptional, IsObject, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  externalOrderId: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  expireMinutes?: number;

  @IsOptional()
  @IsString()
  notifyUrl?: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  userId?: string;
}
