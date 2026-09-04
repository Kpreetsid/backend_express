import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  status: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export class ResponseHelper {
  static success<T>(res: Response, message: string = 'Operation successful', data?: T, statusCode: number = 200): Response {
    const payload: ApiResponse<T> = {
      status: true,
      message,
      ...(data !== undefined ? { data } : {})
    };
    return res.status(statusCode).json(payload);
  }

  static created<T>(res: Response, message: string = 'Created successfully', data?: T): Response {
    return this.success(res, message, data, 201);
  }

  static paginated<T>(res: Response, message: string, data: T[], total: number, page: number, limit: number): Response {
    return res.status(200).json({
      status: true,
      message,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / (limit || 1))
      }
    });
  }
}
