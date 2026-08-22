import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/StoreContext';
import { searchYoutube } from '../../lib/youtube';
import { calculateSimilarity } from '../../lib/similarity';
import { YoutubeSearchResult, SimilarityResult } from '../../types';
import { generateId } from '../../lib/utils';
import { Search, Loader2, AlertTriangle, Info, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NotionSelect } from '../../components/ui/NotionSelect';


export function useYoutubeSearch(initialKeyword: string) {
  const { state, setState, addMergedSongs, addExcludedYoutubeIds, removeExcludedYoutubeId, getComputedSongs, updateSong, deleteSong, updateSinger, updateUiState, ensureSinger, ensureSingers } = useStore();
  const keyword = state.uiState?.searchKeyword || initialKeyword || '';
  const setKeyword = (val: string) => updateUiState({ searchKeyword: val });
  
  const singerOptions = state.singers.map(s => ({ label: s.name, value: s.id }));
  const locationOptions = Array.from(new Set([
    ...state.singers.map(s => s.location),
    ...state.songs.map(s => s.location)
  ].filter(Boolean)));
  
  const minViews = state.uiState?.youtubeSearchMinViews || 0;
  const setMinViews = (val: number) => updateUiState({ youtubeSearchMinViews: val });
  
  const searchLocation = state.uiState?.youtubeSearchLocation || '';
  const searchGenre = state.uiState?.youtubeSearchGenre || '';
  const setSearchGenre = (val: string) => updateUiState({ youtubeSearchGenre: val });
  const genreOptions = (state.customGenres || []).map(g => ({ label: g, value: g }));
  const setSearchLocation = (val: string) => updateUiState({ youtubeSearchLocation: val });
  
  const [isSearching, setIsSearching] = useState(false);
  const rawResults = state.uiState?.youtubeSearchResults || [];
  const results = Array.from(new Map(rawResults.map((r: any) => [r.id, r])).values()) as any[];
  const setResults = (res: YoutubeSearchResult[]) => updateUiState({ youtubeSearchResults: res });
  
  const updateUnregisteredResult = (resId: string, updates: { mainSingerId?: string | null, subSingerIds?: string[] }) => {
    const newResults = results.map(r => r.id === resId ? { ...r, ...updates } : r);
    setResults(newResults);
  };
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(state.uiState?.youtubeSearchSelectedIds || []));
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set(state.uiState?.youtubeSearchManualSelectedIds || []));
  const [comparingGroup, setComparingGroup] = useState<SimilarityResult[] | null>(state.uiState?.youtubeSearchComparingGroup || null);
  const [viewingDbSong, setViewingDbSong] = useState<any | null>(null);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error' | 'warning'} | null>(null);

  const showMessage = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setMessage({text, type});
    setTimeout(() => setMessage(null), 3000);
  };

  

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    if (!state.youtubeApiKey) {
      showMessage('設定画面からYouTube API Keyを設定してください。', 'error');
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSelectedIds(new Set());
    setManualSelectedIds(new Set());

    // Register singer if not exists
    const nowIso = new Date().toISOString();
    const singerId = ensureSinger(keyword, searchLocation);
    if (singerId) {
      const updates: any = { lastSearchedAt: nowIso };
      if (searchLocation) updates.location = searchLocation;
      updateSinger(singerId, updates);
    }

    try {
      const apiResults = await searchYoutube(keyword, minViews, state.youtubeApiKey);
      const computedSongs = getComputedSongs();

      const getSourcesForSong = (song: any) => {
        const sources = [];
        const singer = state.singers.find(s => s.id === song.mainSingerId);
        const artistName = singer?.name || '';
        
        // Use individual mapped videos for similarity comparison
        if (song.urlTitles && song.urlDurationSeconds && song.youtubeIds.length > 0) {
          song.youtubeIds.forEach((yid: string, i: number) => {
             sources.push({ 
               title: song.urlTitles[i] || song.title, 
               duration: song.urlDurationSeconds[i] || 0, 
               channel: '',
               artistName
             });
          });
        } else {
          // Fallback if no underlying videos are found (should not happen for valid DB entries)
          sources.push({ title: song.title, duration: 0, channel: '', artistName });
        }
        return sources;
      };

      const getSourcesForRes = (res: YoutubeSearchResult) => {
        const song = computedSongs.find(s => s.youtubeIds.includes(res.id));
        if (song) return getSourcesForSong(song);
        
        const singer = res.mainSingerId ? state.singers.find(s => s.id === res.mainSingerId) : undefined;
        const artistName = singer?.name || '';
        return [{ title: res.title, duration: res.durationSeconds, channel: res.channelTitle, artistName }];
      };

      const getMaxSimilarity = (sourcesA: any[], sourcesB: any[]) => {
        let maxScore = -1;
        let bestResult = { score: 0, reasons: [] as string[], warnings: [] as string[] };
        for (const a of sourcesA) {
          for (const b of sourcesB) {
             const dbSingers = state.singers.map(s => s.name);
             const res = calculateSimilarity(a, b, keyword, dbSingers);
             if (res.score > maxScore) {
                maxScore = res.score;
                bestResult = res;
             }
          }
        }
        return bestResult;
      };

      // Calculate similarities and groups
      const processedResults = apiResults.map((res: YoutubeSearchResult) => {
        const candidates: SimilarityResult[] = [];
        const resSources = getSourcesForRes(res);
        
        // Compare with existing DB
        computedSongs.forEach((song) => {
          if (!song.youtubeIds || song.youtubeIds.length === 0) return;
          if (song.youtubeIds.includes(res.id)) return; // Don't match if it's already exactly this video
          
          const targetSources = getSourcesForSong(song);
          const { score, reasons, warnings } = getMaxSimilarity(resSources, targetSources);
          
          let avgDuration = 0;
          if (song.urlDurationSeconds && song.urlDurationSeconds.length > 0) {
            const sum = song.urlDurationSeconds.reduce((a: number, b: number) => a + b, 0);
            avgDuration = Math.round(sum / song.urlDurationSeconds.length);
          }

          if (score >= 60) {
            candidates.push({
              targetId: song.id,
              targetYoutubeId: song.youtubeIds[0],
              targetTitle: song.title, // ここをDB上の曲名を使用するように変更
              targetUrl: song.urls[0] || '',
              targetViewCount: song.viewCount,
              targetPublishedAt: song.releaseDate,
              targetChannelTitle: 'DB登録済み',
              targetDurationSeconds: avgDuration,
              score,
              reasons,
              warnings,
              isAlreadyMerged: true, // DB登録済みの曲は自身が既に登録済みであるため選択不可とする
              isDbEntry: true,
            });
          }
        });

        // Compare with other search results
        apiResults.forEach((otherRes: YoutubeSearchResult) => {
          if (res.id === otherRes.id) return;
          // DBに既に登録されているYouTubeIDの場合は、DB登録済みの候補として挙がるため検索結果候補からは除外
          if (computedSongs.some(song => song.youtubeIds?.includes(otherRes.id))) return;
          
          const targetSources = [{ title: otherRes.title, duration: otherRes.durationSeconds, channel: otherRes.channelTitle }];
          const { score, reasons, warnings } = getMaxSimilarity(resSources, targetSources);
          
          if (score >= 65) {
            candidates.push({
              targetId: otherRes.id,
              targetYoutubeId: otherRes.id,
              targetTitle: otherRes.title,
              targetUrl: otherRes.url,
              targetViewCount: otherRes.viewCount,
              targetPublishedAt: otherRes.publishedAt,
              targetChannelTitle: otherRes.channelTitle,
              targetDurationSeconds: otherRes.durationSeconds,
              score,
              reasons,
              warnings,
              isAlreadyMerged: computedSongs.some(s => s.youtubeIds.includes(otherRes.id)),
            });
          }
        });

        candidates.sort((a, b) => b.score - a.score);
        return { ...res, similarityCandidates: candidates };
      });

      setResults(processedResults);
    } catch (err: any) {
      showMessage(`検索エラー: ${err.message}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegister = () => {
    // Collect active (non-excluded) results
    const toRegister = results.filter(r => !state.excludedYoutubeIds.includes(r.id));
    if (toRegister.length === 0) return;

    // Check if already in DB
    const newItems = toRegister.filter(r => !state.songs.some(s => s.youtubeIds.includes(r.id)));
    const existingItems = toRegister.filter(r => state.songs.some(s => s.youtubeIds.includes(r.id)));
    
    let updateCount = 0;
    existingItems.forEach(r => {
      const song = state.songs.find(s => s.youtubeIds.includes(r.id));
      if (song) {
        const idx = song.youtubeIds.indexOf(r.id);
        if (idx !== -1) {
          const newUrlViewCounts = song.urlViewCounts ? [...song.urlViewCounts] : song.urls.map(() => 0);
          const newUrlDurationSeconds = song.urlDurationSeconds ? [...song.urlDurationSeconds] : song.urls.map(() => 0);
          const newUrlTitles = song.urlTitles ? [...song.urlTitles] : song.urls.map(() => '');
          const oldIndividualView = newUrlViewCounts[idx] || 0;
          
          newUrlViewCounts[idx] = r.viewCount;
          newUrlDurationSeconds[idx] = r.durationSeconds;
          newUrlTitles[idx] = r.title;
          
          let alarmMsg = song.alarm || '';
          // 個別再生数が前回より減った場合のアラーム
          if (oldIndividualView > 0 && r.viewCount < oldIndividualView) {
            alarmMsg = '個別再生数が減少';
          }
          
          const newTotalViews = newUrlViewCounts.reduce((a, b) => a + b, 0);
          
          updateSong(song.id, { 
            viewCount: newTotalViews, 
            urlViewCounts: newUrlViewCounts,
            urlDurationSeconds: newUrlDurationSeconds,
            urlTitles: newUrlTitles,
            alarm: alarmMsg
          });
          updateCount++;
        }
      }
    });

    if (newItems.length === 0) {
      if (updateCount > 0) {
        showMessage(`${updateCount}件の曲情報を更新しました。`, 'success');
      } else {
        showMessage('登録・更新可能な新しい動画はありません。', 'warning');
      }
      return;
    }

    const singerId = ensureSinger(keyword, searchLocation);
    if (singerId && searchLocation) {
      updateSinger(singerId, { location: searchLocation });
    }

    const mapped = newItems.map(r => ({
      title: r.title,
      youtubeIds: [r.id],
      mainSingerId: r.mainSingerId !== undefined ? r.mainSingerId : (singerId || null),
      subSingerIds: r.subSingerIds || [],
      location: searchLocation,
      genre: searchGenre ? [searchGenre] : [],
      usage: [],
      evaluation1: '',
      urls: [r.url],
      urlTitles: [r.title],
      urlViewCounts: [r.viewCount],
      urlDurationSeconds: [r.durationSeconds],
      releaseDate: r.publishedAt,
      viewCount: r.viewCount,
    }));

    addMergedSongs(mapped);
    showMessage(`${mapped.length}件を新規登録し、${updateCount}件を更新しました。`, 'success');
  };

  const handleExclude = (id: string) => {
    addExcludedYoutubeIds([id]);
  };

  const handleRemoveExclude = (id: string) => {
    removeExcludedYoutubeId(id);
  };

  const openCompare = (candidates: SimilarityResult[], sourceId: string) => {
    const isSourceDbEntry = state.songs.some(s => s.youtubeIds.includes(sourceId));
    setComparingGroup([{
      // Self
      targetId: sourceId,
      targetYoutubeId: sourceId,
      targetTitle: results.find(r => r.id === sourceId)?.title || '',
      targetUrl: results.find(r => r.id === sourceId)?.url || '',
      targetViewCount: results.find(r => r.id === sourceId)?.viewCount || 0,
      targetPublishedAt: results.find(r => r.id === sourceId)?.publishedAt || '',
      targetChannelTitle: results.find(r => r.id === sourceId)?.channelTitle || '',
      targetDurationSeconds: results.find(r => r.id === sourceId)?.durationSeconds || 0,
      score: 100,
      reasons: [],
      warnings: [],
      isAlreadyMerged: isSourceDbEntry,
      isDbEntry: isSourceDbEntry,
      isSelf: true,
    }, ...candidates.map(c => ({
      ...c,
      isSelf: false,
      isAlreadyMerged: c.isAlreadyMerged || state.songs.some(s => s.youtubeIds.includes(c.targetId))
    }))]);
  };

  const handleManualMergePreview = () => {
    const selectedResults = results.filter(r => manualSelectedIds.has(r.id));
    if (selectedResults.length < 2) return;

    const group: SimilarityResult[] = selectedResults.map(r => {
      const isAlreadyMerged = state.songs.some(s => s.youtubeIds.includes(r.id));
      return {
        targetId: r.id,
        targetYoutubeId: r.id,
        targetTitle: r.title,
        targetUrl: r.url,
        targetViewCount: r.viewCount,
        targetPublishedAt: r.publishedAt,
        targetChannelTitle: r.channelTitle,
        targetDurationSeconds: r.durationSeconds,
        score: 100,
        reasons: ['手動選択による統合'],
        warnings: [],
        isAlreadyMerged: isAlreadyMerged,
        isDbEntry: isAlreadyMerged,
        isSelf: false, // 手動選択時は全員同列に扱う
      };
    });

    setComparingGroup(group);
    setSelectedIds(new Set(group.map(g => g.targetId)));
  };

  const [editingMergedSong, setEditingMergedSong] = useState<any>(null);

  
  // Sync local states with global state for export/import compatibility
  useEffect(() => {
    updateUiState({
      youtubeSearchSelectedIds: Array.from(selectedIds),
      youtubeSearchManualSelectedIds: Array.from(manualSelectedIds),
      youtubeSearchComparingGroup: comparingGroup,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, manualSelectedIds, comparingGroup]);

  useEffect(() => {
    if (state.uiState?.youtubeSearchSelectedIds) {
      setSelectedIds(prev => {
        const next = new Set(state.uiState!.youtubeSearchSelectedIds);
        if (prev.size !== next.size || [...prev].some(id => !next.has(id))) return next;
        return prev;
      });
    }
    if (state.uiState?.youtubeSearchManualSelectedIds) {
      setManualSelectedIds(prev => {
        const next = new Set(state.uiState!.youtubeSearchManualSelectedIds);
        if (prev.size !== next.size || [...prev].some(id => !next.has(id))) return next;
        return prev;
      });
    }
    if (state.uiState?.youtubeSearchComparingGroup !== undefined) {
      setComparingGroup(state.uiState.youtubeSearchComparingGroup);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.uiState?.youtubeSearchSelectedIds, state.uiState?.youtubeSearchManualSelectedIds, state.uiState?.youtubeSearchComparingGroup]);

  const currentSinger = state.singers.find(s => s.name === keyword);

  const handleMerge = () => {
    if (!comparingGroup) return;
    const selected = comparingGroup.filter(c => selectedIds.has(c.targetId));
    if (selected.length < 2) return;

    const ids = selected.map(s => s.targetYoutubeId || '').filter(Boolean);
    const urls = selected.map(s => s.targetUrl);
    const urlTitles = selected.map(s => s.targetTitle);

    // Find if any selected item is already in an existing song
    const existingSongs = new Set<any>();
    for (const id of ids) {
      const song = state.songs.find(s => s.youtubeIds.includes(id));
      if (song) existingSongs.add(song);
    }
    const existingSongsArray = Array.from(existingSongs);

    if (existingSongsArray.length > 0) {
      const targetSong = existingSongsArray[0];
      
      const allExistingYoutubeIds = existingSongsArray.flatMap(s => s.youtubeIds);
      const allExistingUrls = existingSongsArray.flatMap(s => s.urls || []);
      const allExistingUrlTitles = existingSongsArray.flatMap(s => 
        (s.urls || []).map((_: any, i: number) => s.urlTitles?.[i] || s.title || '無題')
      );

      const newSelected = selected.filter(s => !allExistingYoutubeIds.includes(s.targetYoutubeId || ''));
      
      const mergedYoutubeIds = [...allExistingYoutubeIds, ...newSelected.map(s => s.targetYoutubeId || '')];
      const mergedUrls = [...allExistingUrls, ...newSelected.map(s => s.targetUrl)];
      const mergedUrlTitles = [...allExistingUrlTitles, ...newSelected.map(s => s.targetTitle)];
      
      const allExistingUrlViewCounts = existingSongsArray.flatMap(s => 
        s.urlViewCounts || s.urls.map(() => 0)
      );
      const mergedUrlViewCounts = [...allExistingUrlViewCounts, ...newSelected.map(s => s.targetViewCount)];
      
      const allExistingUrlDurationSeconds = existingSongsArray.flatMap(s => 
        s.urlDurationSeconds || s.urls.map(() => 0)
      );
      const mergedUrlDurationSeconds = [...allExistingUrlDurationSeconds, ...newSelected.map(s => s.targetDurationSeconds)];
      
      // Calculate added views from new selections + the views of other merged existing songs
      const addedViews = newSelected.reduce((acc, s) => acc + s.targetViewCount, 0) + 
                         existingSongsArray.slice(1).reduce((acc, s) => acc + s.viewCount, 0);

      updateSong(targetSong.id, {
        youtubeIds: mergedYoutubeIds,
        urls: mergedUrls,
        urlTitles: mergedUrlTitles,
        urlViewCounts: mergedUrlViewCounts,
        urlDurationSeconds: mergedUrlDurationSeconds,
        viewCount: targetSong.viewCount + addedViews,
      });

      for (let i = 1; i < existingSongsArray.length; i++) {
        deleteSong(existingSongsArray[i].id);
      }

      setComparingGroup(null);
      setSelectedIds(new Set());
      setManualSelectedIds(new Set());
      setEditingMergedSong(targetSong);
      return;
    }

    const totalViews = selected.reduce((acc, s) => acc + s.targetViewCount, 0);
    const oldestDate = selected.map(s => s.targetPublishedAt).sort()[0];

    const singerId = ensureSinger(keyword, searchLocation);
    if (singerId && searchLocation) {
      updateSinger(singerId, { location: searchLocation });
    }

    const newSongs = addMergedSongs([{
      title: '統合された曲 (名称未設定)',
      youtubeIds: ids,
      mainSingerId: singerId || null,
      subSingerIds: [],
      location: searchLocation,
      genre: searchGenre ? [searchGenre] : [],
      usage: [],
      evaluation1: '',
      urls: urls,
      urlTitles: urlTitles,
      urlViewCounts: selected.map(s => s.targetViewCount),
      urlDurationSeconds: selected.map(s => s.targetDurationSeconds),
      releaseDate: oldestDate,
      viewCount: totalViews,
    }]);

    setComparingGroup(null);
    setSelectedIds(new Set());
    setManualSelectedIds(new Set());
    
    if (newSongs && newSongs.length > 0) {
      setEditingMergedSong(newSongs[0]);
    }
  };


  return {

    keyword, setKeyword,
    singerOptions, locationOptions,
    minViews, setMinViews,
    searchLocation, setSearchLocation,
    searchGenre, setSearchGenre,
    genreOptions,
    isSearching, setIsSearching,
    rawResults, results, setResults,
    updateUnregisteredResult,
    selectedIds, setSelectedIds,
    manualSelectedIds, setManualSelectedIds,
    comparingGroup, setComparingGroup,
    viewingDbSong, setViewingDbSong,
    message, setMessage, showMessage,
    handleSearch, handleRegister, handleExclude, handleRemoveExclude,
    openCompare, handleManualMergePreview,
    editingMergedSong, setEditingMergedSong,
    currentSinger, handleMerge

  };
}
