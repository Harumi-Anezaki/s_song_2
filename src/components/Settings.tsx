import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { Download, Upload, Save, Key, User as UserIcon, RefreshCw, LogOut, LogIn, Trash2, AlertTriangle } from 'lucide-react';
import { signInWithGoogle, logout } from '../lib/firebase';

export default function Settings() {
  const { state, setState, updateSettings, exportData, importData, user, syncStatus } = useStore();
  const [apiKey, setApiKey] = useState(state.youtubeApiKey || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [resetConfirm, setResetConfirm] = useState<'all' | 'songs' | 'singers' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(state.youtubeApiKey || '');
  }, [state.youtubeApiKey]);

  const handleSave = () => {
    updateSettings('youtubeApiKey', apiKey);
    setSaveMessage('設定を保存しました。');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `music-db-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importData(content);
        setSaveMessage('インポートが完了しました。');
        setTimeout(() => setSaveMessage(''), 3000);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleReset = (type: 'all' | 'songs' | 'singers') => {
    if (resetConfirm !== type) {
      setResetConfirm(type);
      setTimeout(() => setResetConfirm(null), 3000);
      return;
    }
    
    setState(s => {
      const updates: any = {};
      if (type === 'all' || type === 'songs') updates.songs = [];
      if (type === 'all' || type === 'singers') updates.singers = [];
      return { ...s, ...updates };
    });
    setResetConfirm(null);
    setSaveMessage('データをリセットしました。');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <header className="bg-white border-b border-slate-200 px-6 py-4 z-10 sticky top-0">
        <h1 className="text-lg font-bold text-slate-800">設定</h1>
      </header>

      <section className="flex-1 p-4 sm:p-8 overflow-auto">
        <div className="max-w-2xl space-y-8">

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <UserIcon className="w-5 h-5 text-slate-500" />
          クラウド同期 (Googleアカウント連携)
        </h3>
        <p className="text-xs text-slate-600 mb-6">
          Googleアカウントでログインすると、アプリの状態（データベース、ビュー設定など）がクラウドに保存され、他の端末でも同期されるようになります。
        </p>
        
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-md border border-slate-200">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-800">{user.displayName || 'ユーザー'}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-xs font-medium">
                  {syncStatus === 'syncing' && <><RefreshCw className="w-3 h-3 text-blue-500 animate-spin" /><span className="text-blue-500">同期中...</span></>}
                  {syncStatus === 'success' && <><Save className="w-3 h-3 text-green-500" /><span className="text-green-500">同期完了</span></>}
                  {syncStatus === 'error' && <span className="text-red-500">同期エラー</span>}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 sm:py-1.5 rounded-md text-base sm:text-xs font-medium border border-slate-300 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 sm:py-2 rounded-md text-base sm:text-sm font-bold transition-all shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <LogIn className="w-5 h-5" />
            Googleでログインして同期を有効にする
          </button>
        )}
      </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Key className="w-5 h-5 text-slate-500" />
              YouTube API 連携
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  YouTube Data API v3 Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-3 sm:py-2 min-h-[44px] bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-base sm:text-sm"
              placeholder="AIzaSy..."
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 sm:py-1.5 rounded-md text-base sm:text-xs font-bold transition-all shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
            {saveMessage && <span className="text-xs text-green-600 font-bold">{saveMessage}</span>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <HardDriveIcon className="w-5 h-5 text-slate-500" />
          データ管理
        </h3>
        <p className="text-xs text-slate-600 mb-6">
          DBデータやリンクドDBのビュー設定を含むすべての情報をJSON形式でエクスポート・インポートできます。
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
          <button
            onClick={handleExport}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 sm:py-1.5 rounded-md text-base sm:text-xs font-medium border border-slate-300 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Download className="w-4 h-4" />
            エクスポート
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 sm:py-1.5 rounded-md text-base sm:text-xs font-medium border border-slate-300 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Upload className="w-4 h-4" />
            インポート
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      <div className="bg-white border border-red-200 rounded-lg p-6 shadow-sm relative overflow-hidden mt-8">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
        <h3 className="text-sm font-bold text-red-600 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <Trash2 className="w-5 h-5" />
          データリセット
        </h3>
        <p className="text-xs text-slate-600 mb-6">
          登録された曲や歌手のデータを削除します。この操作は元に戻せません。
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
          <button
            onClick={() => handleReset('all')}
            className={`px-4 py-3 sm:py-2 rounded-md text-base sm:text-xs font-bold transition-all flex items-center gap-2 w-full sm:w-auto justify-center ${resetConfirm === 'all' ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm' : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'}`}
          >
            <AlertTriangle className="w-4 h-4" />
            {resetConfirm === 'all' ? '本当に全て削除しますか？' : '全て'}
          </button>
          
          <button
            onClick={() => handleReset('songs')}
            className={`px-4 py-3 sm:py-2 rounded-md text-base sm:text-xs font-medium transition-all flex items-center gap-2 w-full sm:w-auto justify-center ${resetConfirm === 'songs' ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'}`}
          >
            {resetConfirm === 'songs' ? '確認: 曲のみ削除' : '曲のみリセット'}
          </button>

          <button
            onClick={() => handleReset('singers')}
            className={`px-4 py-3 sm:py-2 rounded-md text-base sm:text-xs font-medium transition-all flex items-center gap-2 w-full sm:w-auto justify-center ${resetConfirm === 'singers' ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'}`}
          >
            {resetConfirm === 'singers' ? '確認: 歌手のみ削除' : '歌手のみリセット'}
          </button>
        </div>
      </div>

        </div>
      </section>
    </div>
  );
}

function HardDriveIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" x2="2" y1="12" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" x2="6.01" y1="16" y2="16" />
      <line x1="10" x2="10.01" y1="16" y2="16" />
    </svg>
  );
}
