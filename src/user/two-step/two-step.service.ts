import crypto from 'node:crypto';
import { failure } from '../../common/middlewares';
import { AccountModel } from '../../modules/company/models/account.model';
import { UserModel } from '../../modules/users/models/user.model';
import { twoStepMailer } from './two-step.mail';
import { TwoStepStore, TwoStepRecord, twoStepStore } from './two-step.model';

const EXPIRY = 5 * 60_000;
const COOLDOWN = 60_000;
const WINDOW = 15 * 60_000;
const RETENTION = 24 * 60 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
type ResponseMode = 'login' | 'authenticate';

const invalid = () => failure(410, 'TWO_STEP_INVALID', 'Verification is invalid or expired. Please sign in again.');
const malformed = () => failure(400, 'TWO_STEP_MALFORMED', 'A valid challenge and four-digit code are required.');
const limited = () => failure(429, 'TWO_STEP_RATE_LIMITED', 'Please wait before requesting another verification code.');
const unavailable = () => failure(503, 'TWO_STEP_UNAVAILABLE', 'Login verification is temporarily unavailable. Please try again later.');
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const id = (value: any): string => String(value?._id ?? value ?? '');
const validId = (value: string) => /^[a-f\d]{24}$/i.test(value);
const equalDigest = (left: string | null, right: string) => typeof left === 'string' && /^[a-f\d]{64}$/.test(left)
  && crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));

export interface TwoStepDependencies {
  store: TwoStepStore;
  now: () => number;
  secret: () => string | undefined;
  randomCode: () => string;
  loadUser: (userId: string, accountId: string) => Promise<any>;
  loadAccount: (accountId: string) => Promise<any>;
  send: (email: string, code: string) => Promise<void>;
}

