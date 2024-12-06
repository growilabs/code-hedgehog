import * as core from '@actions/core';
import { filterFiles, shouldProcessFile } from '../../src/filters';
import type { IFileChange, IFilterConfig } from '../../src/types';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  debug: vi.fn(),
}));

describe('filters', () => {
  let defaultConfig: IFilterConfig;
  let sampleFile: IFileChange;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup default test config
    defaultConfig = {
      include: ['**/*.ts', '**/*.js'],
      exclude: ['**/node_modules/**'],
      maxFileSize: 1000,
    };

    // Setup sample file
    sampleFile = {
      path: 'src/index.ts',
      content: 'console.log("test")',
      patch: '@@ -0,0 +1 @@\n+console.log("test")',
      size: 500,
    };
  });

  describe('shouldProcessFile', () => {
    it('should accept file matching include pattern and size limit', () => {
      const result = shouldProcessFile(sampleFile, defaultConfig);
      expect(result).toBe(true);
    });

    it('should reject file exceeding size limit', () => {
      const largeFile: IFileChange = {
        ...sampleFile,
        size: 2000,
      };
      const result = shouldProcessFile(largeFile, defaultConfig);
      expect(result).toBe(false);
      expect(core.debug).toHaveBeenCalledWith(expect.stringContaining('exceeds limit'));
    });

    it('should reject file matching exclude pattern', () => {
      const excludedFile: IFileChange = {
        ...sampleFile,
        path: 'node_modules/package/index.ts',
      };
      const result = shouldProcessFile(excludedFile, defaultConfig);
      expect(result).toBe(false);
      expect(core.debug).toHaveBeenCalledWith(expect.stringContaining('matches exclude pattern'));
    });

    it('should reject file not matching include patterns', () => {
      const unmatchedFile: IFileChange = {
        ...sampleFile,
        path: 'src/styles.css',
      };
      const result = shouldProcessFile(unmatchedFile, defaultConfig);
      expect(result).toBe(false);
      expect(core.debug).toHaveBeenCalledWith(expect.stringContaining('does not match any include patterns'));
    });

    it('should prioritize exclude over include patterns', () => {
      const config: IFilterConfig = {
        ...defaultConfig,
        include: ['**/*.ts'],
        exclude: ['src/**/*.ts'],
      };
      const result = shouldProcessFile(sampleFile, config);
      expect(result).toBe(false);
    });
  });

  describe('filterFiles', () => {
    it('should filter multiple files correctly', () => {
      const files: IFileChange[] = [
        sampleFile,
        {
          ...sampleFile,
          path: 'src/styles.css',
          size: 300,
        },
        {
          ...sampleFile,
          path: 'node_modules/package/index.ts',
          size: 400,
        },
        {
          ...sampleFile,
          path: 'src/large.ts',
          size: 1500,
        },
      ];

      const result = filterFiles(files, defaultConfig);

      expect(result).toHaveLength(1);
      assert(result[0] != null);
      expect(result[0].path).toBe('src/index.ts');
    });

    it('should return empty array for no matching files', () => {
      const files: IFileChange[] = [
        {
          ...sampleFile,
          path: 'src/styles.css',
        },
      ];

      const result = filterFiles(files, defaultConfig);
      expect(result).toHaveLength(0);
    });
  });
});
