import { error } from 'console';
import { Request, Response, NextFunction } from 'express';

export const errorMiddleware: any = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  switch (err.name) {
    case 'BadRequestError':
      return res.status(400).json({ status: false, message: 'Bad Request', error: err.message });

    case 'JsonWebTokenError':
      return res.status(401).json({ status: false, message: 'Invalid token' });

    case 'TokenExpiredError':
      return res.status(401).json({ status: false, message: 'Token expired' });

    case 'UnauthorizedError':
      return res.status(401).json({ status: false, message: 'Authorization token is missing or invalid' });

    case 'ForbiddenError':
      return res.status(403).json({ status: false, message: 'Forbidden' });

    case 'NotFoundError':
      return res.status(404).json({ status: false, message: 'Resource not found' });

    case 'MethodNotAllowedError':
      return res.status(405).json({ status: false, message: 'Method Not Allowed' });

    case 'NotAcceptableError':
      return res.status(406).json({ status: false, message: 'Not Acceptable' });

    case 'RequestTimeoutError':
      return res.status(408).json({ status: false, message: 'Request Timeout' });

    case 'ConflictError':
      return res.status(409).json({ status: false, message: 'Conflict' });

    case 'LengthRequiredError':
      return res.status(411).json({ status: false, message: 'Length Required' });

    case 'PreconditionFailedError':
      return res.status(412).json({ status: false, message: 'Precondition Failed' });

    case 'UnsupportedMediaTypeError':
      return res.status(415).json({ status: false, message: 'Unsupported Media Type' });

    case 'RangeNotSatisfiableError':
      return res.status(416).json({ status: false, message: 'Range Not Satisfiable' });

    case 'ExpectationFailedError':
      return res.status(417).json({ status: false, message: 'Expectation Failed' });

    case 'ValidationError':
    case 'MongoError':
    case 'CastError':
      return res.status(422).json({ status: false, message: 'Validation or MongoDB error', error: err.message });

    case 'TooManyRequestsError':
      return res.status(429).json({ status: false, message: 'Too Many Requests' });

    case 'UnavailableForLegalReasonsError':
      return res.status(451).json({ status: false, message: 'Unavailable For Legal Reasons' });

    case 'InternalServerError':
      return res.status(500).json({ status: false, message: 'Internal Server Error' });

    case 'NotImplementedError':
      return res.status(501).json({ status: false, message: 'Not Implemented' });

    case 'BadGatewayError':
      return res.status(502).json({ status: false, message: 'Bad Gateway' });

    case 'ServiceUnavailableError':
      return res.status(503).json({ status: false, message: 'Service Unavailable' });

    case 'GatewayTimeoutError':
      return res.status(504).json({ status: false, message: 'Gateway Timeout' });

    case 'InsufficientStorageError':
      return res.status(507).json({ status: false, message: 'Insufficient Storage' });

    case 'LoopDetectedError':
      return res.status(508).json({ status: false, message: 'Loop Detected' });

    case 'NotExtendedError':
      return res.status(510).json({ status: false, message: 'Not Extended' });

    case 'NetworkAuthenticationRequiredError':
      return res.status(511).json({ status: false, message: 'Network Authentication Required' });
  }

  // Default fallback
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(statusCode).json({ status: false, message });
};
