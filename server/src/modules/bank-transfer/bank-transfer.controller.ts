import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';

import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { BankTransferService } from './bank-transfer.service';
import { CreateBankTransferDto, ReviewTransferDto, UploadProofDto } from './dto/create-bank-transfer.dto';
import { QueryBankTransferAdminDto } from './dto/query-bank-transfer-admin.dto';

@Controller()
export class BankTransferController {
  constructor(private readonly bankTransferService: BankTransferService) {}

  @Post('/api/v1/bank-transfers')
  @UseGuards(ApiSignGuard)
  @UsePipes(new CustomValidationPipe())
  async create(@CurrentMerchant('merchantId') merchantId: string, @Body() dto: CreateBankTransferDto) {
    return this.bankTransferService.createTransfer(merchantId, dto);
  }

  @Post('/api/v1/bank-transfers/:transferId/proof')
  @UseGuards(ApiSignGuard)
  @UsePipes(new CustomValidationPipe())
  async uploadProof(
    @CurrentMerchant('merchantId') merchantId: string,
    @Param('transferId') transferId: string,
    @Body() dto: UploadProofDto,
  ) {
    return this.bankTransferService.uploadProof(merchantId, transferId, dto.proofUrl);
  }

  @Get('/api/v1/admin/bank-transfers')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new CustomValidationPipe())
  async listAdmin(@Query() query: QueryBankTransferAdminDto) {
    return this.bankTransferService.listAdmin(query);
  }

  @Get('/api/v1/admin/bank-transfers/:transferId')
  @UseGuards(JwtAuthGuard)
  async getAdmin(@Param('transferId') transferId: string) {
    return this.bankTransferService.getAdmin(transferId);
  }

  @Put('/api/v1/admin/bank-transfers/:transferId/review')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new CustomValidationPipe())
  async review(@Param('transferId') transferId: string, @Body() dto: ReviewTransferDto) {
    return this.bankTransferService.reviewTransfer(transferId, dto);
  }
}
