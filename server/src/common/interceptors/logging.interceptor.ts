import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, traceId } = request;
    const merchantId = request?.merchant?.merchantId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          JSON.stringify({
            traceId,
            method,
            url,
            statusCode: response?.statusCode,
            merchantId,
            duration,
            timestamp: new Date().toISOString(),
          }),
        );
      }),
    );
  }
}
