export const SONG_COLUMNS = [
  { key: 'title', label: '曲名', type: 'text' },
  { key: 'id', label: 'ID', type: 'text' },
  { key: 'mainSingerId', label: 'メイン歌手', type: 'single_select' },
  { key: 'subSingerIds', label: 'サブ歌手', type: 'multi_select' },
  { key: 'location', label: '言語', type: 'single_select' },
  { key: 'genre', label: 'ジャンル', type: 'multi_select' },
  { key: 'usage', label: '用途', type: 'multi_select' },
  { key: 'evaluation1', label: '評価', type: 'single_select' },
  { key: 'urls', label: 'URL', type: 'text' },
  { key: 'releaseDate', label: 'リリース日', type: 'date' },
  { key: 'viewCount', label: '再生数', type: 'number' },
  { key: 'songViewsPerDay', label: '回/日', type: 'number' },
  { key: 'top70Views', label: '再生数上位60%', type: 'number' },
  { key: 'top70ViewsPerDay', label: '回/日上位60%', type: 'number' },
  { key: 'singerPreference', label: '歌手の好き度', type: 'number' },
  { key: 'trend', label: '流行関数', type: 'number' },
  { key: 'createdAt', label: '作成日時', type: 'date' },
  { key: 'updatedAt', label: '更新日時', type: 'date' },
];

export const SINGER_COLUMNS = [
  { key: 'search', label: '検索', type: 'custom' },
  { key: 'lastSearchedAt', label: '最終検索', type: 'text', className: 'px-4 py-3 whitespace-nowrap text-center' },
  { key: 'name', label: '歌手名', type: 'text' },
  { key: 'location', label: '言語', type: 'single_select' },
  { key: 'preference', label: '好き度', type: 'number' },
  { key: 'singability', label: '歌いやすさ', type: 'number' },
  { key: 'mainSongs', label: 'メイン曲', type: 'multi_select' },
  { key: 'subSongs', label: 'サブ曲', type: 'multi_select' },
  { key: 'songViews', label: '曲の再生数', type: 'text' },
  { key: 'songViewsPerDay', label: '曲の回/日', type: 'text' },
  { key: 'top70Views', label: '再生数_上位60%', type: 'number' },
  { key: 'top70ViewsPerDay', label: '回/日_上位60%', type: 'number' },
  { key: 'createdAt', label: '作成日時', type: 'date' },
  { key: 'updatedAt', label: '更新日時', type: 'date' },
];

export const TEXT_OPERATORS = [
  { value: 'contains', label: 'を含む' },
  { value: 'not_contains', label: 'を含まない' },
  { value: 'equals', label: 'と完全一致' },
  { value: 'not_equals', label: 'と一致しない' },
  { value: 'is_empty', label: '未入力' },
  { value: 'is_not_empty', label: '未入力ではない' },
];

export const NUMBER_OPERATORS = [
  { value: 'equals', label: 'と等しい' },
  { value: 'not_equals', label: 'と等しくない' },
  { value: 'greater_than', label: 'より大きい' },
  { value: 'less_than', label: 'より小さい' },
  { value: 'greater_than_or_equal', label: '以上' },
  { value: 'less_than_or_equal', label: '以下' },
  { value: 'is_empty', label: '未入力' },
  { value: 'is_not_empty', label: '未入力ではない' },
];

export const DATE_OPERATORS = [
  { value: 'equals', label: 'と一致する' },
  { value: 'before', label: 'より前' },
  { value: 'after', label: 'より後' },
  { value: 'is_empty', label: '未入力' },
  { value: 'is_not_empty', label: '未入力ではない' },
];

export const SELECT_OPERATORS = [
  { value: 'equals', label: 'と一致する' },
  { value: 'not_equals', label: 'と一致しない' },
  { value: 'is_empty', label: '未入力' },
  { value: 'is_not_empty', label: '未入力ではない' },
];

export const MULTI_SELECT_OPERATORS = [
  { value: 'contains', label: 'のいずれかを含む' },
  { value: 'contains_all', label: 'のすべてを含む' },
  { value: 'not_contains', label: 'を含まない' },
  { value: 'is_empty', label: '未入力' },
  { value: 'is_not_empty', label: '未入力ではない' },
];

export function getOperatorsForType(type: string) {
  switch (type) {
    case 'number': return NUMBER_OPERATORS;
    case 'date': return DATE_OPERATORS;
    case 'single_select': return SELECT_OPERATORS;
    case 'multi_select': return MULTI_SELECT_OPERATORS;
    default: return TEXT_OPERATORS;
  }
}
