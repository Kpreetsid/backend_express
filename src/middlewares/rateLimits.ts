import rateLimit from 'express-rate-limit';

class RateLimiterService {
  public readonly globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many requests, please try again later.',
    },
  });

  public readonly authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
    skipSuccessfulRequests: false,
  });

  public readonly uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      message: 'Too many upload requests. Please slow down.',
    },
  });
}

export const rateLimiter = new RateLimiterService();