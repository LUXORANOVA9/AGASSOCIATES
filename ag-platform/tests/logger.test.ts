import { describe, it, expect, vi } from 'vitest';
import { sanitize } from '../src/server/utils/logger';

describe('Sanitization Utility', () => {
  it('should redact postgres connection strings', () => {
    const input = 'Failed to connect to postgres://user:password123@localhost:5432/mydb';
    const output = sanitize(input);
    expect(output).toBe('Failed to connect to postgres://[REDACTED]:[REDACTED]@[REDACTED]/[REDACTED]');
    expect(output).not.toContain('password123');
  });

  it('should redact credentials in http/https URLs', () => {
    const input = 'Error fetching from https://admin:secret_pass@api.service.com/data';
    const output = sanitize(input);
    expect(output).toBe('Error fetching from https://[REDACTED]:[REDACTED]@api.service.com/data');
    expect(output).not.toContain('secret_pass');
  });

  it('should redact common sensitive keywords', () => {
    const inputs = [
      'Invalid apiKey=12345-abcde',
      'Unauthorized access with token: some-long-jwt-token',
      'Database password = mysecretpassword!',
      'secret: privatekey123'
    ];

    inputs.forEach(input => {
      const output = sanitize(input);
      expect(output).toContain('[REDACTED]');
      expect(output).not.toMatch(/12345-abcde|some-long-jwt-token|mysecretpassword!|privatekey123/);
    });
  });

  it('should redact Bearer tokens', () => {
    const input = 'Authorization: Bearer my.sensitive.token';
    const output = sanitize(input);
    expect(output).toBe('Authorization: Bearer [REDACTED]');
    expect(output).not.toContain('my.sensitive.token');
  });

  it('should return the original message if no sensitive data is present', () => {
    const input = 'User not found';
    const output = sanitize(input);
    expect(output).toBe(input);
  });
});
