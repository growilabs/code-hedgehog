import { promises as fs, constants as fsConstants } from 'node:fs';
import process from 'node:process'; // Import process for environment variables
import { DEFAULT_CONFIG, parseYaml } from '../deps.ts';
import type { PathInstruction, ReviewConfig } from '../types.ts'; // Import PathInstruction

/**
 * Load configuration from a YAML file, merging with defaults.
 * @param configPath Path to the configuration file. Defaults to '.coderabbitai.yaml'.
 * @returns The loaded base configuration (ReviewConfig) merged with defaults. Processor-specific fields from YAML are ignored.
 */
// Return type changed back to Promise<ReviewConfig>
export async function loadConfig(configPath = '.coderabbitai.yaml'): Promise<ReviewConfig> {
  let baseConfig: ReviewConfig = { ...DEFAULT_CONFIG }; // Start with defaults
  try {
    try {
      await fs.access(configPath, fsConstants.R_OK);
    } catch (error) {
      console.warn(`Config file "${configPath}" not found or not readable, using default base config.`);
      return baseConfig; // Return defaults if file not found
    }

    const content = await fs.readFile(configPath, 'utf-8');
    const yamlContent = parseYaml(content) as unknown;

    if (!yamlContent || typeof yamlContent !== 'object') {
      console.warn(`Invalid config format in "${configPath}", using default base config.`);
      return baseConfig; // Return defaults if invalid format
    }

    // Use Record<string, unknown> for safer type handling
    const parsedYaml = yamlContent as Record<string, unknown>;
    console.debug(`Loaded YAML content from ${configPath}:`, JSON.stringify(parsedYaml));

    // Merge only the base fields from YAML into the default config
    // Explicitly pick known base fields to avoid including processor-specific ones
    // Safely access properties from parsedYaml (unknown)
    baseConfig = {
      ...DEFAULT_CONFIG,
      // Check if it's an array before casting to PathInstruction[]
      file_path_instructions: Array.isArray(parsedYaml.file_path_instructions) ? parsedYaml.file_path_instructions as PathInstruction[] : DEFAULT_CONFIG.file_path_instructions,
      path_filters: typeof parsedYaml.path_filters === 'string' ? parsedYaml.path_filters : DEFAULT_CONFIG.path_filters,
      skip_simple_changes: typeof parsedYaml.skip_simple_changes === 'boolean' ? parsedYaml.skip_simple_changes : DEFAULT_CONFIG.skip_simple_changes,
      // Ensure path_instructions is handled correctly (it's required by core ReviewConfig)
      // Check if it's an array before casting to PathInstruction[]
      path_instructions: Array.isArray(parsedYaml.path_instructions) ? parsedYaml.path_instructions as PathInstruction[] : DEFAULT_CONFIG.path_instructions,
    };
    console.debug(`Merged base config: ${JSON.stringify(baseConfig)}`);
  } catch (error) {
    console.error(`Error reading or parsing config file "${configPath}":`, error);
    // Return defaults on error
    baseConfig = { ...DEFAULT_CONFIG };
  }
  return baseConfig; // Return the merged base ReviewConfig
}
