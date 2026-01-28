import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpsertProductDto {
  @IsString()
  productId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  unitPrice: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
