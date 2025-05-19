import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction): Response | void => {
  if (res.headersSent) {
    return next(err);
  }

  const response: { status: boolean; message: string; error?: string } = {
    status: false,
    message: err.message || 'Internal Server Error',
    error: 'Something went wrong'
  };

  const statusCode = err.status || 500;

  console.error({ name: err.name, code: err.code, message: err.message, stack: err.stack, path: req.path, method: req.method });

  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Max allowed size is 5MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file format.';
        break;
      default:
        message = 'File upload error';
        break;
    }
    return res.status(400).json({ status: false, message, error: err.message }).end();
  }

  switch (err.name) {
    case 'BadRequestError':
      return res.status(400).json({ status: false, message: 'Bad Request', error: err.message }).end();

    case 'JsonWebTokenError':
    case 'InvalidTokenError':
      return res.status(401).json({ status: false, message: 'Invalid token', error: err.message }).end();

    case 'TokenExpiredError':
    case 'UnauthorizedError':
      return res.status(401).json({ status: false, message: 'Token expired or unauthorized', error: err.message }).end();

    case 'ForbiddenError':
      return res.status(403).json({ status: false, message: 'Access Forbidden', error: err.message }).end();

    case 'NotFoundError':
      return res.status(404).json({ status: false, message: 'Resource Not Found', error: err.message }).end();

    case 'MethodNotAllowedError':
      return res.status(405).json({ status: false, message: 'Method Not Allowed', error: err.message }).end();

    case 'NotAcceptableError':
      return res.status(406).json({ status: false, message: 'Not Acceptable', error: err.message }).end();

    case 'RequestTimeoutError':
      return res.status(408).json({ status: false, message: 'Request Timeout', error: err.message }).end();

    case 'ConflictError':
      return res.status(409).json({ status: false, message: 'Conflict', error: err.message }).end();

    case 'LengthRequiredError':
      return res.status(411).json({ status: false, message: 'Length Required', error: err.message }).end();

    case 'PreconditionFailedError':
      return res.status(412).json({ status: false, message: 'Precondition Failed', error: err.message }).end();

    case 'UnsupportedMediaTypeError':
      return res.status(415).json({ status: false, message: 'Unsupported Media Type', error: err.message }).end();

    case 'RangeNotSatisfiableError':
      return res.status(416).json({ status: false, message: 'Range Not Satisfiable', error: err.message }).end();

    case 'ExpectationFailedError':
      return res.status(417).json({ status: false, message: 'Expectation Failed', error: err.message }).end();

    case 'TooManyRequestsError':
      return res.status(429).json({ status: false, message: 'Too Many Requests', error: err.message }).end();

    case 'UnavailableForLegalReasonsError':
      return res.status(451).json({ status: false, message: 'Unavailable For Legal Reasons', error: err.message }).end();

    case 'InternalServerError':
      return res.status(500).json({ status: false, message: 'Internal Server Error', error: err.message }).end();

    case 'NotImplementedError':
      return res.status(501).json({ status: false, message: 'Not Implemented', error: err.message }).end();

    case 'BadGatewayError':
      return res.status(502).json({ status: false, message: 'Bad Gateway', error: err.message }).end();

    case 'ServiceUnavailableError':
      return res.status(503).json({ status: false, message: 'Service Unavailable', error: err.message }).end();

    case 'GatewayTimeoutError':
      return res.status(504).json({ status: false, message: 'Gateway Timeout', error: err.message }).end();

    case 'InsufficientStorageError':
      return res.status(507).json({ status: false, message: 'Insufficient Storage', error: err.message }).end();

    case 'LoopDetectedError':
      return res.status(508).json({ status: false, message: 'Loop Detected', error: err.message }).end();

    case 'NotExtendedError':
      return res.status(510).json({ status: false, message: 'Not Extended', error: err.message }).end();

    case 'NetworkAuthenticationRequiredError':
      return res.status(511).json({ status: false, message: 'Network Authentication Required', error: err.message }).end();

    case 'ValidationError':
      return res.status(422).json({ status: false, message: 'Validation Error', error: err.message }).end();

    case 'MongoServerError':
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ status: false, message: `Duplicate value for "${field}".`, error: err.message }).end();
      }
      return res.status(500).json({ status: false, message: 'MongoDB Error', error: err.message }).end();

    case 'CastError':
      return res.status(400).json({ status: false, message: 'Invalid ID format', error: err.message }).end();
  }

  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return res.status(400).json({ status: false, message: 'File too large', error: err.message }).end();
    case 'LIMIT_FILE_COUNT':
      return res.status(400).json({ status: false, message: 'Too many files', error: err.message }).end();
    case 'LIMIT_UNEXPECTED_FILE':
      return res.status(400).json({ status: false, message: 'Unexpected file', error: err.message }).end();
  }

  return res.status(statusCode).json(response).end();
};