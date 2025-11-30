/**
 * Represents a tag detected in the DOCX file
 */
export interface DocxTag {
  id: string;      // Unique identifier (usually the tag name itself)
  raw: string;     // The full string including braces, e.g., "{{name}}"
  name: string;    // The clean name, e.g., "name"
}

/**
 * Key-value pair for form data
 */
export type FormDataMap = Record<string, string>;

/**
 * Core processing status for UI feedback
 */
export type ProcessingStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Configuration for the internal DocxManager
 */
export interface DocxConfig {
  delimiters: {
    start: string;
    end: string;
  };
}

/**
 * Error structure for the app
 */
export interface AppError {
  title: string;
  message: string;
  code?: string;
}

/**
 * View Modes for the Application
 */
export type ViewMode = 'generator' | 'creator';

/**
 * Appendix File Structure
 */
export interface AppendixFile {
    id: string;
    file: File;
    name: string;
    type: 'pdf' | 'image';
    previewUrl?: string; // For thumbnail
}