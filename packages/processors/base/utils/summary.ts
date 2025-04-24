import { ImpactLevel, type OverallSummary } from '../schema.ts';

/**
 * Merge multiple OverallSummary results into one
 * @param previous Array of previous summaries to merge
 * @param latest Latest summary to merge with
 * @returns Merged summary
 */
export function mergeOverallSummaries(previous: OverallSummary, latest: OverallSummary): OverallSummary {
  const previousMappings = previous.aspectMappings;

  // Process current mappings (new or update)
  const newAspectMappings = latest.aspectMappings.map((latestMapping) => {
    // Find previous mapping with the same key
    const prevMapping = previousMappings.find((p) => p.aspect.key === latestMapping.aspect.key);

    if (prevMapping) {
      // For existing aspect
      return {
        aspect: {
          key: latestMapping.aspect.key,
          description: latestMapping.aspect.description, // Use new description
          impact: mergeImpactLevels([prevMapping.aspect.impact, latestMapping.aspect.impact]),
        },
        files: [...new Set([...prevMapping.files, ...latestMapping.files])],
      };
    }
    // Add new aspect as is
    return latestMapping;
  });

  // Preserve aspects from previous mappings that are not referenced in current analysis
  const preservedMappings = previousMappings.filter((prev) => !latest.aspectMappings.some((curr) => curr.aspect.key === prev.aspect.key));

  return {
    description: latest.description,
    aspectMappings: [...preservedMappings, ...newAspectMappings],
    crossCuttingConcerns: latest.crossCuttingConcerns,
  };
}

/**
 * Merge impact levels by selecting highest priority
 * Priority: high > medium > low
 * @param impacts Array of impact levels to merge
 * @returns Highest priority impact level
 */
export function mergeImpactLevels(impacts: ImpactLevel[]): ImpactLevel {
  if (impacts.includes(ImpactLevel.High)) return ImpactLevel.High;
  if (impacts.includes(ImpactLevel.Medium)) return ImpactLevel.Medium;
  return ImpactLevel.Low;
}
