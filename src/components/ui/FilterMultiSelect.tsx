import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, X, Search } from 'lucide-react';

interface Option {
  label: string;
  value: string;
}

interface Props {
  options: Option[];
  value: string; // comma-separated values
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FilterMultiSelect({ options, value, onChange, placeholder = '選択...' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValues = useMemo(() => value.split(',').map(v => v.trim()).filter(Boolean), [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optValue: string) => {
    const newSelected = selectedValues.includes(optValue)
      ? selectedValues.filter(v => v !== optValue)
      : [...selectedValues, optValue];
    onChange(newSelected.join(','));
  };

  const removeOption = (e: React.MouseEvent, optValue: string) => {
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== optValue).join(','));
  };

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative flex-1 min-w-[200px]" ref={containerRef}>
      <div 
        className="min-h-[34px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-md px-2 py-1 cursor-pointer flex flex-wrap gap-1 items-center transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedValues.length === 0 && (
          <span className="text-slate-400 text-sm px-1">{placeholder}</span>
        )}
        {selectedValues.map(val => {
          const opt = options.find(o => o.value === val);
          const label = opt ? opt.label : val;
          return (
            <span key={val} className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded shadow-sm">
              {label}
              <button onClick={(e) => removeOption(e, val)} className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none">
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-md overflow-hidden flex flex-col max-h-[300px]">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 text-slate-500 bg-slate-50/50">
            <Search className="w-4 h-4 shrink-0" />
            <input 
              type="text" 
              className="bg-transparent border-none focus:outline-none text-sm w-full" 
              placeholder="検索..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-slate-400 text-xs">見つかりませんでした</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div 
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <div className="w-4 flex justify-center shrink-0">
                      {isSelected && <Check className="w-4 h-4" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
