import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
}

export const Stat = forwardRef<HTMLDivElement, StatProps>(
  ({ label, value, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`flex flex-col ${className}`} {...props}>
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-lg font-semibold text-gray-900">{value}</span>
      </div>
    );
  }
);
Stat.displayName = 'Stat';