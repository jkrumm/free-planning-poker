import { TRPCError, type TRPC_ERROR_CODE_KEY } from '@trpc/server';

/**
 * Metadata attached to CustomTRPCError for Sentry capture
 */
export interface ErrorMetadata {
  /** Router or component name (e.g., 'roomRouter', 'analyticsRouter') */
  component: string;

  /** Procedure or action name (e.g., 'getRoomStats', 'updateRoomName') */
  action: string;

  /** Additional context for debugging (must be JSON-serializable) */
  extra?: Record<string, string | number | boolean | null>;

  /** Sentry severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Custom TRPCError that carries Sentry metadata for centralized error capture.
 *
 * Use this when catching system errors (database failures, external API errors, etc.)
 * that should be reported to Sentry.
 *
 * @example
 * ```typescript
 * const data = await db.query.table.findFirst().catch((error) => {
 *   throw new CustomTRPCError(
 *     'INTERNAL_SERVER_ERROR',
 *     'Failed to get data',
 *     { component: 'exampleRouter', action: 'getData', extra: { id }, severity: 'high' },
 *     error
 *   );
 * });
 * ```
 */
export class CustomTRPCError extends TRPCError {
  public readonly metadata: ErrorMetadata;

  constructor(
    code: TRPC_ERROR_CODE_KEY,
    message: string,
    metadata: ErrorMetadata,
    cause?: unknown,
  ) {
    super({ code, message, cause });
    this.metadata = metadata;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, CustomTRPCError.prototype);

    // Make cause non-enumerable to prevent V8 serialization issues in Jest/IPC
    // (Inspired by NestJS CustomError pattern)
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        writable: false,
        enumerable: false,
        configurable: true,
      });
    }
  }

  /**
   * Extend metadata with additional context post-construction.
   * Useful when you need to add context after the error is created.
   *
   * @example
   * ```typescript
   * const error = new CustomTRPCError(...);
   * throw error.extendMetadata({ userId: ctx.userId });
   * ```
   */
  extendMetadata(
    extra: Record<string, string | number | boolean | null>,
  ): this {
    this.metadata.extra = { ...this.metadata.extra, ...extra };
    return this;
  }
}

/**
 * Helper function to convert any error to CustomTRPCError with INTERNAL_SERVER_ERROR code.
 * Use this as the most common case for system errors.
 *
 * Default severity: 'high' (blocks user actions)
 *
 * @example
 * ```typescript
 * const data = await db.query.table.findFirst().catch((error) =>
 *   throw toCustomTRPCError(error, 'Failed to get data', {
 *     component: 'exampleRouter',
 *     action: 'getData',
 *     extra: { id },
 *   })
 * );
 * ```
 */
export function toCustomTRPCError(
  error: unknown,
  message: string,
  metadata: Omit<ErrorMetadata, 'severity'> & {
    severity?: ErrorMetadata['severity'];
  },
): CustomTRPCError {
  return new CustomTRPCError(
    'INTERNAL_SERVER_ERROR',
    message,
    { ...metadata, severity: metadata.severity ?? 'high' },
    error,
  );
}

/**
 * Static helper to convert any error to CustomTRPCError.
 * If error is already CustomTRPCError, returns it unchanged.
 * Otherwise creates new CustomTRPCError with provided metadata.
 *
 * (Inspired by NestJS CustomError.toCustomError pattern)
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   throw fromError(error, {
 *     component: 'exampleRouter',
 *     action: 'getData',
 *     severity: 'high',
 *   });
 * }
 * ```
 */
export function fromError(
  error: unknown,
  metadata: ErrorMetadata,
): CustomTRPCError {
  if (error instanceof CustomTRPCError) {
    return error;
  }

  if (error instanceof TRPCError) {
    return new CustomTRPCError(
      error.code,
      error.message,
      metadata,
      error.cause,
    );
  }

  if (error instanceof Error) {
    return new CustomTRPCError(
      'INTERNAL_SERVER_ERROR',
      error.message,
      metadata,
      error,
    );
  }

  return new CustomTRPCError(
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred',
    metadata,
    error,
  );
}

/**
 * Helper to check if an error is a business logic error (shouldn't be captured in Sentry).
 *
 * Business logic errors are expected errors that indicate user input issues
 * or resource states, not system failures.
 */
export function isBusinessLogicError(error: TRPCError): boolean {
  return [
    'BAD_REQUEST',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'PRECONDITION_FAILED',
  ].includes(error.code);
}
