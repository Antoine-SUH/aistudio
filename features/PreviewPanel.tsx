import React, { useEffect, useRef, useState } from 'react';
import { DocxManager } from '../core/DocxManager';
import { FormDataMap } from '../types';

interface PreviewPanelProps {
  manager: DocxManager;
  data: FormDataMap;
  triggerRefresh: number;
  onTextSelection?: (text: string) => void;
  // New props for highlighting search results
  highlightSearchTerm?: string;
  highlightIndices?: number[];
  // New prop for appendices
  appendixImages?: string[]; 
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  manager, 
  data, 
  triggerRefresh, 
  onTextSelection,
  highlightSearchTerm,
  highlightIndices = [],
  appendixImages = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Render the Document
  useEffect(() => {
    const render = async () => {
      if (!containerRef.current || !manager.hasLoaded()) return;
      
      try {
        setError(null);
        containerRef.current.innerHTML = ''; 
        await manager.renderPreview(containerRef.current, data);
        
        // Stylize {{tags}} but keep them clean
        stylizeTags(containerRef.current);
        
        // Re-apply highlights if they exist after a full re-render
        if (highlightSearchTerm && highlightSearchTerm.trim() !== '') {
           applySearchHighlights(containerRef.current, highlightSearchTerm, highlightIndices);
        }

      } catch (err) {
        setError("Failed to render preview. The document might be too complex for the web renderer.");
      }
    };

    render();
  }, [manager, triggerRefresh, data]);

  // 2. Apply Temporary Highlights (Only when selection changes, no full re-render)
  useEffect(() => {
      if (!containerRef.current) return;
      
      // Clean up previous highlights first to avoid duplication
      removeSearchHighlights(containerRef.current);

      if (highlightSearchTerm && highlightSearchTerm.trim() !== '') {
          // Wrap in rAF to ensure DOM is stable
          requestAnimationFrame(() => {
             if (containerRef.current) {
                applySearchHighlights(containerRef.current, highlightSearchTerm, highlightIndices);
             }
          });
      }
  }, [highlightSearchTerm, highlightIndices]);

  // 3. Setup Text Selection Listener
  useEffect(() => {
      if (!onTextSelection) return;

      const handleMouseUp = () => {
          const selection = window.getSelection();
          if (selection && selection.toString().trim().length > 0) {
              if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
                  onTextSelection(selection.toString());
              }
          }
      };

      document.addEventListener('mouseup', handleMouseUp);
      return () => {
          document.removeEventListener('mouseup', handleMouseUp);
      };
  }, [onTextSelection]);

  const stylizeTags = (root: HTMLElement) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodesToReplace: { node: Text, content: string }[] = [];

    let node;
    while (node = walker.nextNode() as Text) {
       if (node.nodeValue && node.nodeValue.includes('{{') && node.nodeValue.includes('}}')) {
           nodesToReplace.push({ node: node, content: node.nodeValue });
       }
    }

    nodesToReplace.forEach(({ node, content }) => {
        const span = document.createElement('span');
        const html = content.replace(
            /{{(.*?)}}/g, 
            '<span class="docx-tag-clean">{{$1}}</span>'
        );
        span.innerHTML = html;
        node.replaceWith(span);
    });
  };

  /**
   * Robust Highlighting Logic
   */
  const applySearchHighlights = (root: HTMLElement, term: string, targetIndices: number[]) => {
      if (!term) return;
      
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let node;
      
      while (node = walker.nextNode() as Text) {
          if (node.nodeValue && node.nodeValue.toLowerCase().includes(term.toLowerCase())) {
              textNodes.push(node);
          }
      }

      let globalMatchIndex = 0;

      textNodes.forEach((textNode) => {
          const content = textNode.nodeValue || "";
          const parts = content.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
          
          if (parts.length > 1) {
              const spanWrapper = document.createElement('span');
              spanWrapper.className = 'docx-highlight-wrapper'; // Marker class for cleanup
              
              parts.forEach((part) => {
                  if (part.toLowerCase() === term.toLowerCase()) {
                      const isSelected = targetIndices.includes(globalMatchIndex);
                      
                      const mark = document.createElement('span');
                      mark.textContent = part;
                      
                      if (isSelected) {
                          mark.className = 'docx-search-highlight';
                      }
                      
                      spanWrapper.appendChild(mark);
                      globalMatchIndex++;
                  } else {
                      spanWrapper.appendChild(document.createTextNode(part));
                  }
              });
              
              textNode.replaceWith(spanWrapper);
          }
      });
  };

  const removeSearchHighlights = (root: HTMLElement) => {
      // Find wrapper spans we created and unwrap them
      const wrappers = root.querySelectorAll('.docx-highlight-wrapper');
      wrappers.forEach(el => {
          const parent = el.parentNode;
          if (parent) {
              // Replace the wrapper with its text content (effectively removing the highlight spans inside)
              parent.replaceChild(document.createTextNode(el.textContent || ""), el);
              parent.normalize();
          }
      });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 text-slate-400 p-8 text-center border-2 border-dashed border-slate-300 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-200 overflow-auto rounded-lg shadow-inner p-8 custom-scrollbar relative flex flex-col items-center gap-8">
      <style>{`
        .docx-paper {
          font-family: 'Calibri', 'Segoe UI', 'Roboto', 'Arial', sans-serif;
          color: black;
          line-height: 1.15;
          /* Explicit page styling */
          background: white;
          box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
          margin-left: auto;
          margin-right: auto;
          /* A4 Dimensions */
          width: 794px;
          min-height: 1123px;
          padding: 48px;
          box-sizing: border-box;
          transform-origin: top;
        }

        .docx-paper ::selection { background: #a855f7; color: white; }
        
        .docx-tag-clean {
          font-family: 'Courier New', monospace;
          color: #4b5563;
          font-weight: 600;
        }

        .docx-search-highlight {
          background-color: #fef08a !important; 
          outline: 2px solid #fde047;
          border-radius: 2px;
          color: black;
        }

        /* Basic Word Styles Restoration */
        .docx-paper h1 { font-size: 24pt; font-weight: bold; margin-bottom: 12pt; color: #2e2e2e; }
        .docx-paper h2 { font-size: 18pt; font-weight: bold; margin-bottom: 10pt; color: #2e2e2e; }
        .docx-paper h3 { font-size: 14pt; font-weight: bold; margin-bottom: 8pt; color: #4e4e4e; }
        .docx-paper h4 { font-size: 12pt; font-weight: bold; margin-bottom: 6pt; }
        .docx-paper p { margin-bottom: 10pt; }
        .docx-paper strong, .docx-paper b { font-weight: 700; }
        .docx-paper table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; border: 1px solid #d1d5db; }
        .docx-paper td, .docx-paper th { border: 1px solid #000; padding: 4pt 8pt; vertical-align: top; }
        .docx-paper img { max-width: 100%; height: auto; }
        
        .appendix-page img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
      `}</style>

      {/* Main Document Page */}
      <div 
        ref={containerRef} 
        className="docx-paper text-black"
      />

      {/* Appendix Pages */}
      {appendixImages.map((imgUrl, idx) => (
          <div key={idx} className="docx-paper appendix-page flex items-center justify-center p-0 overflow-hidden relative">
              <span className="absolute top-2 right-2 bg-slate-200 text-slate-500 text-[10px] px-2 py-1 rounded">
                  Appendix {idx + 1}
              </span>
              <img src={imgUrl} alt={`Appendix page ${idx + 1}`} />
          </div>
      ))}
    </div>
  );
};