export function createTwoStepService(deps: TwoStepDependencies) {
  function secret(): string {
    const key = deps.secret();
    if (typeof key !== 'string' || Buffer.byteLength(key, 'utf8') < 32) throw unavailable();
    return key;
  }
  function hmac(key: string, purpose: string, values: unknown[]) {
    return crypto.createHmac('sha256', key).update(JSON.stringify([purpose, ...values])).digest('hex');
  }
  function credential(key: string, user: any, accountId: string) {
    return hmac(key, 'two-step-credential-v1', [id(user), accountId, user.password, user.email]);
  }
  function codeDigest(key: string, record: TwoStepRecord, token: string, code: string) {
    return hmac(key, 'two-step-code-v1', [record.accountId, record.userId, token, code]);
  }
  function identity(user: any, account: any) {
    if (!user || !account || !validId(id(user)) || !validId(id(account)) || id(user.account_id) !== id(account)
      || user.user_status !== 'active' || user.isVerified !== true || account.account_status !== 'active'
      || account.visible !== true || account.two_step_auth_enabled !== true
      || typeof user.password !== 'string' || !user.password
      || typeof user.email !== 'string' || user.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
      || !Number.isSafeInteger(account.two_step_auth_revision ?? 0) || (account.two_step_auth_revision ?? 0) < 0) throw invalid();
  }
  async function current(record: TwoStepRecord, key: string) {
    const [user, account] = await Promise.all([
      deps.loadUser(record.userId, record.accountId), deps.loadAccount(record.accountId)
    ]);
    identity(user, account);
    if (id(user) !== record.userId || id(account) !== record.accountId
      || (account.two_step_auth_revision ?? 0) !== record.policyRevision
      || !equalDigest(record.credentialDigest, credential(key, user, record.accountId))) throw invalid();
    return { user, account };
  }
  function tokenDigest(token: unknown): { token: string; digest: string } {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw malformed();
    return { token, digest: hash(token) };
  }
  function live(record: TwoStepRecord | null, now: number): asserts record is TwoStepRecord {
    if (!record || record.deliveryState !== 'ready' || record.consumedAt !== null
      || +record.expiresAt <= now || record.attempts >= MAX_ATTEMPTS || +record.lockedUntil > now) throw invalid();
  }
  function liveFilter(record: TwoStepRecord, now: number) {
    return { _id: record._id, version: record.version, challengeDigest: record.challengeDigest,
      deliveryState: 'ready', consumedAt: null, expiresAt: { $gt: new Date(now) },
      attempts: { $lt: MAX_ATTEMPTS }, lockedUntil: { $lte: new Date(now) } };
  }
  function empty(user: any, account: any, now: number): TwoStepRecord {
    return { _id: hash(JSON.stringify(['two-step-principal-v1', id(account), id(user)])),
      version: 0, userId: id(user), accountId: id(account), challengeDigest: null,
      codeDigest: null, credentialDigest: null, policyRevision: 0, responseMode: 'login', sessionStartedAt: now,
      expiresAt: new Date(0), attempts: 0, attemptWindowStartedAt: new Date(now), consumedAt: null,
      deliveryState: 'invalid', nextSendAt: new Date(0), sendTimes: [], lockedUntil: new Date(0), purgeAt: new Date(now + RETENTION) };
  }

  async function deliver(record: TwoStepRecord, token: string, code: string) {
    try {
      const identitySnapshot = await current(record, secret());
      await deps.send(identitySnapshot.user.email, code);
    } catch {
      const latest = await deps.store.read({ _id: record._id, challengeDigest: record.challengeDigest });
      if (latest?.deliveryState === 'pending') await deps.store.compareAndSet(
        { _id: record._id, version: latest.version, challengeDigest: record.challengeDigest, deliveryState: 'pending' },
        { ...latest, version: latest.version + 1, deliveryState: 'invalid', codeDigest: null });
      throw unavailable();
    }
    const now = deps.now();
    const activated = now < +record.expiresAt && await deps.store.compareAndSet(
      { _id: record._id, version: record.version, challengeDigest: record.challengeDigest, deliveryState: 'pending',
        expiresAt: { $gt: new Date(now) } },
      { ...record, version: record.version + 1, deliveryState: 'ready' });
    if (!activated) throw invalid();
    return { twoStepRequired: true as const, challengeToken: token,
      expiresAt: record.expiresAt, resendAvailableAt: record.nextSendAt };
  }

  async function reserve(record: TwoStepRecord, user: any, account: any, mode: ResponseMode, sessionStartedAt: number,
    key: string, resend: boolean) {
    const now = deps.now();
    if (+record.lockedUntil > now || +record.nextSendAt > now
      || (record.deliveryState === 'pending' && +record.expiresAt > now)) throw limited();
    const sendTimes = record.sendTimes.filter(time => +time > now - WINDOW);
    if (sendTimes.length >= MAX_SENDS) throw limited();
    const token = crypto.randomBytes(32).toString('base64url');
    const code = deps.randomCode();
    if (!/^\d{4}$/.test(code)) throw unavailable();
    // Guess budgets survive both resends and fresh password submissions.
    const resetAttempts = !resend && now >= +record.attemptWindowStartedAt + WINDOW;
    const next: TwoStepRecord = { ...record, version: record.version + 1, challengeDigest: hash(token),
      credentialDigest: credential(key, user, id(account)), policyRevision: account.two_step_auth_revision ?? 0,
      responseMode: mode, sessionStartedAt, expiresAt: new Date(now + EXPIRY),
      attempts: resetAttempts ? 0 : record.attempts,
      attemptWindowStartedAt: resetAttempts ? new Date(now) : record.attemptWindowStartedAt,
      consumedAt: null, deliveryState: 'pending', nextSendAt: new Date(now + COOLDOWN),
      sendTimes: [...sendTimes, new Date(now)], purgeAt: new Date(Math.max(now + RETENTION, +record.lockedUntil + RETENTION)) };
    next.codeDigest = codeDigest(key, next, token, code);
    const filter = resend ? liveFilter(record, now) : { _id: record._id, version: record.version };
    if (!await deps.store.compareAndSet(filter, next)) return null;
    return { next, token, code };
  }

  return {
    async issue(user: any, account: any, responseMode: ResponseMode, sessionStartedAt: number) {
      const key = secret(); identity(user, account);
      if (!['login', 'authenticate'].includes(responseMode) || !Number.isSafeInteger(sessionStartedAt)
        || sessionStartedAt > deps.now() || sessionStartedAt < 0) throw malformed();
      const initial = empty(user, account, deps.now());
      await deps.store.initialize(initial);
      for (let retry = 0; retry < 30; retry++) {
        const record = await deps.store.read({ _id: initial._id });
        if (!record) throw unavailable();
        const generation = await reserve(record, user, account, responseMode, sessionStartedAt, key, false);
        if (generation) return deliver(generation.next, generation.token, generation.code);
      }
      throw limited();
    },
    async resend(token: unknown) {
      const key = secret(); const parsed = tokenDigest(token);
      for (let retry = 0; retry < 30; retry++) {
        const record = await deps.store.read({ challengeDigest: parsed.digest });
        live(record, deps.now());
        const { user, account } = await current(record, key);
        live(record, deps.now());
        const generation = await reserve(record, user, account, record.responseMode, record.sessionStartedAt, key, true);
        if (generation) return deliver(generation.next, generation.token, generation.code);
      }
      throw limited();
    },
    async consume(token: unknown, code: unknown) {
      const key = secret(); const parsed = tokenDigest(token);
      if (typeof code !== 'string' || !/^\d{4}$/.test(code)) throw malformed();
      for (let retry = 0; retry < 30; retry++) {
        const record = await deps.store.read({ challengeDigest: parsed.digest });
        live(record, deps.now());
        await current(record, key);
        const now = deps.now(); live(record, now);
        const correct = equalDigest(record.codeDigest, codeDigest(key, record, parsed.token, code));
        const attempts = record.attempts + (correct ? 0 : 1);
        const exhausted = attempts >= MAX_ATTEMPTS;
        const next: TwoStepRecord = { ...record, version: record.version + 1, attempts,
          consumedAt: correct ? new Date(now) : null,
          deliveryState: correct ? 'consumed' : exhausted ? 'invalid' : 'ready',
          lockedUntil: exhausted ? new Date(now + WINDOW) : record.lockedUntil,
          codeDigest: correct || exhausted ? null : record.codeDigest,
          purgeAt: new Date(now + RETENTION) };
        if (!await deps.store.compareAndSet(liveFilter(record, now), next)) continue;
        if (correct) {
          // Identity changes while MongoDB commits must not create a new session.
          // The code remains spent even if this final check rejects the login.
          const { user, account } = await current(next, key);
          return { user, account, responseMode: record.responseMode, sessionStartedAt: record.sessionStartedAt };
        }
        if (exhausted) throw invalid();
        throw failure(400, 'TWO_STEP_CODE_INVALID', 'The verification code is incorrect. Please try again.');
      }
      throw invalid();
    }
  };
}

export const twoStepService = createTwoStepService({
  store: twoStepStore, now: Date.now, secret: () => process.env.TWO_STEP_AUTH_SECRET,
  randomCode: () => String(crypto.randomInt(0, 10000)).padStart(4, '0'),
  loadUser: (userId, accountId) => UserModel.findOne({ _id: userId, account_id: accountId }).select('+password').lean().exec(),
  loadAccount: accountId => AccountModel.findById(accountId).lean().exec(),
  send: (email, code) => twoStepMailer.send(email, code)
});
