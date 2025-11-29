import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 select-none">
        {label}
      </label>
      <input
        className={`w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 placeholder-slate-400 ${className}`}
        {...props}
      />
    </div>
  );
};
