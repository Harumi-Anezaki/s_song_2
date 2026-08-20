import { YoutubeSearchResult, SimilarityResult } from '../types';

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}

function calculateStringSimilarity(s1: string, s2: string): { score: number, overlap: number } {
  if (s1.length === 0 || s2.length === 0) return { score: 0, overlap: 0 };

  if (s1.length < 2 || s2.length < 2) {
    const isMatch = s1 === s2;
    const isIncluded = s1.length === 1 ? s2.includes(s1) : s1.includes(s2);
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const editScore = Math.max(0, (1 - distance / maxLength) * 100);
    return { score: isMatch ? 100 : editScore, overlap: isIncluded ? 100 : 0 };
  }
  
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const b of b1) {
    if (b2.has(b)) intersection++;
  }
  const bigramScore = (intersection / Math.max(b1.size, b2.size)) * 100;
  
  const minSize = Math.min(b1.size, b2.size);
  const overlap = minSize > 0 ? (intersection / minSize) * 100 : 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const editScore = Math.max(0, (1 - distance / maxLength) * 100);

  return {
    score: (bigramScore + editScore) / 2,
    overlap
  };
}

const COMMON_WORDS = [
  'official', 'music video', 'mv', 'pv', 'lyrics', '歌詞付き', 'full', 'hd', '4k', 'audio',
  'lyric video', 'tvアニメ', 'アニメ', 'ノンクレジット', 'op', 'ed', 'オープニング', 'エンディング',
  '主題歌', 'covered by', '歌ってみた', '切り抜き', 'スペシャル', 'ちゃんねる', 'チャンネル',
  'mad', 'amv', '公式', 'original', 'teaser', 'trailer'
];

const VERSION_WORDS = [
  'live', 'cover', '歌ってみた', 'remix', 'acoustic', 'instrumental', 'karaoke', 'カラオケ',
  'sped up', 'nightcore', 'short ver', 'short ver.', 'short', 'the first take', 'performance', '紅白', '切り抜き'
];

export function normalizeTitle(title: string, keyword: string, channelName: string = ''): string {
  return removeNoiseWords(title, channelName, keyword);
}

