import { DocxTag } from '../types';

/**
 * TagDetector
 * Responsible for analyzing text content and extracting valid templating tags.
 * Designed to be robust against spacing variations within tags.
 */
export class TagDetector {
  // Matches {{ name }}
  private static readonly DOUBLE_BRACE_REGEX = /{{\s*([^}]+)\s*}}/g;
  // Matches { name } but tries to avoid capturing {{ name }} parts
  // We use a negative lookahead/lookbehind approach or just parse simpler.
  // Regex: { followed by not {, then content, then } not followed by }
  private static readonly SINGLE_BRACE_REGEX = /(?<!{){\s*([^{}]+)\s*}(?!})/g;

  /**
   * Scans the provided full text of the document and returns a list of unique tags.
   * Auto-detects if the user is using {{...}} or {...} style.
   */
  public static findTags(fullText: string): DocxTag[] {
    const tags: DocxTag[] = [];
    const seen = new Set<string>();

    // Strategy: First look for Double Braces (Standard)
    let hasDouble = false;
    let match;
    
    TagDetector.DOUBLE_BRACE_REGEX.lastIndex = 0;
    while ((match = TagDetector.DOUBLE_BRACE_REGEX.exec(fullText)) !== null) {
      hasDouble = true;
      this.addTag(match[0], match[1], tags, seen);
    }

    // If we found significant double braces, we assume that's the style.
    // If we found NONE, we look for single braces.
    // This prevents confusion like "{ function() { code } }" being detected as tags unless intended.
    if (!hasDouble) {
        TagDetector.SINGLE_BRACE_REGEX.lastIndex = 0;
        while ((match = TagDetector.SINGLE_BRACE_REGEX.exec(fullText)) !== null) {
            // Filter out common false positives like JSON or JS code in text
            // A tag usually doesn't have newlines or excessive length
            const name = match[1].trim();
            if (name.length < 50 && !name.includes('\n')) {
                this.addTag(match[0], name, tags, seen);
            }
        }
    }

    // Sort alphabetically for better UX in the form
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  private static addTag(raw: string, name: string, tags: DocxTag[], seen: Set<string>) {
      const cleanName = name.trim();
      if (cleanName && !seen.has(cleanName)) {
        seen.add(cleanName);
        tags.push({
          id: cleanName,
          raw: raw,
          name: cleanName,
        });
      }
  }
}