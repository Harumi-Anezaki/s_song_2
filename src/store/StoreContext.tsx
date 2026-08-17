import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { auth, rtdb, onAuthStateChanged, User } from '../lib/firebase';
import { ref, get, set, child } from 'firebase/database';
import { AppState, Song, Singer, LinkedDbView } from '../types';
import SeedData from './SeedData.json';
import { generateId } from '../lib/utils';
import { differenceInDays, parseISO } from 'date-fns';

type StoreContextType = {
  user: User | null;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateSong: (id: string, updates: Partial<Song>) => void;
  deleteSong: (id: string) => void;
  updateSinger: (id: string, updates: Partial<Singer>) => void;
  deleteSinger: (id: string) => void;
  ensureSinger: (nameOrId: string) => string;
  ensureSingers: (namesOrIds: string[]) => string[];
  addMergedSongs: (songs: Partial<Song>[]) => Song[];
  addExcludedYoutubeIds: (ids: string[]) => void;
  removeExcludedYoutubeId: (id: string) => void;
  getComputedSongs: () => any[];
  getComputedSingers: () => any[];
  updateSettings: (key: string, value: any) => void;
  updateUiState: (updates: Partial<NonNullable<AppState['uiState']>>) => void;
  updateView: (viewId: string, updates: Partial<LinkedDbView>) => void;
  addView: (view: LinkedDbView) => void;
  deleteView: (viewId: string) => void;
  importData: (data: string) => void;
  exportData: () => string;
  deleteGlobalTag: (type: 'genre' | 'usage' | 'evaluation1', tag: string) => void;
};

