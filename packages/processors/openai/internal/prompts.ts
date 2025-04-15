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

## Review Aspects

1. Standard Aspects
Use these predefined aspects for technical characteristics:
${aspects.map(a => `- ${a.name} (key: "${a.key}")
  ${a.description}`).join('\n')}

2. Domain Aspects
What is a Domain?
- A domain represents a specific business or functional area that the code addresses
- Examples:
  - "Authentication & Authorization": User login, permissions, security tokens
  - "Payment Processing": Payment methods, transactions, billing
  - "Data Transformation": Format conversion, validation, normalization
  - "User Management": User profiles, preferences, roles

How to identify domains:
- Analyze file's purpose and responsibilities
- Look for business/functional patterns in:
  - Code structure and organization
  - Function and variable names
  - Class responsibilities
  - Comments and documentation
- Consider what real-world problem the code solves

Creating domain aspects:
- Use format: "domain:<name>" (e.g., domain:auth, domain:payment)
- Provide description explaining:
  - What the domain handles
  - Why this file belongs to the domain
- Judge impact level in domain context

## Files To Analyze

${files.map(f => `### ${f.path}\n\n\`\`\`diff\n${f.patch}\n\`\`\`\n`).join('\n')}

## Change Summaries

${summarizeResults.map(r => `- ${r.path}: ${r.summary || 'No summary available'}`).join('\n')}

Create a comprehensive analysis:
1. For elements requiring semantic integration:
   - description: Create a comprehensive overview integrating all changes
   - aspect.description: Update descriptions to reflect the current understanding
   - crossCuttingConcerns:
     What to identify:
     - System-wide implications that:
       - Affect multiple aspects or domains
       - Require broader consideration beyond individual files
       - Impact development practices or processes
     
     Examples:
     - Security policy changes affecting multiple components
     - Documentation updates needed across the system
     - Performance implications spanning multiple modules
     - Testing strategy adjustments
     - Dependency updates requiring system-wide changes
     - Changes to development or deployment processes

     Integration with previous concerns:
     - Review each previous concern and assess its current relevance
     - Maintain concerns that are still applicable to the system
     - Update concern descriptions to reflect new understanding
     - Add new concerns arising from current changes
     - Combine related concerns into more comprehensive descriptions
     - Remove concerns that are no longer relevant
     - Ensure all maintained concerns reflect current state

2. For aspect mappings:
   - Analyze ONLY the current files for both standard and domain aspects
   - For standard aspects:
     - Add files to relevant technical aspects using provided keys
     - Explain how the changes relate to each aspect
   - For domain aspects:
     - Identify business/functional domains for each file
     - Create aspects with "domain:<name>" format
     - Explain domain purpose and why files belong
   - DO NOT remove or modify aspect assignments for files you cannot directly analyze
   - Maintain both standard and domain aspects from previous analysis

Important rules:
- Only assign current files to aspects
- Maintain previous file-aspect relationships
- Update descriptions without invalidating previous assignments
- Create new aspects only when necessary for current files

Expected JSON format:
{
  "description": string, // Comprehensive description integrating previous and current changes
  "aspectMappings": [
    // Standard aspects example:
    {
      "aspect": {
        "key": string,       // Standard aspect key (e.g., "performance", "security")
        "description": string, // Specific description of how this aspect applies to current changes
        "impact": string     // Impact level (high, medium, low)
      },
      "files": string[]      // Files from current batch affected by this aspect
    },
    // Domain aspects example:
    {
      "aspect": {
        "key": string,       // Domain aspect key (e.g., "domain:auth", "domain:payment")
        "description": string, // Explain domain purpose and why files belong here
        "impact": string     // Impact level in domain context (high, medium, low)
      },
      "files": string[]      // Files from current batch in this domain
    }
  ],
  "crossCuttingConcerns": string[] // System-wide implications requiring broader consideration
}

Note about cross-cutting concerns:
- Focus on implications that span multiple components
- Consider both technical and process-related impacts
- Identify concerns that might require coordination across teams
- Flag issues that could affect future maintenance or development
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