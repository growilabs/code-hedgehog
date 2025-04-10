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
}: {
  title: string;
  description: string;
  files: { path: string; patch: string }[];
  summarizeResults: { path: string; needsReview: boolean, summary?: string, reason?: string }[];
}) => `You are analyzing the overall changes in a pull request to group related changes.

## Pull Request

Title: ${title}
Description: ${description}

## Files Changed

${files.map(f => `### ${f.path}\n\n\`\`\`diff\n${f.patch}\n\`\`\`\n`).join('\n')}

## summarized results

${summarizeResults.map(r => `- ${r.path}: ${r.summary || 'No summary available'}`).join('\n')}

Analyze these changes and respond with:
1. Overall description of changes
2. Aspect summaries for each review aspect based on the summaries in the summarized results
3. Identify cross-cutting concerns

Expected JSON format:
{

  "description": string, // Overall description of changes
  "aspectMappings": [
    {
      "aspect": {
        "key": string,
        "description": string,
        "impact": string // Impact level (high, medium, low)
      },
      "files": string[],
    }
  ],
  "crossCuttingConcerns": string[] // Optional cross-cutting concerns
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