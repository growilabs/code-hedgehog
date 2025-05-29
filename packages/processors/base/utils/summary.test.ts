import { expect } from '@std/expect';
import { test } from '@std/testing/bdd';
import { ImpactLevel } from '../schema.ts';
import { mergeImpactLevels, mergeOverallSummaries } from './summary.ts';

// モック型
type Aspect = { key: string; description: string; impact: ImpactLevel };
type AspectMapping = { aspect: Aspect; files: string[] };
type OverallSummary = {
  description: string;
  aspectMappings: AspectMapping[];
  crossCuttingConcerns: string[];
};

test('mergeImpactLevels: High優先', () => {
  expect(mergeImpactLevels([ImpactLevel.Low, ImpactLevel.High])).toBe(ImpactLevel.High);
  expect(mergeImpactLevels([ImpactLevel.Medium, ImpactLevel.High])).toBe(ImpactLevel.High);
  expect(mergeImpactLevels([ImpactLevel.High])).toBe(ImpactLevel.High);
});

test('mergeImpactLevels: Medium優先', () => {
  expect(mergeImpactLevels([ImpactLevel.Low, ImpactLevel.Medium])).toBe(ImpactLevel.Medium);
  expect(mergeImpactLevels([ImpactLevel.Medium])).toBe(ImpactLevel.Medium);
});

test('mergeImpactLevels: Lowのみ', () => {
  expect(mergeImpactLevels([ImpactLevel.Low])).toBe(ImpactLevel.Low);
  expect(mergeImpactLevels([])).toBe(ImpactLevel.Low);
});

test('mergeOverallSummaries: aspect key重複時はimpact統合・filesマージ', () => {
  const prev: OverallSummary = {
    description: 'prev',
    aspectMappings: [
      {
        aspect: { key: 'a', description: 'descA-old', impact: ImpactLevel.Low },
        files: ['f1.ts'],
      },
      {
        aspect: { key: 'b', description: 'descB-old', impact: ImpactLevel.Medium },
        files: ['f2.ts'],
      },
    ],
    crossCuttingConcerns: ['prev-cc'],
  };
  const latest: OverallSummary = {
    description: 'latest',
    aspectMappings: [
      {
        aspect: { key: 'a', description: 'descA-new', impact: ImpactLevel.High },
        files: ['f1.ts', 'f3.ts'],
      },
      {
        aspect: { key: 'c', description: 'descC', impact: ImpactLevel.Low },
        files: ['f4.ts'],
      },
    ],
    crossCuttingConcerns: ['latest-cc'],
  };
  const merged = mergeOverallSummaries(prev, latest);
  // aspectMappings: preserved(b), merged(a), new(c)
  expect(merged.aspectMappings.length).toBe(3);
  // preserved
  expect(merged.aspectMappings).toContainEqual({
    aspect: { key: 'b', description: 'descB-old', impact: ImpactLevel.Medium },
    files: ['f2.ts'],
  });
  // merged
  expect(merged.aspectMappings).toContainEqual({
    aspect: { key: 'a', description: 'descA-new', impact: ImpactLevel.High },
    files: ['f1.ts', 'f3.ts'],
  });
  // new
  expect(merged.aspectMappings).toContainEqual({
    aspect: { key: 'c', description: 'descC', impact: ImpactLevel.Low },
    files: ['f4.ts'],
  });
  // description, crossCuttingConcernsはlatest
  expect(merged.description).toBe('latest');
  expect(merged.crossCuttingConcerns).toEqual(['latest-cc']);
});

test('mergeOverallSummaries: previousのみのaspectがpreservedされる', () => {
  const prev: OverallSummary = {
    description: 'prev',
    aspectMappings: [
      {
        aspect: { key: 'x', description: 'descX', impact: ImpactLevel.Low },
        files: ['f.ts'],
      },
    ],
    crossCuttingConcerns: [],
  };
  const latest: OverallSummary = {
    description: 'latest',
    aspectMappings: [],
    crossCuttingConcerns: [],
  };
  const merged = mergeOverallSummaries(prev, latest);
  expect(merged.aspectMappings).toContainEqual({
    aspect: { key: 'x', description: 'descX', impact: ImpactLevel.Low },
    files: ['f.ts'],
  });
});

test('mergeOverallSummaries: files重複はユニーク化', () => {
  const prev: OverallSummary = {
    description: '',
    aspectMappings: [
      {
        aspect: { key: 'a', description: 'd', impact: ImpactLevel.Low },
        files: ['f1.ts'],
      },
    ],
    crossCuttingConcerns: [],
  };
  const latest: OverallSummary = {
    description: '',
    aspectMappings: [
      {
        aspect: { key: 'a', description: 'd', impact: ImpactLevel.Low },
        files: ['f1.ts', 'f2.ts'],
      },
    ],
    crossCuttingConcerns: [],
  };
  const merged = mergeOverallSummaries(prev, latest);
  expect(merged.aspectMappings.find((m) => m.aspect.key === 'a')?.files.sort()).toEqual(['f1.ts', 'f2.ts']);
});
