import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { InvoiceType } from '../../../common/constants';

export class CreateInvoiceDto {
  @IsString()
  orderId: string;

  @IsEnum(InvoiceType)
  type: InvoiceType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;
}

export class IssueInvoiceDto {
  @IsOptional()
  @IsString()
  operatorId?: string;
}
