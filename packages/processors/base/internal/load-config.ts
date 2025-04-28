import { promises as fs, constants as fsConstants } from 'node:fs';
import { DEFAULT_CONFIG, parseYaml } from '../deps.ts';
import type { ReviewConfig } from '../types.ts';

/**
 * Load configuration from a YAML file, merging with defaults.
 * @param configPath Path to the configuration file. Defaults to '.coderabbitai.yaml'.
 * @returns The loaded configuration merged with defaults.
 */
export async function loadConfig(configPath = '.coderabbitai.yaml'): Promise<ReviewConfig> {
  let config: ReviewConfig = DEFAULT_CONFIG;
  try {
    try {
      await fs.access(configPath, fsConstants.R_OK);
    } catch (error) {
      console.warn(`Config file "${configPath}" not found or not readable, using defaults.`);
      return config;
    }

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = parseYaml(content) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      console.warn(`Invalid config format in "${configPath}", using defaults.`);
      return config;
    }

    config = {
      ...DEFAULT_CONFIG,
      ...(parsed as Partial<ReviewConfig>),
    };
  } catch (error) {
    console.error(`Error reading or parsing config file "${configPath}":`, error);
  }
  return config;
}
