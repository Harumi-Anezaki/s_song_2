import { useLinkedDb } from './useLinkedDb';
import { motion, Reorder } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/StoreContext';
import { LinkedDbView, Filter, Sort, DbType } from '../../types';
import { cn, generateId } from '../../lib/utils';
import { AutoResizeTextarea } from '../../components/ui/AutoResizeTextarea';
import { FilterMultiSelect } from '../../components/ui/FilterMultiSelect';
import { Plus, Search, ArrowLeft, X, Trash2, Filter as FilterIcon, ArrowUpDown, GripVertical, Settings2, Columns, Eye, EyeOff, Copy, Music, Mic } from 'lucide-react';
import { truncateText } from '../../lib/utils';
import { NotionSelect } from '../../components/ui/NotionSelect';
import { MusicPlayerMode } from '../music-player';


import { SONG_COLUMNS, SINGER_COLUMNS, getOperatorsForType } from '../../lib/constants';


import { DynamicTable, ViewOptions } from '../../components/shared/DynamicTable';



export default function LinkedDb() {

  const {
    isMusicMode, setIsMusicMode,
    currentPlaylist, setCurrentPlaylist,
    activeViewId, setActiveViewId,
    isSetup, setIsSetup,
    showAddViewModal, setShowAddViewModal,
    searchQuery, setSearchQuery,
    filteredCount, setFilteredCount,
    genreOptions, usageOptions, singerOptions, locationOptions, evaluationOptions,
    handleDeleteGenre, handleDeleteUsage, handleDeleteEvaluation,
    handleUpdateGenre, handleUpdateUsage, handleUpdateEvaluation,
    activeView
  } = useLinkedDb();
  const { state, setState, addView, updateView, deleteView, updateSong, updateSinger, getComputedSongs, getComputedSingers, ensureSinger, ensureSingers, deleteGlobalTag, updateUiState } = useStore();

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isMusicMode ? 'bg-[#121212]' : 'bg-white'}`}>
      <header className={`flex-shrink-0 px-6 py-4 flex justify-between items-center border-b transition-colors ${isMusicMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-100'}`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tight flex items-center gap-4 transition-colors ${isMusicMode ? 'text-white' : 'text-slate-900'}`}>
            リンクドDB
            {activeView?.sourceDb === 'song' && (
              <button 
                onClick={() => setIsMusicMode(!isMusicMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${isMusicMode ? 'bg-[#1DB954] text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <Music className="w-4 h-4" />
                音楽再生モード
              </button>
            )}
          </h1>
        </div>
      </header>
      <div className={`flex items-center gap-1 border-b px-2 py-1 overflow-x-auto shrink-0 transition-colors [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isMusicMode ? "bg-[#181818] border-[#282828]" : "bg-slate-50 border-slate-200"}`}>
        <Reorder.Group
          as="div"
          axis="x"
          values={state.linkedViews}
          onReorder={(newViews) => setState(s => ({ ...s, linkedViews: newViews }))}
          className="flex items-center gap-1"
        >
          {state.linkedViews.map((v: LinkedDbView) => (
            <Reorder.Item
              as="div"
              value={v}
              key={v.id}
              dragListener={!isMobile}
              onClick={() => setActiveViewId(v.id)}
              className={cn("px-3 min-h-[44px] py-1.5 text-base sm:text-sm font-medium rounded-t-md whitespace-nowrap flex items-center gap-2 select-none transition-colors", !isMobile ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", activeViewId === v.id ? (isMusicMode ? "bg-[#282828] text-white" : "bg-white border border-b-0 border-slate-200 text-blue-600") : (isMusicMode ? "text-gray-400 hover:bg-white/10 hover:text-gray-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"))}
            >
              {activeViewId === v.id ? (
                <div className="relative flex items-center min-w-[2rem]">
                  <span className="invisible whitespace-pre px-0.5">{v.name || 'ビュー名'}</span>
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => updateView(v.id, { name: e.target.value })}
                    className={`absolute inset-0 w-full bg-transparent border-none p-0 focus:ring-0 font-medium outline-none text-base sm:text-sm ${isMusicMode ? "text-white" : "text-blue-600"}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="ビュー名"
                  />
                </div>
              ) : (
                <span>{v.name}</span>
              )}
              <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); deleteView(v.id); if (activeViewId === v.id) setActiveViewId(state.linkedViews[0]?.id || null); }} className="p-2 sm:p-0.5 -mr-1.5 sm:mr-0 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4 sm:w-3 sm:h-3" /></button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
        <button onClick={() => setShowAddViewModal(true)} className={`whitespace-nowrap shrink-0 px-3 min-h-[44px] py-1.5 text-base sm:text-sm rounded-md flex items-center gap-1 transition-colors ${isMusicMode ? "text-gray-400 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100"}`}>
          <Plus className="w-4 h-4" /> ビューを追加
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeView ? (
          <>
            {isMusicMode && activeView.sourceDb === 'song' && (
              <MusicPlayerMode songs={currentPlaylist} onClose={() => setIsMusicMode(false)} />
            )}
            <div className={`flex-1 flex flex-col overflow-hidden ${isMusicMode && activeView.sourceDb === 'song' ? 'hidden' : ''}`}>
            <div className="px-4 py-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 bg-white gap-2">
               <div className="flex items-center gap-3 w-full sm:w-auto">
                 <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                   {filteredCount}件
                 </span>
                 <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ビュー内を検索..." className="border border-slate-300 rounded-md px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <div className="flex items-center gap-1 w-full sm:w-auto flex-wrap sm:flex-nowrap">
               <ViewOptions view={activeView} onUpdateView={updateView} type={activeView.sourceDb} optionsMap={{
                 mainSingerId: singerOptions,
                 subSingerIds: singerOptions,
                 genre: genreOptions,
                 usage: usageOptions,
                 evaluation1: evaluationOptions,
                 location: locationOptions,
                 mainSongs: (activeView.sourceDb === 'song' ? getComputedSongs() : getComputedSongs()).map((s: any) => ({ label: s.title, value: s.id })),
                 subSongs: (activeView.sourceDb === 'song' ? getComputedSongs() : getComputedSongs()).map((s: any) => ({ label: s.title, value: s.id }))
               }} />
               </div>
            </div>
            <div className="flex-1 overflow-hidden bg-white relative">
              <DynamicTable
                 view={activeView}
                 data={activeView.sourceDb === 'song' ? getComputedSongs() : getComputedSingers()}
                 onUpdateView={updateView}
                 type={activeView.sourceDb}
                 onUpdateItem={activeView.sourceDb === 'song' ? updateSong : updateSinger}
                 onFilteredCountChange={setFilteredCount}
                 onFilteredDataChange={setCurrentPlaylist}
                 singers={state.singers}
                 searchQuery={searchQuery}
                 genreOptions={genreOptions}
                 usageOptions={usageOptions}
                 singerOptions={singerOptions}
                 locationOptions={locationOptions}
                 evaluationOptions={evaluationOptions}
                 onDeleteGenre={handleDeleteGenre}
                 onDeleteUsage={handleDeleteUsage}
                 onDeleteEvaluation={handleDeleteEvaluation}
                 onUpdateGenre={handleUpdateGenre}
                 onUpdateUsage={handleUpdateUsage}
                 onUpdateEvaluation={handleUpdateEvaluation}
                 ensureSinger={ensureSinger}
                 ensureSingers={ensureSingers}
              />
            </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
             ビューを選択するか、新しいビューを作成してください
          </div>
        )}
      </div>

      {showAddViewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
           <div className="bg-white rounded-xl p-6 w-full max-w-[440px] shadow-2xl border border-slate-100 mx-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Plus className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-xl text-slate-800">新しいビューを作成</h2>
              </div>
              <div className="flex flex-col gap-3">
                 <button onClick={() => {
                    const newId = generateId();
                    addView({
                      id: newId,
                      name: '新しい楽曲ビュー',
                      sourceDb: 'song',
                      columns: SONG_COLUMNS.map(c => c.key),
                      hiddenColumns: [],
                      filters: [],
                      sorts: [],
                      columnWidths: {},
                      wrapText: false
                    });
                    setActiveViewId(newId);
                    setShowAddViewModal(false);
                 }} className="group flex items-center gap-4 p-4 border border-slate-200 hover:border-blue-500 hover:ring-1 hover:ring-blue-500 rounded-xl transition-all text-left bg-white shadow-sm hover:shadow-md">
                   <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                     <Music className="w-6 h-6" />
                   </div>
                   <div>
                     <div className="font-bold text-slate-800 text-base group-hover:text-blue-700 transition-colors">楽曲データベース</div>
                     <div className="text-xs text-slate-500 mt-1 leading-relaxed">曲、アーティスト、ジャンルなどを管理するビューを作成します</div>
                   </div>
                 </button>
                 <button onClick={() => {
                    const newId = generateId();
                    addView({
                      id: newId,
                      name: '新しい歌手ビュー',
                      sourceDb: 'singer',
                      columns: SINGER_COLUMNS.map(c => c.key),
                      hiddenColumns: [],
                      filters: [],
                      sorts: [],
                      columnWidths: {},
                      wrapText: false
                    });
                    setActiveViewId(newId);
                    setShowAddViewModal(false);
                 }} className="group flex items-center gap-4 p-4 border border-slate-200 hover:border-green-500 hover:ring-1 hover:ring-green-500 rounded-xl transition-all text-left bg-white shadow-sm hover:shadow-md">
                   <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors shrink-0">
                     <Mic className="w-6 h-6" />
                   </div>
                   <div>
                     <div className="font-bold text-slate-800 text-base group-hover:text-green-700 transition-colors">歌手データベース</div>
                     <div className="text-xs text-slate-500 mt-1 leading-relaxed">歌手の情報、評価、メモなどを管理するビューを作成します</div>
                   </div>
                 </button>
                 
                 {activeView && (
                   <button onClick={() => {
                      const newId = generateId();
                      const newView = { ...activeView, id: newId, name: `${activeView.name} (コピー)` };
                      addView(newView);
                      setActiveViewId(newId);
                      setShowAddViewModal(false);
                   }} className="group flex items-center gap-4 p-4 border border-slate-200 hover:border-purple-500 hover:ring-1 hover:ring-purple-500 rounded-xl transition-all text-left bg-white shadow-sm hover:shadow-md">
                     <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                       <Copy className="w-6 h-6" />
                     </div>
                     <div>
                       <div className="font-bold text-slate-800 text-base group-hover:text-purple-700 transition-colors">表示中のビューを複製</div>
                       <div className="text-xs text-slate-500 mt-1 leading-relaxed">現在開いている「{activeView.name}」の設定を引き継ぎます</div>
                     </div>
                   </button>
                 )}
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowAddViewModal(false)} className="px-5 py-2.5 hover:bg-slate-100 rounded-lg text-sm font-semibold text-slate-600 transition-colors">キャンセル</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

