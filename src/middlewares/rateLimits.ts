import rateLimit from 'express-rate-limit';

class RateLimiterService {
  public readonly twoStepVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    limit: 50, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: { 
      status: false, 
      code: 'TWO_STEP_RATE_LIMITED', 
      message: 'Too many verification attempts. Please try later.' 
    }
  });

  public readonly twoStepSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    limit: 20, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: { 
      status: false, 
      code: 'TWO_STEP_RATE_LIMITED', 
      message: 'Too many verification requests. Please try later.' 
    }
  });

  public readonly globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'GLOBAL_RATE_LIMITED',
      message: 'Too many requests, please try after some time.',
    },
  });

  public readonly authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many authentication attempts. please try after some time.',
    },
    skipSuccessfulRequests: false,
  });

  public readonly uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'UPLOAD_RATE_LIMITED',
      message: 'Too many upload requests. please try after some time.',
    },
  });

  public readonly otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'OTP_RATE_LIMITED',
      message: 'Too many otp requests. please try after some time.',
    },
  });

  public readonly otpValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'OTP_VALIDATE_RATE_LIMITED',
      message: 'Too many otp validate requests. please try after some time.',
    },
  });

  public readonly emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'EMAIL_RATE_LIMITED',
      message: 'Too many email requests. please try after some time.',
    },
  });

  public readonly notificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'NOTIFICATION_RATE_LIMITED',
      message: 'Too many notification requests. please try after some time.',
    },
  });

  public readonly passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'PASSWORD_RESET_RATE_LIMITED',
      message: 'Too many password reset requests. please try after some time.',
    },
  });

  public readonly passwordResetValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'PASSWORD_RESET_VALIDATE_RATE_LIMITED',
      message: 'Too many password reset validate requests. please try after some time.',
    },
  });

  public readonly unauthorizedRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 75,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'UNAUTHORIZED_REQUEST_RATE_LIMITED',
      message: 'Too many unauthorized requests. please try after some time.',
    },
  });

  public readonly reportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'REPORT_RATE_LIMITED',
      message: 'Too many report requests. please try after some time.',
    },
  });

  public readonly searchLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: false,
      code: 'SEARCH_RATE_LIMITED',
      message: 'Too many search requests. please try after some time.',
    },
  });
}

export const rateLimiter = new RateLimiterService();