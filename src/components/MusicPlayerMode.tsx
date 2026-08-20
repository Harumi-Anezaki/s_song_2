import React, { useState, useRef, useEffect } from 'react';
import _ReactPlayer from 'react-player';
const ReactPlayer = (_ReactPlayer as any).default || _ReactPlayer;
import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Music, ChevronDown, Clock, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/StoreContext';

interface MusicPlayerModeProps {
  songs: any[];
  onClose: () => void;
}

export function MusicPlayerMode({ songs, onClose }: MusicPlayerModeProps) {
  const { state, updateUiState } = useStore();
  const _playerState = state.uiState?.musicPlayer || {};
  const [currentIndex, setCurrentIndex] = useState(_playerState.currentIndex ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playedRatio, setPlayedRatio] = useState(0);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(_playerState.isShuffle ?? true);
  const [isRepeat, setIsRepeat] = useState(_playerState.isRepeat ?? false);
  
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);

  const [alarmTime, setAlarmTime] = useState({ h: 0, m: 0 });
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [timeUntilAlarm, setTimeUntilAlarm] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  // Sync state to/from global store for export/import
  useEffect(() => {
    const s = state.uiState?.musicPlayer;
    if (s) {
      if (s.currentIndex !== undefined && s.currentIndex !== currentIndex) setCurrentIndex(s.currentIndex);
      if (s.isShuffle !== undefined && s.isShuffle !== isShuffle) setIsShuffle(s.isShuffle);
      if (s.isRepeat !== undefined && s.isRepeat !== isRepeat) setIsRepeat(s.isRepeat);
    }
  }, [state.uiState?.musicPlayer]);

  useEffect(() => {
    updateUiState({
      musicPlayer: {
        ...(state.uiState?.musicPlayer || {}),
        currentIndex,
        isShuffle,
        isRepeat
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isShuffle, isRepeat]);

  useEffect(() => {
    if (songs.length > 0 && currentIndex >= songs.length) {
      setCurrentIndex(0);
    }
  }, [songs, currentIndex]);

  useEffect(() => {
    if (isShuffle) {
      const indices = Array.from({ length: songs.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setShuffledIndices(indices);
    } else {
      setShuffledIndices([]);
    }
  }, [isShuffle, songs.length]);

  const handleNext = () => {
    if (isShuffle && shuffledIndices.length > 0) {
      const currentShuffleIdx = shuffledIndices.indexOf(currentIndex);
      const nextShuffleIdx = (currentShuffleIdx + 1) % shuffledIndices.length;
      setCurrentIndex(shuffledIndices[nextShuffleIdx]);
    } else {
      setCurrentIndex((prev) => (prev + 1) % songs.length);
    }
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (isShuffle && shuffledIndices.length > 0) {
      const currentShuffleIdx = shuffledIndices.indexOf(currentIndex);
      const prevShuffleIdx = (currentShuffleIdx - 1 + shuffledIndices.length) % shuffledIndices.length;
      setCurrentIndex(shuffledIndices[prevShuffleIdx]);
    } else {
      setCurrentIndex((prev) => (prev - 1 + songs.length) % songs.length);
    }
    setIsPlaying(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isShuffle, shuffledIndices, songs.length]);

  const handleEnded = () => {
    if (isRepeat) {
      playerRef.current?.seekTo(0);
      setIsPlaying(true);
    } else {
      handleNext();
    }
  };

  const [isSeeking, setIsSeeking] = useState(false);

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    if (!isSeeking) {
      setPlayedRatio(state.played);
      setPlayedSeconds(state.playedSeconds);
    }
  };

  const handleSeekMouseDown = () => {
    setIsSeeking(true);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayedRatio(parseFloat(e.target.value));
  };

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    setIsSeeking(false);
    playerRef.current?.seekTo(parseFloat(e.currentTarget.value));
  };

  useEffect(() => {
    if (!isAlarmActive) {
      setTimeUntilAlarm(null);
      return;
    }
    
    const checkAlarm = () => {
      const now = new Date();
      if (now.getHours() === alarmTime.h && now.getMinutes() === alarmTime.m) {
        setIsPlaying(false);
        setIsAlarmActive(false);
        setTimeUntilAlarm(null);
        return;
      }
      
      let target = new Date(now);
      target.setHours(alarmTime.h, alarmTime.m, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      const diff = target.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilAlarm(`あと${h}時間${m}分`);
    };

    checkAlarm();
    const interval = setInterval(checkAlarm, 10000);
    return () => clearInterval(interval);
  }, [isAlarmActive, alarmTime]);

  const currentSong = songs[currentIndex];

  const getBestUrl = (song: any) => {
    if (!song || !song.urls || song.urls.length === 0) return '';
    if (!song.urlViewCounts || song.urlViewCounts.length === 0) return song.urls[0];
    let maxIdx = 0;
    let maxView = -1;
    song.urlViewCounts.forEach((vc: number, idx: number) => {
      if (vc > maxView) {
        maxView = vc;
        maxIdx = idx;
      }
    });
    return song.urls[maxIdx];
  };

  const extractVideoId = (url: string) => {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : null;
  };

  const playingUrl = getBestUrl(currentSong);
  const videoId = extractVideoId(playingUrl);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!songs || songs.length === 0) {
    return (
      <div className="flex-1 bg-[#121212] text-white flex flex-col items-center justify-center p-8">
        <p>再生できる曲がありません。</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700">戻る</button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#121212] text-gray-200 flex flex-col relative overflow-hidden">
      {/* Hidden Player */}
      <div className="hidden">
        <ReactPlayer
          ref={playerRef}
          url={playingUrl}
          playing={isPlaying}
          volume={0.5}
          muted={false}
          onDuration={setDuration}
          onProgress={handleProgress}
          onEnded={handleEnded}
          width="1px"
          height="1px"
          config={{ youtube: { playerVars: { showinfo: 0, controls: 0 } } }}
        />
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 pb-32 sm:pb-32 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="max-w-4xl mx-auto space-y-1">
          {songs.map((song, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div 
                key={song.id} 
                className={cn(
                  "flex items-center justify-between py-3 px-4 mx-2 rounded-md cursor-pointer transition-colors",
                  isActive ? "bg-white/10" : "hover:bg-white/5 active:bg-white/10"
                )}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsPlaying(true);
                }}
              >
                <div className="flex flex-col flex-1 min-w-0 pr-4">
                  <div className={cn("text-base font-medium truncate", isActive ? "text-green-500 font-bold" : "text-white")}>
                    {song.title}
                  </div>
                  <div className="text-sm text-gray-400 truncate">
                    {song._mainSingerName || 'Unknown Artist'}
                  </div>
                </div>
                {/* On PC, we can show a small visualizer or something, but we'll keep it simple */}
                {isActive && (
                   <div className="hidden sm:flex shrink-0 w-4 h-4 items-end gap-[2px]">
                     <div className="w-[3px] bg-green-500 animate-[bounce_1s_infinite] h-full" />
                     <div className="w-[3px] bg-green-500 animate-[bounce_1.2s_infinite] h-2/3" />
                     <div className="w-[3px] bg-green-500 animate-[bounce_0.8s_infinite] h-4/5" />
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE PLAYER (Hidden on sm and up) */}
      <div className="sm:hidden block">
        {/* Mini Player */}
        <div 
          className="absolute bottom-[20px] left-2 right-2 bg-[#282828] rounded-xl p-2 flex items-center justify-between z-40 shadow-2xl cursor-pointer max-w-3xl mx-auto"
          onClick={() => setIsMobilePlayerOpen(true)}
        >
          <div className="flex items-center gap-3 overflow-hidden flex-1 pl-1">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Thumbnail" className="w-10 h-10 object-cover rounded shadow-sm flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-[#181818] rounded flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div className="flex flex-col min-w-0 pr-2">
              <div className="text-white font-bold text-sm truncate">{currentSong?.title || '未選択'}</div>
              <div className="text-xs text-gray-400 truncate">{currentSong?._mainSingerName || 'Unknown Artist'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 pr-2 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 text-white">
              {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-0.5" fill="currentColor" />}
            </button>
          </div>
          
          {/* Progress bar inside mini player */}
          <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#404040] rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear" 
              style={{ width: `${playedRatio * 100}%` }}
            />
          </div>
        </div>

        {/* Full Screen Player Overlay */}
        <div className={cn("fixed inset-0 bg-[#121212] z-[100] flex flex-col transition-transform duration-300", isMobilePlayerOpen ? "translate-y-0" : "translate-y-full")}>
          <div className="flex justify-between items-center p-4">
            <button onClick={() => setIsMobilePlayerOpen(false)} className="text-white p-2">
              <ChevronDown className="w-8 h-8" />
            </button>
            <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
              {currentSong?._mainSingerName || 'Now Playing'}
            </span>
            <div className="w-12" /> {/* Spacer */}
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center px-8 pb-8 max-w-md mx-auto w-full">
            <div className="w-full aspect-square bg-[#282828] rounded-lg shadow-2xl mb-8 flex items-center justify-center overflow-hidden">
              {thumbnailUrl ? (
                 <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
              ) : (
                 <Music className="w-32 h-32 text-gray-500" />
              )}
            </div>
            
            <div className="w-full mb-6 flex flex-col">
              <h2 className="text-white font-bold text-2xl mb-1 truncate">{currentSong?.title}</h2>
              <p className="text-gray-400 text-lg truncate">{currentSong?._mainSingerName || 'Unknown Artist'}</p>
            </div>
            
            <div className="w-full flex flex-col gap-2 mb-8">
              <input 
                type="range" min={0} max={0.999999} step="any"
                value={playedRatio}
                onMouseDown={handleSeekMouseDown}
                onChange={handleSeekChange}
                onMouseUp={handleSeekMouseUp}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full active:[&::-webkit-slider-thumb]:scale-150 transition-transform"
              />
              <div className="flex justify-between text-xs text-gray-400 font-mono">
                <span>{formatTime(playedSeconds)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="w-full flex items-center justify-between mb-8">
              <button onClick={() => setIsShuffle(!isShuffle)} className={cn("transition", isShuffle ? 'text-green-500' : 'text-gray-400')}>
                <Shuffle className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-6">
                <button onClick={handlePrev} className="text-white transition active:scale-95">
                  <SkipBack className="w-10 h-10" fill="currentColor" />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)} 
                  className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center transition active:scale-95 shadow-xl"
                >
                  {isPlaying ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8 ml-1" fill="currentColor" />}
                </button>
                <button onClick={handleNext} className="text-white transition active:scale-95">
                  <SkipForward className="w-10 h-10" fill="currentColor" />
                </button>
              </div>
              <button onClick={() => setIsRepeat(!isRepeat)} className={cn("transition", isRepeat ? 'text-green-500' : 'text-gray-400')}>
                <Repeat className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PC PLAYER (Hidden on mobile) */}
      <div className="hidden sm:flex absolute bottom-0 left-0 right-0 bg-[#181818] border-t border-[#282828] p-4 flex-row items-center justify-between z-50">
        {/* Current Song Info */}
        <div className="w-1/3 flex items-center justify-start gap-4">
          <div className="w-12 h-12 bg-[#282828] rounded flex items-center justify-center flex-shrink-0">
            {thumbnailUrl ? (
               <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover rounded shadow-sm" />
            ) : (
               <Music className="w-6 h-6 text-gray-500" />
            )}
          </div>
          <div className="truncate">
            <div className="text-white font-bold truncate">{currentSong?.title}</div>
            <div className="text-xs text-gray-400 truncate">{currentSong?._mainSingerName || 'Unknown Artist'}</div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="w-full sm:w-1/3 flex flex-col items-center">
          <div className="flex items-center gap-6 mb-2">
            <button 
              onClick={() => setIsShuffle(!isShuffle)} 
              className={`transition ${isShuffle ? 'text-green-500' : 'text-gray-400 hover:text-white'}`}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={handlePrev} className="text-gray-400 hover:text-white transition">
              <SkipBack className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
            >
              {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-1" fill="currentColor" />}
            </button>
            <button onClick={handleNext} className="text-gray-400 hover:text-white transition">
              <SkipForward className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsRepeat(!isRepeat)} 
              className={`transition ${isRepeat ? 'text-green-500' : 'text-gray-400 hover:text-white'}`}
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>
          
          <div className="w-full flex items-center gap-2 text-xs text-gray-400 font-mono">
            <span>{formatTime(playedSeconds)}</span>
            <input 
              type="range" min={0} max={0.999999} step="any"
              value={playedRatio}
              onMouseDown={handleSeekMouseDown}
              onChange={handleSeekChange}
              onMouseUp={handleSeekMouseUp}
              className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* Alarm */}
        <div className="w-full sm:w-1/3 flex items-center justify-center sm:justify-end pr-0 sm:pr-4">
          <div className="flex flex-col items-start gap-1.5">
            <div className="flex items-center justify-between w-full">
               <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold tracking-wider">
                 <Clock className="w-3 h-3" /> ALARM
               </div>
               {timeUntilAlarm && (
                 <div className="text-[10px] text-indigo-300 bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-800/50 font-mono ml-2">
                   {timeUntilAlarm}
                 </div>
               )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="relative group">
                  <select 
                    value={alarmTime.h}
                    onChange={(e) => {
                      setAlarmTime({ ...alarmTime, h: parseInt(e.target.value) });
                      if (!isAlarmActive) setIsAlarmActive(true);
                    }}
                    className="bg-[#090909] text-white font-mono text-sm outline-none cursor-pointer appearance-none text-center w-12 py-1.5 rounded-md border border-[#282828] focus:border-gray-500 transition-colors [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i} className="bg-[#181818]">{i.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
                <span className="text-gray-500 font-mono">:</span>
                <div className="relative group">
                  <select 
                    value={alarmTime.m}
                    onChange={(e) => {
                      setAlarmTime({ ...alarmTime, m: parseInt(e.target.value) });
                      if (!isAlarmActive) setIsAlarmActive(true);
                    }}
                    className="bg-[#090909] text-white font-mono text-sm outline-none cursor-pointer appearance-none text-center w-12 py-1.5 rounded-md border border-[#282828] focus:border-gray-500 transition-colors [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m} className="bg-[#181818]">{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button 
                onClick={() => setIsAlarmActive(!isAlarmActive)}
                className={`p-1.5 rounded-md transition-colors ${isAlarmActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50' : 'bg-[#090909] text-gray-400 border border-[#282828] hover:text-white hover:border-gray-600'}`}
              >
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
