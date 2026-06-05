export class MollieError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly mollieTitle: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'MollieError';
  }
}

export class MollieValidationError extends MollieError {
  constructor(
    detail: string,
    public readonly field?: string,
    requestId?: string,
  ) {
    super(detail, 400, 'Unprocessable Entity', requestId);
    this.name = 'MollieValidationError';
  }
}

export class MollieAuthError extends MollieError {
  constructor(detail: string, requestId?: string) {
    super(detail, 401, 'Unauthorized', requestId);
    this.name = 'MollieAuthError';
  }
}

export class MollieNotFoundError extends MollieError {
  constructor(detail: string, requestId?: string) {
    super(detail, 404, 'Not Found', requestId);
    this.name = 'MollieNotFoundError';
  }
}

export class MollieRateLimitError extends MollieError {
  constructor(requestId?: string) {
    super('Mollie rate limit reached. Please slow down requests.', 429, 'Too Many Requests', requestId);
    this.name = 'MollieRateLimitError';
  }
}

export class MollieUpstreamError extends MollieError {
  constructor(detail: string, statusCode: number, requestId?: string) {
    super(detail, statusCode, 'Upstream Error', requestId);
    this.name = 'MollieUpstreamError';
  }
}
