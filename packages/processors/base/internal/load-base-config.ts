import { promises as fs } from 'node:fs';
// Removed unused import: import process from 'node:process';
import { z } from 'zod'; // Import zod
import { DEFAULT_CONFIG, parseYaml } from '../deps.ts';
import type { PathInstruction, ReviewConfig } from '../types.ts';

// Define a Zod schema for the base configuration fields we expect from YAML
// Matches the PathInstruction interface
const PathInstructionSchema = z
  .object({
    path: z.string(), // Correct property name
    instructions: z.string(), // Correct property name
  })
  .passthrough(); // Allow other potential fields within PathInstruction

const FileFilterSchema = z
  .object({
    exclude: z.array(z.string()).optional(),
    max_changes: z.number().optional(),
  })
  .passthrough();

const BaseConfigSchema = z
  .object({
    language: z.string().optional(),
    file_path_instructions: z.array(PathInstructionSchema).optional(),
    file_filter: FileFilterSchema.optional(),
    skip_simple_changes: z.boolean().optional(),
    review_diff_since_last_review: z.boolean().optional(),
    // path_instructions is required in ReviewConfig, but might be missing in YAML
    path_instructions: z.array(PathInstructionSchema).optional(),
  })
  .passthrough(); // Allow other fields (processor-specific)

// Define a specific error type for configuration loading issues (optional but good practice)
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    // Add 'override' modifier
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Load configuration from a YAML file, merging with defaults.
 * Uses Zod for schema validation.
 * @param configPath Path to the configuration file. Defaults to '.coderabbitai.yaml'.
 * @returns The loaded base configuration (ReviewConfig) merged with defaults.
 *          Returns default config if file not found, unreadable, or validation fails.
 */
export async function loadBaseConfig(configPath = '.coderabbitai.yaml'): Promise<ReviewConfig> {
  let yamlContent: unknown;
  try {
    // Removed fs.access check, rely on readFile's error handling
    const content = await fs.readFile(configPath, 'utf-8');
    yamlContent = parseYaml(content);
  } catch (error: unknown) {
    // Use 'unknown' instead of 'any'
    // Type guard to check if error is an object with a 'code' property
    if (error && typeof error === 'object' && 'code' in error && (error.code === 'ENOENT' || error.code === 'EACCES')) {
      console.warn(`Config file "${configPath}" not found or not readable, using default base config.`);
      return { ...DEFAULT_CONFIG }; // Return defaults if file not found/readable
    }
    // Log other read/parse errors and return defaults
    console.error(`Error reading or parsing config file "${configPath}":`, error);
    // Optionally throw a specific error instead of returning defaults:
    // throw new ConfigLoadError(`Error reading or parsing config file "${configPath}"`, error);
    return { ...DEFAULT_CONFIG };
  }

  // Validate the parsed YAML content against the schema
  const validationResult = BaseConfigSchema.safeParse(yamlContent);

  if (!validationResult.success) {
    console.warn(`Invalid config format in "${configPath}". Errors: ${validationResult.error.message}. Using default base config.`);
    // Log the actual invalid data for debugging if needed (be careful with sensitive data)
    // console.debug("Invalid YAML content:", yamlContent);
    return { ...DEFAULT_CONFIG }; // Return defaults if validation fails
  }

  const parsedYaml = validationResult.data; // Use validated data
  console.debug(`Validated YAML content from ${configPath}:`, JSON.stringify(parsedYaml));

  // Merge validated fields into the default config.
  // For file_filter (exclude, max_changes), if specified in YAML, those values are used.
  // Otherwise, DEFAULT_CONFIG values are used.
  // The deprecated path_filters field is ignored.
  // Zod ensures the types are correct (or optional and thus undefined).
  const baseConfig: ReviewConfig = {
    ...DEFAULT_CONFIG,
    language: parsedYaml.language ?? DEFAULT_CONFIG.language,
    file_path_instructions: parsedYaml.file_path_instructions ?? DEFAULT_CONFIG.file_path_instructions,
    skip_simple_changes: parsedYaml.skip_simple_changes ?? DEFAULT_CONFIG.skip_simple_changes,
    review_diff_since_last_review: parsedYaml.review_diff_since_last_review ?? DEFAULT_CONFIG.review_diff_since_last_review,
    path_instructions: parsedYaml.path_instructions ?? DEFAULT_CONFIG.path_instructions,
    file_filter: {
      exclude: parsedYaml.file_filter?.exclude ?? DEFAULT_CONFIG.file_filter.exclude,
      max_changes: parsedYaml.file_filter?.max_changes ?? DEFAULT_CONFIG.file_filter.max_changes,
    },
  };

  console.debug(`Merged base config: ${JSON.stringify(baseConfig)}`);
  return baseConfig;
}
