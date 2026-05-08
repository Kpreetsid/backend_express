import rateLimit from 'express-rate-limit';

class RateLimiterService {
  public readonly globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many requests, please try after some time.',
    },
  });

  public readonly authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many authentication attempts. please try after some time.',
    },
    skipSuccessfulRequests: false,
  });

  public readonly uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many upload requests. please try after some time.',
    },
  });

  public readonly otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many otp requests. please try after some time.',
    },
  });

  public readonly otpValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many otp validate requests. please try after some time.',
    },
  });

  public readonly emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many email requests. please try after some time.',
    },
  });

  public readonly notificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many notification requests. please try after some time.',
    },
  });

  public readonly passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many password reset requests. please try after some time.',
    },
  });

  public readonly passwordResetValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many password reset validate requests. please try after some time.',
    },
  });

  public readonly unauthorizedRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many unauthorized requests. please try after some time.',
    },
  });

  public readonly reportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many report requests. please try after some time.',
    },
  });

  public readonly searchLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many search requests. please try after some time.',
    },
  });
}

export const rateLimiter = new RateLimiterService();