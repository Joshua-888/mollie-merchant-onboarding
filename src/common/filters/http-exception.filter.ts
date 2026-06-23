import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  MollieAuthError,
  MollieError,
  MollieNotFoundError,
  MollieRateLimitError,
  MollieValidationError,
} from '../../integrations/mollie/mollie.errors';
import { CvrError } from '../../integrations/cvr/cvr.errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = uuidv4();

    const { statusCode, message } = this.resolveError(exception);

    this.logger.error({
      requestId,
      method: request.method,
      path: request.url,
      statusCode,
      message,
      errorType: exception instanceof Error ? exception.name : 'UnknownError',
    });

    response.status(statusCode).json({
      statusCode,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveError(exception: unknown): { statusCode: number; message: string } {
    if (exception instanceof MollieValidationError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message };
    }
    if (exception instanceof MollieAuthError) {
      return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Mollie authorization failed' };
    }
    if (exception instanceof MollieNotFoundError) {
      return { statusCode: HttpStatus.NOT_FOUND, message: exception.message };
    }
    if (exception instanceof MollieRateLimitError) {
      return { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: exception.message };
    }
    if (exception instanceof MollieError) {
      return { statusCode: HttpStatus.BAD_GATEWAY, message: 'Payment provider error' };
    }
    if (exception instanceof CvrError) {
      return { statusCode: exception.statusCode, message: exception.message };
    }
    if (exception instanceof HttpException) {
      return { statusCode: exception.getStatus(), message: exception.message };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    };
  }
}
