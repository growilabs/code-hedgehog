/**
 * Checks if a given file path matches a glob pattern.
 * Handles basic glob syntax including *, **, ?, and {alt1,alt2}.
 * @param filePath The file path to test.
 * @param pattern The glob pattern.
 * @returns True if the path matches the pattern, false otherwise.
 */
export function matchesGlobPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex pattern
  let i = 0;
  let regexString = '';
  const len = pattern.length;

  while (i < len) {
    const char = pattern[i++];

    switch (char) {
      case '*':
        if (pattern[i] === '*') {
          // Handle **
          regexString += '.*'; // Matches zero or more characters including '/'
          i++;
        } else {
          // Handle *
          // シングルワイルドカードは / を含まない文字列にマッチ
          regexString += '[^/]*'; // Matches zero or more characters except '/'
        }
        break;
      case '?':
        regexString += '[^/]'; // Matches exactly one character except '/'
        break;
      case '{': {
        let group = '';
        let braceLevel = 1;
        const start = i;
        while (i < len) {
          const nextChar = pattern[i++];
          if (nextChar === '\\') {
            group += `\\${pattern[i++]}`;
          } else if (nextChar === '{') {
            braceLevel++;
            group += '{';
          } else if (nextChar === '}') {
            braceLevel--;
            if (braceLevel === 0) break;
            group += '}';
          } else {
            group += nextChar;
          }
        }
        if (braceLevel !== 0) {
          // Malformed group
          regexString += '\\{'; // Treat '{' as literal
          i = start; // Backtrack
        } else {
          // Convert comma-separated alternatives to regex OR |, respecting escaped commas
          const placeholder = '__COMMA__'; // Use a simple placeholder unlikely to be in the pattern
          const escapedGroup = group.replace(/\\,/g, placeholder); // Temporarily replace escaped commas
          const alternativesRegex = escapedGroup
            .split(',') // Split by unescaped commas
            .map((alt) => alt.replace(new RegExp(placeholder, 'g'), ',')) // Restore escaped commas to literal commas
            .join('|'); // Join with regex OR
          regexString += `(?:${alternativesRegex})`;
        }
        break;
      }
      case '\\': // Handle escaped characters
        if (i < len) {
          regexString += `\\${pattern[i++]}`; // Add escaped character literally
        } else {
          regexString += '\\\\'; // Trailing backslash
        }
        break;
      default:
        // Escape other regex special characters
        regexString += char.replace(/[.+^$()|[\]]/g, '\\$&');
    }
  }

  try {
    // Anchor the pattern
    const regex = new RegExp(`^${regexString}$`);
    return regex.test(filePath);
  } catch (error) {
    // Log invalid patterns but treat them as non-matching
    console.warn(`Invalid glob pattern "${pattern}":`, error);
    return false;
  }
}
