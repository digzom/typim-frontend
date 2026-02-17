import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageAdapter, StorageSecurityError } from '../../../src/utils/storage';

describe('StorageAdapter', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = new StorageAdapter();
    storage.clearAll();
  });

  describe('allowlist', () => {
    it('should reject keys not in allowlist', () => {
      const result = storage.set('unauthorized:key', 'value', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not in storage allowlist');
    });

    it('should accept allowlisted keys', () => {
      const result = storage.set('typim:theme', 'dark', 1);

      expect(result.success).toBe(true);
    });
  });

  describe('security (INV-002)', () => {
    it('should throw SecurityError for edit token keys', () => {
      expect(() => storage.set('editToken', 'secret123', 1)).toThrow(StorageSecurityError);
    });

    it('should throw SecurityError for share token keys', () => {
      expect(() => storage.set('share_token', 'secret123', 1)).toThrow(StorageSecurityError);
    });

    it('should throw SecurityError for values containing edit token', () => {
      expect(() => storage.set('typim:state', { editToken: 'secret123' }, 1)).toThrow(
        StorageSecurityError
      );
    });

    it('should throw SecurityError for values containing sensitive data', () => {
      expect(() => storage.set('typim:state', { apiKey: 'secret123' }, 1)).toThrow(
        StorageSecurityError
      );
    });
  });

  describe('get', () => {
    it('should return data for valid key', () => {
      storage.set('typim:theme', 'dark', 1);
      const result = storage.get('typim:theme', 1);

      expect(result.success).toBe(true);
      expect(result.data).toBe('dark');
    });

    it('should return undefined for missing key', () => {
      const result = storage.get('typim:theme', 1);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('should handle version mismatch', () => {
      storage.set('typim:theme', 'dark', 1);
      const result = storage.get('typim:theme', 2);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version mismatch');
    });

    it('should handle invalid JSON', () => {
      localStorage.setItem('typim:theme', 'invalid json');
      const result = storage.get('typim:theme', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Parse error');
    });
  });

  describe('set', () => {
    it('should store data with version wrapper', () => {
      storage.set('typim:theme', 'dark', 1);

      const raw = localStorage.getItem('typim:theme');
      expect(raw).not.toBeNull();

      interface StoredData {
        version: number;
        data: string;
        timestamp: number;
      }
      const parsed = JSON.parse(raw as string) as StoredData;

      expect(parsed.version).toBe(1);
      expect(parsed.data).toBe('dark');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should handle quota exceeded error', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
      const quotaErrorStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          const error = new Error('Quota exceeded');
          error.name = 'QuotaExceededError';
          throw error;
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(() => null),
        length: 0,
      } as Storage;

      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: quotaErrorStorage,
      });

      const result = storage.set('typim:theme', 'dark', 1);

      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      }

      expect(result.success).toBe(false);
      expect(result.error).toContain('quota exceeded');
    });
  });

  describe('remove', () => {
    it('should remove item from storage', () => {
      storage.set('typim:theme', 'dark', 1);
      storage.remove('typim:theme');

      const result = storage.get('typim:theme', 1);
      expect(result.data).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should remove all typim keys', () => {
      storage.set('typim:theme', 'dark', 1);
      storage.set('typim:fonts:body', 'serif', 1);

      storage.clearAll();

      expect(storage.get('typim:theme', 1).data).toBeUndefined();
      expect(storage.get('typim:fonts:body', 1).data).toBeUndefined();
    });
  });
});
