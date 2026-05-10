import pino from 'pino';

/**
 * Pino logger instance for structured JSON logging
 * Outputs JSON in both dev and production for Logdy compatibility
 */
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: {
    service: 'free-planning-poker',
  },
});

export default logger;
