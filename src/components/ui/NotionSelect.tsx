import React, { useState, useRef, useEffect } from 'react';
import { X, Search, MoreHorizontal, Trash2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { createPortal } from 'react-dom';

export const getNotionColor = (text: string) => {
  if (!text) return { bg: 'bg-transparent', text: 'text-slate-700' };
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    { bg: 'bg-[#f3f2f1]', text: 'text-[#32302c]' }, // gray
    { bg: 'bg-[#f4eeee]', text: 'text-[#49290e]' }, // brown
    { bg: 'bg-[#fbebc8]', text: 'text-[#d9730d]' }, // orange
    { bg: 'bg-[#fbf3db]', text: 'text-[#cb912f]' }, // yellow
    { bg: 'bg-[#edf3ec]', text: 'text-[#0f7b6c]' }, // green
    { bg: 'bg-[#e7f3f8]', text: 'text-[#0b6e99]' }, // blue
    { bg: 'bg-[#f4f0f7]', text: 'text-[#6940a5]' }, // purple
    { bg: 'bg-[#f9eef3]', text: 'text-[#ad1a72]' }, // pink
    { bg: 'bg-[#fdebec]', text: 'text-[#e03e3e]' }, // red
  ];
  
  return colors[Math.abs(hash) % colors.length];
};

export type Option = {
  label: string;
  value: string;
};

type NotionSelectProps = {
  value: string | string[];
  options: Option[];
  onChange: (value: any) => void;
  onDeleteOption?: (value: string) => void;
  onUpdateOption?: (oldValue: string, newValue: string) => void;
  multiple?: boolean;
  allowCreate?: boolean;
  placeholder?: string;
  className?: string;
  tagsPerRow?: number;
};

