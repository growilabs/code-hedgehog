/**
 * Prompt templates for OpenAI processor
 */



/**
 * Template for generating file change summary 
 */
export const summarizePrompt = ({title, description, fileDiff}: {title: string, description: string, fileDiff: string}) => `## GitHub PR Title

\`${title}\`

## Description

\`\`\`
${description}
\`\`\`

## File Diff

\`\`\`diff
${fileDiff}
\`\`\`

## Add summary

Your task is to succinctly summarize the diff within 100 words.
Your summary should include:
- Changes to function signatures
- Changes to global data structures
- Changes that affect external interfaces
- Changes that affect code behavior

Respond with the following JSON format:
{
  "summary": "The previously generated summary"
}
`;

/**
 * Template for triage decision
 */
export const triagePrompt = `## Add triage information

And additionally, please triage the diff as NEEDS_REVIEW or APPROVED based on:

- If any logic or functionality is modified, mark as NEEDS_REVIEW including:
  - Control structure changes
  - Function call changes
  - Variable assignment changes
- If changes are formatting/comments only, mark as APPROVED

Respond with the following JSON format:
{
  "status": "NEEDS_REVIEW" or "APPROVED",
  "reason": "Explanation for the decision"
}
`;