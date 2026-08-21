import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/StoreContext';

export function useMusicPlayer(songs: any[]) {
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

  const handleNext = useCallback(() => {
    if (isShuffle && shuffledIndices.length > 0) {
      const currentShuffleIdx = shuffledIndices.indexOf(currentIndex);
      const nextShuffleIdx = (currentShuffleIdx + 1) % shuffledIndices.length;
      setCurrentIndex(shuffledIndices[nextShuffleIdx]);
    } else {
      setCurrentIndex((prev) => (prev + 1) % songs.length);
    }
    setIsPlaying(true);
  }, [isShuffle, shuffledIndices, currentIndex, songs.length]);

  const handlePrev = useCallback(() => {
    if (isShuffle && shuffledIndices.length > 0) {
      const currentShuffleIdx = shuffledIndices.indexOf(currentIndex);
      const prevShuffleIdx = (currentShuffleIdx - 1 + shuffledIndices.length) % shuffledIndices.length;
      setCurrentIndex(shuffledIndices[prevShuffleIdx]);
    } else {
      setCurrentIndex((prev) => (prev - 1 + songs.length) % songs.length);
    }
    setIsPlaying(true);
  }, [isShuffle, shuffledIndices, currentIndex, songs.length]);

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
  }, [handlePrev, handleNext]);

  const handleEnded = () => {
    if (isRepeat) {
      playerRef.current?.seekTo(0);
      setIsPlaying(true);
    } else {
      handleNext();
    }
  };

  const [isSeeking, setIsSeeking] = useState(false);

  const handleProgress = (progressState: { played: number; playedSeconds: number }) => {
    if (!isSeeking) {
      setPlayedRatio(progressState.played);
      setPlayedSeconds(progressState.playedSeconds);
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

  const currentSong = songs[currentIndex] || null;

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

  return {
    currentIndex, setCurrentIndex,
    isPlaying, setIsPlaying,
    playedRatio, setPlayedRatio,
    playedSeconds, setPlayedSeconds,
    duration, setDuration,
    isShuffle, setIsShuffle,
    isRepeat, setIsRepeat,
    isMobilePlayerOpen, setIsMobilePlayerOpen,
    alarmTime, setAlarmTime,
    isAlarmActive, setIsAlarmActive,
    timeUntilAlarm, setTimeUntilAlarm,
    playerRef,
    handleNext, handlePrev, handleEnded,
    isSeeking, setIsSeeking,
    handleProgress, handleSeekMouseDown, handleSeekChange, handleSeekMouseUp,
    currentSong, playingUrl, thumbnailUrl, formatTime
  };
}