export function NotionSelect({
  value,
  options,
  onChange,
  onDeleteOption,
  onUpdateOption,
  multiple = false,
  allowCreate = false,
  placeholder = '',
  className,
  tagsPerRow,
}: NotionSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  
  // 編集メニュー（削除）用のステート
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = 280;
      const height = 300; // approx max-height

      let top = rect.bottom + 4;
      if (rect.bottom + height > window.innerHeight && rect.top > height) {
        top = rect.top - height - 4;
      }

      let left = rect.left;
      if (rect.left + width > window.innerWidth) {
        left = rect.right - width;
      }

      if (left < 4) left = 4;
      if (left + width > window.innerWidth - 4) left = window.innerWidth - width - 4;
      if (top < 4) top = 4;
      if (top + height > window.innerHeight - 4) top = window.innerHeight - height - 4;

      setDropdownPos({
        top,
        left,
        width,
      });
    } else {
      setActiveMenu(null);
      setShowDeleteConfirm(null);
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notion-select-dropdown') && !triggerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const selectedValues = multiple 
    ? (Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []))
    : (Array.isArray(value) ? (value.length > 0 ? [value[0]] : []) : (typeof value === 'string' && value ? [value] : []));
  
  const handleSelect = (val: string) => {
    if (multiple) {
      if (!selectedValues.includes(val)) {
        onChange([...selectedValues, val]);
      }
    } else {
      onChange(val);
      setIsOpen(false);
    }
    setSearch('');
  };

  const handleRemove = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    if (multiple) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange('');
    }
  };

  const handleCreate = () => {
    if (!search.trim()) return;
    handleSelect(search.trim());
  };

  const handleDelete = (val: string) => {
    if (onDeleteOption) {
      onDeleteOption(val);
    }
    setShowDeleteConfirm(null);
    setActiveMenu(null);
  };

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) && 
    (multiple ? !selectedValues.includes(o.value) : true)
  );

  const exactMatch = options.find(o => o.label.toLowerCase() === search.toLowerCase());

  return (
    <>
      <div 
        ref={triggerRef}
        onClick={() => setIsOpen(true)}
        className={cn(
          "min-h-[44px] sm:min-h-[28px] py-2 sm:py-1 px-3 sm:px-2 border border-transparent hover:bg-slate-100 rounded cursor-pointer gap-1 items-center",
          tagsPerRow ? "flex flex-col items-start" : "flex flex-wrap",
          className
        )}
      >
        {selectedValues.length === 0 && (
          <span className="text-slate-400 text-xs">{placeholder}</span>
        )}
        {tagsPerRow ? (
          Array.from({ length: Math.ceil(selectedValues.length / tagsPerRow) }).map((_, i) => {
            const chunk = selectedValues.slice(i * tagsPerRow, i * tagsPerRow + tagsPerRow);
            return (
              <div key={i} className="flex gap-1">
                {chunk.map(val => {
                  const opt = options.find(o => o.value === val) || { label: val, value: val };
                  const colors = getNotionColor(opt.label);
                  return (
                    <div 
                      key={val} 
                      className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[13px] sm:text-[11px] whitespace-nowrap", colors.bg, colors.text)}
                    >
                      {opt.label}
                      <button 
                        onClick={(e) => handleRemove(e, val)}
                        className="hover:bg-black/10 rounded-full p-1.5 sm:p-0.5 ml-0.5"
                      >
                        <X className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          selectedValues.map(val => {
            const opt = options.find(o => o.value === val) || { label: val, value: val };
            const colors = getNotionColor(opt.label);
            return (
              <div 
                key={val} 
                className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[13px] sm:text-[11px] whitespace-nowrap", colors.bg, colors.text)}
              >
                {opt.label}
                <button 
                  onClick={(e) => handleRemove(e, val)}
                  className="hover:bg-black/10 rounded-full p-1.5 sm:p-0.5 ml-0.5"
                >
                  <X className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {isOpen && createPortal(
        <>
        <div className="fixed inset-0 bg-black/20 z-[90] sm:hidden" onClick={() => setIsOpen(false)} />
        <div 
          className="notion-select-dropdown fixed inset-x-4 bottom-4 top-[20%] sm:bottom-auto sm:inset-auto sm:fixed z-[100] bg-white rounded-xl sm:rounded-md shadow-2xl sm:shadow-lg border border-slate-200 py-2 flex flex-col text-sm sm:max-h-[300px] overflow-hidden"
          style={window.innerWidth < 640 ? {} : { top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
          {showDeleteConfirm ? (
            <div className="p-4">
               <h4 className="font-bold text-center text-sm mb-4">このオプションを削除してもよろしいですか？</h4>
               <div className="flex flex-col gap-2">
                 <button 
                   className="w-full py-1.5 border border-red-200 text-red-500 rounded font-medium hover:bg-red-50 text-xs"
                   onClick={() => handleDelete(showDeleteConfirm)}
                 >
                   削除
                 </button>
                 <button 
                   className="w-full py-1.5 border border-slate-200 rounded font-medium hover:bg-slate-50 text-xs"
                   onClick={() => setShowDeleteConfirm(null)}
                 >
                   キャンセル
                 </button>
               </div>
            </div>
          ) : activeMenu ? (
            <div className="flex flex-col">
              <div className="px-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">選択肢を編集</span>
                <button className="text-slate-400 hover:text-slate-600" onClick={() => setActiveMenu(null)}><X className="w-4 h-4" /></button>
              </div>
              <div className="px-3 py-2 border-b border-slate-100">
                <input
                  type="text"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim() && editName !== activeMenu) {
                      if (onUpdateOption) onUpdateOption(activeMenu, editName.trim());
                      setActiveMenu(null);
                    }
                  }}
                  className="w-full text-sm outline-none bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:border-blue-300"
                />
              </div>
              <div className="p-1 flex flex-col gap-1">
                 <button
                   className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-bold transition-colors disabled:opacity-50"
                   disabled={!editName.trim() || editName === activeMenu}
                   onClick={() => {
                     if (editName.trim() && editName !== activeMenu && onUpdateOption) {
                       onUpdateOption(activeMenu, editName.trim());
                       setActiveMenu(null);
                     }
                   }}
                   onTouchStart={(e) => {
                     // e.preventDefault(); // Don't prevent default, just do the action immediately
                     if (editName.trim() && editName !== activeMenu && onUpdateOption) {
                       onUpdateOption(activeMenu, editName.trim());
                       setActiveMenu(null);
                     }
                   }}
                   
                 >
                   名前を変更
                 </button>
                 <button 
                   className="w-full flex items-center justify-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-500 rounded text-xs font-bold transition-colors"
                   onClick={() => setShowDeleteConfirm(activeMenu)} onTouchStart={() => setShowDeleteConfirm(activeMenu)}
                   
                 >
                   <Trash2 className="w-4 h-4" />
                   削除
                 </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-3 pb-2 border-b border-slate-100">
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="オプションを選択するか作成します"
                  className="w-full text-base sm:text-xs outline-none bg-slate-50 border border-slate-200 rounded px-3 py-3 sm:py-1.5 focus:border-blue-300 min-h-[44px] sm:min-h-0"
                />
              </div>
              <div className="overflow-auto py-1 flex-1">
                <div className="px-3 py-1 text-[10px] text-slate-500 font-medium">
                  オプションを選択するか作成します
                </div>
                {filteredOptions.map(opt => {
                   const colors = getNotionColor(opt.label);
                   return (
                     <div
                       key={opt.value}
                       className="px-3 py-3 sm:py-1.5 cursor-pointer hover:bg-slate-100 flex items-center justify-between group border-b sm:border-b-0 border-slate-50"
                       onClick={() => handleSelect(opt.value)}
                     >
                        <div className="flex items-center gap-2">
                          <div className={cn("px-1.5 py-0.5 rounded text-[13px] sm:text-[11px]", colors.bg, colors.text)}>
                            {opt.label}
                          </div>
                        </div>
                        {onDeleteOption && (
                          <button 
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(opt.value);
                              setEditName(opt.value);
                            }}
                          >
                            <MoreHorizontal className="w-4 h-4 text-slate-400" />
                          </button>
                        )}
                     </div>
                   );
                })}
                {allowCreate && search.trim() && !exactMatch && (
                  <div
                    onClick={handleCreate}
                    className="px-3 py-3 sm:py-1.5 cursor-pointer hover:bg-slate-100 flex items-center gap-2 text-base sm:text-xs border-t border-slate-100"
                  >
                    <span className="text-slate-500">新規作成:</span>
                    <div className={cn("px-1.5 py-0.5 rounded text-[13px] sm:text-[11px]", getNotionColor(search.trim()).bg, getNotionColor(search.trim()).text)}>
                      {search.trim()}
                    </div>
                  </div>
                )}
                {filteredOptions.length === 0 && (!allowCreate || !search.trim()) && (
                  <div className="px-3 py-2 text-xs text-slate-400">
                    結果なし
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        </>,
        document.body
      )}
    </>
  );
}
