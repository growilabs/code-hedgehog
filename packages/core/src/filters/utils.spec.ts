import { describe, expect, it } from 'vitest';
import { validateFilterConfig } from '../../src/filters/utils';
import type { IFilterConfig } from '../../src/types';

describe('validateFilterConfig', () => {
  const validConfig: IFilterConfig = {
    include: ['**/*.ts'],
    exclude: ['**/node_modules/**'],
    maxFileSize: 1000,
  };

  it('should accept valid config', () => {
    expect(() => validateFilterConfig(validConfig)).not.toThrow();
  });

  it('should throw on empty include patterns', () => {
    const config: IFilterConfig = {
      ...validConfig,
      include: [],
    };
    expect(() => validateFilterConfig(config)).toThrow('Include patterns must be');
  });

  it('should throw on non-array include patterns', () => {
    const config = {
      ...validConfig,
      include: 'test' as any,
    };
    expect(() => validateFilterConfig(config)).toThrow('Include patterns must be');
  });

  it('should throw on non-array exclude patterns', () => {
    const config = {
      ...validConfig,
      exclude: 'test' as any,
    };
    expect(() => validateFilterConfig(config)).toThrow('Exclude patterns must be');
  });

  it('should throw on invalid maxFileSize', () => {
    const config: IFilterConfig = {
      ...validConfig,
      maxFileSize: 0,
    };
    expect(() => validateFilterConfig(config)).toThrow('Maximum file size must be');
  });
});
