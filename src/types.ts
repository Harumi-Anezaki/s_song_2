export type Song = {
  id: string;
  title: string;
  youtubeIds: string[];
  mainSingerId: string | null;
  subSingerIds: string[];
  location: string;
  genre: string | string[];
  usage: string | string[];
  evaluation1: string;
  urls: string[];
  urlTitles?: string[];
  urlViewCounts?: number[];
  urlDurationSeconds?: number[];
  releaseDate: string; // YYYY-MM-DD
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Singer = {
  id: string;
  name: string;
  preference: number | null;
  singability: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DbType = 'song' | 'singer';

export type FilterOperator = 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';

export type Filter = {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
  logic: 'AND' | 'OR';
};

export type Sort = {
  id: string;
  column: string;
  direction: 'asc' | 'desc';
};

export type LinkedDbView = {
  id: string;
  name: string;
  sourceDb: DbType;
  columns: string[]; // Ordered column keys
  hiddenColumns: string[];
  collapsedColumns?: Record<string, boolean>;
  filters: Filter[];
  sorts: Sort[];
  columnWidths: Record<string, number>;
  wrapText: boolean;
};

export type YoutubeSearchResult = {
  id: string;
  title: string;
  url: string;
  viewCount: number;
  publishedAt: string;
  channelTitle: string;
  durationString: string; // "3分4秒"
  durationSeconds: number;
  similarityCandidates?: SimilarityResult[];
  mainSingerId?: string | null;
  subSingerIds?: string[];
};

export type SimilarityResult = {
  targetId: string; // Internal song ID or other YoutubeSearchResult ID
  targetYoutubeId?: string; // If target is a youtube search result
  targetTitle: string;
  targetUrl: string;
  targetViewCount: number;
  targetPublishedAt: string;
  targetChannelTitle: string;
  targetDurationSeconds: number;
  score: number;
  reasons: string[];
  warnings: string[];
  isAlreadyMerged: boolean;
  isDbEntry?: boolean;
};

export type AppState = {
  youtubeApiKey: string;
  customGenres?: string[];
  customUsages?: string[];
  customEvaluations?: string[];
  songs: Song[];
  singers: Singer[];
  excludedYoutubeIds: string[];
  linkedViews: LinkedDbView[];
  lastOpenViewId: string | null;
  uiState?: {
    isSidebarOpen?: boolean;
    activeTab?: 'youtube' | 'linked' | 'original' | 'settings';
    originalDbActiveTab?: 'song' | 'singer';
    originalDbSongView?: LinkedDbView;
    originalDbSingerView?: LinkedDbView;
    searchKeyword?: string;
    youtubeSearchMinViews?: number;
    youtubeSearchLocation?: string;
    youtubeSearchResults?: YoutubeSearchResult[];
    youtubeSearchSelectedIds?: string[];
    youtubeSearchManualSelectedIds?: string[];
    youtubeSearchComparingGroup?: SimilarityResult[] | null;
    linkedDbIsMusicMode?: boolean;
    linkedDbSearchQuery?: string;
    originalDbSearchQuery?: string;
    musicPlayer?: {
      currentIndex?: number;
      isShuffle?: boolean;
      isRepeat?: boolean;
    };
  };
};
