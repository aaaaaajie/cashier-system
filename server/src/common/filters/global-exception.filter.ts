import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constants';
import { IdGenerator } from '../utils/id-generator.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = (request as any).traceId || IdGenerator.generateTraceId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.PARAM_VALIDATION_FAILED;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        message = obj.message || message;
        code = obj.code || code;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      JSON.stringify({
        traceId,
        path: request.url,
        method: request.method,
        message,
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    );

    response.status(status).json({
      code,
      message: Array.isArray(message) ? message.join('; ') : message,
      data: null,
      traceId,
    });
  }
}
