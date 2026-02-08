/**
 * Shared username validation for Free Planning Poker
 *
 * This module provides centralized username validation used by both
 * Next.js frontend and Bun WebSocket server (fpp-server).
 *
 * Rules:
 * - Minimum length: 3 characters
 * - Maximum length: 15 characters
 * - Allowed characters: Letters only (A-Z, a-z)
 * - Case preserved (users choose their own capitalization)
 */

export const USERNAME_RULES = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 15,
  PATTERN: /^[A-Za-z]+$/,
  DESCRIPTION: 'Username must be 3-15 letters (A-Z, a-z only)',
} as const;

export interface UsernameValidationResult {
  isValid: boolean;
  cleaned: string;
  error?: string;
}

/**
 * Validates and cleans a username according to FPP rules.
 *
 * @param username - Raw username input
 * @param options - Validation options
 * @param options.allowEmpty - Allow empty string (for form inputs before submit)
 * @param options.strict - Reject if cleaning changes the value (for server-side)
 * @returns Validation result with cleaned username
 *
 * @example
 * // Frontend form (non-strict, cleans input)
 * const result = validateUsername('Jo+hn');
 * // => { isValid: true, cleaned: 'John' }
 *
 * @example
 * // Server validation (strict, rejects invalid chars)
 * const result = validateUsername('Jo+hn', { strict: true });
 * // => { isValid: false, cleaned: 'John', error: '...' }
 *
 * @example
 * // Form input (allow empty before submit)
 * const result = validateUsername('', { allowEmpty: true });
 * // => { isValid: true, cleaned: '' }
 */
export function validateUsername(
  username: string,
  options: {
    allowEmpty?: boolean;
    strict?: boolean;
  } = {}
): UsernameValidationResult {
  const { allowEmpty = false, strict = false } = options;

  // Handle empty input
  if (!username || username.trim() === '') {
    if (allowEmpty) {
      return { isValid: true, cleaned: '' };
    }
    return {
      isValid: false,
      cleaned: '',
      error: 'Username is required',
    };
  }

  // Clean: strip non-letters (preserves case)
  const cleaned = username.replace(/[^A-Za-z]/g, '');

  // In strict mode, reject if cleaning changed the value
  if (strict && cleaned !== username) {
    return {
      isValid: false,
      cleaned,
      error: 'Username must contain only letters (A-Z, a-z)',
    };
  }

  // Validate length
  if (cleaned.length < USERNAME_RULES.MIN_LENGTH) {
    return {
      isValid: false,
      cleaned,
      error: `Username must be at least ${USERNAME_RULES.MIN_LENGTH} characters`,
    };
  }

  if (cleaned.length > USERNAME_RULES.MAX_LENGTH) {
    return {
      isValid: false,
      cleaned,
      error: `Username must be at most ${USERNAME_RULES.MAX_LENGTH} characters`,
    };
  }

  // Validate character set (should always pass after cleaning, but double-check)
  if (!USERNAME_RULES.PATTERN.test(cleaned)) {
    return {
      isValid: false,
      cleaned,
      error: 'Username must contain only letters (A-Z, a-z)',
    };
  }

  return { isValid: true, cleaned };
}
