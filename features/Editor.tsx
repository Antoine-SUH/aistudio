import React, { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, Paperclip, FileJson, ArrowUp, ArrowDown, Trash2, FileText, Image as ImageIcon, Printer } from 'lucide-react';
import * as FileSaver from 'file-saver';
import { DocxManager } from '../core/DocxManager';
import { DocxTag, FormDataMap, AppError, AppendixFile } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PreviewPanel } from './PreviewPanel';
import { AppendicesModal } from './AppendicesModal';
import { PdfRasterizer } from '../core/PdfRasterizer';
import { DocxAppender } from '../core/DocxAppender';

// Robust import
const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;

interface GeneratorViewProps {
  manager: DocxManager;
  tags: DocxTag[];
  fileName: string;
}

export const GeneratorView: React.FC<GeneratorViewProps> = ({ manager, tags, fileName }) => {
  const [formData, setFormData] = useState<FormDataMap>({});
  const [error, setError] = useState<AppError | null>(null);
  const [refreshPreviewTrigger, setRefreshPreviewTrigger] = useState(0);
  
  // Appendices State
  const [appendices, setAppendices] = useState<AppendixFile[]>([]);
  const [appendixPreviewUrls, setAppendixPreviewUrls] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);

  // Initialize form data when tags change
  useEffect(() => {
    const initialData: FormDataMap = {};
    tags.forEach(tag => {
      initialData[tag.name] = "";
    });
    setFormData(prev => {
        // Keep existing values if keys match
        return { ...initialData, ...prev };
    });
  }, [tags]);

  // Process Appendices for Preview whenever the list changes
  useEffect(() => {
    const generateAppendixPreviews = async () => {
        if (appendices.length === 0) {
            setAppendixPreviewUrls([]);
            return;
        }

        setIsPreviewProcessing(true);
        const urls: string[] = [];

        try {
            for (const item of appendices) {
                if (item.type === 'image') {
                    urls.push(URL.createObjectURL(item.file));
                } else if (item.type === 'pdf') {
                    // Rasterize PDF pages for preview
                    try {
                        const buffers = await PdfRasterizer.convertToImages(item.file);
                        buffers.forEach(buf => {
                            const blob = new Blob([buf], { type: 'image/jpeg' });
                            urls.push(URL.createObjectURL(blob));
                        });
                    } catch (e) {
                        console.error("Failed to preview PDF", item.name, e);
                    }
                }
            }
            setAppendixPreviewUrls(urls);
        } catch (e) {
            console.error("Error generating preview for appendices", e);
        } finally {
            setIsPreviewProcessing(false);
        }
    };

    generateAppendixPreviews();

    // Cleanup URLs on unmount or change to prevent memory leaks
    return () => {
        appendixPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [appendices]);

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const updatePreview = () => {
    setRefreshPreviewTrigger(prev => prev + 1);
  };

  const previewData = useMemo(() => {
    const data = { ...formData };
    tags.forEach(tag => {
      if (!data[tag.name] || data[tag.name].trim() === "") {
        data[tag.name] = `{{${tag.name}}}`;
      }
    });
    return data;
  }, [formData, tags]);

  // --- Appendix Management Handlers ---
  const moveAppendix = (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= appendices.length) return;
      
      const newItems = [...appendices];
      const [removed] = newItems.splice(index, 1);
      newItems.splice(newIndex, 0, removed);
      setAppendices(newItems);
  };

  const removeAppendix = (id: string) => {
      setAppendices(prev => prev.filter(a => a.id !== id));
  };

  // --- Main Generation Logic with Appendices ---
  const handleDownloadFullDoc = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // 1. Generate base filled DOCX
      const filledDocBlob = manager.generateDocument(formData);
      if (!filledDocBlob || filledDocBlob.size === 0) throw new Error("Generated file is empty.");

      let finalBlob = filledDocBlob;

      // 2. If appendices exist, process them
      if (appendices.length > 0) {
          console.log("Processing appendices...");
          const allImages: ArrayBuffer[] = [];

          for (const item of appendices) {
              if (item.type === 'pdf') {
                  const images = await PdfRasterizer.convertToImages(item.file);
                  allImages.push(...images);
              } else {
                  allImages.push(await item.file.arrayBuffer());
              }
          }

          // 3. Append images to DOCX
          finalBlob = await DocxAppender.appendImages(filledDocBlob, allImages);
      }

      saveAs(finalBlob, `filled_${fileName}`);
    } catch (err: any) {
      console.error("Export Error:", err);
      setError({ 
        title: "Export Failed", 
        message: err.message || "An error occurred while generating the document." 
      });
    } finally {
        setIsGenerating(false);
    }
  };

  const handlePrintPdf = () => {
      // Trigger browser print dialog
      // The CSS in PreviewPanel handles the 'print' media query
      window.print();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setFormData(prev => ({...prev, ...json}));
        setRefreshPreviewTrigger(prev => prev + 1); 
      } catch (err) {
        setError({ title: "JSON Error", message: "Invalid JSON file" });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: Form */}
      <div className="w-1/3 min-w-[350px] max-w-[500px] bg-white border-r border-slate-200 flex flex-col z-10 shadow-lg">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-semibold text-slate-700 truncate" title={fileName}>{fileName}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Section 1: Form Fields */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Form Fields ({tags.length})</h4>
                <div className="flex gap-2">
                    <label className="cursor-pointer text-slate-500 hover:text-primary-600" title="Import JSON">
                        <FileJson size={18} />
                        <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
                    </label>
                </div>
            </div>

            <div className="space-y-4">
                {tags.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No tags found. Go to the "Creator" tab to add some.
                    </div>
                ) : (
                    tags.map(tag => (
                    <Input
                        key={tag.id}
                        label={tag.name}
                        value={formData[tag.name] || ''}
                        onChange={(e) => handleInputChange(tag.name, e.target.value)}
                        placeholder={`Value for ${tag.name}`}
                    />
                    ))
                )}
            </div>
            
            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200 text-left">
                <span className="font-bold block mb-1">{error.title}</span>
                <p className="whitespace-pre-wrap text-xs">{error.message}</p>
                </div>
            )}
          </div>

          {/* Section 2: Appendices List (Compact View) */}
          {appendices.length > 0 && (
              <div className="pt-6 border-t border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                      Attached Files ({appendices.length})
                  </h4>
                  <div className="space-y-2">
                      {appendices.map((item, index) => (
                          <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg group hover:border-slate-300 transition-colors">
                                {/* Type Icon */}
                                <div className="w-8 h-8 rounded bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                                    {item.type === 'pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
                                </div>
                                
                                {/* Name */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 truncate" title={item.name}>{item.name}</p>
                                </div>
                                
                                {/* Controls */}
                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => moveAppendix(index, -1)} 
                                        disabled={index === 0}
                                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 hover:bg-slate-200 rounded"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button 
                                        onClick={() => moveAppendix(index, 1)} 
                                        disabled={index === appendices.length - 1}
                                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 hover:bg-slate-200 rounded"
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                    <div className="w-px h-3 bg-slate-300 mx-1"></div>
                                    <button 
                                        onClick={() => removeAppendix(item.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <Button onClick={updatePreview} variant="secondary" className="w-full">
            <RefreshCw size={18} /> Update Preview
          </Button>

          {/* Appendices Button - Full Width */}
          <Button onClick={() => setIsModalOpen(true)} variant="outline" className="w-full relative text-sm">
               <Paperclip size={18} /> Manage Appendices
               {appendices.length > 0 && (
                   <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                       {appendices.length}
                   </span>
               )}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            {/* Print PDF Button */}
            <Button onClick={handlePrintPdf} variant="outline" className="text-slate-600 hover:text-slate-800 border-slate-300">
                <Printer size={18} /> PDF Beta
            </Button>
            
            {/* Download DOCX */}
            <Button onClick={handleDownloadFullDoc} variant="primary" isLoading={isGenerating}>
              <Download size={18} /> Download
            </Button>
          </div>
        </div>
      </div>

      {/* Main Area: Preview */}
      <div className="flex-1 bg-slate-100 relative">
        <PreviewPanel 
          manager={manager} 
          data={previewData} 
          triggerRefresh={refreshPreviewTrigger} 
          appendixImages={appendixPreviewUrls}
        />
        
        {/* Loading Overlay for Appendix Processing */}
        {isPreviewProcessing && (
            <div className="absolute top-4 right-4 bg-white/90 px-4 py-2 rounded-full shadow-lg text-sm text-primary-600 font-medium flex items-center gap-2 animate-in fade-in z-50">
                <RefreshCw size={14} className="animate-spin" /> Rendering appendices...
            </div>
        )}
      </div>

      {/* Appendices Modal */}
      <AppendicesModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        appendices={appendices}
        onUpdate={setAppendices}
      />
    </div>
  );
};