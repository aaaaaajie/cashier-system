import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { json, raw, urlencoded } from 'express';
import { ConfigService } from '@nestjs/config';

import { AppModule, mongoMemoryServer } from './app.module';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TraceIdInterceptor } from './common/interceptors/trace-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.enableCors();

  // Keep raw body for payment callbacks
  app.use('/api/v1/callbacks/wechat', raw({ type: '*/*' }));
  app.use('/api/v1/callbacks/alipay', raw({ type: '*/*' }));

  // Default body parsers for other endpoints
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalInterceptors(
    new TraceIdInterceptor(),
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  const shutdown = async () => {
    await app.close();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();

