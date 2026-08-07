import fs from 'fs';
import { NextFunction, Request, Response } from 'express';
import { payloadCryptoService, PayloadCryptoKeyRecord } from '../_config/payloadCrypto';

const ENCRYPTION_HEADER = 'x-cmms-payload-encrypted';
const KEY_ID_HEADER = 'x-cmms-crypto-key-id';
const TIMESTAMP_HEADER = 'x-cmms-crypto-timestamp';
const NONCE_HEADER = 'x-cmms-crypto-nonce';
const ENCRYPT_REQUEST_HEADER = 'x-cmms-crypto-encrypt-request';
const ENCRYPT_RESPONSE_HEADER = 'x-cmms-crypto-encrypt-response';
const FORM_FIELDS_KEY = '__cmms_crypto_fields';

interface PayloadCryptoContext {
  encryptedRequest: boolean;
  requestBodyEncrypted: boolean;
  keyRecord: PayloadCryptoKeyRecord;
  timestamp: string;
  nonce: string;
}

export const payloadCryptoRequestMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!payloadCryptoService.isEnabled()) {
      next();
      return;
    }

    const encryptedHeader = String(req.headers[ENCRYPTION_HEADER] || '');
    const bodyEnvelope = payloadCryptoService.isEnvelope(req.body) ? req.body : null;
    const requestBodyEncryptionEnabled = readBooleanHeader(req, ENCRYPT_REQUEST_HEADER, true);
    const responseEncryptionEnabled = readBooleanHeader(req, ENCRYPT_RESPONSE_HEADER, true);
    const hasCryptoHeaders = !!req.headers[KEY_ID_HEADER] && !!req.headers[TIMESTAMP_HEADER] && !!req.headers[NONCE_HEADER];
    const hasEncryptedRequest = encryptedHeader === 'v1' || !!bodyEnvelope;
    const hasCryptoContext = hasEncryptedRequest || (hasCryptoHeaders && responseEncryptionEnabled);

    if (!hasCryptoContext) {
      if (payloadCryptoService.isStrictMode() && shouldRequireEncryption(req)) {
        throw Object.assign(new Error('Encrypted payload required'), { status: 400, name: 'BadRequestError' });
      }
      next();
      return;
    }

    if (payloadCryptoService.isStrictMode() && shouldRequireEncryption(req) && requestBodyEncryptionEnabled && !hasEncryptedRequest) {
      throw Object.assign(new Error('Encrypted payload required'), { status: 400, name: 'BadRequestError' });
    }

    if (!payloadCryptoService.canDecryptRequests() && requestBodyEncryptionEnabled && hasEncryptedRequest) {
      throw Object.assign(new Error('Encrypted payload support is disabled on this server'), { status: 400, name: 'BadRequestError' });
    }

    const keyId = String(req.headers[KEY_ID_HEADER] || bodyEnvelope?.kid || '');
    const keyRecord = payloadCryptoService.getKeyRecord(keyId);
    const replay = await payloadCryptoService.validateReplay(
      keyRecord,
      req.headers[TIMESTAMP_HEADER],
      req.headers[NONCE_HEADER]
    );
    const context: PayloadCryptoContext = {
      encryptedRequest: hasCryptoContext,
      requestBodyEncrypted: requestBodyEncryptionEnabled && hasEncryptedRequest,
      keyRecord,
      timestamp: replay.timestamp,
      nonce: replay.nonce
    };
    (req as any).payloadCrypto = context;

    if (bodyEnvelope && context.requestBodyEncrypted) {
      req.body = payloadCryptoService.decryptJson(
        bodyEnvelope,
        keyRecord,
        payloadCryptoService.buildAad(req, keyRecord, replay.timestamp, replay.nonce)
      ) as any;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const payloadCryptoMultipartMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const context = (req as any).payloadCrypto as PayloadCryptoContext | undefined;
    if (!context?.encryptedRequest || !context.requestBodyEncrypted) {
      next();
      return;
    }

    const aad = payloadCryptoService.buildAad(req, context.keyRecord, context.timestamp, context.nonce);
    const encryptedFields = (req.body || {})[FORM_FIELDS_KEY];
    if (encryptedFields) {
      const fieldEnvelope = typeof encryptedFields === 'string' ? JSON.parse(encryptedFields) : encryptedFields;
      const decryptedFields = payloadCryptoService.decryptJson(fieldEnvelope, context.keyRecord, aad);
      req.body = {
        ...(req.body || {}),
        ...(decryptedFields && typeof decryptedFields === 'object' ? decryptedFields : {})
      };
      delete (req.body as any)[FORM_FIELDS_KEY];
    }

    const files = normalizeFiles(req);
    for (const file of files) {
      const encryptedBuffer = file.buffer || fs.readFileSync(file.path);
      const fileEnvelope = JSON.parse(encryptedBuffer.toString('utf8'));
      const decryptedBuffer = payloadCryptoService.decryptBytes(fileEnvelope, context.keyRecord, aad);
      if (file.path) {
        fs.writeFileSync(file.path, decryptedBuffer);
      }
      file.buffer = decryptedBuffer;
      file.size = decryptedBuffer.length;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const payloadCryptoResponseMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = ((body?: any): Response => {
      const preparedBody = prepareResponseBody(req, res, body);
      return originalJson(preparedBody);
    }) as any;

    res.send = ((body?: any): Response => {
      const context = (req as any).payloadCrypto as PayloadCryptoContext | undefined;
      if (!shouldEncryptResponse(req, res, context)) {
        return originalSend(body);
      }

      if (Buffer.isBuffer(body)) {
        const wrapped = {
          __binary: true,
          contentType: String(res.getHeader('Content-Type') || 'application/octet-stream'),
          data: body.toString('base64')
        };
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return originalJson(encryptResponseValue(req, res, wrapped, context!));
      }

      const preparedBody = prepareResponseBody(req, res, body);
      return originalJson(preparedBody);
    }) as any;

    next();
  };
};

