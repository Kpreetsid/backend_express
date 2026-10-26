const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

export const isStrongPassword = (value: unknown): value is string => {
  return typeof value === 'string' && STRONG_PASSWORD_PATTERN.test(value);
};

export const assertStrongPassword = (value: unknown): void => {
  if (!isStrongPassword(value)) {
    throw Object.assign(
      new Error('Password must be at least 8 characters and include uppercase, lowercase, number and special character.'),
      { status: 400 }
    );
  }
};
