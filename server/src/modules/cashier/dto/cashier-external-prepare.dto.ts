import { IsString } from 'class-validator';

export class CashierExternalPrepareDto {
  @IsString()
  merchantId: string;

  @IsString()
  externalOrderId: string;
}
