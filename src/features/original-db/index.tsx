import { useOriginalDb } from './useOriginalDb';
import { motion } from 'motion/react';
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ArrowRight, EyeOff, Eye, Search, GripVertical } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { generateId } from '../../lib/utils';
import { AutoResizeTextarea } from '../../components/ui/AutoResizeTextarea';
import { Song, Singer } from '../../types';
import { NotionSelect } from '../../components/ui/NotionSelect';
import { DynamicTable } from '../../components/shared/DynamicTable';
import { SONG_COLUMNS, SINGER_COLUMNS } from '../../lib/constants';
import { LinkedDbView } from '../../types';

const truncateText = (text: string, maxLength = 20) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};


export default function OriginalDb({ onNavigateToSearch }: { onNavigateToSearch: (keyword: string) => void }) {

  const {
    searchQuery, setSearchQuery,
    songView, singerView,
    handleUpdateSongView, handleUpdateSingerView,
    computedSongs, computedSingers,
    activeTab, setActiveTab,
    handleAddSong, handleAddSinger,
    genreOptions, usageOptions, locationOptions, evaluationOptions, singerOptions,
    handleDeleteGenre, handleDeleteUsage, handleDeleteEvaluation
  } = useOriginalDb();
  const { updateSong, deleteSong, updateSinger, deleteSinger, ensureSinger, ensureSingers, state } = useStore();

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

