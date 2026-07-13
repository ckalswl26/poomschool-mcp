import pino from 'pino';
import { PINO_REDACT_PATHS } from '../security/redaction.js';
import type { Env } from './env.js';

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>) {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: PINO_REDACT_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    base: { service: 'poomschool-mcp' },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(env.NODE_ENV === 'development' ? { transport: undefined } : {}),
  });
}

export type AppLogger = ReturnType<typeof createLogger>;
