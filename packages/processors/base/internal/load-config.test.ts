import { promises as fs } from 'node:fs';
import { expect } from '@std/expect';
import { afterEach, describe, test } from '@std/testing/bdd'; // Removed beforeEach as stubs are created per test
import { restore, stub } from '@std/testing/mock'; // Removed unused 'type Stub'
import * as yaml from 'js-yaml'; // Keep yaml import for dumping test data
import { DEFAULT_CONFIG } from '../deps.ts';
import type { ReviewConfig } from '../types.ts';
import { loadConfig } from './load-config.ts';

describe('loadConfig', () => {
  afterEach(() => {
    restore();
  });

  test('should return default config if file does not exist', async () => {
    const accessStub = stub(fs, 'access', () => Promise.reject(new Error('File not found')));
    const readFileStub = stub(fs, 'readFile');
    const warnStub = stub(console, 'warn');

    const config = await loadConfig('nonexistent.yaml');

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('not found or not readable');
    expect(readFileStub.calls.length).toBe(0);
  });

  test('should return default config if file is not readable', async () => {
    const accessStub = stub(fs, 'access', () => Promise.reject(new Error('Permission denied')));
    const warnStub = stub(console, 'warn');

    const config = await loadConfig('unreadable.yaml');

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('not found or not readable');
  });

  test('should load and merge config from valid YAML file', async () => {
    const customConfig: Partial<ReviewConfig> = {
      path_filters: '*.test.ts\n!src/ignore.ts',
      skip_simple_changes: true,
    };
    // Control the YAML string returned by readFile
    const yamlContent = yaml.dump(customConfig);
    const accessStub = stub(fs, 'access', () => Promise.resolve());
    const readFileStub = stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    // No need to stub yaml.load (parseYaml)
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadConfig('valid.yaml');

    const expectedConfig = { ...DEFAULT_CONFIG, ...customConfig };
    expect(config).toEqual(expectedConfig);
    expect(warnStub.calls.length).toBe(0);
    expect(errorStub.calls.length).toBe(0);
  });

  test('should return default config and log error for invalid YAML format (parse error)', async () => {
    // Provide invalid YAML content to readFile
    const invalidYamlContent = 'invalid: yaml: content\n  bad-indent';
    const accessStub = stub(fs, 'access', () => Promise.resolve());
    const readFileStub = stub(fs, 'readFile', () => Promise.resolve(invalidYamlContent));
    // No need to stub yaml.load, let the actual parser handle it
    const errorStub = stub(console, 'error');
    const warnStub = stub(console, 'warn');

    const config = await loadConfig('invalid-format.yaml');

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
    const accessStub = stub(fs, 'access', () => Promise.resolve());
    const readFileStub = stub(fs, 'readFile', () => Promise.resolve(nonObjectContent));
    // No need to stub yaml.load
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadConfig('non-object.yaml');

    // loadConfig should detect the non-object result and warn
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnStub.calls.length).toBe(1);
    expect(warnStub.calls[0].args[0]).toContain('Invalid config format');
    expect(errorStub.calls.length).toBe(0);
  });

  test('should return default config and log error if readFile fails', async () => {
    const accessStub = stub(fs, 'access', () => Promise.resolve());
    const readFileStub = stub(fs, 'readFile', () => Promise.reject(new Error('Read error')));
    const errorStub = stub(console, 'error');
    const warnStub = stub(console, 'warn');

    const config = await loadConfig('read-error.yaml');

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(errorStub.calls.length).toBe(1);
    expect(errorStub.calls[0].args[0]).toContain('Error reading or parsing config file');
    expect(warnStub.calls.length).toBe(0);
  });

  test('should return default config if use_default_config is true', async () => {
    const customConfigWithFlag: Partial<ReviewConfig> = {
      file_path_instructions: [{ path: 'src/*', instructions: 'Custom instruction' }],
      skip_simple_changes: false, // Different from default
      use_default_config: true, // Flag to ignore other settings
    };
    const yamlContent = yaml.dump(customConfigWithFlag);
    stub(fs, 'access', () => Promise.resolve());
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const logStub = stub(console, 'log');
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadConfig('use-default.yaml');

    expect(config).toEqual(DEFAULT_CONFIG); // Should return default config
    expect(logStub.calls.length).toBe(1); // Should log the reason
    expect(logStub.calls[0].args[0]).toContain('"use_default_config" is true');
    expect(warnStub.calls.length).toBe(0);
    expect(errorStub.calls.length).toBe(0);
  });
  test('should use default path ".coderabbitai.yaml" if no path is provided', async () => {
    // Stub access to succeed for the default path
    const accessStub = stub(fs, 'access', (path) => {
      if (path === '.coderabbitai.yaml') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });
    // Stub readFile to return an empty object for the default path
    const readFileStub = stub(fs, 'readFile', (path) => {
      if (path === '.coderabbitai.yaml') {
        return Promise.resolve('{}'); // Empty config
      }
      return Promise.reject(new Error('Read error'));
    });
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadConfig(); // Call without arguments

    expect(config).toEqual(DEFAULT_CONFIG); // Should return defaults as the file is empty
    expect(accessStub.calls[0].args[0]).toBe('.coderabbitai.yaml');
    expect(readFileStub.calls[0].args[0]).toBe('.coderabbitai.yaml');
    expect(warnStub.calls.length).toBe(0);
    expect(errorStub.calls.length).toBe(0);
  });

  test('should fallback to default values for invalid types in YAML', async () => {
    const invalidTypeConfig = {
      file_path_instructions: 'not an array', // Invalid type
      path_filters: 123, // Invalid type
      skip_simple_changes: 'not a boolean', // Invalid type
      path_instructions: { path: 'invalid', instructions: 'object' }, // Invalid type
    };
    const yamlContent = yaml.dump(invalidTypeConfig);
    stub(fs, 'access', () => Promise.resolve());
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadConfig('invalid-types.yaml');

    // Expect the config to have fallen back to defaults for the invalid fields
    expect(config.file_path_instructions).toEqual(DEFAULT_CONFIG.file_path_instructions);
    expect(config.path_filters).toEqual(DEFAULT_CONFIG.path_filters);
    expect(config.skip_simple_changes).toEqual(DEFAULT_CONFIG.skip_simple_changes);
    expect(config.path_instructions).toEqual(DEFAULT_CONFIG.path_instructions);
    expect(warnStub.calls.length).toBe(0); // No warning expected for type mismatches, just fallback
    expect(errorStub.calls.length).toBe(0);
  });

  test('should load and merge path_instructions from valid YAML file', async () => {
    const customConfigWithPathInstructions: Partial<ReviewConfig> = {
      path_instructions: [{ path: 'src/**/*.ts', instructions: 'Review TypeScript files' }],
      skip_simple_changes: false, // Keep another field to ensure merging works
    };
    const yamlContent = yaml.dump(customConfigWithPathInstructions);
    stub(fs, 'access', () => Promise.resolve());
    stub(fs, 'readFile', () => Promise.resolve(yamlContent));
    const warnStub = stub(console, 'warn');
    const errorStub = stub(console, 'error');

    const config = await loadConfig('valid-with-path-instructions.yaml');

    const expectedConfig = {
      ...DEFAULT_CONFIG,
      path_instructions: customConfigWithPathInstructions.path_instructions,
      skip_simple_changes: customConfigWithPathInstructions.skip_simple_changes,
    };
    expect(config).toEqual(expectedConfig);
    expect(warnStub.calls.length).toBe(0);
    expect(errorStub.calls.length).toBe(0);
  });
});
