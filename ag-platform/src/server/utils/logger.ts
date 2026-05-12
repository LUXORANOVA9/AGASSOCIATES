export function sanitize(message: string): string {
  if (!message) return message;

  let sanitized = message;

  // Redact Postgres connection strings
  sanitized = sanitized.replace(/postgres:\/\/([^:]+):([^@]+)@([^/]+)\/([^?\s]+)/g, 'postgres://[REDACTED]:[REDACTED]@[REDACTED]/[REDACTED]');

  // Redact credentials in URLs
  sanitized = sanitized.replace(/(https?:\/\/)([^:]+):([^@]+)@/g, '$1[REDACTED]:[REDACTED]@');

  // Redact common patterns like key=value, secret: value, etc.
  // This is a bit broad but safer for logs
  const sensitiveKeywords = ['key', 'secret', 'password', 'token', 'apiKey', 'accessToken', 'refreshToken'];
  sensitiveKeywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword})\\s*[=:]\\s*[^\\s|&,;]+`, 'gi');
    sanitized = sanitized.replace(regex, '$1=[REDACTED]');
  });

  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');

  return sanitized;
}
