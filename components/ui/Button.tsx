import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  className = '', 
  variant = 'primary', 
  isLoading, 
  children, 
  disabled,
  ...props 
}) => {
  const baseStyles = "px-4 py-2 rounded-md font-medium transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500",
    secondary: "bg-slate-800 text-white hover:bg-slate-900 focus:ring-slate-500",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-400",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  const opacity = (disabled || isLoading) ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${opacity} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};
