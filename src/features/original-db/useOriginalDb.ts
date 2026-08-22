
import { useState, useMemo } from 'react';
import { useStore } from '../../store/StoreContext';
import { LinkedDbView, Song, Singer } from '../../types';
import { generateId } from '../../lib/utils';
import { SONG_COLUMNS, SINGER_COLUMNS } from '../../lib/constants';

export function useOriginalDb() {
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
    
    let cols = newView.columns.filter(c => c !== 'search' && c !== 'lastSearchedAt');
    if (newView.columns.includes('lastSearchedAt')) {
      // If they already had it, we still force it next to search for consistency, or keep it where they dragged it?
      // "検索カラムの横に" could mean default placement. Let's just place 'lastSearchedAt' immediately after 'search'.
      // If we do this, it will always be locked next to search. The prompt didn't say to lock it, but the search column is already locked.
    }
    newView.columns = ['search', 'lastSearchedAt', ...cols, ...missing.filter(c => c !== 'search' && c !== 'lastSearchedAt')].filter(c => defaultSingerColumns.includes(c));
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
      location: '',
      preference: null,
      singability: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, singers: [newSinger, ...s.singers] }));
  };

  const computedSongs = getComputedSongs();
  const computedSingers = getComputedSingers();

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

  const allLocations = Array.from(new Set([
    ...state.singers.map(s => s.location),
    ...state.songs.map(s => s.location)
  ].filter(Boolean)));

  const genreOptions = (state.customGenres || []).map(g => ({ label: g, value: g }));
  const usageOptions = (state.customUsages || []).map(u => ({ label: u, value: u }));
  const locationOptions = allLocations.map(l => ({ label: l, value: l }));
  const evaluationOptions = (state.customEvaluations || []).map(e => ({ label: e, value: e }));
  const singerOptions = state.singers.map(s => ({ label: s.name, value: s.id }));

  const { deleteGlobalTag, updateGlobalTag } = useStore();
  const handleDeleteGenre = (val: string) => {
    deleteGlobalTag('genre', val);
  };

  const handleDeleteUsage = (val: string) => {
    deleteGlobalTag('usage', val);
  };
  const handleDeleteEvaluation = (val: string) => {
    deleteGlobalTag('evaluation1', val);
  };

  const handleUpdateGenre = (oldVal: string, newVal: string) => {
    updateGlobalTag('genre', oldVal, newVal);
  };
  const handleUpdateUsage = (oldVal: string, newVal: string) => {
    updateGlobalTag('usage', oldVal, newVal);
  };
  const handleUpdateEvaluation = (oldVal: string, newVal: string) => {
    updateGlobalTag('evaluation1', oldVal, newVal);
  };


  return {
    
    searchQuery, setSearchQuery,
    songView, singerView,
    handleUpdateSongView, handleUpdateSingerView,
    computedSongs, computedSingers,
    activeTab, setActiveTab,
    handleAddSong, handleAddSinger,
    genreOptions, usageOptions, locationOptions, evaluationOptions, singerOptions,
    handleDeleteGenre, handleDeleteUsage, handleDeleteEvaluation,
    handleUpdateGenre, handleUpdateUsage, handleUpdateEvaluation

  };
}
