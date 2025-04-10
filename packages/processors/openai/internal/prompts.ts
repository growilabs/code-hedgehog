/**
 * OpenAI processor prompt templates
 */

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
}: {
  title: string;
  description: string;
  files: { path: string; patch: string }[];
  summarizeResults: { path: string; needsReview: boolean, summary?: string, reason?: string }[];
  previousAnalysis?: string;
}) => `You are analyzing changes in the current batch of a pull request.

${previousAnalysis ? `## Previous Analysis (Reference for aspect consistency)
The following analysis from previous batches should be used as reference to maintain consistent aspect categorization:

${previousAnalysis}

Note: Previous analysis provides context for aspect reuse only.
Do NOT include previous files or concerns in your response.\n` : ''}

## Pull Request

Title: ${title}
Description: ${description}

## Current Batch Files

${files.map(f => `### ${f.path}\n\n\`\`\`diff\n${f.patch}\n\`\`\`\n`).join('\n')}

## Current Batch Summaries

${summarizeResults.map(r => `- ${r.path}: ${r.summary || 'No summary available'}`).join('\n')}

Analyze the current batch files and respond with:
1. Description focusing ONLY on the current batch files
2. Aspect mappings for current batch files:
   - Reuse matching aspect keys from previous analysis for consistency
   - Use new aspect keys for unrelated changes
   - Previous analysis is ONLY for aspect key reference

Important rules:
- Focus ONLY on files listed in "Current Batch Files"
- Do NOT include files from previous analysis
- Do NOT copy concerns from previous analysis
- Previous analysis should ONLY guide aspect key choice

Expected JSON format:
{
  "description": string, // Description of current batch changes only
  "aspectMappings": [
    {
      "aspect": {
        "key": string,       // Reuse existing keys when appropriate
        "description": string, // Description of current changes
        "impact": string     // Impact of current changes (high, medium, low)
      },
      "files": string[],     // Only current batch files
    }
  ],
  "crossCuttingConcerns": string[] // Concerns about current batch only
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