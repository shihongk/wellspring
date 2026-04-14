import { forwardRef, SelectHTMLAttributes } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white disabled:bg-gray-100 disabled:text-gray-500 ${className}`}
        {...props}
      />
    );
  }
);
Select.displayName = 'Select';