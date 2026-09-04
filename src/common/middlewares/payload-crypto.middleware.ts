import fs from 'fs';
import { NextFunction, Request, Response } from 'express';
import { payloadCryptoService, PayloadCryptoKeyRecord } from '../utils/crypto.helper';

const ENCRYPTION_HEADER = 'x-cmms-payload-encrypted';
const KEY_ID_HEADER = 'x-cmms-crypto-key-id';
const TIMESTAMP_HEADER = 'x-cmms-crypto-timestamp';
const NONCE_HEADER = 'x-cmms-crypto-nonce';
const FORM_FIELDS_KEY = '__cmms_crypto_fields';

export interface PayloadCryptoContext {
  encryptedRequest: boolean;
  requestBodyEncrypted: boolean;
  responseEncryptionEnabled: boolean;
  keyRecord: PayloadCryptoKeyRecord;
  timestamp: string;
  nonce: string;
}

export const payloadCryptoRequestMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const bodyEnvelope = payloadCryptoService.isEnvelope(req.body) ? req.body : null;

    if (bodyEnvelope) {
      if (!payloadCryptoService.canDecryptRequests()) {
        throw Object.assign(new Error('Encrypted payload support is disabled on this server'), { status: 400, name: 'BadRequestError' });
      }

      const keyId = String(req.headers[KEY_ID_HEADER] || bodyEnvelope.kid || '');
      const keyRecord = payloadCryptoService.getKeyRecord(keyId);
      const replay = payloadCryptoService.validateReplay(
        keyRecord,
        req.headers[TIMESTAMP_HEADER],
        req.headers[NONCE_HEADER]
      );

      const context: PayloadCryptoContext = {
        encryptedRequest: true,
        requestBodyEncrypted: true,
        responseEncryptionEnabled: payloadCryptoService.canEncryptResponses(),
        keyRecord,
        timestamp: replay.timestamp,
        nonce: replay.nonce
      };
      (req as any).payloadCrypto = context;

      const aad = payloadCryptoService.buildAad(req, keyRecord, replay.timestamp, replay.nonce);
      req.body = payloadCryptoService.decryptJson(bodyEnvelope, keyRecord, aad) as any;
      next();
      return;
    }

    // Request body is not encrypted (plain request)
    // If response encryption is enabled, check if key is available from header for response encryption
    if (payloadCryptoService.canEncryptResponses()) {
      const keyId = String(req.headers[KEY_ID_HEADER] || '');
      const keyRecord = keyId ? payloadCryptoService.findKeyRecord(keyId) : null;
      if (keyRecord) {
        const replay = (req.headers[TIMESTAMP_HEADER] && req.headers[NONCE_HEADER])
          ? payloadCryptoService.validateReplay(keyRecord, req.headers[TIMESTAMP_HEADER], req.headers[NONCE_HEADER])
          : { timestamp: '', nonce: '' };

        (req as any).payloadCrypto = {
          encryptedRequest: false,
          requestBodyEncrypted: false,
          responseEncryptionEnabled: true,
          keyRecord,
          timestamp: replay.timestamp,
          nonce: replay.nonce
        };
      }
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
  let context = (req as any).payloadCrypto as PayloadCryptoContext | undefined;
  if (!context && payloadCryptoService.canEncryptResponses()) {
    const keyId = String(req.headers[KEY_ID_HEADER] || '');
    const user = (req as any).user;
    const authHeader = req.headers.authorization ? String(req.headers.authorization) : '';
    const token = (req as any).token || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
    const keyRecord = keyId
      ? payloadCryptoService.findKeyRecord(keyId)
      : payloadCryptoService.findSessionKey({
        token,
        userId: user?._id?.toString() || user?.id?.toString()
      });

    if (keyRecord) {
      context = {
        encryptedRequest: false,
        requestBodyEncrypted: false,
        responseEncryptionEnabled: true,
        keyRecord,
        timestamp: '',
        nonce: ''
      };
      (req as any).payloadCrypto = context;
    }
  }

  const withSession = attachPayloadCryptoSessionIfNeeded(req, body);
  if (!shouldEncryptResponse(req, res, context, withSession)) {
    return withSession;
  }
  return encryptResponseValue(req, res, withSession, context!);
}

function encryptResponseValue(req: Request, res: Response, body: any, context: PayloadCryptoContext): any {
  const responseTimestamp = Date.now().toString();
  const responseNonce = randomNonce();
  const aad = payloadCryptoService.buildAad(req, context.keyRecord, context.timestamp || responseTimestamp, context.nonce || responseNonce, true);
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

  return {
    ...body,
    data: {
      ...body.data,
      payloadCrypto: payloadCryptoService.createAuthenticatedSession({
        token: String(body.data.token),
        tokenId: body.data.token_id ? String(body.data.token_id) : undefined,
        userId,
        accountId
      })
    }
  };
}

function shouldEncryptResponse(_req: Request, res: Response, context?: PayloadCryptoContext, _body?: any): boolean {
  if (res.getHeader('X-CMMS-Payload-Encrypted') === 'v1') {
    return false;
  }
  if (!payloadCryptoService.canEncryptResponses()) {
    return false;
  }
  const activeContext = context || (_req as any).payloadCrypto;
  return !!activeContext?.keyRecord;
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

export { FORM_FIELDS_KEY, ENCRYPTION_HEADER, KEY_ID_HEADER, TIMESTAMP_HEADER, NONCE_HEADER };
