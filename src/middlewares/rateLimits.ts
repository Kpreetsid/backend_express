import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisConfig } from '../configDB';
import { getRedisClient } from '../_config/redis';
import { redisKeys } from '../_config/redis-keys';

const createStore = (scope: string): RedisStore | undefined => {
  if (!redisConfig.enabled) return undefined;
  return new RedisStore({
    prefix: redisKeys.rateLimitPrefix(scope),
    sendCommand: async (...args: string[]) => {
      const client = getRedisClient();
      if (!client?.isReady) throw new Error('Redis rate-limit store is unavailable');
      return client.sendCommand(args);
    }
  });
};

const createLimiter = (
  scope: string,
  max: number,
  message: string,
  windowMs = 15 * 60 * 1000
): RateLimitRequestHandler => {
  const store = createStore(scope);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: false, message },
    ...(store ? { store } : {})
  });
};

class RateLimiterService {
  public readonly globalLimiter = createLimiter(
    'global',
    3000,
    'Too many requests, please try after some time.'
  );
  public readonly authLimiter = createLimiter(
    'auth',
    300,
    'Too many authentication attempts. please try after some time.'
  );
  public readonly uploadLimiter = createLimiter(
    'upload',
    75,
    'Too many upload requests. please try after some time.'
  );
  public readonly otpLimiter = createLimiter(
    'otp',
    75,
    'Too many otp requests. please try after some time.'
  );
  public readonly otpValidateLimiter = createLimiter(
    'otp-validate',
    75,
    'Too many otp validate requests. please try after some time.'
  );
  public readonly emailLimiter = createLimiter(
    'email',
    75,
    'Too many email requests. please try after some time.'
  );
  public readonly notificationLimiter = createLimiter(
    'notification',
    75,
    'Too many notification requests. please try after some time.'
  );
  public readonly passwordResetLimiter = createLimiter(
    'password-reset',
    75,
    'Too many password reset requests. please try after some time.'
  );
  public readonly passwordResetValidateLimiter = createLimiter(
    'password-reset-validate',
    75,
    'Too many password reset validate requests. please try after some time.'
  );
  public readonly unauthorizedRequestLimiter = createLimiter(
    'unauthorized',
    75,
    'Too many unauthorized requests. please try after some time.'
  );
  public readonly reportLimiter = createLimiter(
    'report',
    150,
    'Too many report requests. please try after some time.'
  );
  public readonly searchLimiter = createLimiter(
    'search',
    180,
    'Too many search requests. please try after some time.',
    60 * 1000
  );
}

export const rateLimiter = new RateLimiterService();
