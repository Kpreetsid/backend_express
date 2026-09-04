import { AppError } from './app.error';

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: unknown) {
    super(message, 409, details);
  }
}
