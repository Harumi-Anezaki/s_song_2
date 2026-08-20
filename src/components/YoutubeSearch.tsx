import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { searchYoutube } from '../lib/youtube';
import { calculateSimilarity } from '../lib/similarity';
import { YoutubeSearchResult, SimilarityResult } from '../types';
import { generateId } from '../lib/utils';
import { Search, Loader2, AlertTriangle, Info, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { NotionSelect } from './ui/NotionSelect';

export default function YoutubeSearch({ initialKeyword }: { initialKeyword: string }) {
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
    const existingSinger = state.singers.find((s) => s.name === keyword);
    const nowIso = new Date().toISOString();
    if (!existingSinger) {
      setState((s) => ({
        ...s,
        singers: [
          ...s.singers,
          {
            id: generateId(),
            name: keyword,
            preference: null,
            singability: null,
            createdAt: nowIso,
            updatedAt: nowIso,
            lastSearchedAt: nowIso,
          },
        ],
      }));
    } else {
      updateSinger(existingSinger.id, { lastSearchedAt: nowIso });
    }

    try {
      const apiResults = await searchYoutube(keyword, minViews, state.youtubeApiKey);
      const computedSongs = getComputedSongs();

      const getSourcesForSong = (song: any) => {
        const sources = [];
        
        // Use individual mapped videos for similarity comparison
        if (song.urlTitles && song.urlDurationSeconds && song.youtubeIds.length > 0) {
          song.youtubeIds.forEach((yid: string, i: number) => {
             sources.push({ 
               title: song.urlTitles[i] || song.title, 
               duration: song.urlDurationSeconds[i] || 0, 
               channel: '' 
             });
          });
        } else {
          // Fallback if no underlying videos are found (should not happen for valid DB entries)
          sources.push({ title: song.title, duration: 0, channel: '' });
        }
        return sources;
      };

      const getSourcesForRes = (res: YoutubeSearchResult) => {
        const song = computedSongs.find(s => s.youtubeIds.includes(res.id));
        if (song) return getSourcesForSong(song);
        return [{ title: res.title, duration: res.durationSeconds, channel: res.channelTitle }];
      };

      const getMaxSimilarity = (sourcesA: any[], sourcesB: any[]) => {
        let maxScore = -1;
        let bestResult = { score: 0, reasons: [] as string[], warnings: [] as string[] };
        for (const a of sourcesA) {
          for (const b of sourcesB) {
             const res = calculateSimilarity(a, b, keyword);
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

    const singer = state.singers.find(s => s.name === keyword);

    const mapped = newItems.map(r => ({
      title: r.title,
      youtubeIds: [r.id],
      mainSingerId: r.mainSingerId !== undefined ? r.mainSingerId : (singer ? singer.id : null),
      subSingerIds: r.subSingerIds || [],
      location: searchLocation,
      genre: [],
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

    const newSongs = addMergedSongs([{
      title: '統合された曲 (名称未設定)',
      youtubeIds: ids,
      mainSingerId: state.singers.find(s => s.name === keyword)?.id || null,
      subSingerIds: [],
      location: searchLocation,
      genre: [],
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

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {message && (
        <div className={cn(
          "absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg text-sm font-bold text-white transition-opacity",
          message.type === 'error' ? 'bg-red-600' : message.type === 'warning' ? 'bg-amber-600' : 'bg-green-600'
        )}>
          {message.text}
        </div>
      )}
      <header className="bg-white border-b border-slate-200 px-6 py-4 z-10 sticky top-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-slate-800">YouTube検索</h1>
          <div className="flex space-x-2">
            <button
              onClick={handleManualMergePreview}
              disabled={manualSelectedIds.size < 2}
              className="bg-amber-100 hover:bg-amber-200 text-amber-700 disabled:opacity-50 px-4 py-3 sm:py-1.5 rounded-md text-base sm:text-xs font-bold transition-all shadow-sm"
            >
              手動統合 ({manualSelectedIds.size})
            </button>
            <button
              onClick={handleRegister}
              disabled={results.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 sm:py-1.5 rounded-md text-base sm:text-xs font-bold transition-all shadow-sm"
            >
              登録・更新実行
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-end">
          <div className="w-full sm:col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">検索キーワード (歌手名)</label>
            <input
              type="text"
              placeholder="歌手名を入力..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-3 sm:py-2 min-h-[44px] bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-base sm:text-sm"
            />
          </div>
          <div className="w-full sm:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">最低再生回数制限</label>
            <select
              value={minViews}
              onChange={(e) => setMinViews(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-3 py-3 sm:py-2 min-h-[44px] bg-slate-50 outline-none text-base sm:text-sm"
            >
              <option value={0}>制限なし</option>
              <option value={1000000}>100万回 (80万回〜)</option>
              <option value={10000000}>1000万回 (800万回〜)</option>
              <option value={100000000}>1億回 (8000万回〜)</option>
            </select>
          </div>
          <div className="w-full sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">言語</label>
            <select
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-3 sm:py-2 min-h-[44px] bg-slate-50 outline-none text-base sm:text-sm"
            >
              <option value="">未設定</option>
              {locationOptions.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:col-span-3">
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="w-full flex justify-center bg-slate-800 text-white font-bold py-3 sm:py-2 rounded shadow hover:bg-slate-900 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '検索開始'}
            </button>
          </div>
        </div>
      </header>

      <section className="flex-1 overflow-hidden flex flex-col">
        {results.length > 0 ? (
          <div className="bg-white flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-4 py-3 whitespace-nowrap w-px">選択</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px text-center">🗑️</th>
                    <th className="px-4 py-3 w-full">タイトル</th>
                    <th className="px-4 py-3 w-16">URL</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px">類似</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px">メイン歌手</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px">サブ歌手</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px">再生数</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px">投稿日</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px">アカウント</th>
                    <th className="px-4 py-3 whitespace-nowrap w-px">時間</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {results.map((res) => {
                  const isExcluded = state.excludedYoutubeIds.includes(res.id);
                  const registeredSong = state.songs.find(s => s.youtubeIds.includes(res.id));
                  const isRegistered = !!registeredSong;
                  const isMerged = isRegistered && registeredSong.youtubeIds.length > 1;
                  const candidates = res.similarityCandidates || [];
                  const topCandidate = candidates[0];
                  let simClass = 'text-slate-400';
                  let simLabel = '-';
                  let simActionable = false;
                  
                  const hasActionableUnregisteredCandidates = candidates.some(c => {
                    if (c.isDbEntry) return false;
                    const dynamicallyAlreadyMerged = c.isAlreadyMerged || state.songs.some(s => s.youtubeIds.includes(c.targetId));
                    return !dynamicallyAlreadyMerged;
                  });
                  
                  const hasAnyActionableCandidates = candidates.some(c => {
                    const dynamicallyAlreadyMerged = c.isAlreadyMerged || state.songs.some(s => s.youtubeIds.includes(c.targetId));
                    return c.isDbEntry || !dynamicallyAlreadyMerged;
                  });

                  if (isRegistered) {
                    if (hasActionableUnregisteredCandidates) {
                      simLabel = '類似';
                      simActionable = true;
                      simClass = topCandidate?.score >= 85 ? 'text-amber-600 font-bold' : 'text-amber-500 font-medium';
                    } else if (isMerged) {
                      simLabel = '済';
                      simActionable = false;
                      simClass = 'text-slate-400 font-bold';
                    } else {
                      simLabel = '-';
                      simActionable = false;
                      simClass = 'text-slate-300';
                    }
                  } else {
                    if (hasAnyActionableCandidates) {
                      simLabel = '類似';
                      simActionable = true;
                      simClass = topCandidate?.score >= 85 ? 'text-amber-600 font-bold' : 'text-amber-500 font-medium';
                    } else {
                      simLabel = '-';
                      simActionable = false;
                      simClass = 'text-slate-300';
                    }
                  }
                  
                  const hasCandidates = hasAnyActionableCandidates;

                  return (
                    <tr key={res.id} className={cn(
                      'transition-colors group',
                      isExcluded ? 'bg-slate-100 text-slate-400' :
                      isMerged ? 'bg-purple-50' :
                      isRegistered ? 'bg-cyan-50/50' : 
                      hasCandidates ? 'bg-amber-50/30' : 'hover:bg-slate-50',
                    )}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="rounded text-blue-600 cursor-pointer"
                          checked={manualSelectedIds.has(res.id)}
                          disabled={isExcluded}
                          onChange={(e) => {
                            const newSet = new Set(manualSelectedIds);
                            if (e.target.checked) newSet.add(res.id);
                            else newSet.delete(res.id);
                            setManualSelectedIds(newSet);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-middle">
                        <div className="flex items-center justify-center gap-2">
                        {!isExcluded && !isRegistered && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleExclude(res.id)}
                              className="text-xs border border-slate-300 rounded px-3 sm:px-2 py-3 sm:py-1 min-h-[36px] sm:min-h-0 hover:bg-slate-200 text-slate-700"
                            >
                              除外
                            </button>
                          </div>
                        )}
                        {isMerged ? (
                          <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded text-[10px] font-bold">統合済</span>
                        ) : isRegistered ? (
                          <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px]">登録済</span>
                        ) : null}
                        {isExcluded && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400">除外済</span>
                            <button
                              onClick={() => handleRemoveExclude(res.id)}
                              className="text-[10px] text-blue-600 hover:underline hover:text-blue-800"
                            >
                              解除
                            </button>
                          </div>
                        )}
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 whitespace-normal break-all w-[250px] min-w-[250px] max-w-[250px]", isMerged ? "font-medium text-purple-800" : isRegistered ? "font-medium text-blue-700" : "font-medium text-slate-700")}>
                        <span className={cn(isExcluded && 'line-through')}>{res.title}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a href={res.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                          開く
                        </a>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {simActionable ? (
                          <button
                            onClick={() => openCompare(candidates, res.id)}
                            className={cn("hover:underline cursor-pointer", simClass)}
                          >
                            {simLabel}
                          </button>
                        ) : simLabel === '済' && registeredSong ? (
                          <button
                            onClick={() => setViewingDbSong(registeredSong)}
                            className={cn("hover:underline cursor-pointer", simClass)}
                          >
                            {simLabel}
                          </button>
                        ) : (
                          <span className={simClass}>{simLabel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[150px]">
                        {isRegistered && registeredSong ? (
                          <NotionSelect 
                            value={registeredSong.mainSingerId || ''} 
                            options={singerOptions} 
                            onChange={(val: any) => {
                              const newId = ensureSinger(val);
                              updateSong(registeredSong.id, { mainSingerId: newId || null });
                            }}
                            allowCreate
                            placeholder="未設定" 
                          />
                        ) : (
                          <NotionSelect 
                            value={res.mainSingerId !== undefined ? (res.mainSingerId || '') : (currentSinger?.id || '')} 
                            options={singerOptions} 
                            onChange={(val: any) => {
                              const newId = ensureSinger(val);
                              updateUnregisteredResult(res.id, { mainSingerId: newId || null });
                            }}
                            allowCreate
                            placeholder="未設定" 
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        {isRegistered && registeredSong ? (
                          <NotionSelect 
                            value={registeredSong.subSingerIds || []} 
                            options={singerOptions} 
                            onChange={(val: any) => {
                              const newIds = ensureSingers(Array.isArray(val) ? val : [val]);
                              updateSong(registeredSong.id, { subSingerIds: newIds });
                            }} 
                            allowCreate
                            multiple 
                            placeholder="未設定" 
                          />
                        ) : (
                          <NotionSelect 
                            value={res.subSingerIds || []} 
                            options={singerOptions} 
                            onChange={(val: any) => {
                              const newIds = ensureSingers(Array.isArray(val) ? val : [val]);
                              updateUnregisteredResult(res.id, { subSingerIds: newIds });
                            }} 
                            allowCreate
                            multiple 
                            placeholder="未設定" 
                          />
                        )}
                      </td>
                      <td className={cn("px-4 py-3 whitespace-nowrap w-px text-right font-mono", isExcluded && 'opacity-50')}>
                        {res.viewCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap w-px text-slate-500">
                        {res.publishedAt}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap w-px max-w-[150px] truncate text-slate-500" title={res.channelTitle}>
                        {res.channelTitle}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap w-px text-right">
                        {res.durationString}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            {/* Status Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
              <div className="flex space-x-4">
                <span>Total: {results.length}</span>
                <span className="text-blue-600">Registered: {results.filter(r => state.songs.some(s => s.youtubeIds.includes(r.id))).length}</span>
              </div>
              <div className="flex items-center space-x-2">
                 <div className="w-2 h-2 rounded-full bg-green-500"></div>
                 <span>Similarity Engine Active</span>
              </div>
            </div>
          </div>
        ) : (
          !isSearching && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <Search className="w-12 h-12 text-gray-300" />
              <p>検索キーワードを入力して動画を取得してください</p>
            </div>
          )
        )}
      </section>

      {comparingGroup && (
        <div className="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-5xl flex flex-col max-h-full overflow-hidden text-sm text-slate-900">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">類似候補の比較・統合</h3>
              <button onClick={() => { setComparingGroup(null); setSelectedIds(new Set()); }} className="text-gray-500 hover:text-gray-700 font-bold">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3">対象</th>
                    <th className="p-3">タイトル</th>
                    <th className="p-3">再生数</th>
                    <th className="p-3">時間</th>
                    <th className="p-3">類似度</th>
                    <th className="p-3">判定理由 / 警告</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comparingGroup.map(c => {
                    const isSelected = selectedIds.has(c.targetId);
                    const dbSong = c.isDbEntry 
                      ? state.songs.find(s => s.id === c.targetId || s.youtubeIds.includes(c.targetId)) 
                      : null;
                    const mergedCount = dbSong ? dbSong.youtubeIds.length : 0;
                    
                    let dbSongAvgDuration = 0;
                    if (dbSong && dbSong.urlDurationSeconds && dbSong.urlDurationSeconds.length > 0) {
                      const sum = dbSong.urlDurationSeconds.reduce((a, b) => a + b, 0);
                      dbSongAvgDuration = Math.round(sum / dbSong.urlDurationSeconds.length);
                    }
                    
                    return (
                      <React.Fragment key={c.targetId}>
                        <tr className={cn(
                          'hover:bg-gray-50', 
                          c.isDbEntry && mergedCount > 1 ? 'bg-purple-50/20' : (c.isAlreadyMerged && !c.isSelf ? 'bg-blue-50/30' : '')
                        )}>
                          <td 
                            className={cn(
                              "p-3 align-middle",
                              c.isDbEntry && mergedCount > 1 && "border-l-4 border-l-purple-500"
                            )}
                            rowSpan={c.isDbEntry && mergedCount > 1 && dbSong ? 2 : 1}
                          >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={c.isAlreadyMerged && !c.isDbEntry && !c.isSelf}
                            onChange={(e) => {
                              const newSet = new Set(selectedIds);
                              if (e.target.checked) newSet.add(c.targetId);
                              else newSet.delete(c.targetId);
                              setSelectedIds(newSet);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 max-w-[200px]">
                          {c.isDbEntry && dbSong ? (
                            <>
                              <span className="text-blue-600 font-bold block break-words mb-1">
                                {dbSong.title}
                              </span>
                              <div className="text-xs text-gray-500 break-words">DB登録済み</div>
                            </>
                          ) : (
                            <>
                              <a href={c.targetUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline block break-words mb-1">
                                {c.targetTitle}
                              </a>
                              <div className="text-xs text-gray-500 break-words">{c.targetChannelTitle}</div>
                            </>
                          )}
                        </td>
                        <td className="p-3 font-mono text-right">
                          {c.isDbEntry && dbSong ? dbSong.viewCount.toLocaleString() : c.targetViewCount.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          {c.isDbEntry && dbSong ? `${Math.floor(dbSongAvgDuration/60)}分${dbSongAvgDuration%60}秒` : `${Math.floor(c.targetDurationSeconds/60)}分${c.targetDurationSeconds%60}秒`}
                        </td>
                        <td className="p-3 font-bold text-center">
                          {c.score === 100 ? '-' : `${c.score}%`}
                        </td>
                        <td className="p-3">
                          <div className="text-xs text-green-700 flex flex-col gap-1">
                            {c.reasons.map((r, i) => <span key={i}>✓ {r}</span>)}
                          </div>
                          <div className="text-xs text-red-600 flex flex-col gap-1 mt-1 font-medium">
                            {c.warnings.map((w, i) => <span key={i}>⚠️ {w}</span>)}
                          </div>
                          {c.isSelf && <div className="text-xs text-slate-500 font-bold mt-1">比較の基準 (選択した動画)</div>}
                          {c.isAlreadyMerged && !c.isSelf && !c.isDbEntry && <div className="text-xs text-blue-600 font-bold mt-1">DB登録済のため選択不可</div>}
                          {c.isDbEntry && !c.isSelf && <div className="text-xs text-blue-600 font-bold mt-1">DB登録済みの曲 (統合可能)</div>}
                        </td>
                      </tr>
                      {mergedCount > 1 && dbSong && (
                        <tr className="bg-purple-50/10">
                          <td colSpan={5} className="p-0 border-t border-purple-100">
                            <div className="py-2 pr-4 space-y-1 pl-4">
                              <div className="text-[10px] font-bold text-purple-600 mb-2">含まれる動画リスト:</div>
                              {dbSong.urlTitles?.map((title, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-700 bg-white/60 px-3 py-1.5 rounded-sm border border-purple-50/50 hover:bg-white transition-colors">
                                  <span className="flex-1 min-w-0 mr-4 font-medium break-words" title={title}>{title}</span>
                                  <div className="flex items-center gap-6 text-gray-500 mt-1 sm:mt-0 shrink-0">
                                    <span className="font-mono">{dbSong.urlViewCounts?.[idx]?.toLocaleString() || 0}回</span>
                                    <span>
                                      {Math.floor((dbSong.urlDurationSeconds?.[idx] || 0) / 60)}分{(dbSong.urlDurationSeconds?.[idx] || 0) % 60}秒
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-4">
              <button
                onClick={() => { setComparingGroup(null); setSelectedIds(new Set()); }}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleMerge}
                disabled={selectedIds.size < 2}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                選択した動画を統合して登録 ({selectedIds.size}件)
              </button>
            </div>
          </div>
        </div>
      )}
      {editingMergedSong && (
        <div className="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[400px] text-sm">
            <h3 className="font-bold text-lg mb-2">曲名の設定</h3>
            <p className="text-slate-600 mb-4 text-xs">統合された曲がDBに登録されました。正しい曲名を入力してください。</p>
            <input
              type="text"
              className="w-full border border-slate-300 rounded px-3 py-2 mb-4 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
              value={editingMergedSong.title}
              onChange={e => setEditingMergedSong({...editingMergedSong, title: e.target.value})}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-bold transition-colors shadow-sm"
                onClick={() => {
                  updateSong(editingMergedSong.id, { title: editingMergedSong.title });
                  setEditingMergedSong(null);
                  showMessage('曲名を更新しました。');
                }}
              >
                保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      {viewingDbSong && (
        <div className="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-full overflow-hidden text-sm text-slate-900">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewingDbSong.title}</h3>
                <div className="text-xs text-gray-500 mt-1">DB登録済 / 統合動画数: {viewingDbSong.youtubeIds?.length || 1}</div>
              </div>
              <button onClick={() => setViewingDbSong(null)} className="text-gray-500 hover:text-gray-700 font-bold p-2 cursor-pointer">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-auto flex-1 bg-gray-50/50">
               <div className="space-y-2">
                 {viewingDbSong.urlTitles?.map((title: string, idx: number) => (
                   <div key={idx} className="bg-white px-4 py-3 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <div className="flex-1 min-w-0">
                       <a href={viewingDbSong.urls?.[idx]} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium block break-words">
                         {title}
                       </a>
                     </div>
                     <div className="flex items-center gap-6 text-gray-500 shrink-0">
                       <div className="flex flex-col items-end">
                         <span className="text-[10px] uppercase font-bold text-gray-400">再生数</span>
                         <span className="font-mono font-medium text-gray-700">{viewingDbSong.urlViewCounts?.[idx]?.toLocaleString() || 0}回</span>
                       </div>
                       <div className="flex flex-col items-end">
                         <span className="text-[10px] uppercase font-bold text-gray-400">時間</span>
                         <span className="font-medium text-gray-700">
                           {Math.floor((viewingDbSong.urlDurationSeconds?.[idx] || 0) / 60)}分{(viewingDbSong.urlDurationSeconds?.[idx] || 0) % 60}秒
                         </span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-white flex justify-end">
              <button
                onClick={() => setViewingDbSong(null)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
