/**
 * StorageAdapter - Safe localStorage wrapper with validation
 * Implements IStorageAdapter interface
 * Invariant: Share tokens are NEVER persisted (INV-002)
 * @module utils/storage
 */

import type { StorageResult, IStorageAdapter } from '../core/types';

/**
 * SecurityError - Thrown when attempting to store sensitive data
 */
export class StorageSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageSecurityError';
  }
}

/**
 * Valid storage keys (allowlist approach)
 */
const ALLOWED_KEYS = new Set([
  'typim:state',
  'typim:fonts:body',
  'typim:fonts:mono',
  'typim:theme',
  'typim:splitRatio',
  'typim:enableLiveMarkdown',
  'typim:vimMode',
  'typim:version',
]);

/**
 * Patterns that indicate sensitive data (share tokens, edit tokens)
 */
const SENSITIVE_PATTERNS = [
  /edit[_-]?token/i,
  /share[_-]?token/i,
  /auth[_-]?token/i,
  /api[_-]?key/i,
  /password/i,
  /secret/i,
];

/**
 * Check if a key contains sensitive data patterns
 * @param key - Storage key
 * @returns True if key appears sensitive
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Check if a value contains sensitive data
 * @param value - Value to check
 * @returns True if value appears sensitive
 */
function containsSensitiveData(value: unknown): boolean {
  if (typeof value === 'string') {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).some(key => isSensitiveKey(key));
  }
  return false;
}

/**
 * StorageAdapter provides safe localStorage operations
 * @implements {IStorageAdapter}
 */
export class StorageAdapter implements IStorageAdapter {
  private readonly isAvailable: boolean;

  constructor() {
    this.isAvailable = this.checkAvailability();
  }

  /**
   * Check if localStorage is available and working
   * @returns True if localStorage is available
   */
  private checkAvailability(): boolean {
    try {
      if (typeof window === 'undefined') {
        return false;
      }
      const testKey = '__typim_storage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a value from storage
   * @param key - Storage key
   * @param expectedVersion - Expected schema version
   * @returns Storage result with data or error
   */
  get(key: string, expectedVersion: number): StorageResult<unknown> {
    // Check key is in allowlist
    if (!ALLOWED_KEYS.has(key)) {
      return {
        success: false,
        error: `Key "${key}" is not in storage allowlist`,
      };
    }

    // Check storage availability
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'localStorage is not available',
      };
    }

    try {
      const raw = window.localStorage.getItem(key);

      if (raw === null) {
        return {
          success: true,
          data: undefined,
        };
      }

      interface ParsedValue {
        version: number;
        data: unknown;
      }
      const parsed = JSON.parse(raw) as ParsedValue;

      // Check version
      if (parsed.version !== expectedVersion) {
        return {
          success: false,
          error: `Version mismatch: expected ${String(expectedVersion)}, got ${String(parsed.version)}`,
        };
      }

      return {
        success: true,
        data: parsed.data,
      };
    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  /**
   * Set a value in storage
   * @param key - Storage key
   * @param value - Value to store
   * @param version - Schema version
   * @returns Storage result
   * @throws {StorageSecurityError} If attempting to store sensitive data
   */
  set(key: string, value: unknown, version: number): StorageResult<void> {
    // Security check: block sensitive keys
    if (isSensitiveKey(key)) {
      throw new StorageSecurityError(
        `Attempted to store sensitive key: ${key}. Edit tokens must not be persisted.`
      );
    }

    // Security check: block sensitive data
    if (containsSensitiveData(value)) {
      throw new StorageSecurityError(
        'Attempted to store sensitive data. Edit tokens must not be persisted.'
      );
    }

    // Check key is in allowlist
    if (!ALLOWED_KEYS.has(key)) {
      return {
        success: false,
        error: `Key "${key}" is not in storage allowlist`,
      };
    }

    // Check storage availability
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'localStorage is not available',
      };
    }

    try {
      const wrapped = {
        version,
        data: value,
        timestamp: Date.now(),
      };

      window.localStorage.setItem(key, JSON.stringify(wrapped));

      return {
        success: true,
      };
    } catch (error) {
      // Handle quota exceeded
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return {
          success: false,
          error: 'Storage quota exceeded',
        };
      }

      return {
        success: false,
        error: `Storage error: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  /**
   * Remove a value from storage
   * @param key - Storage key
   */
  remove(key: string): void {
    if (!this.isAvailable) return;

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[StorageAdapter] Failed to remove ${key}:`, error);
    }
  }

  /**
   * Check if storage is available
   * @returns True if localStorage is available
   */
  available(): boolean {
    return this.isAvailable;
  }

  /**
   * Clear all Typim-related storage
   */
  clearAll(): void {
    if (!this.isAvailable) return;

    for (const key of ALLOWED_KEYS) {
      this.remove(key);
    }
  }
}

/** Singleton instance */
export const storageAdapter = new StorageAdapter();
