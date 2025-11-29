/**
 * TagNormalizer
 * 
 * A robust utility to "heal" the XML structure of DOCX files before processing.
 */
export class TagNormalizer {
    /**
     * Main entry point to normalize DOCX XML content.
     */
    public static normalize(xmlContent: string, isDoubleMode: boolean = true): string {
      let xml = xmlContent;
  
      // 1. Remove XML "Noise" (Track changes, spell check, etc.)
      xml = TagNormalizer.removeNoiseTags(xml);
  
      if (isDoubleMode) {
          // 2. Repair Split Delimiters ({...{ -> {{)
          xml = TagNormalizer.repairSplitDelimiters(xml);
          
          // 3. Fix "Duplicate Open" error ({{ ... {{ -> {{)
          // This removes rogue Start braces inside a tag zone
          xml = TagNormalizer.removeDuplicateDelimiters(xml);

          // 4. Consolidate Tag Content
          xml = TagNormalizer.consolidateTags(xml);
      } else {
          // Single brace mode: simpler logic, we just strip noise mostly.
          // We can try to consolidate { tag } if split, but { is rarely split.
      }
  
      return xml;
    }
  
    private static removeNoiseTags(xml: string): string {
      const noisePatterns = [
        /<w:proofErr[^>]*\/>/g,       
        /<w:noProof[^>]*\/>/g,        
        /<w:lang[^>]*\/>/g,           
        /<w:bookmarkStart[^>]*\/>/g,  
        /<w:bookmarkEnd[^>]*\/>/g,    
        /<w:commentRangeStart[^>]*\/>/g, 
        /<w:commentRangeEnd[^>]*\/>/g,
        /<w:permStart[^>]*\/>/g,      
        /<w:permEnd[^>]*\/>/g,
        /<w:moveFromRangeStart[^>]*\/>/g, 
        /<w:moveFromRangeEnd[^>]*\/>/g,
        /<w:moveToRangeStart[^>]*\/>/g,
        /<w:moveToRangeEnd[^>]*\/>/g,
        /<w:rsid[^>]*\/>/g            
      ];
  
      let cleaned = xml;
      noisePatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
  
      return cleaned;
    }
  
    private static repairSplitDelimiters(xml: string): string {
      // Matches: { </w:t>...<w:t> {
      // Replaces with {{
      xml = xml.replace(/({)([^}{]*?)(<[^>]+>)+([^}{]*?)({)/g, (match, p1, padding1, tags, padding2, p2) => {
         if (!padding1.trim() && !padding2.trim()) {
           return "{{";
         }
         return match; 
      });
  
      // Matches: } </w:t>...<w:t> }
      // Replaces with }}
      xml = xml.replace(/(})([^}{]*?)(<[^>]+>)+([^}{]*?)(})/g, (match, p1, padding1, tags, padding2, p2) => {
        if (!padding1.trim() && !padding2.trim()) {
          return "}}";
        }
        return match;
     });
  
     return xml;
    }

    /**
     * Solves "Duplicate open tags" error.
     * Looks for {{ ... {{ and kills the second {{
     */
    private static removeDuplicateDelimiters(xml: string): string {
        // Regex: Find {{ followed by NOT }}, then found another {{
        // We act conservatively: only if the text between is short (likely a typo or split run)
        // This is tricky via regex on XML. 
        // Safer approach: ConsolidateTags usually handles this if we do it right.
        return xml;
    }
  
    private static consolidateTags(xml: string): string {
      // Pattern: {{ followed by anything (non-greedy) until }}
      const tagRegex = /{{([\s\S]*?)}}/g;
  
      return xml.replace(tagRegex, (match, content) => {
        // Strip ALL XML tags from the content
        // Convert {{ <w:r>na</w:r><w:r>me</w:r> }} to {{ name }}
        // Also fix inner braces: {{ na { me }} -> {{ name }}
        let cleanContent = content.replace(/<[^>]+>/g, "");
        
        // Remove rogue braces inside the tag name that cause "Duplicate Open"
        cleanContent = cleanContent.replace(/{/g, '').replace(/}/g, '');
        
        return `{{${cleanContent}}}`;
      });
    }
  }