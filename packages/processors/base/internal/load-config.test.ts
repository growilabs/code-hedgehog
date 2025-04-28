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
});
