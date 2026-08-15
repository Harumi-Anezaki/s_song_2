import React, { useEffect, useRef } from 'react';
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  rows?: number;
}
export function AutoResizeTextarea({ className, style, rows, onChange, value, ...rest }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      {...rest}
      value={value}
      className={`text-base sm:text-sm min-h-[44px] sm:min-h-0 py-2 sm:py-1 ${className || ''}`}
      ref={ref}
      rows={rows || 1}
      style={{ ...style, resize: 'none', overflow: 'hidden' }}
      onChange={(e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
        if (onChange) onChange(e);
      }}
    />
  );
}
