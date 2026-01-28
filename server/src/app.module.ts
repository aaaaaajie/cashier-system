import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { MongoMemoryServer } from 'mongodb-memory-server';

import configuration from './config/configuration';
import { InfraModule } from './infra/infra.module';
import { AuthModule } from './modules/auth/auth.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { RefundModule } from './modules/refund/refund.module';
import { RecordModule } from './modules/record/record.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { BankTransferModule } from './modules/bank-transfer/bank-transfer.module';
import { NotificationModule } from './modules/notification/notification.module';
import { CashierModule } from './modules/cashier/cashier.module';
import { ExternalOrderModule } from './modules/external-order/external-order.module';

let mongoMemoryServer: MongoMemoryServer | null = null;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    InfraModule,
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const level = config.get<string>('logging.level') ?? 'info';
        const filename = config.get<string>('logging.file');

        const transports: winston.transport[] = [
          new winston.transports.Console({
            level,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json(),
            ),
          }),
        ];

        if (filename) {
          transports.push(
            new winston.transports.File({
              filename,
              level,
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              ),
            }),
          );
        }

        return { transports };
      },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const useMemoryDb = config.get<string>('mongodb.useMemory') === 'true';
        if (useMemoryDb) {
          mongoMemoryServer = await MongoMemoryServer.create();
          const uri = mongoMemoryServer.getUri();
          console.log(`[MongoDB] Using in-memory database: ${uri}`);
          return { uri };
        }
        return { uri: config.get<string>('mongodb.uri') };
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    MerchantModule,
    ProductModule,
    OrderModule,
    PaymentModule,
    RefundModule,
    RecordModule,
    InvoiceModule,
    BankTransferModule,
    NotificationModule,
    CashierModule,
    ExternalOrderModule,
  ],
})
export class AppModule {}

export { mongoMemoryServer };
