import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';

import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { CreateInvoiceDto, IssueInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceAdminDto } from './dto/query-invoice-admin.dto';
import { InvoiceService } from './invoice.service';

@Controller()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post('/api/v1/invoices')
  @UseGuards(ApiSignGuard)
  @UsePipes(new CustomValidationPipe())
  async create(@CurrentMerchant('merchantId') merchantId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.createInvoice(merchantId, dto);
  }

  @Get('/api/v1/invoices/:invoiceId')
  @UseGuards(ApiSignGuard)
  async get(@CurrentMerchant('merchantId') merchantId: string, @Param('invoiceId') invoiceId: string) {
    return this.invoiceService.getInvoice(merchantId, invoiceId);
  }

  @Get('/api/v1/admin/invoices')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new CustomValidationPipe())
  async listAdmin(@Query() query: QueryInvoiceAdminDto) {
    return this.invoiceService.listAdmin(query);
  }

  @Get('/api/v1/admin/invoices/:invoiceId')
  @UseGuards(JwtAuthGuard)
  async getAdmin(@Param('invoiceId') invoiceId: string) {
    return this.invoiceService.getInvoiceAdmin(invoiceId);
  }

  @Put('/api/v1/admin/invoices/:invoiceId/issue')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new CustomValidationPipe())
  async issue(@Param('invoiceId') invoiceId: string, @Body() dto: IssueInvoiceDto) {
    return this.invoiceService.issueInvoice(invoiceId, dto.operatorId);
  }
}
