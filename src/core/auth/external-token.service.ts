import crypto from 'crypto';
import { auth } from '../config/env.config';

const getKey = (): Buffer => {
  if (!auth.external_secret) {
    throw Object.assign(new Error('External authentication secret is not configured'), { status: 500 });
  }
  return crypto.createHash('sha256').update(auth.external_secret).digest();
};

export const generateExternalAccessToken = (body: Record<string, unknown>, ttlSeconds: number = 300): string => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...body, iat: now, exp: now + ttlSeconds };
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: tag.toString('base64')
  })).toString('base64');
};

export const encryptToken = (email: string, ttlSeconds: number = 300): string => {
  return generateExternalAccessToken({ email }, ttlSeconds);
};

export const decryptToken = (token: string): any => {
  try {
    const key = getKey();
    const decodedJson = Buffer.from(token, 'base64').toString('utf8');
    const decoded = JSON.parse(decodedJson);
    const iv = Buffer.from(decoded.iv, 'base64');
    const ct = Buffer.from(decoded.ct, 'base64');
    const tag = Buffer.from(decoded.tag, 'base64');
    if (iv.length !== 12 || tag.length !== 16 || !ct.length) {
      throw new Error('Invalid encrypted token structure');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid or corrupted external token'), { status: 401, name: 'InvalidTokenError' });
  }
};
