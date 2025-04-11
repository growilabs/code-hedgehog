/**
 * Review aspect definition types and defaults
 */

export interface ReviewAspect {
  /** Unique identifier for the aspect */
  key: string;
  /** Display name of the aspect */
  name: string;
  /** Detailed description of what this aspect covers */
  description: string;
}

/**
 * Default review aspects covering common code review perspectives
 */
export const defaultReviewAspects: ReviewAspect[] = [
  {
    key: "performance",
    name: "Performance",
    description: "Aspects related to code execution speed and efficiency",
  },
  {
    key: "security",
    name: "Security",
    description: "Aspects related to vulnerabilities and security risks",
  },
  {
    key: "testability",
    name: "Testability",
    description: "Aspects related to ease of testing and code coverage",
  },
  {
    key: "error_handling",
    name: "Error Handling",
    description: "Aspects related to exception handling and error management",
  },
  {
    key: "maintainability",
    name: "Maintainability",
    description: "Aspects related to code clarity, understandability, and ease of future maintenance and extension",
  },
  {
    key: "documentation",
    name: "Documentation",
    description: "Aspects related to appropriateness of comments and explanations",
  },
  {
    key: "architecture",
    name: "Architecture",
    description: "Aspects related to design patterns and code structure",
  },
  {
    key: "naming",
    name: "Naming Conventions",
    description: "Aspects related to naming of variables, functions, and other identifiers",
  },
  {
    key: "code_style",
    name: "Code Style",
    description: "Aspects related to formatting, indentation, and coding style",
  },
  {
    key: "resource_management",
    name: "Resource Management",
    description: "Aspects related to management of memory, file handles, and other resources",
  },
];
