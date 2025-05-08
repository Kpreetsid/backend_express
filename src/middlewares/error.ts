import { Request, Response, NextFunction } from 'express';

export const errorMiddleware: any = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  switch (err.name) {
    case 'BadRequestError':
      return res.status(400).json({ status: false, message: 'Bad Request', error: err.message });

    case 'JsonWebTokenError':
      return res.status(401).json({ status: false, message: 'Invalid token', error: err.message });

    case 'TokenExpiredError':
      return res.status(401).json({ status: false, message: 'Token expired', error: err.message });

    case 'UnauthorizedError':
      if (err.message === 'jwt expired') {
        return res.status(401).json({ status: false, message: 'Token has expired. Please log in again.' });
      }
      return res.status(401).json({ status: false, message: 'Invalid token.' });

    case 'InvalidTokenError':
      return res.status(401).json({ status: false, message: 'Invalid token', error: err.message });

    case 'ForbiddenError':
      return res.status(403).json({ status: false, message: 'Forbidden', error: err.message });

    case 'NotFoundError':
      return res.status(404).json({ status: false, message: 'Resource not found', error: err.message });

    case 'MethodNotAllowedError':
      return res.status(405).json({ status: false, message: 'Method Not Allowed', error: err.message });

    case 'NotAcceptableError':
      return res.status(406).json({ status: false, message: 'Not Acceptable', error: err.message });

    case 'RequestTimeoutError':
      return res.status(408).json({ status: false, message: 'Request Timeout', error: err.message });

    case 'ConflictError':
      return res.status(409).json({ status: false, message: 'Conflict', error: err.message });

    case 'LengthRequiredError':
      return res.status(411).json({ status: false, message: 'Length Required', error: err.message });

    case 'PreconditionFailedError':
      return res.status(412).json({ status: false, message: 'Precondition Failed', error: err.message });

    case 'UnsupportedMediaTypeError':
      return res.status(415).json({ status: false, message: 'Unsupported Media Type', error: err.message });

    case 'RangeNotSatisfiableError':
      return res.status(416).json({ status: false, message: 'Range Not Satisfiable', error: err.message });

    case 'ExpectationFailedError':
      return res.status(417).json({ status: false, message: 'Expectation Failed', error: err.message });

    case 'TooManyRequestsError':
      return res.status(429).json({ status: false, message: 'Too Many Requests', error: err.message });

    case 'UnavailableForLegalReasonsError':
      return res.status(451).json({ status: false, message: 'Unavailable For Legal Reasons', error: err.message });

    case 'InternalServerError':
      return res.status(500).json({ status: false, message: 'Internal Server Error', error: err.message });

    case 'NotImplementedError':
      return res.status(501).json({ status: false, message: 'Not Implemented', error: err.message });

    case 'BadGatewayError':
      return res.status(502).json({ status: false, message: 'Bad Gateway', error: err.message });

    case 'ServiceUnavailableError':
      return res.status(503).json({ status: false, message: 'Service Unavailable', error: err.message });

    case 'GatewayTimeoutError':
      return res.status(504).json({ status: false, message: 'Gateway Timeout', error: err.message });

    case 'InsufficientStorageError':
      return res.status(507).json({ status: false, message: 'Insufficient Storage', error: err.message });

    case 'LoopDetectedError':
      return res.status(508).json({ status: false, message: 'Loop Detected', error: err.message });

    case 'NotExtendedError':
      return res.status(510).json({ status: false, message: 'Not Extended', error: err.message });

    case 'NetworkAuthenticationRequiredError':
      return res.status(511).json({ status: false, message: 'Network Authentication Required', error: err.message });

    // Handle Mongoose/MongoDB errors
    case 'ValidationError':
      return res.status(422).json({ status: false, message: 'Validation Error', error: err.message });

    case 'MongoServerError':
      if (err.code === 11000) {
        return res.status(409).json({ status: false, message: 'Duplicate key error', error: err.message });
      }
      return res.status(500).json({ status: false, message: 'MongoDB Server Error', error: err.message });

    case 'CastError':
      return res.status(400).json({ status: false, message: 'Invalid ID format', error: err.message });
  }

  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(statusCode).json({ status: false, message, error: err.stack || err.message });
};