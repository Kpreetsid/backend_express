import { AppError } from './app.error';

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: unknown) {
    super(message, 400, details);
  }
}
