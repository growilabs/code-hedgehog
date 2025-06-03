import { promises as fs } from 'node:fs';
import { expect } from '@std/expect';
import { afterEach, describe, test } from '@std/testing/bdd'; // Removed beforeEach as stubs are created per test
import { restore, stub } from '@std/testing/mock'; // Removed unused 'type Stub'
import * as yaml from 'js-yaml'; // Keep yaml import for dumping test data
import { DEFAULT_CONFIG } from '../deps.ts';
import type { ReviewConfig } from '../types.ts';
import { loadBaseConfig } from './load-base-config.ts';

describe('loadBaseConfig', () => {
  afterEach(() => {
    restore();
  });

  test('should return default config if file does not exist', async () => {
    // Stub readFile to throw ENOENT error
    const readFileStub = stub(fs, 'readFile', () => {
      // Use NodeJS.ErrnoException or a similar interface if available,
      // otherwise, create an object matching the expected structure.
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      return Promise.reject(error);
    });
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('nonexistent.yaml'); // Rename function call

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('not found or not readable');
    expect(readFileStub.calls.length).toBe(1); // readFile should be called now
  });

  test('should return default config if file is not readable', async () => {
    // Stub readFile to throw EACCES error
    const readFileStub = stub(fs, 'readFile', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      return Promise.reject(error);
    });
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('unreadable.yaml'); // Rename function call

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('not found or not readable');
    expect(readFileStub.calls.length).toBe(1); // readFile should be called
  });

  test('should load and merge config from valid YAML file', async () => {
    const customConfig: Partial<ReviewConfig> = {
      file_filter: {
        exclude: ['*.test.ts', '!src/ignore.ts'],
        max_changes: 0,
      },
      skip_simple_changes: true,
    };
    // Control the YAML string returned by readFile
    const yamlContent = yaml.dump(customConfig);
    // No fs.access stub needed
    const readFileStub = stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    // No need to stub yaml.load (parseYaml)
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadBaseConfig('valid.yaml'); // Rename function call

    const expectedConfig = {
      ...DEFAULT_CONFIG,
      ...customConfig,
    };
    expect(config).toEqual(expectedConfig);
    expect(warnStub.calls.length).toBe(0);
    expect(errorStub.calls.length).toBe(0);
  });

  test('should return default config and log error for invalid YAML format (parse error)', async () => {
    // Provide invalid YAML content to readFile
    const invalidYamlContent = 'invalid: yaml: content\n  bad-indent';
    // No fs.access stub needed
    const readFileStub = stub(fs, 'readFile', () => Promise.resolve(invalidYamlContent));
    // No need to stub yaml.load, let the actual parser handle it
    const errorStub = stub(console, 'error');
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('invalid-format.yaml'); // Rename function call

    // When yaml.load fails, it should be caught, logged via console.error, and return default config
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(errorStub.calls.length).toBe(1);
    expect(errorStub.calls[0].args[0]).toContain('Error reading or parsing config file');
    // Check for YAMLException
    expect(errorStub.calls[0].args[1].name).toBe('YAMLException');
    expect(warnStub.calls.length).toBe(0); // No warning for invalid format, only error
  });

  test('should return default config and warn if parsed content is not an object', async () => {
    // Provide YAML content that parses to a non-object (e.g., a simple string)
    const nonObjectContent = 'just a string';
    // No fs.access stub needed
    const readFileStub = stub(fs, 'readFile', () => Promise.resolve(nonObjectContent));
    // No need to stub yaml.load
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadBaseConfig('non-object.yaml'); // Rename function call

    // loadBaseConfig should detect the non-object result and warn
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format');
    expect(errorStub.calls.length).toBe(0);
  });

  test('should return default config and log error if readFile fails (other than ENOENT/EACCES)', async () => {
    // No fs.access stub needed
    const readFileStub = stub(fs, 'readFile', () => Promise.reject(new Error('Some other read error')));
    const errorStub = stub(console, 'error');
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('read-error.yaml'); // Rename function call

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(errorStub.calls.length).toBe(1);
    expect(errorStub.calls[0].args[0]).toContain('Error reading or parsing config file');
    expect(warnStub.calls.length).toBe(0);
  });

  test('should use default path ".coderabbitai.yaml" if no path is provided', async () => {
    // No fs.access stub needed
    // Stub readFile to return an empty object for the default path
    const readFileStub = stub(fs, 'readFile', (path) => {
      if (path === '.coderabbitai.yaml') {
        return Promise.resolve('{}'); // Empty config
      }
      return Promise.reject(new Error('Read error'));
    });
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadBaseConfig(); // Rename function call

    expect(config).toEqual(DEFAULT_CONFIG); // Should return defaults as the file is empty
    // expect(accessStub.calls[0].args[0]).toBe('.coderabbitai.yaml'); // Removed access check
    expect(readFileStub.calls[0].args[0]).toBe('.coderabbitai.yaml');
    expect(warnStub.calls.length).toBe(0);
    expect(errorStub.calls.length).toBe(0);
  });

  test('should fallback to default values for invalid types in YAML', async () => {
    const invalidTypeConfig = {
      file_path_instructions: 'not an array', // Invalid type
      file_filter: 123, // Invalid type
      skip_simple_changes: 'not a boolean', // Invalid type
      path_instructions: { path: 'invalid', instructions: 'object' }, // Invalid type
    };
    const yamlContent = yaml.dump(invalidTypeConfig);
    // No fs.access stub needed
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadBaseConfig('invalid-types.yaml'); // Rename function call

    // Expect the config to have fallen back to defaults for the invalid fields
    expect(config.file_path_instructions).toEqual(DEFAULT_CONFIG.file_path_instructions);
    expect(config.file_filter).toEqual(DEFAULT_CONFIG.file_filter);
    expect(config.skip_simple_changes).toEqual(DEFAULT_CONFIG.skip_simple_changes);
    expect(config.path_instructions).toEqual(DEFAULT_CONFIG.path_instructions);
    expect(warnStub.calls.length).toBe(1); // Expect 1 warning due to Zod validation failure
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format'); // Check warning message
    expect(errorStub.calls.length).toBe(0);
  });

  test('should load and merge path_instructions from valid YAML file', async () => {
    const customConfigWithPathInstructions: Partial<ReviewConfig> = {
      path_instructions: [{ path: 'src/**/*.ts', instructions: 'Review TypeScript files' }],
      skip_simple_changes: false, // Keep another field to ensure merging works
    };
    const yamlContent = yaml.dump(customConfigWithPathInstructions);
    // No fs.access stub needed
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadBaseConfig('valid-with-path-instructions.yaml'); // Rename function call

    const expectedConfig = {
      ...DEFAULT_CONFIG,
      path_instructions: customConfigWithPathInstructions.path_instructions,
      skip_simple_changes: customConfigWithPathInstructions.skip_simple_changes,
    };
    expect(config).toEqual(expectedConfig);
    expect(warnStub.calls.length).toBe(0);
    expect(errorStub.calls.length).toBe(0);
  });

  test('should prioritize file_filter over deprecated path_filters if both are present in YAML', async () => {
    const mixedConfig = {
      file_filter: {
        exclude: ['new_exclude/**'],
        max_changes: 50,
      },
      path_filters: 'old_exclude/**', // This should be ignored
      skip_simple_changes: true,
    };
    const yamlContent = yaml.dump(mixedConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('mixed-config.yaml');

    expect(config.file_filter.exclude).toEqual(['new_exclude/**']);
    expect(config.file_filter.max_changes).toBe(50);
    expect(config.skip_simple_changes).toBe(true);
    // Ensure no warning about path_filters being used, as it should be ignored.
    // If there were a specific warning for deprecated fields, we could check for that.
    // For now, we check that the general "Invalid config format" warning is NOT present
    // if the rest of the config is valid.
    const invalidFormatWarning = warnStub.calls.find((call) => call.args[0].includes('Invalid config format'));
    expect(invalidFormatWarning).toBeUndefined();
  });

  test('should use DEFAULT_CONFIG.file_filter if file_filter is not in YAML, even if path_filters is present', async () => {
    const onlyPathFiltersConfig = {
      path_filters: 'should_be_ignored/**', // This should be ignored
      language: 'en-US',
    };
    const yamlContent = yaml.dump(onlyPathFiltersConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('only-path-filters.yaml');

    expect(config.file_filter.exclude).toEqual(DEFAULT_CONFIG.file_filter.exclude);
    expect(config.file_filter.max_changes).toEqual(DEFAULT_CONFIG.file_filter.max_changes);
    expect(config.language).toBe('en-US');
    const invalidFormatWarning = warnStub.calls.find((call) => call.args[0].includes('Invalid config format'));
    expect(invalidFormatWarning).toBeUndefined();
  });

  test('should correctly merge file_filter when only exclude is provided in YAML', async () => {
    const partialFileFilterConfig = {
      file_filter: {
        exclude: ['custom_exclude/**'],
      },
      skip_simple_changes: true,
    };
    const yamlContent = yaml.dump(partialFileFilterConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));

    const config = await loadBaseConfig('partial-file-filter.yaml');

    expect(config.file_filter.exclude).toEqual(['custom_exclude/**']);
    expect(config.file_filter.max_changes).toEqual(DEFAULT_CONFIG.file_filter.max_changes); // max_changes should fallback to default
    expect(config.skip_simple_changes).toBe(true);
  });

  test('should correctly merge file_filter when only max_changes is provided in YAML', async () => {
    const partialFileFilterConfig = {
      file_filter: {
        max_changes: 100,
      },
      language: 'fr-FR',
    };
    const yamlContent = yaml.dump(partialFileFilterConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));

    const config = await loadBaseConfig('partial-file-filter-max-changes.yaml');

    expect(config.file_filter.exclude).toEqual(DEFAULT_CONFIG.file_filter.exclude); // exclude should fallback to default
    expect(config.file_filter.max_changes).toBe(100);
    expect(config.language).toBe('fr-FR');
  });

  test('should warn and use default file_filter if exclude is not an array', async () => {
    const invalidConfig = {
      file_filter: {
        exclude: 'not-an-array',
      },
    };
    const yamlContent = yaml.dump(invalidConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('invalid-exclude-type.yaml');

    expect(config.file_filter).toEqual(DEFAULT_CONFIG.file_filter);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format');
    // Zod error path for exclude when it's not an array
    expect(warnStub.calls[0].args[0]).toContain('Expected array, received string');
  });

  test('should warn and use default file_filter if exclude contains non-strings', async () => {
    const invalidConfig = {
      file_filter: {
        exclude: ['a-string', 123, 'another-string'],
      },
    };
    const yamlContent = yaml.dump(invalidConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('invalid-exclude-element-type.yaml');

    expect(config.file_filter).toEqual(DEFAULT_CONFIG.file_filter);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format');
    // Zod error path for an element within the exclude array
    expect(warnStub.calls[0].args[0]).toContain('Expected string, received number');
  });

  test('should warn and use default file_filter if max_changes is not a number', async () => {
    const invalidConfig = {
      file_filter: {
        max_changes: 'not-a-number',
      },
    };
    const yamlContent = yaml.dump(invalidConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('invalid-max-changes-type.yaml');

    expect(config.file_filter).toEqual(DEFAULT_CONFIG.file_filter);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format');
    // Zod error path for max_changes when it's not a number
    expect(warnStub.calls[0].args[0]).toContain('Expected number, received string');
  });

  test('should warn and use default file_filter if max_changes is a negative number', async () => {
    const invalidConfig = {
      file_filter: {
        max_changes: -5,
      },
    };
    const yamlContent = yaml.dump(invalidConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('negative-max-changes.yaml');

    expect(config.file_filter).toEqual(DEFAULT_CONFIG.file_filter);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format');
    // Zod error message for non-negative numbers
    expect(warnStub.calls[0].args[0]).toContain('Number must be greater than or equal to 0');
  });

  test('should warn and use default file_filter if file_filter contains unknown keys (due to .strict())', async () => {
    const invalidConfig = {
      file_filter: {
        exclude: ['valid/**'],
        unknown_property: 'should cause error',
      },
    };
    const yamlContent = yaml.dump(invalidConfig);
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');

    const config = await loadBaseConfig('unknown-key-in-file-filter.yaml');
    expect(config.file_filter).toEqual(DEFAULT_CONFIG.file_filter);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format');
    // Zod's message for strict mode includes "Unrecognized key(s) in object: 'unknown_property'"
    expect(warnStub.calls[0].args[0]).toContain("Unrecognized key(s) in object: 'unknown_property'");
  });
});
