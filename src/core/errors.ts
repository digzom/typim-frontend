/**
 * Error handling and logging module
 * @module core/errors
 */

import { CONFIG } from './config';

/**
 * Base error class for Typim
 */
export class TypimError extends Error {
  public readonly module: string;
  public readonly action: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    module: string,
    action: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TypimError';
    this.module = module;
    this.action = action;
    this.context = context;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      module: this.module,
      action: this.action,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Editor-related errors
 */
export class EditorError extends TypimError {
  constructor(message: string, action: string, context?: Record<string, unknown>) {
    super(message, 'editor', action, context);
    this.name = 'EditorError';
  }
}

/**
 * Share-related errors
 */
export class ShareError extends TypimError {
  constructor(message: string, action: string, context?: Record<string, unknown>) {
    super(message, 'share', action, context);
    this.name = 'ShareError';
  }
}

/**
 * Storage-related errors
 */
export class StorageError extends TypimError {
  readonly name = 'StorageError';
  constructor(message: string, action: string, context?: Record<string, unknown>) {
    super(message, 'storage', action, context);
  }
}

/**
 * State-related errors
 */
export class StateError extends TypimError {
  constructor(message: string, action: string, context?: Record<string, unknown>) {
    super(message, 'state', action, context);
    this.name = 'StateError';
  }
}

/**
 * Log levels
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  redactSensitive: boolean;
}

/**
 * Sensitive data patterns to redact
 */
const SENSITIVE_PATTERNS = [
  /edit[_-]?token["']?\s*[:=]\s*["']?[^\s"']+/gi,
  /token["']?\s*[:=]\s*["']?[^\s"']{20,}/gi,
  /password["']?\s*[:=]\s*["']?[^\s"']+/gi,
];

/**
 * Redact sensitive data from log message
 * @param message - Message to redact
 * @returns Redacted message
 */
function redactSensitiveData(message: string): string {
  let redacted = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

/**
 * Logger class with level filtering and context
 */
export class Logger {
  private readonly config: LoggerConfig;

  constructor(
    environment: 'development' | 'production',
    config: Partial<LoggerConfig> = {}
  ) {
    this.config = {
      minLevel: environment === 'production' ? 'info' : 'debug',
      enableConsole: true,
      redactSensitive: true,
      ...config,
    };
  }

  /**
   * Check if a log level should be logged
   * @param level - Log level to check
   * @returns True if should log
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.minLevel);
  }

  /**
   * Format log message with metadata
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context
   * @returns Formatted message
   */
  private format(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * Log a debug message
   * @param message - Message to log
   * @param context - Additional context
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;

    const formatted = this.format('debug', message, context);
    const final = this.config.redactSensitive ? redactSensitiveData(formatted) : formatted;

    if (this.config.enableConsole) {
      // eslint-disable-next-line no-console
      console.debug(final);
    }
  }

  /**
   * Log an info message
   * @param message - Message to log
   * @param context - Additional context
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;

    const formatted = this.format('info', message, context);
    const final = this.config.redactSensitive ? redactSensitiveData(formatted) : formatted;

    if (this.config.enableConsole) {
      console.info(final);
    }
  }

  /**
   * Log a warning message
   * @param message - Message to log
   * @param context - Additional context
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;

    const formatted = this.format('warn', message, context);
    const final = this.config.redactSensitive ? redactSensitiveData(formatted) : formatted;

    if (this.config.enableConsole) {
      console.warn(final);
    }
  }

  /**
   * Log an error message
   * @param message - Message to log
   * @param error - Error object
   * @param context - Additional context
   */
  error(
    message: string,
    error?: Error | TypimError,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog('error')) return;

    const errorContext = error
      ? {
          ...context,
          error: error instanceof TypimError ? error.toJSON() : error.message,
          stack: error.stack,
        }
      : context;

    const formatted = this.format('error', message, errorContext);
    const final = this.config.redactSensitive ? redactSensitiveData(formatted) : formatted;

    if (this.config.enableConsole) {
      console.error(final);
    }
  }
}

/**
 * Global error handler setup
 * @param logger - Logger instance
 */
export function setupGlobalErrorHandling(logger: Logger): void {
  if (typeof window === 'undefined') return;

  // Handle uncaught errors
  window.onerror = (
    message: string | Event,
    source: string | undefined,
    lineno: number | undefined,
    colno: number | undefined,
    error: Error | undefined
  ): boolean => {
    const messageStr = typeof message === 'string' ? message : 'Error event occurred';
    logger.error('Uncaught error', error ?? undefined, {
      message: messageStr,
      source,
      lineno,
      colno,
    });
    return false;
  };

  // Handle unhandled promise rejections
  window.onunhandledrejection = (event: PromiseRejectionEvent): void => {
    const reason: unknown = event.reason;
    let errorToLog: Error | undefined;

    if (reason instanceof Error) {
      errorToLog = reason;
    } else if (typeof reason === 'string') {
      errorToLog = new Error(reason);
    } else {
      errorToLog = new Error(String(reason));
    }

    logger.error('Unhandled promise rejection', errorToLog, {
      stack: errorToLog.stack,
    });
  };
}

/** Default logger instance */
export const defaultLogger = new Logger(CONFIG.environment);