function removeNoiseWords(text: string, channelName: string = '', keyword: string = ''): string {
  let t = text.toLowerCase();
  
  t = t.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  t = t.replace(/　/g, ' ');
  
  if (keyword) {
    t = t.replace(new RegExp(keyword.toLowerCase(), 'g'), ' ');
  }
  
  if (channelName) {
    const cleanChannel = channelName.toLowerCase().replace(/[()[\]{}<>'"`\-=_+*&^%$#@!~\\|/?,.;:【】『』「」]/g, ' ');
    cleanChannel.split(/\s+/).forEach(part => {
      if (part.length > 2) {
        t = t.replace(new RegExp(part, 'g'), ' ');
      }
    });
  }

  COMMON_WORDS.forEach((w) => {
    t = t.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    t = t.replace(new RegExp(w, 'gi'), ' '); 
  });
  
  VERSION_WORDS.forEach((w) => {
    t = t.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    t = t.replace(new RegExp(w, 'gi'), ' '); 
  });
  
  t = t.replace(/[()[\]{}<>'"`\-=_+*&^%$#@!~\\|/?,.;:【】『』「」]/g, ' ');

  return t.replace(/\s+/g, ' ').trim();
}

function extractBracketContents(str: string): string[] {
  const matches = str.match(/([「『【"“\'‘])([^」』】"”\'’]+)([」』】"”\'’])/g) || [];
  return matches.map(m => m.slice(1, -1).trim()).filter(m => m.length > 0);
}

function extractExplicitTitles(title: string): string[] {
  const matches = title.match(/[「『]([^」』]+)[」』]/g) || [];
  return matches.map(m => m.slice(1, -1).trim()).filter(m => m.length >= 2);
}

function extractSignificantParts(title: string): string[] {
  const brackets = extractBracketContents(title);
  const parts = title.split(/[|\-/~〜]/).map(p => p.trim());
  return [...brackets, ...parts].filter(p => p.length >= 2);
}

function hasLiveOrPerformance(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes('live') || t.includes('performance') || t.includes('紅白') || t.includes('ライブ');
}

function hasShortOrTvSize(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes('short') || t.includes('tv') || t.includes('アニメ');
}

function extractVersions(title: string): string[] {
  const t = title.toLowerCase();
  return VERSION_WORDS.filter((v) => t.includes(v));
}

export function calculateSimilarity(
  vid1: { title: string; duration: number; channel: string },
  vid2: { title: string; duration: number; channel: string },
  keyword: string
): { score: number; reasons: string[]; warnings: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const clean1 = removeNoiseWords(vid1.title, vid1.channel, keyword);
  const clean2 = removeNoiseWords(vid2.title, vid2.channel, keyword);

  const brackets1 = extractBracketContents(vid1.title);
  const brackets2 = extractBracketContents(vid2.title);

  let hasBracketMismatch = false;
  let isBracketMatched = false;
  let bracketMatchMethod = '';

  const explicitTitles1 = extractExplicitTitles(vid1.title);
  const explicitTitles2 = extractExplicitTitles(vid2.title);
  
  let isExplicitSongTitleMatched = false;
  
  for (const t1 of explicitTitles1) {
      if (vid2.title.includes(t1)) isExplicitSongTitleMatched = true;
  }
  for (const t2 of explicitTitles2) {
      if (vid1.title.includes(t2)) isExplicitSongTitleMatched = true;
  }

  const clean1NoKw = removeNoiseWords(vid1.title, vid1.channel, '');
  const clean2NoKw = removeNoiseWords(vid2.title, vid2.channel, '');

  if (brackets1.length > 0 && brackets2.length > 0) {
    for (const b1 of brackets1) {
      for (const b2 of brackets2) {
        const n1 = removeNoiseWords(b1, '', '');
        const n2 = removeNoiseWords(b2, '', '');
        if (n1.length < 2 || n2.length < 2) continue;

        const { score: s } = calculateStringSimilarity(n1, n2);
        if (s > 80 || n1.includes(n2) || n2.includes(n1)) {
          isBracketMatched = true;
          bracketMatchMethod = 'both';
        } else if (s < 40) {
           hasBracketMismatch = true;
        }
      }
    }
  }

  if (!isBracketMatched) {
      const parts1 = extractSignificantParts(vid1.title);
      const parts2 = extractSignificantParts(vid2.title);

      const checkCrossMatch = (parts: string[], targetClean: string) => {
          for (const p of parts) {
              const np = removeNoiseWords(p, '', '');
              // If the matched part is basically the search keyword, skip to prevent false artist matching
              if (keyword && np.toLowerCase() === keyword.toLowerCase()) continue;
              if (keyword && np.toLowerCase().includes(keyword.toLowerCase()) && np.length <= keyword.length + 2) continue;

              if (np.length >= 2) {
                  const { score: s, overlap } = calculateStringSimilarity(np, targetClean);
                  if (overlap > 85 || (np.length >= 3 && targetClean.includes(np))) {
                      return true;
                  }
              }
          }
          return false;
      };

      if (checkCrossMatch(parts1, clean2NoKw) || checkCrossMatch(parts2, clean1NoKw)) {
          isBracketMatched = true;
          bracketMatchMethod = 'cross';
          hasBracketMismatch = false; // Override any previous mismatch
      }
  }

  const cleanMatch = calculateStringSimilarity(clean1, clean2);
  const baseScore = cleanMatch.score;
  const overlap = cleanMatch.overlap;

  let isStrongOverlap = false;
  if (overlap >= 85 && Math.min(clean1.length, clean2.length) >= 2) {
      isStrongOverlap = true;
  }

  // 以前のTopicチャンネル対応で入れた includes の条件が緩すぎたため、"I DID IT" (DJ Khaled) と "I'm So Hood" が誤爆していた。
  // それを修正し、ベーススコアによる厳格な評価に戻す
  if (isExplicitSongTitleMatched) {
      score += 75;
      reasons.push('曲名(「」内)が一致');
      isBracketMatched = true; 
      hasBracketMismatch = false;
  } else if (isBracketMatched) {
      score += 65 + (baseScore * 0.1);
      reasons.push('タイトル(区切り部分)が一致');
  } else if (brackets1.length > 0 && brackets2.length > 0 && hasBracketMismatch) {
      score -= 50;
      warnings.push('タイトル(曲名部分)が不一致');
  } else if (isStrongOverlap) {
      score += 50 + (overlap * 0.2); 
      reasons.push(`タイトルが強く部分一致(${Math.round(overlap)}%)`);
  } else {
      score += baseScore * 0.65;
      if (baseScore >= 80) {
          reasons.push(`タイトル一致(${Math.round(baseScore)}%)`);
      } else if (baseScore >= 60) {
          reasons.push(`タイトル部分一致(${Math.round(baseScore)}%)`);
      }
  }

  // もしカッコでの強い一致がない（または短い文字列での誤判定の可能性がある）場合で、
  // 全体の文字列類似度が極端に低い場合は、ペナルティを与える
  if (baseScore < 30 && score > 50 && !isBracketMatched) {
      score -= 30; // 共通点が少なすぎるのに何らかの理由でスコアが高くなっている場合は下げる
  } else if (baseScore < 20 && isBracketMatched && !isExplicitSongTitleMatched) {
      // カッコ等で一致したが、その他の文字列が全く異なり、曲名明記もない場合
      // 再生時間が離れていればペナルティを与えて誤判定を防ぐ
      if (Math.abs(vid1.duration - vid2.duration) > 5) {
          score -= 20;
          warnings.push('タイトル(曲名以外)が異なり時間差あり');
      }
  }

  if (keyword && vid1.title.toLowerCase().includes(keyword.toLowerCase()) && vid2.title.toLowerCase().includes(keyword.toLowerCase())) {
      score += 15;
      reasons.push('歌手名一致');
  }

  if (vid1.duration > 0 && vid2.duration > 0) {
      const durationDiff = Math.abs(vid1.duration - vid2.duration);
      
      const isLive1 = hasLiveOrPerformance(vid1.title);
      const isLive2 = hasLiveOrPerformance(vid2.title);
      const isShort1 = hasShortOrTvSize(vid1.title) || vid1.duration < 190; 
      const isShort2 = hasShortOrTvSize(vid2.title) || vid2.duration < 190;
      
      if (durationDiff <= 2) {
          score += 25;
          reasons.push('再生時間が完全に一致');
      } else if (durationDiff <= 5) {
          score += 15;
          reasons.push('再生時間がほぼ同じ');
      } else if (durationDiff <= 20) {
          score += 7;
          reasons.push('再生時間が近い');
      } else {
          if ((isLive1 && !isLive2) || (!isLive1 && isLive2)) {
               if (durationDiff <= 240) {
                   score += 5;
                   reasons.push('ライブ版と通常版の時間差を許容');
               } else {
                   score -= 10;
                   warnings.push('再生時間が大きく異なる(Live)');
               }
          } else if ((isShort1 && !isShort2) || (!isShort1 && isShort2)) {
               if (vid1.duration <= 190 || vid2.duration <= 190) { 
                   score += 5;
                   reasons.push('TV/ショート版として時間差を許容');
               } else {
                   score -= 10;
                   warnings.push('再生時間が大きく異なる(Short)');
               }
          } else {
               if (isBracketMatched) {
                   warnings.push('再生時間が異なる');
               } else {
                   score -= 15;
                   warnings.push('再生時間が大きく異なる');
               }
          }
      }
  }

  const v1 = extractVersions(vid1.title);
  const v2 = extractVersions(vid2.title);
  
  let hasCoverOrRemix = false;
  const allV = new Set([...v1, ...v2]);
  for (const v of allV) {
      if (v === 'cover' || v === '歌ってみた' || v === 'remix' || v === '切り抜き') {
          hasCoverOrRemix = true;
      }
  }
  
  if (hasCoverOrRemix) {
      warnings.push('Cover・Remix・切り抜きを含む');
  }

  score = Math.max(0, Math.min(100, score));
  if (score < 85) {
      warnings.push('類似度が85点未満');
  }

  return { score: Math.round(score), reasons, warnings };
}