function prepareResponseBody(req: Request, res: Response, body: any): any {
  const withSession = attachPayloadCryptoSessionIfNeeded(req, body);
  const context = (req as any).payloadCrypto as PayloadCryptoContext | undefined;
  if (!shouldEncryptResponse(req, res, context)) {
    return withSession;
  }
  return encryptResponseValue(req, res, withSession, context!);
}

function encryptResponseValue(req: Request, res: Response, body: any, context: PayloadCryptoContext): any {
  const responseTimestamp = Date.now().toString();
  const responseNonce = randomNonce();
  const aad = payloadCryptoService.buildAad(req, context.keyRecord, responseTimestamp, responseNonce, true);
  const envelope = payloadCryptoService.encryptJson(body, context.keyRecord, aad);

  res.setHeader('X-CMMS-Payload-Encrypted', 'v1');
  res.setHeader('X-CMMS-Crypto-Key-Id', context.keyRecord.keyId);
  res.setHeader('X-CMMS-Crypto-Timestamp', responseTimestamp);
  res.setHeader('X-CMMS-Crypto-Nonce', responseNonce);
  return envelope;
}

function attachPayloadCryptoSessionIfNeeded(_req: Request, body: any): any {
  if (!payloadCryptoService.isEnabled() || !body?.status || !body?.data?.token || body.data.payloadCrypto) {
    return body;
  }

  const userDetails = body.data.userDetails || {};
  const userId = String(userDetails._id || userDetails.id || body.data.user_id || '');
  const accountId = String(userDetails.account_id || body.data.org_id || '');
  if (!userId || !accountId) {
    return body;
  }

  const tokenId = body.data.token_id ? String(body.data.token_id) : '';
  return {
    ...body,
    data: {
      ...body.data,
      payloadCrypto: payloadCryptoService.createAuthenticatedSession({
        token: String(body.data.token),
        ...(tokenId ? { tokenId } : {}),
        userId,
        accountId
      })
    }
  };
}

function shouldEncryptResponse(_req: Request, res: Response, context?: PayloadCryptoContext): boolean {
  if (res.getHeader('X-CMMS-Payload-Encrypted') === 'v1') {
    return false;
  }
  return payloadCryptoService.canEncryptResponses()
    && readBooleanHeader(_req, ENCRYPT_RESPONSE_HEADER, true)
    && !!context
    && (context.encryptedRequest || payloadCryptoService.isStrictMode());
}

function readBooleanHeader(req: Request, headerName: string, defaultValue: boolean): boolean {
  const value = req.headers[headerName];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const firstValue = Array.isArray(value) ? value[0] : value;
  return String(firstValue).toLowerCase() !== 'false';
}

function shouldRequireEncryption(req: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    return false;
  }
  return req.path.includes('/api/');
}

function normalizeFiles(req: Request): any[] {
  const files = (req as any).files;
  if (Array.isArray(files)) {
    return files;
  }
  if (files && typeof files === 'object') {
    return Object.values(files).flat() as any[];
  }
  return (req as any).file ? [(req as any).file] : [];
}

function randomNonce(): string {
  return Buffer.from(`${Date.now()}:${Math.random()}:${process.hrtime.bigint().toString()}`).toString('base64url');
}

export { FORM_FIELDS_KEY };
