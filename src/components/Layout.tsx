import React, { useState } from 'react';
import { Search, Database, HardDrive, Settings as SettingsIcon, ChevronLeft, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import YoutubeSearch from '../features/youtube-search';
import LinkedDb from '../features/linked-db';
import OriginalDb from '../features/original-db';
import Settings from './Settings';
import { useStore } from '../store/StoreContext';

type Tab = 'youtube' | 'linked' | 'original' | 'settings';

export default function Layout() {
  const { state, updateUiState } = useStore();
  const activeTab = (state.uiState?.activeTab || 'youtube') as Tab;
  const isSidebarOpen = state.uiState?.isSidebarOpen ?? true;
  const searchKeyword = state.uiState?.searchKeyword || '';
  const setSearchKeyword = (keyword: string) => updateUiState({ searchKeyword: keyword });

  const setActiveTab = (tab: Tab) => updateUiState({ activeTab: tab });
  const setIsSidebarOpen = (isOpen: boolean) => updateUiState({ isSidebarOpen: isOpen });

  const navItems = [
    { id: 'youtube', label: 'YouTube検索', icon: Search },
    { id: 'linked', label: 'リンクドDB', icon: Database },
    { id: 'original', label: 'DB原本', icon: HardDrive },
    { id: 'settings', label: '設定', icon: SettingsIcon },
  ] as const;

  const navigateToSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setActiveTab('youtube');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden text-sm text-slate-900 bg-slate-50 font-sans relative">
      <aside 
        className={cn(
          "bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 z-50 transition-all duration-300 ease-in-out fixed md:relative h-full",
          isSidebarOpen ? "w-56 translate-x-0" : "w-56 -translate-x-full md:w-0 md:translate-x-0 md:border-r-0 overflow-hidden"
        )}
      >
        <div className="p-4 flex items-center justify-between mt-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">DB</div>
            <span className={cn("text-white font-semibold tracking-tight text-base whitespace-nowrap transition-opacity", !isSidebarOpen && "md:opacity-0")}>MusicDB v2</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors hidden md:block"
            title="サイドバーを閉じる"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 sm:py-2 min-h-[44px] sm:min-h-0 rounded-md text-base sm:text-sm transition-colors cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 opacity-70 flex-shrink-0" />
                <span className={cn("transition-opacity", !isSidebarOpen && "md:opacity-0")}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Toggle button when sidebar is closed */}
        {!isSidebarOpen && (
          <div className="absolute top-[8px] left-2 z-30">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
              title="サイドバーを開く"
            >
              <Menu className="w-6 h-6 opacity-70 hover:opacity-100" />
            </button>
          </div>
        )}
        <div className={cn("absolute inset-0 overflow-auto transition-all", !isSidebarOpen && "[&_header]:pl-16 md:[&_header]:pl-16 sm:[&_header]:pl-12")}>
          {activeTab === 'youtube' && <YoutubeSearch initialKeyword={searchKeyword} />}
          {activeTab === 'linked' && <LinkedDb />}
          {activeTab === 'original' && <OriginalDb onNavigateToSearch={navigateToSearch} />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}
