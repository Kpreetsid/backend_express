export class AppError extends Error {
  public readonly status: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, status: number = 500, details?: unknown) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.status = status;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
