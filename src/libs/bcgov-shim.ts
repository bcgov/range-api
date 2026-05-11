import pino from 'pino';
import _dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween.js';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';

_dayjs.extend(isBetween);
_dayjs.extend(advancedFormat);

export const dayjs = _dayjs;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export function errorWithCode(message: string, code: number = 500): Error & { code: number } {
  const err = new Error(message) as Error & { code: number };
  err.code = code;
  return err;
}

export function started(port: number | string): void {
  logger.info(`API server started on port ${port}`);
}
