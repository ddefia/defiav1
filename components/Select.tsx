import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 font-display">
        {label}
      </label>
      <div className="relative">
        <select
          className={`block w-full pl-3 pr-10 py-3 text-sm bg-white border border-brand-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent focus:border-brand-accent text-brand-text appearance-none transition-colors hover:border-gray-400 shadow-sm ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg className="w-4 h-4 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};