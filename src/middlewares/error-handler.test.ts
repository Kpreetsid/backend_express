import { beforeEach, describe, expect, it, vi } from 'vitest';
import multer from 'multer';
import { environment } from '../configDB';
import { applicationLogger } from '../observability/logger';
import { uploadOperationsCounter } from '../observability/metrics';
import { errorMiddleware } from './error-handler';

vi.mock('../observability/logger', () => ({
  applicationLogger: { error: vi.fn(), warn: vi.fn() }
}));
vi.mock('../observability/metrics', () => ({
  uploadOperationsCounter: { inc: vi.fn() }
}));

const makeResponse = () => {
  const response: any = {
    headersSent: false,
    locals: { requestId: 'request-1', correlationId: 'correlation-1' },
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn()
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.end.mockReturnValue(response);
  return response;
};

const request = {
  method: 'POST',
  path: '/api/resource',
  headers: { accountid: 'tenant-1' },
  user: { id: 'user-1' }
} as any;

describe('central API error handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    environment.isProduction = false;
  });

  it('delegates after response headers have already been sent', () => {
    const response = makeResponse();
    response.headersSent = true;
    const next = vi.fn();
    const error = new Error('late failure');

    errorMiddleware(error, request, response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([
    ['BadRequestError', 400, 'Bad Request'],
    ['JsonWebTokenError', 401, 'Invalid token'],
    ['InvalidTokenError', 401, 'Invalid token'],
    ['TokenExpiredError', 401, 'Token expired or unauthorized'],
    ['UnauthorizedError', 401, 'Token expired or unauthorized'],
    ['ForbiddenError', 403, 'Access Forbidden'],
    ['NotFoundError', 404, 'Resource Not Found'],
    ['MethodNotAllowedError', 405, 'Method Not Allowed'],
    ['NotAcceptableError', 406, 'Not Acceptable'],
    ['RequestTimeoutError', 408, 'Request Timeout'],
    ['ConflictError', 409, 'Conflict'],
    ['LengthRequiredError', 411, 'Length Required'],
    ['UnsupportedMediaTypeError', 415, 'Unsupported Media Type'],
    ['RangeNotSatisfiableError', 416, 'Range Not Satisfiable'],
    ['ExpectationFailedError', 417, 'Expectation Failed'],
    ['TooManyRequestsError', 429, 'Too Many Requests'],
    ['UnavailableForLegalReasonsError', 451, 'Unavailable For Legal Reasons'],
    ['InternalServerError', 500, 'Internal Server Error'],
    ['NotImplementedError', 501, 'Not Implemented'],
    ['BadGatewayError', 502, 'Bad Gateway'],
    ['ServiceUnavailableError', 503, 'Service Unavailable'],
    ['GatewayTimeoutError', 504, 'Gateway Timeout'],
    ['InsufficientStorageError', 507, 'Insufficient Storage'],
    ['LoopDetectedError', 508, 'Loop Detected'],
    ['NotExtendedError', 510, 'Not Extended'],
    ['NetworkAuthenticationRequiredError', 511, 'Network Authentication Required'],
    ['ValidationError', 422, 'Validation Error'],
    ['CastError', 400, 'Invalid ID format']
  ])('maps %s without changing the existing response contract', (name, status, message) => {
    const response = makeResponse();
    const error = Object.assign(new Error('detail'), { name });

    errorMiddleware(error, request, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({
      status: false,
      message,
      error: 'detail'
    });
    expect(response.end).toHaveBeenCalledOnce();
    expect(status >= 500 ? applicationLogger.error : applicationLogger.warn)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          tenantId: 'tenant-1',
          userId: 'user-1',
          requestId: 'request-1'
        }),
        status >= 500 ? 'Request failed' : 'Request rejected'
      );
  });

  it('preserves precondition metadata used by ETag clients', () => {
    const response = makeResponse();
    const error = Object.assign(new Error('stale resource'), {
      name: 'PreconditionFailedError',
      data: { currentVersion: 4 }
    });
    errorMiddleware(error, request, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(412);
    expect(response.json).toHaveBeenCalledWith({
      status: false,
      message: 'stale resource',
      error: 'stale resource',
      data: { currentVersion: 4 }
    });
  });

  it('maps duplicate and non-duplicate MongoDB failures safely', () => {
    const duplicateResponse = makeResponse();
    errorMiddleware(Object.assign(new Error('duplicate'), {
      name: 'MongoServerError',
      code: 11000,
      keyValue: { username: 'existing' }
    }), request, duplicateResponse, vi.fn());
    expect(duplicateResponse.status).toHaveBeenCalledWith(409);
    expect(duplicateResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Duplicate value for "username".'
    }));

    const databaseResponse = makeResponse();
    errorMiddleware(Object.assign(new Error('database failure'), {
      name: 'MongoServerError',
      code: 91
    }), request, databaseResponse, vi.fn());
    expect(databaseResponse.status).toHaveBeenCalledWith(500);
    expect(databaseResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'MongoDB Error'
    }));
  });

  it.each([
    ['LIMIT_FILE_SIZE', 'File too large'],
    ['LIMIT_FILE_COUNT', 'Too many files'],
    ['LIMIT_UNEXPECTED_FILE', 'Unexpected file']
  ])('maps legacy upload code %s', (code, message) => {
    const response = makeResponse();
    errorMiddleware(Object.assign(new Error('upload failure'), { code }), request, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      status: false,
      message,
      error: 'upload failure'
    });
  });

  it.each([
    ['LIMIT_FILE_SIZE', 'File too large. Max allowed size is 5MB.'],
    ['LIMIT_FILE_COUNT', 'Too many files uploaded.'],
    ['LIMIT_UNEXPECTED_FILE', 'Unexpected file format.'],
    ['LIMIT_PART_COUNT', 'File upload error']
  ])('maps Multer error %s and increments the upload failure metric', (code, message) => {
    const response = makeResponse();
    const error = new multer.MulterError(code as multer.ErrorCode);
    errorMiddleware(error, request, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      status: false,
      message,
      error: error.message
    });
    expect(uploadOperationsCounter.inc).toHaveBeenCalledWith({ result: 'failure' });
  });

  it('preserves additive data/errors for expected failures and redacts production 5xx details', () => {
    const expectedResponse = makeResponse();
    errorMiddleware(Object.assign(new Error('unprocessable'), {
      status: 422,
      data: { field: 'username' },
      errors: [{ code: 'invalid' }]
    }), request, expectedResponse, vi.fn());
    expect(expectedResponse.json).toHaveBeenCalledWith({
      status: false,
      message: 'unprocessable',
      error: 'unprocessable',
      data: { field: 'username' },
      errors: [{ code: 'invalid' }]
    });

    environment.isProduction = true;
    const productionResponse = makeResponse();
    errorMiddleware(Object.assign(new Error('database password leaked'), { status: 503 }), request, productionResponse, vi.fn());
    expect(productionResponse.json).toHaveBeenCalledWith({
      status: false,
      message: 'Internal Server Error',
      error: 'Internal Server Error'
    });
  });
});
