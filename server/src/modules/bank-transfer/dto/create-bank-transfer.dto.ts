import { IsString, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BankInfoDto {
  @IsString()
  bankName: string;

  @IsString()
  accountName: string;

  @IsString()
  accountNumber: string;
}

export class CreateBankTransferDto {
  @IsString()
  orderId: string;

  @ValidateNested()
  @Type(() => BankInfoDto)
  bankInfo: BankInfoDto;
}

export class UploadProofDto {
  @IsString()
  proofUrl: string;
}

export class ReviewTransferDto {
  @IsString()
  action: 'confirm' | 'reject';

  @IsOptional()
  @IsString()
  reviewNote?: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;
}
