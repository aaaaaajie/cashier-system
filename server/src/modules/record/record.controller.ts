import { Controller, Get, Query, Res, UseGuards, UsePipes } from '@nestjs/common';
import { Response } from 'express';

import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { QueryPaysetDto } from './dto/query-payset.dto';
import { RecordService } from './record.service';

@Controller('/api/v1/payset')
@UseGuards(ApiSignGuard)
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Get()
  @UsePipes(new CustomValidationPipe())
  async query(@CurrentMerchant('merchantId') merchantId: string, @Query() query: QueryPaysetDto) {
    return this.recordService.queryPayset(merchantId, query);
  }

  @Get('export')
  @UsePipes(new CustomValidationPipe())
  async export(@CurrentMerchant('merchantId') merchantId: string, @Query() query: QueryPaysetDto, @Res() res: Response) {
    const csv = await this.recordService.exportPaysetCsv(merchantId, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payset.csv"');
    res.send(csv);
  }
}

