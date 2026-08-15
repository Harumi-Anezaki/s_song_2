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
  const { state, setState, addMergedSongs, addExcludedYoutubeIds, removeExcludedYoutubeId, getComputedSongs, updateSong, deleteSong, updateUiState, ensureSinger, ensureSingers } = useStore();
  const keyword = state.uiState?.searchKeyword || initialKeyword || '';
  const setKeyword = (val: string) => updateUiState({ searchKeyword: val });
  
  const singerOptions = state.singers.map(s => ({ label: s.name, value: s.id }));
  
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
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());
  const [comparingGroup, setComparingGroup] = useState<SimilarityResult[] | null>(null);
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }));
    }

    try {
      const apiResults = await searchYoutube(keyword, minViews, state.youtubeApiKey);
      const computedSongs = getComputedSongs();

      // Calculate similarities and groups
      const processedResults = apiResults.map((res: YoutubeSearchResult) => {
        const candidates: SimilarityResult[] = [];
        
        // Compare with existing DB
        computedSongs.forEach((song) => {
          if (!song.youtubeIds || song.youtubeIds.length === 0) return;
          if (song.youtubeIds.includes(res.id)) return; // Don't match if it's already exactly this video
          
          const { score, reasons, warnings } = calculateSimilarity(
            { title: res.title, duration: res.durationSeconds, channel: res.channelTitle },
            { title: song.title, duration: 240 /* dummy duration since DB might not have it */, channel: '' },
            keyword
          );
          if (score >= 70) {
            candidates.push({
              targetId: song.id,
              targetYoutubeId: song.youtubeIds[0],
              targetTitle: song.title,
              targetUrl: song.urls[0] || '',
              targetViewCount: song.viewCount,
              targetPublishedAt: song.releaseDate,
              targetChannelTitle: 'DB登録済み',
              targetDurationSeconds: 0,
              score,
              reasons,
              warnings,
              isAlreadyMerged: false,
              isDbEntry: true,
            });
          }
        });

        // Compare with other search results
        apiResults.forEach((otherRes: YoutubeSearchResult) => {
          if (res.id === otherRes.id) return;
          // DBに既に登録されているYouTubeIDの場合は、DB登録済みの候補として挙がるため検索結果候補からは除外
          if (computedSongs.some(song => song.youtubeIds?.includes(otherRes.id))) return;
          const { score, reasons, warnings } = calculateSimilarity(
            { title: res.title, duration: res.durationSeconds, channel: res.channelTitle },
            { title: otherRes.title, duration: otherRes.durationSeconds, channel: otherRes.channelTitle },
            keyword
          );
          if (score >= 70) {
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
              isAlreadyMerged: false,
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
          const oldIndividualView = newUrlViewCounts[idx] || 0;
          newUrlViewCounts[idx] = r.viewCount;
          
          let alarmMsg = song.alarm || '';
          // 個別再生数が前回より減った場合のアラーム
          if (oldIndividualView > 0 && r.viewCount < oldIndividualView) {
            alarmMsg = '個別再生数が減少';
          }
          
          const newTotalViews = newUrlViewCounts.reduce((a, b) => a + b, 0);
          
          updateSong(song.id, { 
            viewCount: newTotalViews, 
            urlViewCounts: newUrlViewCounts,
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
      isAlreadyMerged: false,
      isDbEntry: state.songs.some(s => s.youtubeIds.includes(sourceId)),
      isSelf: true,
    }, ...candidates.map(c => ({...c, isSelf: false}))]);
  };

  const handleManualMergePreview = () => {
    const selectedResults = results.filter(r => manualSelectedIds.has(r.id));
    if (selectedResults.length < 2) return;

    const group: SimilarityResult[] = selectedResults.map(r => ({
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
      isAlreadyMerged: false,
      isSelf: false, // 手動選択時は全員同列に扱う
    }));

    setComparingGroup(group);
    setSelectedIds(new Set(group.map(g => g.targetId)));
  };

  const [editingMergedSong, setEditingMergedSong] = useState<any>(null);

  const currentSinger = state.singers.find(s => s.name === keyword);
  const mergedSongs = currentSinger
    ? state.songs.filter(s => s.mainSingerId === currentSinger.id && s.youtubeIds.length > 1)
    : [];

  const handleAddToMerged = (song: any) => {
    const selectedResults = results.filter(r => manualSelectedIds.has(r.id));
    if (selectedResults.length === 0) {
      showMessage('上部のリストから追加したい動画にチェックを入れてください。', 'warning');
      return;
    }
    
    const newItems = selectedResults.filter(r => !song.youtubeIds.includes(r.id));
    const newYoutubeIds = [...song.youtubeIds, ...newItems.map(r => r.id)];
    const newUrls = [...(song.urls || []), ...newItems.map(r => r.url)];
    const existingUrlTitles = (song.urls || []).map((_: any, i: number) => song.urlTitles?.[i] || song.title || '無題');
    const newUrlTitles = [...existingUrlTitles, ...newItems.map(r => r.title)];
    const existingUrlViewCounts = song.urlViewCounts || song.urls.map(() => 0);
    const newUrlViewCounts = [...existingUrlViewCounts, ...newItems.map(r => r.viewCount)];
    const addedViews = newItems.reduce((acc, r) => acc + r.viewCount, 0);

    updateSong(song.id, {
      youtubeIds: newYoutubeIds,
      urls: newUrls,
      urlTitles: newUrlTitles,
      urlViewCounts: newUrlViewCounts,
      viewCount: song.viewCount + addedViews,
    });

    setManualSelectedIds(new Set());
    showMessage(`${newItems.length}件の動画を「${song.title}」に追加統合しました。`);
  };

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
      
      // Calculate added views from new selections + the views of other merged existing songs
      const addedViews = newSelected.reduce((acc, s) => acc + s.targetViewCount, 0) + 
                         existingSongsArray.slice(1).reduce((acc, s) => acc + s.viewCount, 0);

      updateSong(targetSong.id, {
        youtubeIds: mergedYoutubeIds,
        urls: mergedUrls,
        urlTitles: mergedUrlTitles,
        urlViewCounts: mergedUrlViewCounts,
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
              <option value={10000000}>1000万回 (800万回〜)</option>
              <option value={100000000}>1億回 (8000万回〜)</option>
            </select>
          </div>
          <div className="w-full sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">場所</label>
            <select
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-3 sm:py-2 min-h-[44px] bg-slate-50 outline-none text-base sm:text-sm"
            >
              <option value="">未設定</option>
              <option value="日本">日本</option>
              <option value="海外">海外</option>
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

      <section className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
        {results.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const selectable = results.filter(r => !state.excludedYoutubeIds.includes(r.id) && !state.songs.some(s => s.youtubeIds.includes(r.id))).map(r => r.id);
                            setManualSelectedIds(new Set(selectable));
                          } else {
                            setManualSelectedIds(new Set());
                          }
                        }}
                        checked={results.length > 0 && manualSelectedIds.size > 0 && manualSelectedIds.size === results.filter(r => !state.excludedYoutubeIds.includes(r.id) && !state.songs.some(s => s.youtubeIds.includes(r.id))).length}
                      />
                    </th>
                    <th className="px-4 py-3 w-20">操作</th>
                    <th className="px-4 py-3 w-[250px]">タイトル</th>
                    <th className="px-4 py-3 w-16">URL</th>
                    <th className="px-4 py-3 w-32">メイン歌手</th>
                    <th className="px-4 py-3 w-40">サブ歌手</th>
                    <th className="px-4 py-3 w-32">再生数</th>
                    <th className="px-4 py-3 w-28">投稿日</th>
                    <th className="px-4 py-3 w-40">アカウント</th>
                    <th className="px-4 py-3 w-24">時間</th>
                    <th className="px-4 py-3 w-40">類似判定</th>
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

                  let simLabel = '候補なし';
                  let simClass = 'text-slate-400';
                  if (candidates.length > 0) {
                    simLabel = `類似候補${candidates.length}件`;
                    simClass = topCandidate.score >= 85 ? 'text-amber-600 font-bold' : 'text-amber-500 font-medium';
                    if (topCandidate.warnings.length > 0) {
                      simLabel += ' (要確認)';
                    }
                  }
                  
                  const hasCandidates = candidates.length > 0;

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
                      <td className="px-4 py-3 whitespace-nowrap flex items-center gap-2">
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
                      </td>
                      <td className={cn("px-4 py-3 whitespace-normal break-all w-[250px] min-w-[250px] max-w-[250px]", isMerged ? "font-medium text-purple-800" : isRegistered ? "font-medium text-blue-700" : "font-medium text-slate-700")}>
                        <span className={cn(isExcluded && 'line-through')}>{res.title}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a href={res.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                          開く
                        </a>
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
                      <td className={cn("px-4 py-3 whitespace-nowrap text-right font-mono", isExcluded && 'opacity-50')}>
                        {res.viewCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {res.publishedAt}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap max-w-[150px] truncate text-slate-500" title={res.channelTitle}>
                        {res.channelTitle}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {res.durationString}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {hasCandidates ? (
                          <button
                            onClick={() => openCompare(candidates, res.id)}
                            className="flex flex-col text-left hover:underline cursor-pointer"
                          >
                            <span className={simClass}>{topCandidate.score}% {simLabel}</span>
                            {topCandidate.warnings.length > 0 && <span className="text-[9px] text-amber-500 mt-0.5">⚠️ {topCandidate.warnings[0]}</span>}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">候補なし</span>
                        )}
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

        {mergedSongs.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col shrink-0">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">統合済の曲 (DB登録済)</h3>
              <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">{mergedSongs.length}件</span>
            </div>
            <div className="overflow-auto max-h-48">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-bold w-48">曲名</th>
                    <th className="px-4 py-2 font-bold">統合数</th>
                    <th className="px-4 py-2 font-bold">総再生数</th>
                    <th className="px-4 py-2 font-bold w-32">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mergedSongs.map(song => (
                    <tr key={song.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-2 font-medium text-slate-800">{song.title}</td>
                      <td className="px-4 py-2 text-slate-600">{song.youtubeIds.length}動画</td>
                      <td className="px-4 py-2 font-mono text-slate-600">{song.viewCount.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleAddToMerged(song)}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded text-[10px] font-bold transition-colors opacity-0 group-hover:opacity-100"
                        >
                          選択中の動画を追加統合
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                    return (
                      <tr key={c.targetId} className={cn('hover:bg-gray-50', c.isAlreadyMerged && 'bg-blue-50/30')}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={c.isAlreadyMerged}
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
                          <a href={c.targetUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline block truncate mb-1">
                            {c.targetTitle}
                          </a>
                          <div className="text-xs text-gray-500 truncate">{c.targetChannelTitle}</div>
                        </td>
                        <td className="p-3 font-mono text-right">{c.targetViewCount.toLocaleString()}</td>
                        <td className="p-3 text-right">{Math.floor(c.targetDurationSeconds/60)}分{c.targetDurationSeconds%60}秒</td>
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
                          {c.isAlreadyMerged && !c.isSelf && <div className="text-xs text-blue-600 font-bold mt-1">DB登録済のため選択不可</div>}
                          {c.isDbEntry && !c.isAlreadyMerged && !c.isSelf && <div className="text-xs text-blue-600 font-bold mt-1">DB登録済みの曲 (統合可能)</div>}
                        </td>
                      </tr>
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
    </div>
  );
}
