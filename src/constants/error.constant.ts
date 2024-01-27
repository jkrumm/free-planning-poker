import { log as axiomLog } from 'next-axiom';

import HttpStatusCode from 'fpp/constants/http-status-codes.constant';
import { type logEndpoint } from 'fpp/constants/logging.constant';

import { type EventType, type RouteType } from 'fpp/server/db/schema';

/**
 * Logging types
 */

interface GlobalLoggingType {
  userId?: string | null;
  roomId?: string;
  roomReadable?: string;
  roomNumber?: string;
  route?: keyof typeof RouteType;
  event?: keyof typeof EventType;
}

export interface ServerLog extends GlobalLoggingType {
  endpoint?: keyof typeof logEndpoint;
  method?: string;
  browser?: string | null;
  device?: string | null;
  os?: string | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  startTime?: number;
  endTime?: number;
  duration?: number;
  httpCode?: number;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

export interface ClientLog extends GlobalLoggingType {
  withBeacon?: boolean;
}

export function removeNulls(obj: ServerLog | ClientLog) {
  const serializedObj: Record<string, string> = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      serializedObj[key] = String(value);
    }
  });
  return serializedObj;
}

/**
 * Error types
 */

export class BaseError extends Error {
  meta: ServerLog;
  httpCode: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
  constructor(message: string, meta?: ServerLog) {
    super(message);
    this.name = this.constructor.name;
    this.meta = meta ?? {};
  }
}

export class BadRequestError extends BaseError {
  httpCode = HttpStatusCode.BAD_REQUEST;
}

export class NotFoundError extends BaseError {
  httpCode = HttpStatusCode.NOT_FOUND;
}

export class MethodNotAllowedError extends BaseError {
  httpCode = HttpStatusCode.METHOD_NOT_ALLOWED;
}

export class InternalServerError extends BaseError {
  httpCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
}

export class NotImplementedError extends BaseError {
  httpCode = HttpStatusCode.NOT_IMPLEMENTED;
}

export class TooManyRequestsError extends BaseError {
  httpCode = HttpStatusCode.TOO_MANY_REQUESTS;
}

/**
 * Logging class
 */

export class log {
  static debug(message: string, meta: ClientLog | ServerLog) {
    axiomLog.debug(message, removeNulls(meta));
  }
  static info(message: string, meta: ClientLog | ServerLog) {
    axiomLog.info(message, removeNulls(meta));
  }
  static warn(message: string, meta: ClientLog | ServerLog) {
    axiomLog.warn(message, removeNulls(meta));
  }
  static error(message: string, meta: ClientLog | ServerLog) {
    axiomLog.error(message, removeNulls(meta));
  }

  static handleError(error: BaseError) {
    switch (error.constructor.name) {
      case 'BadRequestError':
      case 'NotFoundError':
      case 'NotImplementedError':
      case 'TooManyRequestsError':
        log.warn(error.message, {
          ...error.meta,
          httpCode: error.httpCode,
          errorName: error.name,
          errorStack: error.stack ?? 'no stack',
        } as ServerLog);
        break;
      case 'InternalServerError':
      case 'Error':
        log.error(error.message, {
          ...error?.meta,
          httpCode: error?.httpCode,
          errorName: error?.name,
          errorStack: error?.stack ?? 'no stack',
        } as ServerLog);
        break;
      default:
        log.error('Unknown error', {
          ...error?.meta,
          httpCode: error?.httpCode,
          errorMessage: error?.message,
          errorName: error?.name,
          errorStack: error?.stack ?? 'no stack',
        } as ServerLog);
    }
  }
}
