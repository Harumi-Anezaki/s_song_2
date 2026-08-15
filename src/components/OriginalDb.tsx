import { motion } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ArrowRight, EyeOff, Eye, Search, GripVertical } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { generateId } from '../lib/utils';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
import { Song, Singer } from '../types';
import { NotionSelect } from './ui/NotionSelect';
import { DynamicTable, SONG_COLUMNS, SINGER_COLUMNS } from './LinkedDb';
import { LinkedDbView } from '../types';

const truncateText = (text: string, maxLength = 20) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

export default function OriginalDb({ onNavigateToSearch }: { onNavigateToSearch: (keyword: string) => void }) {
  const { state, updateSong, deleteSong, updateSinger, deleteSinger, setState, getComputedSongs, getComputedSingers, updateUiState, ensureSinger, ensureSingers } = useStore();
  const searchQuery = state.uiState?.originalDbSearchQuery || '';
  const setSearchQuery = (val: string) => updateUiState({ originalDbSearchQuery: val });
  const defaultSongColumns = SONG_COLUMNS.map(c => c.key);
  const defaultSingerColumns = ['search', ...SINGER_COLUMNS.filter(c => c.key !== 'search').map(c => c.key)];

  const songView: LinkedDbView = (() => {
    const view = state.uiState?.originalDbSongView || {
      id: 'original_song', name: 'Song DB', sourceDb: 'song',
      columns: defaultSongColumns, hiddenColumns: [], filters: [], sorts: [], columnWidths: {}, wrapText: false
    };
    let newView = { sourceDb: 'song', ...view };
    const missing = defaultSongColumns.filter(c => !newView.columns.includes(c));
    newView.columns = [...newView.columns, ...missing].filter(c => defaultSongColumns.includes(c));
    newView.filters = (newView.filters || []).filter(f => defaultSongColumns.includes(f.column));
    newView.sorts = (newView.sorts || []).filter(s => defaultSongColumns.includes(s.column));
    return newView;
  })();

  const singerView: LinkedDbView = (() => {
    const view = state.uiState?.originalDbSingerView || {
      id: 'original_singer', name: 'Singer DB', sourceDb: 'singer',
      columns: defaultSingerColumns, hiddenColumns: [], filters: [], sorts: [], columnWidths: {}, wrapText: false
    };
    let newView = { sourceDb: 'singer', ...view };
    const missing = defaultSingerColumns.filter(c => !newView.columns.includes(c));
    newView.columns = ['search', ...newView.columns.filter(c => c !== 'search'), ...missing.filter(c => c !== 'search')].filter(c => defaultSingerColumns.includes(c));
    newView.filters = (newView.filters || []).filter(f => defaultSingerColumns.includes(f.column) && f.column !== 'search');
    newView.sorts = (newView.sorts || []).filter(s => defaultSingerColumns.includes(s.column) && s.column !== 'search');
    return newView;
  })();

  const handleUpdateSongView = (id: string, updates: Partial<LinkedDbView>) => {
    setState(prev => {
      const prevView = prev.uiState?.originalDbSongView || {
        id: 'original_song', name: 'Song DB', sourceDb: 'song',
        columns: defaultSongColumns, hiddenColumns: [], filters: [], sorts: [], columnWidths: {}, wrapText: false
      };
      return { ...prev, uiState: { ...prev.uiState, originalDbSongView: { ...prevView, ...updates } } };
    });
  };
  const handleUpdateSingerView = (id: string, updates: Partial<LinkedDbView>) => {
    setState(prev => {
      const prevView = prev.uiState?.originalDbSingerView || {
        id: 'original_singer', name: 'Singer DB', sourceDb: 'singer',
        columns: defaultSingerColumns, hiddenColumns: [], filters: [], sorts: [], columnWidths: {}, wrapText: false
      };
      return { ...prev, uiState: { ...prev.uiState, originalDbSingerView: { ...prevView, ...updates } } };
    });
  };

  const activeTab = state.uiState?.originalDbActiveTab || 'song';
  const setActiveTab = (tab: 'song' | 'singer') => updateUiState({ originalDbActiveTab: tab });

  const collapsedColumns = state.uiState?.originalDbCollapsedColumns || {};
  const setCollapsedColumns = (updates: Record<string, boolean>) => updateUiState({ originalDbCollapsedColumns: updates });

  const toggleColumnCollapse = (colKey: string) => {
    setCollapsedColumns({ ...collapsedColumns, [colKey]: !collapsedColumns[colKey] });
  };

  const handleAddSong = () => {
    const newSong: Song = {
      id: generateId(),
      title: '新規曲',
      youtubeIds: [],
      mainSingerId: null,
      subSingerIds: [],
      location: '',
      genre: [],
      usage: [],
      evaluation1: '',
      urls: [],
      releaseDate: new Date().toISOString().split('T')[0],
      viewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, songs: [newSong, ...s.songs] }));
  };

  const handleAddSinger = () => {
    const newSinger: Singer = {
      id: generateId(),
      name: '新規歌手',
      preference: null,
      singability: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, singers: [newSinger, ...s.singers] }));
  };

  const computedSongs = useMemo(() => getComputedSongs(), [state.songs, state.singers]);
  const computedSingers = useMemo(() => getComputedSingers(), [state.songs, state.singers]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return computedSongs;
    const lowerQ = searchQuery.toLowerCase();
    return computedSongs.filter(s => s.title.toLowerCase().includes(lowerQ));
  }, [computedSongs, searchQuery]);

  const filteredSingers = useMemo(() => {
    if (!searchQuery.trim()) return computedSingers;
    const lowerQ = searchQuery.toLowerCase();
    return computedSingers.filter(s => s.name.toLowerCase().includes(lowerQ));
  }, [computedSingers, searchQuery]);

  const allGenres = Array.from(new Set([...(state.customGenres || []), ...state.songs.flatMap(s => typeof s.genre === 'string' ? [s.genre] : (s.genre || []))]));
  const allUsages = Array.from(new Set([...(state.customUsages || []), ...state.songs.flatMap(s => typeof s.usage === 'string' ? [s.usage] : (s.usage || []))]));
  const allLocations = Array.from(new Set(state.songs.map(s => s.location).filter(Boolean)));
  const allEvaluations = Array.from(new Set([...(state.customEvaluations || []), ...state.songs.map(s => s.evaluation1).filter(Boolean)]));

  const genreOptions = [...allGenres, '沖縄', 'HIPHOP', 'アイドル'].filter((v, i, a) => a.indexOf(v) === i).map(g => ({ label: g, value: g }));
  const usageOptions = [...allUsages, '盛上', '高音練習', 'おはこ'].filter((v, i, a) => a.indexOf(v) === i).map(u => ({ label: u, value: u }));
  const locationOptions = allLocations.map(l => ({ label: l, value: l }));
  const evaluationOptions = allEvaluations.map(e => ({ label: e, value: e }));
  const singerOptions = state.singers.map(s => ({ label: s.name, value: s.id }));

  const { deleteGlobalTag } = useStore();
  const handleDeleteGenre = (val: string) => {
    deleteGlobalTag('genre', val);
  };

  const handleDeleteUsage = (val: string) => {
    deleteGlobalTag('usage', val);
  };
  const handleDeleteEvaluation = (val: string) => {
    deleteGlobalTag('evaluation1', val);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">DB原本</h1>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="タイトルで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-3 sm:py-1.5 border border-slate-300 rounded-md text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
        </div>
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('song')}
              className={`px-4 py-3 sm:py-1.5 text-base sm:text-sm font-medium rounded-md transition-colors ${activeTab === 'song' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              曲 ({state.songs.length})
            </button>
            <button
              onClick={() => setActiveTab('singer')}
              className={`px-4 py-3 sm:py-1.5 text-base sm:text-sm font-medium rounded-md transition-colors ${activeTab === 'singer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              歌手 ({state.singers.length})
            </button>
          </div>
          <button
            onClick={activeTab === 'song' ? handleAddSong : handleAddSinger}
            className="flex items-center gap-2 px-4 py-3 sm:py-2 bg-blue-600 text-white text-base sm:text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>新規追加</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'song' ? (
          <div className="flex-1 overflow-auto bg-white relative">
          <DynamicTable
            view={{ ...songView, sorts: [], filters: [], hiddenColumns: [] }}
            data={computedSongs}
            onUpdateView={handleUpdateSongView}
            type="song"
            onUpdateItem={updateSong}
            onDeleteItem={deleteSong}
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
            ensureSinger={ensureSinger}
            ensureSingers={ensureSingers}
            onFilteredCountChange={() => {}}
            onFilteredDataChange={() => {}}
          />
        </div>
        ) : (
          <div className="flex-1 overflow-auto bg-white relative">
          <DynamicTable
            view={{ ...singerView, sorts: [], filters: [], hiddenColumns: [] }}
            data={computedSingers}
            onUpdateView={handleUpdateSingerView}
            type="singer"
            onUpdateItem={updateSinger}
            onDeleteItem={deleteSinger}
            onNavigateToSearch={onNavigateToSearch}
            singers={state.singers}
            searchQuery={searchQuery}
            genreOptions={genreOptions}
            usageOptions={usageOptions}
            singerOptions={singerOptions}
            locationOptions={locationOptions}
            evaluationOptions={evaluationOptions}
            ensureSinger={ensureSinger}
            ensureSingers={ensureSingers}
            onFilteredCountChange={() => {}}
            onFilteredDataChange={() => {}}
          />
        </div>
        )}
      </div>
    </div>
  );
}

