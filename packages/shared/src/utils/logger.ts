import pino from 'pino';

const level = process.env['LOG_LEVEL'] ?? 'info';

export const logger = pino({
  level,
  // In Lambda, stdout is captured by CloudWatch Logs.
  // Pino's default transport is already stdout JSON — no transport config needed.
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: process.env['AWS_LAMBDA_FUNCTION_NAME'] ?? 'local',
    env: process.env['NODE_ENV'] ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
