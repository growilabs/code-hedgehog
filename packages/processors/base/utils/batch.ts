/**
 * Create horizontal batches by slicing array sequentially
 * @param entries Array to batch
 * @param batchSize Size of each batch
 * @returns Array of batches
 */
export function createHorizontalBatches<T>(entries: T[], batchSize: number): T[][] {
  const batches = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Create vertical batches by grouping elements at same positions across chunks
 * @param entries Array to batch
 * @param batchSize Size of each batch
 * @returns Array of batches
 */
export function createVerticalBatches<T>(entries: T[], batchSize: number): T[][] {
  const chunkSize = Math.ceil(entries.length / batchSize);

  // Split entries into chunks
  const chunks: T[][] = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }

  // Group elements vertically
  const batches: T[][] = [];
  for (let pos = 0; pos < chunkSize; pos++) {
    const batch = chunks.map((chunk) => chunk[pos]).filter((entry): entry is T => entry !== undefined);
    if (batch.length > 0) {
      batches.push(batch);
    }
  }
  return batches;
}
