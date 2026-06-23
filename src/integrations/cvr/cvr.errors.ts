export class CvrError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 502,
    public readonly code: string = 'CVR_UPSTREAM_ERROR',
  ) {
    super(message);
    this.name = 'CvrError';
  }
}

export class CvrNotFoundError extends CvrError {
  constructor(message = 'Virksomhed ikke fundet i CVR-registret') {
    super(message, 404, 'CVR_NOT_FOUND');
    this.name = 'CvrNotFoundError';
  }
}

export class CvrValidationError extends CvrError {
  constructor(message: string) {
    super(message, 400, 'CVR_VALIDATION_ERROR');
    this.name = 'CvrValidationError';
  }
}

export class CvrRateLimitError extends CvrError {
  constructor(message = 'CVR API rate limit nået — prøv igen om lidt') {
    super(message, 429, 'CVR_RATE_LIMIT');
    this.name = 'CvrRateLimitError';
  }
}
