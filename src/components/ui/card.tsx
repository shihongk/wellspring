import { forwardRef, HTMLAttributes } from 'react';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`rounded-xl border border-gray-200 bg-white shadow-sm p-4 ${className}`} {...props} />
    );
  }
);
Card.displayName = 'Card';