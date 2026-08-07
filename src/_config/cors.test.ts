import { beforeEach, describe, expect, it, vi } from 'vitest';
import { corsConfig } from '../configDB';
import { corsOptions, getAllowedOrigins, isOriginAllowed } from './cors';

describe('CORS policy', () => {
  beforeEach(() => {
    corsConfig.allowedOrigins = [];
    corsConfig.allowDevelopmentLocalhost = false;
  });

  it('retains compatibility origins and de-duplicates configured values', () => {
    corsConfig.allowedOrigins = [
      'https://tenant.example.test',
      'https://app.presageinsights.ai'
    ];

    expect(getAllowedOrigins()).toEqual([
      'https://tenant.example.test',
      'https://app.presageinsights.ai',
      'http://localhost:4200',
      'https://new.presageinsights.ai'
    ]);
  });

  it('allows server-to-server requests, allowlisted origins, and development localhost only', () => {
    corsConfig.allowedOrigins = ['https://tenant.example.test'];
    expect(isOriginAllowed()).toBe(true);
    expect(isOriginAllowed('https://tenant.example.test')).toBe(true);
    expect(isOriginAllowed('http://localhost:4300')).toBe(false);

    corsConfig.allowDevelopmentLocalhost = true;
    expect(isOriginAllowed('http://localhost:4300')).toBe(true);
    expect(isOriginAllowed('https://127.0.0.1')).toBe(true);
    expect(isOriginAllowed('https://localhost.attacker.test')).toBe(false);
  });

  it('calls the CORS callback with an allow decision or a safe denial', () => {
    corsConfig.allowedOrigins = ['https://tenant.example.test'];
    const allow = vi.fn();
    const deny = vi.fn();

    expect(typeof corsOptions.origin).toBe('function');
    (corsOptions.origin as Function)('https://tenant.example.test', allow);
    (corsOptions.origin as Function)('https://attacker.example.test', deny);

    expect(allow).toHaveBeenCalledWith(null, true);
    expect(deny).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Origin is not allowed by CORS policy'
    }));
  });
});
