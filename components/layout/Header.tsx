import React from 'react';
import { FileText, Edit3, Zap } from 'lucide-react';
import { ViewMode } from '../../types';

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  disabled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onViewChange, disabled }) => {
  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 shadow-sm sticky top-0 z-50">
      <div className="flex items-center gap-2 text-primary-600 mr-8">
        <FileText size={24} />
        <h1 className="font-bold text-xl tracking-tight text-slate-800">Smart Docx Editor</h1>
      </div>

      {!disabled && (
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => onViewChange('generator')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              currentView === 'generator'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Zap size={16} /> Generator
          </button>
          <button
            onClick={() => onViewChange('creator')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              currentView === 'creator'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Edit3 size={16} /> Creator
          </button>
        </div>
      )}

      <div className="ml-auto text-sm text-slate-500">
        v2.1.0
      </div>
    </header>
  );
};
