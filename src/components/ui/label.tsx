import { forwardRef, LabelHTMLAttributes } from 'react';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <label ref={ref} className={`block text-sm font-medium text-gray-700 mb-1 ${className}`} {...props} />
    );
  }
);
Label.displayName = 'Label';