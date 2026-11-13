import { Request } from 'express';
import { hasSanitizedBodyKeys } from '../middlewares/mongo-sanitize.middleware';

export interface ProfilePhone {
  number: string;
  internationalNumber: string;
  nationalNumber: string;
  e164Number: string;
  countryCode: string;
  dialCode: string;
}

export function profileError(message: string, status = 400): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

export function profilePrincipal(req: Request): { _id: string; account_id: string; user_role?: string } {
  const user = (req as Request & { user?: { _id?: unknown; account_id?: unknown; user_role?: string } }).user;
  const id = String(user?._id || '');
  const accountId = String(user?.account_id || '');
  if (!/^[a-f0-9]{24}$/i.test(id) || !/^[a-f0-9]{24}$/i.test(accountId)) throw profileError('Unauthorized', 401);
  return { _id: id, account_id: accountId, user_role: user?.user_role };
}

export function profileBody(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length === 0 || Object.keys(value).some(key => !allowed.includes(key))) {
    throw profileError('Invalid profile fields');
  }
  return value as Record<string, unknown>;
}

export function profileRequestBody(req: Request, allowed: string[]): Record<string, unknown> {
  if (hasSanitizedBodyKeys(req)) throw profileError('Invalid profile fields');
  return profileBody(req.body, allowed);
}

export function profileText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string') throw profileError(`${label} must be text`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw profileError(`${label} must contain ${min}–${max} characters`);
  }
  return normalized;
}

/** Structural consistency only; the existing UI phone library validates regional rules. */
export function profilePhone(value: unknown): ProfilePhone {
  const fields = ['number', 'internationalNumber', 'nationalNumber', 'e164Number', 'countryCode', 'dialCode'];
  const body = profileBody(value, fields);
  if (fields.some(field => typeof body[field] !== 'string' || !(body[field] as string).trim() || (body[field] as string).length > 100)) {
    throw profileError('A complete international phone number is required');
  }
  const phone = Object.fromEntries(fields.map(field => [field, (body[field] as string).trim()])) as unknown as ProfilePhone;
  phone.countryCode = phone.countryCode.toUpperCase();
  if (!/^\+[1-9]\d{6,14}$/.test(phone.e164Number) || !/^\+[1-9]\d{0,2}$/.test(phone.dialCode)
    || !/^[A-Z]{2}$/.test(phone.countryCode) || !phone.e164Number.startsWith(phone.dialCode)) {
    throw profileError('Invalid international phone metadata');
  }
  const internationalDigits = phone.e164Number.slice(1);
  const nationalDigits = phone.e164Number.slice(phone.dialCode.length);
  const digits = (text: string): string => text.replace(/\D/g, '');
  const nationalMatches = (text: string): boolean => digits(text) === nationalDigits || digits(text) === `0${nationalDigits}`;
  if (!nationalDigits || !/^\+[\d ().-]+$/.test(phone.internationalNumber)
    || !/^[\d ().-]+$/.test(phone.nationalNumber) || !/^\+?[\d ().-]+$/.test(phone.number)
    || digits(phone.internationalNumber) !== internationalDigits || !nationalMatches(phone.nationalNumber)
    || (digits(phone.number) !== internationalDigits && !nationalMatches(phone.number))) {
    throw profileError('Phone metadata does not match its E.164 number');
  }
  return phone;
}

export function profilePersistenceError(error: unknown, entity: 'user' | 'account'): Error {
  const detail = error as { code?: number; name?: string; status?: number } | null;
  if (detail?.code === 11000 && entity === 'account') return profileError('That account name already exists', 409);
  if (detail?.name === 'ValidationError' || detail?.name === 'CastError') return profileError('Invalid profile values');
  return profileError(`Unable to save ${entity} profile`, 500);
}
