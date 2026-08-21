
import { useState, useEffect } from 'react';
import { useStore } from '../../store/StoreContext';
import { LinkedDbView } from '../../types';

export function useLinkedDb() {
    const { state, setState, addView, updateView, deleteView, updateSong, updateSinger, getComputedSongs, getComputedSingers, ensureSinger, ensureSingers, deleteGlobalTag, updateUiState } = useStore();
  const isMusicMode = state.uiState?.linkedDbIsMusicMode || false;
  const setIsMusicMode = (val: boolean) => updateUiState({ linkedDbIsMusicMode: val });
  const [currentPlaylist, setCurrentPlaylist] = useState<any[]>([]);
  const activeViewId = state.lastOpenViewId;
  const setActiveViewId = (id: string | null) => setState(s => ({ ...s, lastOpenViewId: id }));
  const [isSetup, setIsSetup] = useState(false);
  const [showAddViewModal, setShowAddViewModal] = useState(false);
  const searchQuery = state.uiState?.linkedDbSearchQuery || '';
  const setSearchQuery = (val: string) => updateUiState({ linkedDbSearchQuery: val });
  const [filteredCount, setFilteredCount] = useState<number>(0);

  useEffect(() => {
    if (state.linkedViews.length > 0) {
      if (!activeViewId || !state.linkedViews.some(v => v.id === activeViewId)) {
        setActiveViewId(state.linkedViews[0].id);
      }
    } else {
      setIsSetup(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.linkedViews, activeViewId]);

  // オプションの抽出
  const genreOptions = (state.customGenres || []).map(g => ({ label: g, value: g }));
  const usageOptions = (state.customUsages || []).map(u => ({ label: u, value: u }));
  const singerOptions = state.singers.map(s => ({ label: s.name, value: s.id }));
  const locationOptions = Array.from(new Set([
    ...state.songs.map(s => s.location),
    ...state.singers.map(s => s.location)
  ].filter(Boolean))).map(l => ({ label: l as string, value: l as string }));
  const evaluationOptions = (state.customEvaluations || []).map(e => ({ label: e, value: e }));

  const handleDeleteGenre = (val: string) => {
      deleteGlobalTag('genre', val);
    };
    const handleDeleteUsage = (val: string) => {
      deleteGlobalTag('usage', val);
    };
    const handleDeleteEvaluation = (val: string) => {
      deleteGlobalTag('evaluation1', val);
    };

  const activeView = state.linkedViews.find((v: LinkedDbView) => v.id === activeViewId);


  return {
    
    isMusicMode, setIsMusicMode,
    currentPlaylist, setCurrentPlaylist,
    activeViewId, setActiveViewId,
    isSetup, setIsSetup,
    showAddViewModal, setShowAddViewModal,
    searchQuery, setSearchQuery,
    filteredCount, setFilteredCount,
    genreOptions, usageOptions, singerOptions, locationOptions, evaluationOptions,
    handleDeleteGenre, handleDeleteUsage, handleDeleteEvaluation,
    activeView

  };
}
