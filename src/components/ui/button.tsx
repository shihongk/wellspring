import { forwardRef, ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', style, ...props }, ref) => {
    const base = 'px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed';

    if (variant === 'primary') {
      return (
        <button
          ref={ref}
          className={`${base} text-white ${className}`}
          style={{ backgroundColor: '#0e7490', ...style }}
          {...props}
        />
      );
    }

    if (variant === 'danger') {
      return (
        <button
          ref={ref}
          className={`${base} text-white ${className}`}
          style={{ backgroundColor: '#dc2626', ...style }}
          {...props}
        />
      );
    }

    // secondary
    return (
      <button
        ref={ref}
        className={`${base} bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 ${className}`}
        style={style}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
