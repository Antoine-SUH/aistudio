import React, { useState } from 'react';
import { Download, Search, CheckSquare, Square } from 'lucide-react';
import * as FileSaver from 'file-saver';
import { DocxManager } from '../core/DocxManager';
import { AppError } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PreviewPanel } from './PreviewPanel';

// Robust import
const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;

interface CreatorViewProps {
  manager: DocxManager;
  fileName: string;
  onTagsUpdated: () => void;
}

export const CreatorView: React.FC<CreatorViewProps> = ({ manager, fileName, onTagsUpdated }) => {
  // Search & Replace State
  const [searchText, setSearchText] = useState("");
  const [tagName, setTagName] = useState("");
  const [searchResults, setSearchResults] = useState<{ index: number, context: string, selected: boolean }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [error, setError] = useState<AppError | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refreshPreviewTrigger, setRefreshPreviewTrigger] = useState(0);

  // --- Logic ---

  const executeSearch = (text: string) => {
    if (!text) return;
    setIsSearching(true);
    setSearchResults([]);
    setSuccessMsg(null);
    try {
        const results = manager.scanText(text);
        if (results.length === 0) {
            setError({ title: "Not Found", message: `Text "${text}" not found in document.` });
        } else {
            setError(null);
            // Select all by default
            setSearchResults(results.map(r => ({ ...r, selected: true })));
        }
    } catch (err: any) {
        setError({ title: "Search Error", message: err.message });
    } finally {
        setIsSearching(false);
    }
  };

  const handleSearchClick = () => {
      executeSearch(searchText);
  };

  const toggleSelection = (index: number) => {
    setSearchResults(prev => prev.map(item => 
        item.index === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleApplyTags = () => {
    if (!tagName) {
        setError({ title: "Missing Info", message: "Please enter a tag name." });
        return;
    }

    const indicesToReplace = searchResults.filter(r => r.selected).map(r => r.index);
    if (indicesToReplace.length === 0) {
        setError({ title: "No Selection", message: "Please select at least one occurrence to replace." });
        return;
    }

    try {
      manager.replaceSpecificOccurrences(searchText, tagName, indicesToReplace);
      
      setSuccessMsg(`Replaced ${indicesToReplace.length} occurrence(s) with {{${tagName}}}`);
      
      // Reset logic
      setSearchResults([]);
      setSearchText("");
      setTagName("");
      
      // Update UI
      setRefreshPreviewTrigger(prev => prev + 1);
      onTagsUpdated();
    } catch (err: any) {
        setError({ title: "Replacement Failed", message: err.message });
    }
  };

  const handleDownloadTemplate = () => {
     try {
       // CRITICAL: Use exportCurrentZip to save tags without filling them
       const blob = manager.exportCurrentZip();
       saveAs(blob, `template_${fileName}`);
     } catch(e) {
        console.error("Export Error", e);
     }
  };

  const handleTextSelectedFromPreview = (text: string) => {
      // Auto-fill search box AND trigger search when user selects text
      if (text && text.trim().length > 0) {
          const cleanText = text.trim();
          setSearchText(cleanText);
          executeSearch(cleanText);
      }
  };

  // Extract selected indices to pass to preview for highlighting
  const activeMatchIndices = searchResults
      .filter(r => r.selected)
      .map(r => r.index);

  // --- Render ---

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/3 min-w-[350px] max-w-[500px] bg-white border-r border-slate-200 flex flex-col z-10 shadow-lg">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-700 truncate">{fileName} (Template Mode)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Highlight text in the preview or type below to replace it with tags.
          </p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Step 1: Search */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
             <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">1. Find Text</h4>
             <div className="flex gap-2">
                <input 
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="Highlight in preview or type..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                />
                <Button onClick={handleSearchClick} disabled={!searchText} variant="secondary" className="px-3">
                    <Search size={16} />
                </Button>
             </div>
          </div>

          {/* Step 2: Select Occurrences */}
          {searchResults.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex justify-between items-center">
                      2. Select Occurrences
                      <span className="text-slate-400 font-normal normal-case text-xs bg-white px-2 py-1 rounded border border-slate-200">
                          {searchResults.filter(r => r.selected).length} selected
                      </span>
                  </h4>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {searchResults.map((item) => (
                          <div 
                            key={item.index} 
                            onClick={() => toggleSelection(item.index)}
                            className={`p-3 rounded-md border cursor-pointer text-xs flex gap-3 items-start transition-all ${
                                item.selected ? 'bg-purple-50 border-purple-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                              <div className={`mt-0.5 ${item.selected ? 'text-purple-600' : 'text-slate-300'}`}>
                                  {item.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </div>
                              <p className="text-slate-700 leading-relaxed break-words font-mono">
                                  {item.context.split(new RegExp(`(${searchText})`, 'gi')).map((part, i) => 
                                      part.toLowerCase() === searchText.toLowerCase() 
                                      ? <span key={i} className="bg-yellow-200 font-bold text-slate-900 px-1 rounded">{part}</span> 
                                      : part
                                  )}
                              </p>
                          </div>
                      ))}
                  </div>

                  {/* Step 3: Apply Tag */}
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                      <Input 
                        label="3. Replace with Tag Name" 
                        placeholder="e.g. client_name" 
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value)}
                      />
                      <Button onClick={handleApplyTags} className="w-full bg-purple-600 hover:bg-purple-700">
                          Apply Replacements
                      </Button>
                  </div>
              </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md border border-green-200 flex items-center gap-2">
               <CheckSquare size={16} /> {successMsg}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
              <span className="font-bold block mb-1">{error.title}</span>
              {error.message}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
           <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">
              <Download size={18} /> Download New Template
           </Button>
        </div>
      </div>

      <div className="flex-1 bg-slate-100 relative">
        <PreviewPanel 
          manager={manager} 
          data={{}} 
          triggerRefresh={refreshPreviewTrigger} 
          onTextSelection={handleTextSelectedFromPreview}
          highlightSearchTerm={searchText}
          highlightIndices={activeMatchIndices}
        />
      </div>
    </div>
  );
};