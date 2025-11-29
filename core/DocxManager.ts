import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { renderAsync } from 'docx-preview';
import { TagDetector } from './TagDetector';
import { TagNormalizer } from './TagNormalizer';
import { DocxTag, FormDataMap } from '../types';

/**
 * DocxManager
 * 
 * The main orchestrator for the internal library.
 * Encapsulates PizZip and Docxtemplater processing.
 * Implements the "Smart Editor" logic with robust error handling.
 */
export class DocxManager {
  private zip: PizZip | null = null;
  private doc: Docxtemplater | null = null;
  private originalContent: ArrayBuffer | null = null;
  private loadErrors: any[] = [];
  
  // Smart delimiter detection
  private delimiterConfig = { start: '{{', end: '}}' };

  public load(content: ArrayBuffer): void {
    this.originalContent = content;
    this.loadErrors = [];
    this.doc = null;
    this.zip = null;

    this.detectDelimiters(content);

    try {
      const healedContent = this.healDocumentXml(content);
      this.zip = new PizZip(healedContent);
    } catch (error) {
      console.error("Zip Load Error:", error);
      throw new Error("Failed to read file. It may not be a valid DOCX/Zip file.");
    }

    this.initializeDocxtemplater();
  }

  private initializeDocxtemplater() {
    if (!this.zip) return;
    try {
      this.doc = new Docxtemplater(this.zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: this.delimiterConfig,
        nullGetter: () => "",
        // @ts-ignore
        errorLogging: false 
      });
    } catch (error: any) {
      if (error.properties && error.properties.errors) {
        console.warn("Docxtemplater parsing errors (entering fallback mode):", error.properties.errors);
        this.loadErrors = error.properties.errors;
      } else {
        console.error("Docxtemplater Unknown Error:", error);
        throw new Error("Critical error initializing template engine.");
      }
    }
  }

  /**
   * Scans the document for a specific text string using XML-aware logic.
   * Returns a list of occurrences with "context" so the user can identify them.
   */
  public scanText(searchText: string): { index: number, context: string }[] {
    if (!this.zip) throw new Error("No document loaded");
    const docXmlFile = this.zip.file("word/document.xml");
    if (!docXmlFile) throw new Error("No document.xml found");
    
    const xml = docXmlFile.asText();
    
    // Construct the XML-aware regex (Same as replaceSpecificOccurrences)
    const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const chars = escapedSearch.split('');
    // Allow any number of XML tags between characters
    const patternString = chars.join('(<[^>]+>)*'); 
    const regex = new RegExp(patternString, 'gi'); // Case insensitive for search
    
    const matches: { index: number, context: string }[] = [];
    let match;
    let count = 0;
    
    while ((match = regex.exec(xml)) !== null) {
        // Robust Context Extraction
        // 1. Grab a large chunk of XML around the match
        const range = 200;
        const start = Math.max(0, match.index - range);
        const end = Math.min(xml.length, match.index + match[0].length + range);
        const rawChunk = xml.substring(start, end);

        // 2. Aggressively strip XML tags to get "Human Text"
        // We replace tags with spaces to avoid merging words like "End</p><p>Start" -> "EndStart"
        let cleanText = rawChunk.replace(/<[^>]+>/g, ' '); 
        
        // 3. Normalize whitespace (tabs, newlines, multi-spaces -> single space)
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        // 4. Find the search text inside this clean chunk to center the context
        // Since we stripped tags, the position is approximate, but good enough for UI context
        const lowerChunk = cleanText.toLowerCase();
        const lowerSearch = searchText.toLowerCase();
        const textIndex = lowerChunk.indexOf(lowerSearch);
        
        let finalContext = "";
        if (textIndex !== -1) {
            // Center around the found text
            const ctxStart = Math.max(0, textIndex - 30);
            const ctxEnd = Math.min(cleanText.length, textIndex + searchText.length + 30);
            finalContext = "..." + cleanText.substring(ctxStart, ctxEnd) + "...";
        } else {
            // Fallback if regex match was weirdly split (e.g. across paragraphs)
            finalContext = "..." + cleanText.substring(0, Math.min(60, cleanText.length)) + "...";
        }
        
        matches.push({
            index: count,
            context: finalContext
        });
        count++;
    }
    
    return matches;
  }

  /**
   * Replaces ONLY the specified occurrences of a text with a tag.
   */
  public replaceSpecificOccurrences(searchText: string, tagName: string, indicesToReplace: number[]): void {
      if (!this.zip) throw new Error("No document loaded");
      const docXmlFile = this.zip.file("word/document.xml");
      if (!docXmlFile) throw new Error("Could not find document.xml");
  
      let xml = docXmlFile.asText();
      const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const chars = escapedSearch.split('');
      const patternString = chars.join('(<[^>]+>)*');
      const regex = new RegExp(patternString, 'g'); 
  
      const newTag = `{{${tagName}}}`;
      let matchCount = 0;
      
      xml = xml.replace(regex, (match) => {
          const currentIndex = matchCount;
          matchCount++;
          
          if (indicesToReplace.includes(currentIndex)) {
              return newTag;
          }
          return match; // Keep original text
      });
  
      if (matchCount === 0) {
          throw new Error(`Text "${searchText}" not found in the document structure.`);
      }
  
      // Update Zip
      this.zip.file("word/document.xml", xml);
      
      // Update internal state
      const newZipData = this.zip.generate({ type: "arraybuffer" });
      this.originalContent = newZipData;
      this.load(newZipData);
  }

  /**
   * Exports the CURRENT state of the zip file without running the template engine.
   */
  public exportCurrentZip(): Blob {
      if (!this.zip) throw new Error("No file loaded");
      return this.zip.generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
  }

  private detectDelimiters(content: ArrayBuffer) {
      try {
          const zip = new PizZip(content);
          const xml = zip.file("word/document.xml")?.asText() || "";
          const doubleOpen = (xml.match(/{{/g) || []).length;
          const singleOpen = (xml.match(/{/g) || []).length;
          
          if (doubleOpen === 0 && singleOpen > 0) {
              this.delimiterConfig = { start: '{', end: '}' };
          } else {
              this.delimiterConfig = { start: '{{', end: '}}' };
          }
      } catch (e) {
          this.delimiterConfig = { start: '{{', end: '}}' };
      }
  }

  public getTags(): DocxTag[] {
    if (!this.zip) throw new Error("No document loaded");
    let fullText = "";
    try {
      if (this.doc) {
        fullText = this.doc.getFullText();
      } else {
        const docXml = this.zip.file("word/document.xml");
        if (docXml) fullText = docXml.asText().replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ");
        const headerFiles = Object.keys(this.zip.files).filter(f => f.startsWith('word/header') || f.startsWith('word/footer'));
        headerFiles.forEach(f => {
            const t = this.zip!.file(f)?.asText();
            if(t) fullText += " " + t.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ");
        });
      }
      return TagDetector.findTags(fullText);
    } catch (error) {
      console.error("Tag Extraction Error:", error);
      throw new Error("Failed to parse document text.");
    }
  }

  public generateDocument(data: FormDataMap): Blob {
    if (!this.zip || !this.originalContent) throw new Error("No document loaded");
    try {
      const healedContent = this.healDocumentXml(this.originalContent);
      return this.executeGeneration(healedContent, data);
    } catch (error: any) {
       console.error("Generation failed:", error);
       this.throwHumanReadableError(error);
       throw error;
    }
  }

  private executeGeneration(content: ArrayBuffer, data: FormDataMap): Blob {
    const generationZip = new PizZip(content);
    const generationDoc = new Docxtemplater(generationZip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: this.delimiterConfig,
      nullGetter: () => "", 
      // @ts-ignore
      errorLogging: false 
    });
    generationDoc.render(data);
    return generationDoc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  private healDocumentXml(content: ArrayBuffer): ArrayBuffer {
    const zip = new PizZip(content);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) return content; 
    const originalXml = docXmlFile.asText();
    const isDoubleMode = this.delimiterConfig.start === '{{';
    const healedXml = TagNormalizer.normalize(originalXml, isDoubleMode);
    zip.file("word/document.xml", healedXml);
    return zip.generate({ type: "arraybuffer" });
  }

  private throwHumanReadableError(error: any): void {
      const errors = error.properties?.errors || error.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const messages = errors.map((e: any, index: number) => {
             const expl = e.properties?.explanation || e.message;
             const context = e.properties?.context ? ` (Context: ${e.properties.context})` : "";
             return `${index + 1}. ${expl}${context}`;
        }).join('\n');
        throw new Error(`Template Syntax Errors:\n${messages}`);
      }
      throw new Error(error.message || "Failed to generate document.");
  }

  public async renderPreview(container: HTMLElement, data?: FormDataMap): Promise<void> {
    if (!this.originalContent) return;
    let contentToRender: ArrayBuffer;
    try {
        contentToRender = this.healDocumentXml(this.originalContent);
    } catch (e) {
        contentToRender = this.originalContent;
    }
    if (data && Object.keys(data).length > 0) {
        try {
            const blob = this.executeGeneration(contentToRender, data);
            contentToRender = await blob.arrayBuffer();
        } catch (e) {
            console.warn("Preview generation failed", e);
        }
    }
    try {
      await renderAsync(contentToRender, container, undefined, {
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        debug: false,
        experimental: false,
      });
    } catch (error) {
      console.error("Preview Render Error:", error);
      throw new Error("Failed to render preview.");
    }
  }

  public hasLoaded(): boolean {
    return this.zip !== null;
  }
  
  public getLoadErrors(): any[] {
      return this.loadErrors;
  }
}