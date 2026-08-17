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
  if (s1.length < 2 || s2.length < 2) {
    const isMatch = s1 === s2;
    return { score: isMatch ? 100 : 0, overlap: isMatch ? 100 : 0 };
  }
  
  // Bigram similarity
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const b of b1) {
    if (b2.has(b)) intersection++;
  }
  const bigramScore = (intersection / Math.max(b1.size, b2.size)) * 100;
  
  const minSize = Math.min(b1.size, b2.size);
  const overlap = minSize > 0 ? (intersection / minSize) * 100 : 0;

  // Edit distance similarity
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const editScore = Math.max(0, (1 - distance / maxLength) * 100);

  // Combine both (e.g. average)
  return {
    score: (bigramScore + editScore) / 2,
    overlap
  };
}

function stripBracketContents(str: string): string {
  return str.replace(/[([{<【].*?[)\]}>】]/g, ' ');
}

const COMMON_WORDS = ['official', 'music video', 'mv', 'pv', 'lyrics', '歌詞付き', 'full', 'hd', '4k', 'audio'];
const VERSION_WORDS = ['live', 'cover', '歌ってみた', 'remix', 'acoustic', 'instrumental', 'karaoke', 'カラオケ', 'sped up', 'nightcore', 'short ver', 'the first take'];

export function normalizeTitle(title: string, keyword: string, channelName: string = ''): string {
  let t = title.toLowerCase();
  // Full width to half width
  t = t.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  // Remove symbols, brackets
  t = t.replace(/[()[\]{}<>'"`\-=_+*&^%$#@!~\\|/?,.;:【】『』「」]/g, ' ');
  // Remove search keyword (singer name)
  if (keyword) {
    t = t.replace(new RegExp(keyword.toLowerCase(), 'g'), ' ');
  }
  // Remove channel name to avoid matching "ArtistName - Song" heavily
  if (channelName) {
    const cleanChannel = channelName.toLowerCase().replace(/[()[\]{}<>'"`\-=_+*&^%$#@!~\\|/?,.;:【】『』「」]/g, ' ');
    // split channel name by space and remove parts larger than 2 chars
    cleanChannel.split(/\s+/).forEach(part => {
      if (part.length > 2) {
        t = t.replace(new RegExp(part, 'g'), ' ');
      }
    });
  }
  COMMON_WORDS.forEach((w) => {
    t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ');
  });
  return t.replace(/\s+/g, ' ').trim();
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

  // Normalize titles (strip bracket contents, pass channel name to strip it)
  const base1 = stripBracketContents(vid1.title);
  const base2 = stripBracketContents(vid2.title);
  
  const norm1_full = normalizeTitle(base1, keyword, vid1.channel);
  const norm2_full = normalizeTitle(base2, keyword, vid2.channel);

  // Split by common separators (- | / ~) to handle "Artist - Title" formats
  const parts1 = [vid1.title, ...vid1.title.split(/[-|/〜~]/)].map(s => normalizeTitle(stripBracketContents(s), keyword, vid1.channel)).filter(s => s.length > 2);
  const parts2 = [vid2.title, ...vid2.title.split(/[-|/〜~]/)].map(s => normalizeTitle(stripBracketContents(s), keyword, vid2.channel)).filter(s => s.length > 2);
  
  if (parts1.length === 0) parts1.push(norm1_full);
  if (parts2.length === 0) parts2.push(norm2_full);

  let bestTitleScore = 0;
  let bestOverlap = 0;
  let bestLengthDiff = 999;

  for (const p1 of parts1) {
    for (const p2 of parts2) {
      const { score: s, overlap: o } = calculateStringSimilarity(p1, p2);
      if (s > bestTitleScore) {
        bestTitleScore = s;
        bestOverlap = o;
        bestLengthDiff = Math.abs(p1.length - p2.length);
      }
    }
  }

  // Fallback to full title similarity if part matching didn't yield good results
  const fullMatch = calculateStringSimilarity(norm1_full, norm2_full);
  if (fullMatch.score > bestTitleScore) {
    bestTitleScore = fullMatch.score;
    bestOverlap = fullMatch.overlap;
    bestLengthDiff = Math.abs(norm1_full.length - norm2_full.length);
  }

  score += bestTitleScore * 0.75;

  if (bestTitleScore >= 80) {
    reasons.push(`タイトル一致(${Math.round(bestTitleScore)}%)`);
  } else if (bestTitleScore >= 60) {
    reasons.push(`タイトル部分一致(${Math.round(bestTitleScore)}%)`);
  }
  
  // 完全な包含(overlap)がある場合でも、タイトルの長さが大きく違う場合は別曲とみなす
  if (bestOverlap >= 95 && bestLengthDiff <= 10) {
    score += 15; // わずかな表記揺れや余分な文字程度の差なら加点
    if (bestTitleScore < 80) reasons.push(`タイトル強い部分一致`);
  } else if (bestOverlap >= 95 && bestLengthDiff > 10) {
    // 逆に長さが大きく違うのに包含されている場合 (例: "Love Me" と "As Long As You Love Me")
    // パートマッチによってこれが起きにくくなっているが、念のため残す
    score -= 20;
    warnings.push('タイトル長が大きく異なり別曲の可能性');
  }

  // Keyword match (max 15)
  if (keyword && vid1.title.toLowerCase().includes(keyword.toLowerCase()) && vid2.title.toLowerCase().includes(keyword.toLowerCase())) {
    score += 15;
    reasons.push('歌手名(キーワード)一致');
  }

  // Duration closeness (max 25)
  if (vid1.duration > 0 && vid2.duration > 0) {
    const durationDiff = Math.abs(vid1.duration - vid2.duration);
    if (durationDiff <= 2) {
      score += 25;
      reasons.push('再生時間が完全に一致');
    } else if (durationDiff <= 5) {
      score += 15;
      reasons.push('再生時間がほぼ同じ');
    } else if (durationDiff <= 20) {
      score += 7;
      reasons.push('再生時間が近い');
    }
  }

  // Channel matching logic removed as per user requirement.

  // Versions check
  const v1 = extractVersions(vid1.title);
  const v2 = extractVersions(vid2.title);
  
  let hasCoverOrRemix = false;
  let hasLiveMismatch = false;

  const allV = new Set([...v1, ...v2]);
  for (const v of allV) {
    const inV1 = v1.includes(v);
    const inV2 = v2.includes(v);
    if (inV1 !== inV2) {
      if (v === 'short ver') {
        continue;
      }
      
      score -= 25;
      warnings.push(`片方のみに「${v}」が含まれる`);
      
      if (v === 'cover' || v === '歌ってみた' || v === 'remix') {
        hasCoverOrRemix = true;
      }
      if (v === 'live') {
        hasLiveMismatch = true;
      }
    } else {
      if (v === 'cover' || v === '歌ってみた' || v === 'remix') {
        hasCoverOrRemix = true;
      }
    }
  }

  if (hasCoverOrRemix) {
    warnings.push('Cover・Remixを含む');
  }
  if (hasLiveMismatch) {
    warnings.push('通常版とLive版が混在する');
  }

  score = Math.max(0, Math.min(100, score));
  if (score < 85) {
    warnings.push('類似度が85点未満');
  }

  return { score: Math.round(score), reasons, warnings };
}
