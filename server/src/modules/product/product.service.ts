import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Product, ProductDocument } from './product.schema';
import { UpsertProductDto } from './dto/upsert-product.dto';
import { ErrorCode } from '../../common/constants';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(@InjectModel(Product.name) private readonly productModel: Model<ProductDocument>) {}

  async upsert(merchantId: string, dto: UpsertProductDto) {
    const updated = await this.productModel
      .findOneAndUpdate(
        { merchantId, productId: dto.productId },
        {
          $set: {
            merchantId,
            productId: dto.productId,
            title: dto.title,
            description: dto.description,
            unitPrice: dto.unitPrice,
            currency: dto.currency || 'CNY',
            metadata: dto.metadata,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();

    this.logger.log(
      JSON.stringify({ action: 'product.upserted', merchantId, productId: dto.productId, unitPrice: dto.unitPrice }),
    );

    return updated;
  }

  async get(merchantId: string, productId: string) {
    const product = await this.productModel.findOne({ merchantId, productId }).lean();
    if (!product) {
      throw new HttpException({ code: ErrorCode.PARAM_VALIDATION_FAILED, message: '商品不存在' }, HttpStatus.NOT_FOUND);
    }
    return product;
  }

  async list(merchantId: string) {
    return this.productModel.find({ merchantId }).sort({ updatedAt: -1 }).limit(200).lean();
  }
}