const defaultState: AppState = {
  youtubeApiKey: '',
  songs: [],
  singers: [],
  excludedYoutubeIds: [],
  linkedViews: [],
  lastOpenViewId: null,
  uiState: {
    isSidebarOpen: true,
    activeTab: 'youtube',
  },
  ...(SeedData as Partial<AppState>), // シードデータをマージ
};

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AppState>(defaultState);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('appState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState({ 
          ...defaultState, 
          ...parsed,
          uiState: { ...defaultState.uiState, ...(parsed.uiState || {}) }
        });
      } catch (e) {
        console.error('Failed to parse state', e);
      }
    }
    setIsLoaded(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load from firebase
        try {
          const snapshot = await get(child(ref(rtdb), `users/${currentUser.uid}`));
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.appState) {
              const parsed = JSON.parse(data.appState);
              setState(prevState => ({
                ...prevState,
                ...parsed,
                uiState: { ...prevState.uiState, ...(parsed.uiState || {}) }
              }));
            }
          }
        } catch (err) {
          console.error('Failed to load from firebase RTDB', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('appState', JSON.stringify(state));
      if (user) {
        setSyncStatus('syncing');
        const timer = setTimeout(() => {
          set(ref(rtdb, `users/${user.uid}`), {
            appState: JSON.stringify(state),
            updatedAt: new Date().toISOString()
          })
            .then(() => setSyncStatus('success'))
            .catch((err) => {
              console.error('Sync error RTDB', err);
              setSyncStatus('error');
            });
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [state, isLoaded, user]);

  const updateSettings = (key: string, value: any) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const updateUiState = (updates: Partial<NonNullable<AppState['uiState']>>) => {
    setState((s) => ({
      ...s,
      uiState: { ...(s.uiState || defaultState.uiState), ...updates }
    }));
  };

  const updateSong = (id: string, updates: Partial<Song>) => {
    setState((s) => {
      let nextCustomGenres = s.customGenres || [];
      let nextCustomUsages = s.customUsages || [];
      let nextCustomEvals = s.customEvaluations || [];
      
      if (updates.genre) {
        const arr = Array.isArray(updates.genre) ? updates.genre : [updates.genre];
        nextCustomGenres = Array.from(new Set([...nextCustomGenres, ...arr.filter(Boolean)]));
      }
      if (updates.usage) {
        const arr = Array.isArray(updates.usage) ? updates.usage : [updates.usage];
        nextCustomUsages = Array.from(new Set([...nextCustomUsages, ...arr.filter(Boolean)]));
      }
      if (updates.evaluation1) {
        nextCustomEvals = Array.from(new Set([...nextCustomEvals, updates.evaluation1].filter(Boolean)));
      }

      return {
        ...s,
        customGenres: nextCustomGenres,
        customUsages: nextCustomUsages,
        customEvaluations: nextCustomEvals,
        songs: s.songs.map((song) => (song.id === id ? { ...song, ...updates, updatedAt: new Date().toISOString() } : song)),
      };
    });
  };

  const deleteSong = (id: string) => {
    setState((s) => ({ ...s, songs: s.songs.filter((song) => song.id !== id) }));
  };

  const updateSinger = (id: string, updates: Partial<Singer>) => {
    setState((s) => ({
      ...s,
      singers: s.singers.map((singer) => (singer.id === id ? { ...singer, ...updates, updatedAt: new Date().toISOString() } : singer)),
    }));
  };

  const deleteSinger = (id: string) => {
    setState((s) => ({ ...s, singers: s.singers.filter((singer) => singer.id !== id) }));
  };

  const ensureSinger = (nameOrId: string) => {
    if (!nameOrId) return '';
    const existing = state.singers.find(singer => singer.id === nameOrId);
    if (existing) return existing.id;
    const existingByName = state.singers.find(singer => singer.name === nameOrId);
    if (existingByName) return existingByName.id;
    const newId = generateId();
    setState(prev => {
      // Check again inside the setter to prevent race conditions
      if (prev.singers.some(s => s.name === nameOrId)) return prev;
      return {
        ...prev,
        singers: [
          ...prev.singers,
          {
            id: newId,
            name: nameOrId,
            preference: null,
            singability: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ]
      };
    });
    return newId;
  };

  const ensureSingers = (namesOrIds: string[]) => namesOrIds.map(ensureSinger).filter(Boolean);

  const addMergedSongs = (newSongs: Partial<Song>[]) => {
    const now = new Date().toISOString();
    const toAdd = newSongs.map((ns) => ({
      ...ns,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    })) as Song[];
    setState((s) => ({ ...s, songs: [...s.songs, ...toAdd] }));
    return toAdd;
  };

  const addExcludedYoutubeIds = (ids: string[]) => {
    setState((s) => ({ ...s, excludedYoutubeIds: [...new Set([...s.excludedYoutubeIds, ...ids])] }));
  };

  const removeExcludedYoutubeId = (id: string) => {
    setState((s) => ({ ...s, excludedYoutubeIds: s.excludedYoutubeIds.filter((excludedId) => excludedId !== id) }));
  };

  const updateView = (viewId: string, updates: Partial<LinkedDbView>) => {
    setState((s) => ({
      ...s,
      linkedViews: s.linkedViews.map((v) => (v.id === viewId ? { ...v, ...updates } : v)),
    }));
  };

  const addView = (view: LinkedDbView) => {
    setState((s) => ({ ...s, linkedViews: [...s.linkedViews, view] }));
  };

  const deleteView = (viewId: string) => {
    setState((s) => ({ ...s, linkedViews: s.linkedViews.filter((v) => v.id !== viewId) }));
  };

  const importData = (dataStr: string) => {
    try {
      const data = JSON.parse(dataStr);
      setState({ 
        ...defaultState, 
        ...data,
        uiState: { ...defaultState.uiState, ...(data.uiState || {}) }
      });
    } catch (e) {
      console.error('Import failed. Invalid JSON.', e);
    }
  };

  const deleteGlobalTag = (type: 'genre' | 'usage' | 'evaluation1', tag: string) => {
    setState(s => {
      let nextCustomGenres = s.customGenres || [];
      let nextCustomUsages = s.customUsages || [];
      let nextCustomEvals = s.customEvaluations || [];
      
      if (type === 'genre') nextCustomGenres = nextCustomGenres.filter(g => g !== tag);
      if (type === 'usage') nextCustomUsages = nextCustomUsages.filter(g => g !== tag);
      if (type === 'evaluation1') nextCustomEvals = nextCustomEvals.filter(g => g !== tag);

      return {
        ...s,
        customGenres: nextCustomGenres,
        customUsages: nextCustomUsages,
        customEvaluations: nextCustomEvals,
        songs: s.songs.map(song => {
          let updated = false;
          let newSong = { ...song, updatedAt: new Date().toISOString() };
          if (type === 'genre') {
             if (Array.isArray(song.genre) && song.genre.includes(tag)) { newSong.genre = song.genre.filter(g => g !== tag); updated = true; }
             else if (song.genre === tag) { newSong.genre = []; updated = true; }
          }
          if (type === 'usage') {
             if (Array.isArray(song.usage) && song.usage.includes(tag)) { newSong.usage = song.usage.filter(g => g !== tag); updated = true; }
             else if (song.usage === tag) { newSong.usage = []; updated = true; }
          }
          if (type === 'evaluation1') {
             if (song.evaluation1 === tag) { newSong.evaluation1 = ''; updated = true; }
          }
          return updated ? newSong : song;
        })
      };
    });
  };

  const exportData = () => {
    return JSON.stringify(state, null, 2);
  };

  const getComputedSingers = () => {
    return state.singers.map((singer) => {
      const mainSongs = state.songs.filter((s) => s.mainSingerId === singer.id);
      const subSongs = state.songs.filter((s) => s.subSingerIds.includes(singer.id));
      const allSongs = [...mainSongs, ...subSongs];

      const songViews = allSongs.map((s) => s.viewCount);
      const songViewsPerDay = allSongs.map((s) => {
        const days = Math.max(1, differenceInDays(new Date(), parseISO(s.releaseDate)) || 1);
        return s.viewCount / days;
      });

      const sortedViews = [...songViews].sort((a, b) => b - a);
      let top70Views = null;
      if (sortedViews.length > 5) {
        const idx = Math.floor(sortedViews.length * 0.7);
        if (idx > 0) top70Views = sortedViews[idx - 1];
      }

      const sortedViewsPerDay = [...songViewsPerDay].sort((a, b) => b - a);
      let top70ViewsPerDay = null;
      if (sortedViewsPerDay.length > 5) {
        const idx = Math.floor(sortedViewsPerDay.length * 0.7);
        if (idx > 0) top70ViewsPerDay = sortedViewsPerDay[idx - 1];
      }

      return {
        ...singer,
        _mainSongs: mainSongs,
        _subSongs: subSongs,
        _songViews: songViews,
        _songViewsPerDay: songViewsPerDay,
        _top70Views: top70Views,
        _top70ViewsPerDay: top70ViewsPerDay,
      };
    });
  };

  const getComputedSongs = () => {
    const computedSingers = getComputedSingers();

    return state.songs.map((song) => {
      const days = Math.max(1, differenceInDays(new Date(), parseISO(song.releaseDate)) || 1);
      const viewsPerDay = song.viewCount / days;

      const mainSinger = computedSingers.find((s) => s.id === song.mainSingerId);
      const singerPreference = mainSinger?.preference ?? null;
      const top70Views = mainSinger?._top70Views ?? null;
      const top70ViewsPerDay = mainSinger?._top70ViewsPerDay ?? null;

      let trend = '';
      if (top70Views !== null && top70ViewsPerDay !== null) {
        if (song.viewCount < top70Views && viewsPerDay < top70ViewsPerDay) {
          trend = '時代遅れ';
        }
      }

      return {
        ...song,
        _viewsPerDay: viewsPerDay,
        _top70Views: top70Views,
        _top70ViewsPerDay: top70ViewsPerDay,
        _singerPreference: singerPreference,
        _mainSingerName: mainSinger?.name ?? '',
        _trend: trend,
      };
    });
  };

  if (!isLoaded) return null;

  return (
    <StoreContext.Provider
      value={{
        user,
        syncStatus,
        state,
        setState,
        updateSong,
        deleteSong,
        updateSinger,
        deleteSinger,
        ensureSinger,
        ensureSingers,
        addMergedSongs,
        addExcludedYoutubeIds,
        removeExcludedYoutubeId,
        getComputedSongs,
        getComputedSingers,
        updateSettings,
        updateUiState,
        updateView,
        addView,
        deleteView,
        importData,
        exportData,
        deleteGlobalTag,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
