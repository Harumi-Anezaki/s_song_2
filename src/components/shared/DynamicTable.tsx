import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn, generateId, truncateText } from '../../lib/utils';
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea';
import { FilterMultiSelect } from '../ui/FilterMultiSelect';
import { Plus, Search, ArrowLeft, X, Trash2, Filter as FilterIcon, ArrowUpDown, GripVertical, Settings2, Columns, Eye, EyeOff, Copy } from 'lucide-react';
import { SONG_COLUMNS, SINGER_COLUMNS, getOperatorsForType } from '../../lib/constants';
import { NotionSelect } from '../ui/NotionSelect';

function DebouncedFilterInput({ initialValue, onChange }: { initialValue: string, onChange: (val: string) => void }) {
  const [val, setVal] = React.useState(initialValue);
  React.useEffect(() => { setVal(initialValue); }, [initialValue]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value);
    onChange(e.target.value);
  };
  return <input type="text" value={val} onChange={handleChange} className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all flex-1 min-w-0" />;
}

export function ViewOptions({ view, onUpdateView, type, optionsMap }: { view: any, onUpdateView: any, type: string, optionsMap: any }) {
  const [activeMenu, setActiveMenu] = React.useState<'sort' | 'filter' | 'properties' | null>(null);
  const ALL_COLUMNS = (type === 'song' ? SONG_COLUMNS : SINGER_COLUMNS).filter(c => c.key !== 'search' && c.key !== 'lastSearchedAt');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setActiveMenu(null);
    }
    // document.addEventListener("mousedown", handleClickOutside);
    // return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  const toggleColumn = (key: string) => {
    const hidden = view.hiddenColumns || [];
    if (hidden.includes(key)) {
      onUpdateView(view.id, { hiddenColumns: hidden.filter((k: string) => k !== key) });
    } else {
      onUpdateView(view.id, { hiddenColumns: [...hidden, key] });
    }
  };

  const addSort = () => {
    const newSort = { id: Date.now().toString(), column: ALL_COLUMNS[0].key, direction: 'asc' };
    onUpdateView(view.id, { sorts: [...(view.sorts || []), newSort] });
  };
  const updateSort = (id: string, updates: any) => {
    onUpdateView(view.id, { sorts: view.sorts.map((s: any) => s.id === id ? { ...s, ...updates } : s) });
  };
  const removeSort = (id: string) => {
    onUpdateView(view.id, { sorts: view.sorts.filter((s: any) => s.id !== id) });
  };

  const addFilter = () => {
    const newFilter = { id: Date.now().toString(), column: ALL_COLUMNS[0].key, operator: 'contains', value: '', logic: 'AND' };
    onUpdateView(view.id, { filters: [...(view.filters || []), newFilter] });
  };
  const updateFilter = (id: string, updates: any) => {
    onUpdateView(view.id, { filters: view.filters.map((f: any) => f.id === id ? { ...f, ...updates } : f) });
  };
  const removeFilter = (id: string) => {
    onUpdateView(view.id, { filters: view.filters.filter((f: any) => f.id !== id) });
  };

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  return (
    <>
    <div className="sm:hidden shrink-0">
      <button onClick={() => setMobileMenuOpen(true)} className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-100 rounded text-slate-600 bg-white border border-slate-200 text-sm whitespace-nowrap">
        <Settings2 className="w-4 h-4" /> 表示設定
      </button>
    </div>
    <div className={`relative z-[99] ${mobileMenuOpen ? 'fixed inset-0 bg-white z-[210] p-4 flex flex-col gap-4 overflow-auto items-start' : 'hidden sm:flex items-center gap-1'}`} ref={ref}>
      {mobileMenuOpen && (
        <div className="flex justify-between items-center border-b pb-2 w-full">
          <h2 className="font-bold text-lg">表示設定</h2>
          <button onClick={() => setMobileMenuOpen(false)} className="text-gray-500 hover:text-black"><X className="w-6 h-6"/></button>
        </div>
      )}
      <button onClick={() => setActiveMenu(activeMenu === 'sort' ? null : 'sort')} className={`flex items-center gap-2 px-3 py-3 sm:py-1 w-full sm:w-auto hover:bg-slate-100 rounded text-base sm:text-sm font-medium ${view.sorts?.length ? 'text-blue-600 bg-blue-50 sm:bg-transparent' : 'text-slate-700 sm:text-slate-600 border border-slate-200 sm:border-transparent'}`}>
        <ArrowUpDown className="w-3 h-3" /> {view.sorts?.length ? `${view.sorts.length}件の並べ替え` : '並べ替え'}
      </button>
      {activeMenu === 'sort' && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}
      {activeMenu === 'sort' && (
        <div className="sm:absolute sm:top-full sm:right-0 mt-4 sm:mt-1 w-full sm:w-[550px] bg-white sm:border sm:border-slate-200 sm:shadow-lg rounded-md p-2 sm:p-3 z-[99] sm:max-h-[80vh] overflow-y-auto">
          <div className="text-xs font-bold text-slate-500 mb-2">並べ替え条件</div>
          <div className="space-y-2 mb-3">
            {(view.sorts || []).map((sort: any) => (
              <div key={sort.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 text-base sm:text-xs bg-slate-50 p-2 rounded-md sm:bg-transparent sm:p-0">
                <select value={sort.column} onChange={e => updateSort(sort.id, { column: e.target.value })} className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 sm:py-1.5 pl-3 sm:pl-2.5 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M6%209L12%2015L18%209%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat flex-1 w-full sm:min-w-0 shrink text-base sm:text-xs">
                  {ALL_COLUMNS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
                </select>
                {(() => {
                  const colDef = ALL_COLUMNS.find(c => c.key === sort.column);
                  const colType = colDef ? colDef.type : 'text';
                  const ascLabel = colType === 'number' ? '昇順 (1→9)' : colType === 'date' ? '昇順 (古い順)' : '昇順 (A→Z)';
                  const descLabel = colType === 'number' ? '降順 (9→1)' : colType === 'date' ? '降順 (新しい順)' : '降順 (Z→A)';
                  return (
                    <select value={sort.direction} onChange={e => updateSort(sort.id, { direction: e.target.value })} className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 sm:py-1.5 pl-3 sm:pl-2.5 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M6%209L12%2015L18%209%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat w-full sm:w-32 shrink-0 text-base sm:text-xs">
                      <option value="asc">{ascLabel}</option>
                      <option value="desc">{descLabel}</option>
                    </select>
                  );
                })()}
                <button onClick={() => removeSort(sort.id)} className="text-slate-400 hover:text-red-500 p-2 sm:p-1 shrink-0 self-end sm:self-auto flex items-center gap-1 text-sm"><Trash2 className="w-4 h-4 sm:w-3 sm:h-3" /><span className="sm:hidden">削除</span></button>
              </div>
            ))}
            {(!view.sorts || view.sorts.length === 0) && <div className="text-xs text-slate-400">条件がありません</div>}
          </div>
          <button onClick={addSort} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800"><Plus className="w-3 h-3" /> 並べ替えを追加</button>
        </div>
      )}

      <button onClick={() => setActiveMenu(activeMenu === 'filter' ? null : 'filter')} className={`flex items-center gap-2 px-3 py-3 sm:py-1 w-full sm:w-auto hover:bg-slate-100 rounded text-base sm:text-sm font-medium ${view.filters?.length ? 'text-blue-600 bg-blue-50 sm:bg-transparent' : 'text-slate-700 sm:text-slate-600 border border-slate-200 sm:border-transparent'}`}>
        <FilterIcon className="w-3 h-3" /> {view.filters?.length ? `${view.filters.length}件のフィルター` : 'フィルター'}
      </button>
      {activeMenu === 'filter' && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}
      {activeMenu === 'filter' && (
        <div className="sm:absolute sm:top-full sm:right-0 mt-4 sm:mt-1 w-full sm:min-w-[550px] sm:w-max max-w-[800px] bg-white sm:border sm:border-slate-200 sm:shadow-lg rounded-md p-2 sm:p-3 z-[99] sm:max-h-[80vh] overflow-y-auto">
          <div className="text-xs font-bold text-slate-500 mb-2">フィルター条件</div>
          <div className="space-y-2 mb-3">
            {(view.filters || []).map((filter: any, idx: number) => (
              <div key={filter.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 text-base sm:text-xs bg-slate-50 p-3 rounded-md sm:bg-transparent sm:p-0">
                {idx > 0 ? (
                   <select value={filter.logic || 'AND'} onChange={e => updateFilter(filter.id, { logic: e.target.value })} className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 sm:py-1.5 pl-3 sm:pl-2.5 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M6%209L12%2015L18%209%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat w-full sm:w-20 shrink-0 text-base sm:text-xs">
                     <option value="AND">かつ</option>
                     <option value="OR">または</option>
                   </select>
                ) : <div className="w-16 text-center text-slate-400 text-xs shrink-0 font-medium">条件</div>}
                
                <select value={filter.column} onChange={e => {
  const colDef = ALL_COLUMNS.find(c => c.key === e.target.value);
  const newOps = getOperatorsForType(colDef?.type || 'text');
  updateFilter(filter.id, { column: e.target.value, operator: newOps[0].value, value: '' });
}} className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 sm:py-1.5 pl-3 sm:pl-2.5 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M6%209L12%2015L18%209%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat w-full sm:w-32 shrink-0 text-base sm:text-xs">
                  {ALL_COLUMNS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
                </select>
                {(() => {
                  const colDef = ALL_COLUMNS.find(c => c.key === filter.column);
                  const colType = colDef ? colDef.type : 'text';
                  const typeOperators = getOperatorsForType(colType);
                  // Ensure current operator is valid for this type
                  if (!typeOperators.find(o => o.value === filter.operator)) {
                     // Automatically fix invalid operator on render (or user can re-select)
                     // A better way is to update on column change, but this prevents crashing
                  }
                  
                  return (
                    <>
                      <select value={filter.operator} onChange={e => updateFilter(filter.id, { operator: e.target.value })} className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 sm:py-1.5 pl-3 sm:pl-2.5 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M6%209L12%2015L18%209%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat w-full sm:w-32 shrink-0 text-base sm:text-xs">
                        {typeOperators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      {!['is_empty', 'is_not_empty'].includes(filter.operator) ? (
                        colType === 'single_select' || colType === 'multi_select' ? (
                          <FilterMultiSelect
                            options={optionsMap[filter.column] || []}
                            value={filter.value || ''}
                            onChange={(val) => updateFilter(filter.id, { value: val })}
                            placeholder="値を選択..."
                          />
                        ) : colType === 'date' ? (
                          <input type="date" value={filter.value || ''} onChange={e => updateFilter(filter.id, { value: e.target.value })} className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all flex-1 min-w-0" />
                        ) : colType === 'number' ? (
                          <input type="number" value={filter.value || ''} onChange={e => updateFilter(filter.id, { value: e.target.value })} placeholder="値" className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all flex-1 min-w-0" />
                        ) : (
                          <input type="text" value={filter.value || ''} onChange={e => updateFilter(filter.id, { value: e.target.value })} placeholder="値" className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all flex-1 min-w-0" />
                        )
                      ) : (
                        <div className="flex-1 min-w-0" />
                      )}
                    </>
                  );
                })()}
                <button onClick={() => removeFilter(filter.id)} className="text-slate-400 hover:text-red-500 p-2 sm:p-1 shrink-0 self-end sm:self-auto flex items-center gap-1 text-sm"><Trash2 className="w-4 h-4 sm:w-3 sm:h-3" /><span className="sm:hidden">削除</span></button>
              </div>
            ))}
            {(!view.filters || view.filters.length === 0) && <div className="text-xs text-slate-400">条件がありません</div>}
          </div>
          <button onClick={addFilter} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800"><Plus className="w-3 h-3" /> フィルターを追加</button>
        </div>
      )}

      <button onClick={() => setActiveMenu(activeMenu === 'properties' ? null : 'properties')} className="flex items-center gap-2 px-3 py-3 sm:py-1 w-full sm:w-auto hover:bg-slate-100 rounded text-base sm:text-sm font-medium text-slate-700 sm:text-slate-600 border border-slate-200 sm:border-transparent">
        <Columns className="w-3 h-3" /> プロパティ
      </button>
      {activeMenu === 'properties' && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}
      {activeMenu === 'properties' && (
        <PropertiesMenu 
          view={view} 
          onUpdateView={onUpdateView} 
          ALL_COLUMNS={ALL_COLUMNS} 
          onClose={() => setActiveMenu(null)}
        />
      )}
    </div>
    </>
  );
}

export function DynamicTable({ view, data, onUpdateView, type, onUpdateItem, onDeleteItem, onNavigateToSearch, singers, searchQuery, genreOptions, usageOptions, singerOptions, locationOptions, evaluationOptions, onDeleteGenre, onDeleteUsage, onDeleteEvaluation, onUpdateGenre, onUpdateUsage, onUpdateEvaluation, ensureSinger, ensureSingers, onFilteredCountChange, onFilteredDataChange }: any) {
  const [mobileEditRow, setMobileEditRow] = React.useState<any>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const collapsedColumns = view.collapsedColumns || {};

  const handleDragStart = (e: React.DragEvent, colKey: string) => {
    setDraggedColumn(colKey);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColKey) return;
    const newColumns = [...view.columns];
    const draggedIdx = newColumns.indexOf(draggedColumn);
    const targetIdx = newColumns.indexOf(targetColKey);
    newColumns.splice(draggedIdx, 1);
    newColumns.splice(targetIdx, 0, draggedColumn);
    onUpdateView(view.id, { columns: newColumns });
    setDraggedColumn(null);
  };

  const toggleColumnCollapse = (colKey: string) => {
    onUpdateView(view.id, { collapsedColumns: { ...collapsedColumns, [colKey]: !collapsedColumns[colKey] } });
  };
  const COLLAPSIBLE_COLUMNS = ['title', 'mainSingerId', 'subSingerIds', 'location', 'genre', 'usage', 'evaluation1', 'urls', 'name', 'mainSongs', 'subSongs', 'songViews', 'songViewsPerDay'];
  
  const isMinWrapCol = (colKey: string) => {
    const targetColsForMinWrap = ['id', 'mainSingerId', 'location', 'genre', 'usage', 'evaluation1', 'releaseDate', 'viewCount', 'songViewsPerDay', 'top70Views', 'top70ViewsPerDay', 'singerPreference', 'trend', 'createdAt', 'updatedAt'];
    return targetColsForMinWrap.includes(colKey) && (!COLLAPSIBLE_COLUMNS.includes(colKey) || !collapsedColumns[colKey]);
  };

  const getColWidth = (colKey: string) => {
    if (view.columnWidths && view.columnWidths[colKey]) return view.columnWidths[colKey];
    if (isMinWrapCol(colKey)) return undefined;
    if (colKey === 'subSingerIds') return undefined;
    if (colKey === 'title' || colKey === 'name') return 350;
    if (colKey === 'lastSearchedAt') return 92;
    return ['mainSingerId', 'search', 'preference', 'singability'].includes(colKey) ? undefined : 150;
  };

  let ALL_COLUMNS = type === 'song' ? SONG_COLUMNS : SINGER_COLUMNS;
  if (!onNavigateToSearch) ALL_COLUMNS = ALL_COLUMNS.filter(c => c.key !== 'search' && c.key !== 'lastSearchedAt');
  const visibleColumns = view.columns.filter((c: string) => !view.hiddenColumns.includes(c));

  const getCellValue = (row: any, colKey: string) => {
    if (colKey === 'location' && type === 'song') return row._location;
    if (colKey === 'songViewsPerDay') return row._viewsPerDay;
    if (colKey === 'trend') return row._trend;
    if (colKey === 'songViews') return row._songViews;
    if (colKey === 'top70Views') return row._top70Views;
    if (colKey === 'top70ViewsPerDay') return row._top70ViewsPerDay;
    if (colKey === 'singerPreference') return row._singerPreference;
    return row[colKey];
  };

  const filteredData = data.filter((row: any) => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      const matchSearch = visibleColumns.some((colKey: string) => {
        let val = getCellValue(row, colKey);
        const strVal = Array.isArray(val) ? val.join(',') : String(val ?? '');
        return strVal.toLowerCase().includes(lowerQuery);
      });
      if (!matchSearch) return false;
    }

    if (view.filters && view.filters.length > 0) {
      let filterResult = true;
      for (let i = 0; i < view.filters.length; i++) {
        const filter = view.filters[i];
        const colDef = (type === 'song' ? SONG_COLUMNS : SINGER_COLUMNS).find(c => c.key === filter.column);
        const colType = colDef ? colDef.type : 'text';

        let val = getCellValue(row, filter.column);
        const strVal = Array.isArray(val) ? val.join(',') : String(val ?? '').toLowerCase();
        const fVal = String(filter.value || '');
        const fValLower = fVal.toLowerCase();
        
        let valArray: string[] = [];
        if (Array.isArray(val)) {
           // Extract string representations for multi-select
           valArray = val.map(v => typeof v === 'object' ? String(v.id || v.title || v.name) : String(v));
        } else if (typeof val === 'string' && val.includes(',')) {
           valArray = val.split(',').map(s => s.trim());
        } else {
           valArray = [String(val ?? '')];
        }

        let conditionMet = true;
        const numVal = Number(val);
        const numFVal = Number(fVal);
        const timeVal = new Date(val).getTime();
        const timeFVal = new Date(fVal).getTime();
        
        const isValEmpty = val === null || val === undefined || strVal === '' || strVal === 'null' || strVal === 'undefined';

        switch (filter.operator) {
          case 'is_empty': conditionMet = isValEmpty; break;
          case 'is_not_empty': conditionMet = !isValEmpty; break;
          case 'contains': 
            conditionMet = colType === 'multi_select' 
               ? valArray.some(v => v.toLowerCase().includes(fValLower))
               : strVal.includes(fValLower); 
            break;
          case 'not_contains': 
            conditionMet = colType === 'multi_select'
               ? !valArray.some(v => v.toLowerCase().includes(fValLower))
               : !strVal.includes(fValLower); 
            break;
          case 'contains_all':
             if (!fValLower) { conditionMet = true; break; }
             const searchTokens = fValLower.split(',').map(t => t.trim()).filter(Boolean);
             conditionMet = searchTokens.every(token => valArray.some(v => v.toLowerCase().includes(token)));
             break;
          case 'equals': 
            if (colType === 'number') conditionMet = numVal === numFVal;
            else if (colType === 'date') conditionMet = new Date(val).toDateString() === new Date(fVal).toDateString();
            else if (colType === 'multi_select' || colType === 'single_select') conditionMet = valArray.includes(fVal) || strVal === fValLower;
            else conditionMet = strVal === fValLower;
            break;
          case 'not_equals': 
            if (colType === 'number') conditionMet = numVal !== numFVal;
            else if (colType === 'date') conditionMet = new Date(val).toDateString() !== new Date(fVal).toDateString();
            else if (colType === 'multi_select' || colType === 'single_select') conditionMet = !valArray.includes(fVal) && strVal !== fValLower;
            else conditionMet = strVal !== fValLower;
            break;
          case 'greater_than': 
            if (colType === 'date') conditionMet = timeVal > timeFVal;
            else conditionMet = numVal > numFVal; 
            break;
          case 'less_than': 
            if (colType === 'date') conditionMet = timeVal < timeFVal;
            else conditionMet = numVal < numFVal; 
            break;
          case 'greater_than_or_equal': conditionMet = numVal >= numFVal; break;
          case 'less_than_or_equal': conditionMet = numVal <= numFVal; break;
          case 'before': conditionMet = timeVal < timeFVal; break;
          case 'after': conditionMet = timeVal > timeFVal; break;
          default: conditionMet = true; break;
        }

        if (i === 0) {
          filterResult = conditionMet;
        } else {
          const logic = filter.logic || 'AND';
          if (logic === 'AND') {
            filterResult = filterResult && conditionMet;
          } else {
            filterResult = filterResult || conditionMet;
          }
        }
      }
      if (!filterResult) return false;
    }
    
    return true;
  });

  const sortedData = [...filteredData].sort((a: any, b: any) => {
    if (!view.sorts || view.sorts.length === 0) return 0;
    for (const sort of view.sorts) {
      const colDef = (type === 'song' ? SONG_COLUMNS : SINGER_COLUMNS).find(c => c.key === sort.column);
      const colType = colDef ? colDef.type : 'text';

      let aVal = getCellValue(a, sort.column);
      let bVal = getCellValue(b, sort.column);
      
      if (aVal === bVal) continue;
      const aEmpty = aVal === null || aVal === undefined || aVal === '';
      const bEmpty = bVal === null || bVal === undefined || bVal === '';
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      
      if (colType === 'number') {
        const numA = Number(aVal) || 0;
        const numB = Number(bVal) || 0;
        if (numA !== numB) return sort.direction === 'asc' ? numA - numB : numB - numA;
      } else if (colType === 'date') {
        const timeA = new Date(aVal).getTime() || 0;
        const timeB = new Date(bVal).getTime() || 0;
        if (timeA !== timeB) return sort.direction === 'asc' ? timeA - timeB : timeB - timeA;
      } else {
        // Multi-select / text
        const strA = Array.isArray(aVal) ? aVal.join(',') : String(aVal);
        const strB = Array.isArray(bVal) ? bVal.join(',') : String(bVal);
        const comp = strA.localeCompare(strB);
        if (comp !== 0) return sort.direction === 'asc' ? comp : -comp;
      }
    }
    return 0;
  });

  const sortedDataIds = sortedData.map((d: any) => d.id).join(',');
  const sortedDataViews = sortedData.map((d: any) => d.viewCount).join(',');
  useEffect(() => {
    if (onFilteredCountChange) {
      onFilteredCountChange(sortedData.length);
    }
    if (onFilteredDataChange) {
      onFilteredDataChange(sortedData);
    }
  }, [sortedDataIds, sortedDataViews, onFilteredCountChange, onFilteredDataChange]);

  // Search/Filter placeholder (skipped full implementation for simplicity, just showing structure)
  // Let's render the basic table.
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;

  return (
    <div ref={parentRef} className="h-full w-full overflow-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full border-collapse text-sm" style={{ width: 'max-content' }}>
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-[80]">
          <Reorder.Group 
            as="tr" 
            axis="x" 
            values={visibleColumns} 
            onReorder={(newCols) => onUpdateView(view.id, { columns: newCols })} 
            className="text-[10px] uppercase tracking-wider text-slate-500 font-bold"
          >
            {onDeleteItem && <th className="px-4 py-3 text-center border-r border-slate-200 w-12 sticky left-0 bg-slate-50 !z-[60]">🗑️</th>}
            {visibleColumns.map((colKey: string) => {
              const colDef = ALL_COLUMNS.find(c => c.key === colKey);
              if (!colDef) return null;
              return (
                <Reorder.Item 
                  as="th"
                  value={colKey}
                  key={colKey} 
                  className={`px-4 py-3 text-left border-r border-slate-200 relative group bg-slate-50 ${(colKey === 'title' || colKey === 'name') ? 'sticky !z-[50] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : 'z-0'} ${isMinWrapCol(colKey) ? 'whitespace-nowrap' : ''}`}
                  style={{ left: (colKey === 'title' || colKey === 'name') ? (onDeleteItem ? '48px' : '0px') : undefined, width: getColWidth(colKey) }}
                >
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing">
                    <span className="truncate select-none">{colDef.label}</span>
                    {COLLAPSIBLE_COLUMNS.includes(colKey) && (
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleColumnCollapse(colKey)} className="text-gray-400 hover:text-gray-600 ml-auto cursor-pointer">
                        {collapsedColumns[colKey] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </thead>
        <tbody className="text-xs divide-y divide-slate-100">
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={visibleColumns.length + (onDeleteItem ? 1 : 0)} />
            </tr>
          )}
          {virtualItems.map((virtualRow: any) => {
            const row = sortedData[virtualRow.index];
            return (
            <tr key={row.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="hover:bg-slate-50 transition-colors group/row min-h-[44px] sm:min-h-0 cursor-pointer sm:cursor-default" onClick={(e) => { if (isMobile) { setMobileEditRow(row); } }}>
              {onDeleteItem && (
                <td className="px-4 py-3 border-r border-slate-100 text-center sticky left-0 bg-white group-hover/row:bg-slate-50 !z-[50]">
                  <button onClick={(e) => { e.stopPropagation(); onDeleteItem(row.id); }} className="text-slate-400 hover:text-red-600 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity focus:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              )}
              {visibleColumns.map((colKey: string) => {
                 const colDef = ALL_COLUMNS.find(c => c.key === colKey);
                 if (!colDef) return null;
                 let val = row[colKey];
                 if (colKey === 'location' && type === 'song') val = row._location;
                 if (colKey === 'songViewsPerDay') val = row._viewsPerDay;
                 if (colKey === 'trend') val = row._trend;
                 if (colKey === 'songViews') val = row._songViews?.slice(0,3).join(', ');

                 const renderCellContent = () => {
                    if (type === 'singer' && colKey === 'search') {
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (onNavigateToSearch) onNavigateToSearch(row.name); }}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          <Search className="w-3 h-3" />
                          検索
                        </button>
                      );
                    }
                    if (type === 'song') {
                      if (colKey === 'title') {
                        return ( <>{collapsedColumns[colKey] ? val : (<AutoResizeTextarea value={val || ''} onChange={(e) => onUpdateItem(row.id, { [colKey]: e.target.value })} className="bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded px-1 w-full block" />)}
                        </> );
                      }
                      if (colKey === 'genre') {
                        return ( <>{collapsedColumns[colKey] ? truncateText(Array.isArray(val) ? val.join(', ') : val) : (<NotionSelect value={val || []} options={genreOptions} onChange={(newVal) => onUpdateItem(row.id, { genre: newVal })} onDeleteOption={onDeleteGenre} onUpdateOption={onUpdateGenre} allowCreate multiple placeholder="未設定" />)}
                        </> );
                      }
                      if (colKey === 'usage') {
                        return ( <>{collapsedColumns[colKey] ? truncateText(Array.isArray(val) ? val.join(', ') : val) : (<NotionSelect value={val || []} options={usageOptions} onChange={(newVal) => onUpdateItem(row.id, { usage: newVal })} onDeleteOption={onDeleteUsage} onUpdateOption={onUpdateUsage} allowCreate multiple placeholder="未設定" />)}
                        </> );
                      }
                      if (colKey === 'mainSingerId') {
                        return ( <>{collapsedColumns[colKey] ? truncateText(singerOptions.find((o: any) => o.value === val)?.label || '') : (
                          <NotionSelect 
                            value={val || ''} 
                            options={singerOptions} 
                            onChange={(newVal: any) => {
                              const newId = ensureSinger(newVal);
                              onUpdateItem(row.id, { mainSingerId: newId || null });
                            }} 
                            allowCreate
                            placeholder="未設定" 
                          />
                        )}
                        </> );
                      }
                      if (colKey === 'subSingerIds') {
                        return ( <>{collapsedColumns[colKey] ? truncateText((row.subSingerIds || []).map((id: string) => singerOptions.find((o: any) => o.value === id)?.label).filter(Boolean).join(', ')) : (
                          <NotionSelect 
                            value={row.subSingerIds || []} 
                            options={singerOptions} 
                            onChange={(newVal: any) => {
                              const newIds = ensureSingers(Array.isArray(newVal) ? newVal : [newVal]);
                              onUpdateItem(row.id, { subSingerIds: newIds });
                            }} 
                            allowCreate
                            multiple 
                            placeholder="未設定"
                            tagsPerRow={2}
                          />
                        )}
                        </> );
                      }
                      if (colKey === 'location') {
                        return ( <>{collapsedColumns[colKey] ? truncateText(val) : (<div className="px-2 py-1 bg-slate-50 text-slate-600 rounded text-xs truncate max-w-full">{val || '-'}</div>)}
                        </> );
                      }
                      if (colKey === 'evaluation1') {
                        return ( <>{collapsedColumns[colKey] ? truncateText(val) : (<NotionSelect value={val || ''} options={evaluationOptions} onChange={(newVal) => onUpdateItem(row.id, { evaluation1: newVal })} onDeleteOption={onDeleteEvaluation} onUpdateOption={onUpdateEvaluation} allowCreate placeholder="未設定" />)}
                        </> );
                      }
                      if (colKey === 'releaseDate') {
                        return (
                          <input
                            type="date"
                            value={val || ''}
                            onChange={(e) => onUpdateItem(row.id, { releaseDate: e.target.value })}
                            className="bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                          />
                        );
                      }
                      if (colKey === 'urls') {
                        return ( <>{collapsedColumns['urls'] ? truncateText(row.urls?.join(', ')) : (
                          <div className="flex flex-col gap-1">
                            {row.urls && row.urls.length > 0 ? row.urls.map((url: string, index: number) => {
                              const fullTitle = row.urlTitles?.[index] || row.title || '無題';
                              const displayTitle = fullTitle.substring(0, 10);
                              const viewCountStr = row.urlViewCounts?.[index] ? ` (${row.urlViewCounts[index].toLocaleString()}再生)` : '';
                              return (
                                <a key={index} href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs block truncate" title={fullTitle}>
                                  {displayTitle}{viewCountStr}
                                </a>
                              );
                            }) : '-'}
                          </div>
                        )}</> );
                      }
                    } else if (type === 'singer') {
                      if (colKey === 'location') {
                        return ( <>{collapsedColumns[colKey] ? val : (<NotionSelect value={val || ''} options={locationOptions} onChange={(newVal) => onUpdateItem(row.id, { location: newVal })} allowCreate placeholder="未設定" />)}
                        </> );
                      }
                      if (colKey === 'lastSearchedAt') {
                        if (!val) return <span className="text-gray-400 text-xs font-mono">-</span>;
                        const d = new Date(val);
                        if (isNaN(d.getTime())) return <span className="text-gray-400 text-xs font-mono">-</span>;
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        return <span className="text-gray-700 text-sm font-mono">{mm}/{dd}</span>;
                      }
                      if (colKey === 'name') {
                        return (
                          <AutoResizeTextarea value={val || ''} onChange={(e) => onUpdateItem(row.id, { [colKey]: e.target.value })} className="bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded px-1 w-full block" />
                        );
                      }
                      if (colKey === 'preference' || colKey === 'singability') {
                        return (
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={val || ''}
                            onChange={(e) => onUpdateItem(row.id, { [colKey]: parseInt(e.target.value) || null })}
                            className="bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded px-1 w-16 text-right"
                          />
                        );
                      }
                    }

                    if (colKey === 'createdAt' || colKey === 'updatedAt') {
                      return <span className="text-gray-400 text-xs font-mono">{val ? new Date(val).toLocaleString() : '-'}</span>;
                    }
                    if (colKey === 'mainSongs' || colKey === 'subSongs') {
                      const songsArr = colKey === 'mainSongs' ? row._mainSongs : row._subSongs;
                      return <>{collapsedColumns[colKey] ? truncateText(songsArr?.map((song: any) => song.title).join(', ') || '-') : (songsArr?.length ? songsArr.map((song: any) => <div key={song.id}>{song.title}</div>) : '-')}</>;
                    }
                    if (colKey === 'songViews') {
                      return <>{collapsedColumns['songViews'] ? truncateText(row._songViews?.join(', ')) : (row._songViews?.join(', ') || '-')}</>;
                    }
                    if (colKey === 'songViewsPerDay') {
                      if (type === 'song') {
                        const valNum = row._viewsPerDay;
                        const display = valNum != null ? Math.round(valNum).toLocaleString() : '-';
                        return <span className="font-mono text-gray-500">{display}</span>;
                      } else {
                        return <>{collapsedColumns['songViewsPerDay'] ? truncateText(row._songViewsPerDay?.map(Math.round).join(', ') || '-') : (row._songViewsPerDay?.map(Math.round).join(', ') || '-')}</>;
                      }
                    }
                    if (colKey === 'top70Views') {
                      return <span className="font-mono text-gray-500">{row._top70Views?.toLocaleString() || '-'}</span>;
                    }
                    if (colKey === 'top70ViewsPerDay') {
                      return <span className="font-mono text-gray-500">{row._top70ViewsPerDay ? Math.round(row._top70ViewsPerDay).toLocaleString() : '-'}</span>;
                    }
                    if (colKey === 'singerPreference') {
                      return <span className="font-mono text-gray-500">{row._singerPreference ? row._singerPreference : '-'}</span>;
                    }
                    if (typeof val === 'number') {
                      return <span className="font-mono">{val.toLocaleString()}</span>;
                    }
                    if (colKey === 'id') {
                      return <span className="text-gray-500 text-xs" title={val}>{val.substring(0,8)}...</span>;
                    }
                    return String(val || '');
                 };
                 
                 return (
                   <motion.td layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} key={colKey} className={cn("px-4 py-3 border-r border-slate-100", isMinWrapCol(colKey) ? 'whitespace-nowrap' : (colKey === 'title' ? 'sm:whitespace-normal sm:break-words whitespace-nowrap truncate' : (view.wrapText ? 'whitespace-normal' : 'whitespace-nowrap truncate')), (colKey === 'title' || colKey === 'name') ? 'sticky !z-[40] bg-white group-hover/row:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : 'relative z-0', isMobile && "pointer-events-none")} style={{ left: (colKey === 'title' || colKey === 'name') ? (onDeleteItem ? '48px' : '0px') : undefined, maxWidth: getColWidth(colKey), minWidth: getColWidth(colKey) }}>
                     {renderCellContent()}
                   </motion.td>
                 );
              })}
            </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} colSpan={visibleColumns.length + (onDeleteItem ? 1 : 0)} />
            </tr>
          )}
        </tbody>
      </table>
      {mobileEditRow && isMobile && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-bold text-lg">詳細編集</h2>
            <button onClick={() => setMobileEditRow(null)} className="p-2 rounded-full hover:bg-slate-200">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 pb-32">
            {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key) || c.key === 'title' || c.key === 'name').map(colDef => {
              const colKey = colDef.key;
              let val = mobileEditRow[colKey];
              if (colKey === 'location' && type === 'song') val = mobileEditRow._location;
              if (colKey === 'songViewsPerDay') val = mobileEditRow._viewsPerDay;
              if (colKey === 'trend') val = mobileEditRow._trend;
              if (colKey === 'songViews') val = mobileEditRow._songViews?.slice(0,3).join(', ');

              // We recreate the render cell logic but specifically for mobile
              let cellContent = null;
              if (type === 'singer' && colKey === 'search') {
                cellContent = <button onClick={() => { setMobileEditRow(null); if (onNavigateToSearch) onNavigateToSearch(mobileEditRow.name); }} className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold w-full">YouTubeで検索</button>;
              } else if (type === 'song') {
                if (colKey === 'title') {
                  cellContent = <AutoResizeTextarea value={val || ''} onChange={(e) => { onUpdateItem(mobileEditRow.id, { [colKey]: e.target.value }); setMobileEditRow({...mobileEditRow, [colKey]: e.target.value}); }} className="border border-slate-300 focus:border-blue-500 rounded p-3 w-full bg-white text-base" />;
                } else if (colKey === 'genre') {
                  cellContent = <NotionSelect value={val || []} options={genreOptions} onChange={(newVal) => { onUpdateItem(mobileEditRow.id, { genre: newVal }); setMobileEditRow({...mobileEditRow, genre: newVal}); }} onDeleteOption={onDeleteGenre} onUpdateOption={onUpdateGenre} allowCreate multiple placeholder="ジャンルを追加..." />;
                } else if (colKey === 'usage') {
                  cellContent = <NotionSelect value={val || []} options={usageOptions} onChange={(newVal) => { onUpdateItem(mobileEditRow.id, { usage: newVal }); setMobileEditRow({...mobileEditRow, usage: newVal}); }} onDeleteOption={onDeleteUsage} onUpdateOption={onUpdateUsage} allowCreate multiple placeholder="用途を追加..." />;
                } else if (colKey === 'mainSingerId') {
                  cellContent = <NotionSelect value={val || ''} options={singerOptions} onChange={(newVal) => { const newId = ensureSinger(newVal); onUpdateItem(mobileEditRow.id, { mainSingerId: newId || null }); setMobileEditRow({...mobileEditRow, mainSingerId: newId || null}); }} allowCreate placeholder="歌手を設定..." />;
                } else if (colKey === 'subSingerIds') {
                  cellContent = <NotionSelect value={val || []} options={singerOptions} onChange={(newVal) => { const newIds = ensureSingers(newVal); onUpdateItem(mobileEditRow.id, { subSingerIds: newIds }); setMobileEditRow({...mobileEditRow, subSingerIds: newIds}); }} allowCreate multiple placeholder="サブ歌手を追加..." />;
                } else if (colKey === 'location') {
                  cellContent = <div className="text-slate-700 bg-slate-50 p-3 rounded">{String(val || '-')}</div>;
                } else if (colKey === 'evaluation1') {
                  cellContent = <NotionSelect value={val || ''} options={evaluationOptions} onChange={(newVal) => { onUpdateItem(mobileEditRow.id, { evaluation1: newVal }); setMobileEditRow({...mobileEditRow, evaluation1: newVal}); }} onDeleteOption={onDeleteEvaluation} onUpdateOption={onUpdateEvaluation} allowCreate placeholder="評価..." />;
                } else {
                  cellContent = <div className="text-slate-700 bg-slate-50 p-3 rounded">{String(val || '-')}</div>;
                }
              } else if (type === 'singer') {
                if (colKey === 'lastSearchedAt') {
                  let formatted = '-';
                  if (val) {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      formatted = String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
                    }
                  }
                  cellContent = <div className="text-slate-700 bg-slate-50 p-3 rounded font-mono">{formatted}</div>;
                } else if (colKey === 'name') {
                  cellContent = <AutoResizeTextarea value={val || ''} onChange={(e) => { onUpdateItem(mobileEditRow.id, { [colKey]: e.target.value }); setMobileEditRow({...mobileEditRow, [colKey]: e.target.value}); }} className="border border-slate-300 focus:border-blue-500 rounded p-3 w-full bg-white text-base" />;
                } else if (colKey === 'location') {
                  cellContent = <NotionSelect value={val || ''} options={locationOptions} onChange={(newVal) => { onUpdateItem(mobileEditRow.id, { location: newVal }); setMobileEditRow({...mobileEditRow, location: newVal}); }} allowCreate placeholder="言語..." />;
                } else if (colKey === 'preference' || colKey === 'singability') {
                  cellContent = <input type="number" min="1" max="5" value={val || ''} onChange={(e) => { const n = parseInt(e.target.value) || null; onUpdateItem(mobileEditRow.id, { [colKey]: n }); setMobileEditRow({...mobileEditRow, [colKey]: n}); }} className="border border-slate-300 rounded p-3 w-full bg-white text-base" />;
                } else {
                  cellContent = <div className="text-slate-700 bg-slate-50 p-3 rounded">{String(val || '-')}</div>;
                }
              }

              return (
                <div key={colKey} className="flex flex-col gap-2">
                  <label className="font-bold text-slate-500 text-sm">{colDef.label}</label>
                  {cellContent}
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            {onDeleteItem && (
              <button onClick={() => { onDeleteItem(mobileEditRow.id); setMobileEditRow(null); }} className="text-red-500 flex items-center gap-2 font-bold p-3 hover:bg-red-50 rounded">
                <Trash2 className="w-5 h-5" /> 削除
              </button>
            )}
            <button onClick={() => setMobileEditRow(null)} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold ml-auto">
              完了
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function DatabaseIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}


function PropertiesMenu({ view, onUpdateView, ALL_COLUMNS, onClose }: any) {
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // ensure all columns are in view.columns (in case some were added later)
  const orderedColumns = view.columns || ALL_COLUMNS.map((c: any) => c.key);
  const missingColumns = ALL_COLUMNS.filter((c: any) => !orderedColumns.includes(c.key)).map((c: any) => c.key);
  const allOrdered = [...orderedColumns, ...missingColumns];

  const hiddenColumns = view.hiddenColumns || [];
  
  const shownProps = allOrdered.filter((k: string) => !hiddenColumns.includes(k));
  const hiddenProps = allOrdered.filter((k: string) => hiddenColumns.includes(k));

  const toggleColumn = (key: string) => {
    if (hiddenColumns.includes(key)) {
      onUpdateView(view.id, { hiddenColumns: hiddenColumns.filter((k: string) => k !== key) });
    } else {
      onUpdateView(view.id, { hiddenColumns: [...hiddenColumns, key] });
    }
  };

  const hideAll = () => {
    onUpdateView(view.id, { hiddenColumns: allOrdered });
  };

  const showAll = () => {
    onUpdateView(view.id, { hiddenColumns: [] });
  };

  const handleDragStart = (e: React.DragEvent, colKey: string) => {
    e.dataTransfer.setData('colKey', colKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    const draggedKey = e.dataTransfer.getData('colKey');
    if (!draggedKey || draggedKey === targetColKey) return;
    
    const newColumns = [...allOrdered];
    const draggedIdx = newColumns.indexOf(draggedKey);
    const targetIdx = newColumns.indexOf(targetColKey);
    newColumns.splice(draggedIdx, 1);
    newColumns.splice(targetIdx, 0, draggedKey);
    
    onUpdateView(view.id, { columns: newColumns });
  };

  const getIcon = (type: string) => {
    // Return simple SVG based on type
    if (type === 'text') return <div className="w-4 h-4 flex items-center justify-center font-serif text-[10px] font-bold">Aa</div>;
    if (type === 'number') return <div className="w-4 h-4 flex items-center justify-center font-serif text-[10px] font-bold">#</div>;
    if (type === 'date') return <div className="w-4 h-4 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>;
    if (type === 'single_select') return <div className="w-4 h-4 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>;
    if (type === 'multi_select') return <div className="w-4 h-4 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></div>;
    return <div className="w-4 h-4 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg></div>;
  };

  const renderItem = (k: string, isVisible: boolean) => {
    const colDef = ALL_COLUMNS.find((c: any) => c.key === k);
    if (!colDef) return null;
    if (searchQuery && !colDef.label.toLowerCase().includes(searchQuery.toLowerCase())) return null;

    return (
      <div 
        key={k} 
        draggable
        onDragStart={(e) => handleDragStart(e, k)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, k)}
        className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-100 rounded group cursor-grab active:cursor-grabbing text-sm transition-colors"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-slate-400">
            {getIcon(colDef.type)}
          </div>
          <span className="text-slate-700">{colDef.label}</span>
        </div>
        <button onClick={() => toggleColumn(k)} className="text-slate-400 hover:text-slate-700">
          {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className="absolute top-full right-0 mt-1 w-[320px] bg-white border border-slate-200 shadow-xl rounded-xl z-[99] flex flex-col max-h-[500px]">
      <div className="flex flex-col border-b border-slate-100 p-2">
        <div className="flex items-center justify-between px-2 py-1 mb-2">
          <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
            <ArrowLeft className="w-4 h-4 cursor-pointer hover:text-slate-900" onClick={onClose} />
            プロパティの表示/非表示
          </div>
          <X className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600" onClick={onClose} />
        </div>
        <div className="relative px-2 mb-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="プロパティを検索..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-blue-500 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 text-slate-700"
          />
        </div>
      </div>
      
      <div className="overflow-y-auto p-2 scrollbar-thin">
        {shownProps.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 font-medium">
              <span>テーブルで表示</span>
              <button onClick={hideAll} className="text-blue-500 hover:text-blue-600 transition-colors">すべて非表示</button>
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {shownProps.map((k: string) => renderItem(k, true))}
            </div>
          </div>
        )}
        
        {hiddenProps.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 font-medium">
              <span>テーブルで非表示</span>
              <button onClick={showAll} className="text-blue-500 hover:text-blue-600 transition-colors">すべて表示</button>
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {hiddenProps.map((k: string) => renderItem(k, false))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
