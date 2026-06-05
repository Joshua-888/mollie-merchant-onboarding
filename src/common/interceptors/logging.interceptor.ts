import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const requestId = uuidv4();
    const start = Date.now();

    req.requestId = requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log({
            requestId,
            method: req.method,
            path: req.url,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
          });
        },
        error: () => {
          this.logger.warn({
            requestId,
            method: req.method,
            path: req.url,
            durationMs: Date.now() - start,
          });
        },
      }),
    );
  }
}
