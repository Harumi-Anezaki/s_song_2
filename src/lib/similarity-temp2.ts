import { YoutubeSearchResult, SimilarityResult } from '../types';
import { COMMON_WORDS, VERSION_WORDS, CHANNEL_SUFFIXES, LIVE_PERFORMANCE_WORDS, SHORT_TV_SIZE_WORDS, COVER_REMIX_WORDS } from './similarity-words';

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

export function normalizeTitle(title: string, keyword: string | string[], channelName: string = ''): string {
  return removeNoiseWords(title, channelName, keyword);
}

function removeNoiseWords(text: string, channelName: string = '', keyword: string | string[] = ''): string {
  let t = text.toLowerCase();
  
  t = t.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  t = t.replace(/　/g, ' ');
  
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  keywords.forEach(kw => {
    if (kw) {
      // Escape kw just in case
      const escapedKw = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp(escapedKw, 'g'), ' ');
    }
  });
  
  if (channelName) {
    let cleanChannel = channelName.toLowerCase().replace(/[()[\]{}<>'"`\-=_+*&^%$#@!~\\|/?,.;:【】『』「」–—]/g, ' ');
    cleanChannel = cleanChannel.replace(/(vevo|official|channel|music|japan|inc|ltd|co|entertainment|records|topic|tv|studio|project)/ig, ' ').trim();
    cleanChannel.split(/\s+/).forEach(part => {
      if (part.length > 2) {
        t = t.replace(new RegExp(part, 'gi'), ' ');
      }
    });
  }

  // Remove *th single (e.g. 1st single, 8th single, 20th single)
  t = t.replace(/\d+(st|nd|rd|th)\s*single/gi, ' ');
  // Also remove c/w if it often comes with it (optional, but good for cleaning)
  t = t.replace(/\bc\/w\b/gi, ' ');

  const noiseWords = [...COMMON_WORDS, ...VERSION_WORDS].sort((a, b) => b.length - a.length);
  noiseWords.forEach((w) => {
    t = t.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    if (!/^[a-z0-9]+$/i.test(w)) {
      t = t.replace(new RegExp(w, 'gi'), ' '); 
    }
  });
  
  t = t.replace(/[()[\]{}<>'"`\-=_+*&^%$#@!~\\|/?,.;:【】『』「」–—]/g, ' ');

  return t.replace(/\s+/g, ' ').trim();
}

function extractBracketContents(str: string): string[] {
  const matches = str.match(/([「『"“'‘])([^」』"”'’]+)([」』"”'’])/g) || [];
  return matches.map(m => m.slice(1, -1).trim()).filter(m => m.length > 0);
}

function extractExplicitTitles(title: string): string[] {
  const matches = title.match(/[「『]([^」』]+)[」』]/g) || [];
  return matches.map(m => m.slice(1, -1).trim()).filter(m => m.length >= 2);
}

function removeChannelName(title: string, channelName: string): string {
    if (!channelName) return title;
    let cleanChannel = channelName.toLowerCase().replace(/[()[\]{}<>'"`\-=_+*&^%$#@!~\\|/?,.;:【】『』「」–—]/g, ' ');
    cleanChannel = cleanChannel.replace(new RegExp(`(${CHANNEL_SUFFIXES.join('|')})`, 'ig'), ' ').trim();
    
    let t = title;
    cleanChannel.split(/\s+/).forEach(part => {
        if (part.length > 2) {
            t = t.replace(new RegExp(part, 'ig'), ' ');
        }
    });
    return t;
}

function extractSignificantParts(title: string): string[] {
  const brackets = extractBracketContents(title);
  const parts = title.split(/[()[\]{}【】『』「」|/~〜–—]|\s+-\s+/).map(p => p.trim());
  return [...brackets, ...parts].filter(p => p.length >= 2);
}

function hasLiveOrPerformance(title: string): boolean {
  const t = title.toLowerCase();
  return LIVE_PERFORMANCE_WORDS.some(w => t.includes(w));
}

function hasShortOrTvSize(title: string): boolean {
  const t = title.toLowerCase();
  return SHORT_TV_SIZE_WORDS.some(w => t.includes(w));
}

function extractVersions(title: string): string[] {
  const t = title.toLowerCase();
  return VERSION_WORDS.filter((v) => t.includes(v));
}

export function calculateSimilarity(
  vid1: { title: string; duration: number; channel: string; artistName?: string },
  vid2: { title: string; duration: number; channel: string; artistName?: string },
  keyword: string
): { score: number; reasons: string[]; warnings: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const keywords1 = [keyword, vid1.artistName].filter(Boolean) as string[];
  const keywords2 = [keyword, vid2.artistName].filter(Boolean) as string[];

  const clean1 = removeNoiseWords(removeNoiseWords(vid1.title, vid1.channel, keywords1), vid2.channel, '');
  const clean2 = removeNoiseWords(removeNoiseWords(vid2.title, vid2.channel, keywords2), vid1.channel, '');

  const brackets1 = extractBracketContents(vid1.title);
  const brackets2 = extractBracketContents(vid2.title);

  let hasBracketMismatch = false;
  let isBracketMatched = false;
  let bracketMatchMethod = '';

  const cleanTitle1NoChannel = removeNoiseWords(removeChannelName(vid1.title, vid1.channel), '', vid1.artistName || '');
  const cleanTitle2NoChannel = removeNoiseWords(removeChannelName(vid2.title, vid2.channel), '', vid2.artistName || '');
  const explicitTitles1 = extractExplicitTitles(vid1.title);
  const explicitTitles2 = extractExplicitTitles(vid2.title);
  
  let isExplicitSongTitleMatched = false;
  
  const isTitleIncluded = (part: string, fullTitle: string) => {
      const p = part.toLowerCase();
      const f = fullTitle.toLowerCase();
      if (!f.includes(p)) return false;
      if (/^[a-z0-9]+$/.test(p) && p.length < 5) {
          const regex = new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`, 'i');
          return regex.test(f);
      }
      return true;
  };

  for (const t1 of explicitTitles1) {
      if (isTitleIncluded(t1, vid2.title)) isExplicitSongTitleMatched = true; console.log("EXPLICIT MATCH");
  }
  for (const t2 of explicitTitles2) {
      if (isTitleIncluded(t2, vid1.title)) isExplicitSongTitleMatched = true; console.log("EXPLICIT MATCH");
  }

  const clean1NoKw = removeNoiseWords(removeNoiseWords(vid1.title, vid1.channel, vid1.artistName || ''), vid2.channel, '');
  const clean2NoKw = removeNoiseWords(removeNoiseWords(vid2.title, vid2.channel, vid2.artistName || ''), vid1.channel, '');

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

  console.log("isBracketMatched:", isBracketMatched); if (!isBracketMatched) {
      const parts1 = extractSignificantParts(cleanTitle1NoChannel);
      const parts2 = extractSignificantParts(cleanTitle2NoChannel);

      const checkCrossMatch = (parts: string[], targetClean: string) => {
          let hasMatch = false;
          let isSongTitleMatch = false;
          for (const p of parts) {
              const np = removeNoiseWords(p, '', '');
              // We no longer skip based on keyword here, because it breaks cases where the keyword is the song title.
              // We rely on the isSongTitle logic below and robust channel name stripping.
              if (np.length >= 2) {
                  const { score: s, overlap } = calculateStringSimilarity(np, targetClean);
                  
                  let isMatched = false;
                  if (np.length < 4) {
                      if (/^[a-z0-9]+$/i.test(np)) {
                          if (new RegExp(`(^|\\s)${np}(\\s|$)`, 'i').test(targetClean)) isMatched = true;
                      } else {
                          if (targetClean.includes(np)) isMatched = true;
                      }
                  } else {
                      if (targetClean.includes(np)) {
                          isMatched = true;
                      }
                      if (overlap > 85 && (Math.max(np.length, targetClean.length) / Math.min(np.length, targetClean.length) < 1.5)) {
                          isMatched = true;
                      }
                  }

                  if (isMatched) {
                      hasMatch = true;
                      // If the matched part is identical to the keyword, it's likely the artist name.
                      let isSongTitle = false;
                      if (!keyword || np.toLowerCase() !== keyword.toLowerCase()) {
                          isSongTitle = true;
                      } else if (parts.length === 1) {
                          // If it's the only part left, it must be the song title
                          isSongTitle = true;
                      }
                      
                      if (isSongTitle) {
                          isSongTitleMatch = true;
                      }
                  }
              }
          }
          return { matched: hasMatch, isSongTitle: isSongTitleMatch };
      };

      const match1 = checkCrossMatch(parts1, clean2NoKw);
      const match2 = checkCrossMatch(parts2, clean1NoKw); console.log("match1:", match1); console.log("match2:", match2);

      if (match1.matched || match2.matched) {
          if (match1.isSongTitle || match2.isSongTitle) {
              isExplicitSongTitleMatched = true; console.log("EXPLICIT MATCH");
          } else {
              isBracketMatched = true;
              bracketMatchMethod = 'cross';
          }
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
      score += 80 + (baseScore * 0.1);
      reasons.push('曲名が一致');
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
      if (COVER_REMIX_WORDS.includes(v)) {
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
