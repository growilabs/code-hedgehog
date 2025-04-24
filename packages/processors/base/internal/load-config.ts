import { promises as fs, constants as fsConstants } from 'node:fs';
// Import from deps.ts instead of types.ts
import { parseYaml, DEFAULT_CONFIG, type ReviewConfig } from '../deps.ts';

/**
 * Load configuration from a YAML file, merging with defaults.
 * @param configPath Path to the configuration file. Defaults to '.coderabbitai.yaml'.
 * @returns The loaded configuration merged with defaults.
 */
export async function loadConfig(configPath = '.coderabbitai.yaml'): Promise<ReviewConfig> {
  // Use ReviewConfig type
  let config: ReviewConfig = DEFAULT_CONFIG; // Assuming DEFAULT_CONFIG is compatible
  try {
    // Check if file exists and is readable
    try {
      await fs.access(configPath, fsConstants.R_OK);
    } catch (error) {
      console.warn(`Config file "${configPath}" not found or not readable, using defaults.`);
      return config; // Return default config if file not accessible
    }

    // Read and parse file
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = parseYaml(content) as unknown;

    // Validate config format
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`Invalid config format in "${configPath}", using defaults.`);
      return config; // Return default config if format is invalid
    }

    // Merge with defaults, ensuring parsed is treated as Partial<ReviewConfig>
    config = {
      ...DEFAULT_CONFIG,
      ...(parsed as Partial<ReviewConfig>), // Cast parsed to allow partial override
    };
  } catch (error) {
    console.error(`Error reading or parsing config file "${configPath}":`, error);
    // Keep default config in case of other errors
  }
  return config;
}