// Below are the dynamic SongTable and SingerTable
function DragHeader({ col, collapsedColumns, onToggleCollapse, draggedColumn, onDragStart, onDragOver, onDrop, onDragEnd }: any) {
  const isCollapsed = collapsedColumns[col.id];
  return (
    <motion.th layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} className={`${col.className} relative group bg-slate-50 ${draggedColumn === col.id ? 'opacity-50' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, col.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, col.id)}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab" />
          <span>{col.label}</span>
        </div>
        {col.collapsible && (
          <button onClick={() => onToggleCollapse(col.id)} className="text-gray-400 hover:text-gray-600">
            {isCollapsed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        )}
      </div>
    </motion.th>
  );
}

const SONG_DEF = [
  { id: 'actions', label: '操作', className: 'px-4 py-3 whitespace-nowrap w-16' },
  { id: 'title', label: '曲名', collapsible: true, className: 'px-4 py-3 whitespace-nowrap w-[250px] min-w-[250px]' },
  { id: 'id', label: 'ID', className: 'px-4 py-3 whitespace-nowrap w-24' },
  { id: 'mainSingerId', label: 'メイン歌手', collapsible: true, className: 'px-4 py-3 whitespace-nowrap min-w-[150px]' },
  { id: 'subSingerIds', label: 'サブ歌手', collapsible: true, className: 'px-4 py-3 whitespace-nowrap min-w-[200px]' },
  { id: 'location', label: '場所', collapsible: true, className: 'px-4 py-3 whitespace-nowrap w-24' },
  { id: 'genre', label: 'ジャンル', collapsible: true, className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'usage', label: '用途', collapsible: true, className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'evaluation1', label: '評価1', collapsible: true, className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'urls', label: 'URL', collapsible: true, className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'releaseDate', label: 'リリース日', className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'viewCount', label: '再生数', className: 'px-4 py-3 whitespace-nowrap text-right w-32' },
  { id: '_viewsPerDay', label: '回/日', className: 'px-4 py-3 whitespace-nowrap text-right w-32' },
  { id: '_top70Views', label: '同アーティストの再生数の上位70%', className: 'px-4 py-3 whitespace-nowrap text-right w-32' },
  { id: '_top70ViewsPerDay', label: '同アーティストの回/日の上位70%', className: 'px-4 py-3 whitespace-nowrap text-right w-32' },
  { id: '_singerPreference', label: '歌手の好き度', className: 'px-4 py-3 whitespace-nowrap text-right w-24' },
  { id: '_trend', label: '流行関数', className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'alarm', label: 'ALARM', className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'createdAt', label: '作成日時', className: 'px-4 py-3 whitespace-nowrap w-32' },
  { id: 'updatedAt', label: '更新日時', className: 'px-4 py-3 whitespace-nowrap w-32' },
];

