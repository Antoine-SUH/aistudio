import React, { useCallback, useState } from 'react';
import { X, Upload, FileText, Image as ImageIcon, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AppendixFile } from '../types';

interface AppendicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  appendices: AppendixFile[];
  onUpdate: (files: AppendixFile[]) => void;
}

export const AppendicesModal: React.FC<AppendicesModalProps> = ({ isOpen, onClose, appendices, onUpdate }) => {
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: AppendixFile[] = Array.from(files).map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        name: f.name,
        type: f.type.includes('pdf') ? 'pdf' : 'image',
        previewUrl: f.type.includes('image') ? URL.createObjectURL(f) : undefined
    }));
    onUpdate([...appendices, ...newFiles]);
  };

  const removeFile = (id: string) => {
      onUpdate(appendices.filter(a => a.id !== id));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= appendices.length) return;
      
      const newItems = [...appendices];
      const [removed] = newItems.splice(index, 1);
      newItems.splice(newIndex, 0, removed);
      onUpdate(newItems);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-lg text-slate-800">Manage Appendices</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
            {/* Drop Zone */}
            <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    isDragging ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                }}
            >
                <Upload className="mx-auto text-slate-400 mb-4" size={32} />
                <p className="text-slate-600 font-medium mb-1">Drag & Drop PDF or Images here</p>
                <p className="text-slate-400 text-sm mb-4">or</p>
                <label className="inline-block">
                    <input 
                        type="file" 
                        multiple 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        className="hidden" 
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                    <span className="bg-white border border-slate-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 cursor-pointer shadow-sm text-slate-700">
                        Browse Files
                    </span>
                </label>
            </div>

            {/* List */}
            <div className="mt-6 space-y-3">
                {appendices.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm italic mt-8">No appendices attached yet.</p>
                ) : (
                    appendices.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm group">
                            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {item.type === 'pdf' ? (
                                    <FileText className="text-red-500" size={20} />
                                ) : (
                                    item.previewUrl ? <img src={item.previewUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-blue-500" size={20} />
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                                <p className="text-xs text-slate-400 uppercase">{item.type} • {(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => moveFile(index, -1)} disabled={index === 0} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30">
                                    <ArrowUp size={16} className="text-slate-500" />
                                </button>
                                <button onClick={() => moveFile(index, 1)} disabled={index === appendices.length - 1} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30">
                                    <ArrowDown size={16} className="text-slate-500" />
                                </button>
                                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                <button onClick={() => removeFile(item.id)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <Button onClick={onClose} variant="primary">Done</Button>
        </div>
      </div>
    </div>
  );
};