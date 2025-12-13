import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;
  
  const inputClasses = `
    mt-1 block w-full rounded-md border px-3 py-2 text-foreground placeholder-zinc-400 shadow-sm
    focus:outline-none focus:ring-2 focus:ring-offset-0
    ${hasError 
      ? 'border-error-border focus:border-error focus:ring-error' 
      : 'border-border focus:border-accent focus:ring-accent'
    }
    ${className}
  `.trim();
  
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={inputClasses}
        aria-invalid={hasError}
        aria-describedby={
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
        {...props}
      />
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-sm text-error-text"
          role="alert"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="mt-1 text-sm text-foreground opacity-70"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}





