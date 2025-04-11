/**
 * OpenAI processor prompt templates
 */

import type { ReviewAspect } from './aspects.ts';
import { defaultReviewAspects } from './aspects.ts';

/**
 * Template for triage phase prompt
 */
export const createTriagePrompt = ({
  title,
  description,
  filePath,
  patch,
  needsReviewPre,
}: {
  title: string;
  description: string;
  filePath: string;
  patch: string;
  needsReviewPre: boolean;
}) => `You are a code reviewer performing initial triage of changes.
Please analyze the following code changes and determine if detailed review is needed.

## Pull Request

Title: ${title}
Description: ${description}

## File Changes

File: ${filePath}

\`\`\`diff
${patch}
\`\`\`

Respond in JSON format with:
- summary: Brief description of changes (100 words or less)
${needsReviewPre
  ? '- needsReview: true if changes require detailed review'
  : '- needsReview: false (fixed value for this prompt)'
}
${needsReviewPre
  ? '- reason: Explanation for the review decision only when \'needsReview\' is false (5 words or less)'
  : ''
}

Expected JSON format:
{
  "summary": string,
  "needsReview": boolean,
  "reason": string (optional)
}

Consider these factors:
- Logic or functionality changes require review
- Simple formatting or comment changes may not need review
- Impact on code behavior and structure
`;

/**
 * Template for grouping/overall summary phase prompt
 */
export const createGroupingPrompt = ({
  title,
  description,
  files,
  summarizeResults,
  previousAnalysis,
  aspects = defaultReviewAspects,
}: {
  title: string;
  description: string;
  files: { path: string; patch: string }[];
  summarizeResults: { path: string; needsReview: boolean, summary?: string, reason?: string }[];
  previousAnalysis?: string;
  aspects?: ReviewAspect[];
}) => `You are analyzing code changes in a pull request.

${previousAnalysis ? `## Previous Analysis
The following analysis provides context for your review:

${previousAnalysis}

Note:
- Use previous analysis to maintain consistent aspect categorization
- Create a comprehensive description that covers all changes cohesively
- Present changes as a logically connected whole
- Only analyze listed files for aspect mappings\n` : ''}

## Pull Request

Title: ${title}
Description: ${description}

## Available Review Aspects
Use these standard aspects as a guide for your analysis:
${aspects.map(a => `- ${a.name} (key: "${a.key}")
  ${a.description}`).join('\n')}

## Files To Analyze

${files.map(f => `### ${f.path}\n\n\`\`\`diff\n${f.patch}\n\`\`\`\n`).join('\n')}

## Change Summaries

${summarizeResults.map(r => `- ${r.path}: ${r.summary || 'No summary available'}`).join('\n')}

Create a comprehensive analysis:
1. For elements requiring semantic integration:
   - description: Create a comprehensive overview integrating all changes
   - aspect.description: Update descriptions to reflect the current understanding
   - crossCuttingConcerns: Maintain and extend concerns based on all changes

2. For aspect mappings:
   - Analyze ONLY the current files
   - Add them to appropriate aspects
   - DO NOT remove or modify aspect assignments for files you cannot directly analyze
   - Focus on extending existing aspects rather than removing them

Important rules:
- Only assign current files to aspects
- Maintain previous file-aspect relationships
- Update descriptions without invalidating previous assignments
- Create new aspects only when necessary for current files

Expected JSON format:
{
  "description": string, // Comprehensive description integrating previous and current changes
  "aspectMappings": [
    {
      "aspect": {
        "key": string,       // Use standard aspect keys (e.g., "performance", "security")
        "description": string, // Specific description of how this aspect applies to current changes
        "impact": string     // Impact level (high, medium, low)
      },
      "files": string[]      // Files from current batch affected by this aspect
    }
  ],
  "crossCuttingConcerns": string[] // Cross-cutting concerns specific to current batch
}
`;

/**
 * Template for detailed review phase prompt
 */
export const createReviewPrompt = ({
  title,
  description, 
  filePath,
  patch,
  instructions,
  aspects,
}: {
  title: string;
  description: string;
  filePath: string;
  patch: string;
  instructions?: string;
  aspects?: { name: string; description: string }[];
}) => `You are a code reviewer performing detailed analysis.
Please review the following code changes and provide specific feedback.

## Context

PR Title: ${title}
Description: ${description}
File: ${filePath}

${aspects?.length ? `## Review Aspects\n\n${aspects.map(a => `- ${a.name}: ${a.description}`).join('\n')}` : ''}

${instructions ? `## Additional Instructions\n\n${instructions}` : ''}

## Changes

\`\`\`diff
${patch}
\`\`\`

Provide a thorough review focusing on:
- Code correctness and potential bugs
- Performance implications
- Security considerations
- Design and architectural impacts
- Maintainability and readability

Respond in JSON format with:
{
  "comments": [
    {
      "message": string,      // Review comment
      "suggestion"?: string,  // Optional improvement suggestion
      "line_number"?: number  // Optional line number reference
    }
  ],
  "summary": string          // Overall evaluation of changes
}
`;