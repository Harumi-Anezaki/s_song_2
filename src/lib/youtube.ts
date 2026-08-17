export async function searchYoutube(keyword: string, minViews: number, apiKey: string) {
  if (!apiKey) throw new Error('YouTube API Key is missing.');

  let allSearchItems: any[] = [];
  let nextPageToken = '';
  const maxTotalResults = 100;

  // 1. Fetch up to 100 search results using pagination
  while (allSearchItems.length < maxTotalResults) {
    const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      keyword + ' -shorts'
    )}&type=video&maxResults=50&order=viewCount&key=${apiKey}${pageTokenParam}`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`YouTube API Search Error: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.items && searchData.items.length > 0) {
      allSearchItems = allSearchItems.concat(searchData.items);
    }

    nextPageToken = searchData.nextPageToken;
    if (!nextPageToken) break; // これ以上のページがない場合
  }

  allSearchItems = allSearchItems.slice(0, maxTotalResults);
  const allVideoIds = Array.from(new Set(allSearchItems.map((item: any) => item.id.videoId).filter(Boolean)));

  if (allVideoIds.length === 0) return [];

  // 2. Fetch video details in chunks of 50
  let allVideoItems: any[] = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const chunkIds = allVideoIds.slice(i, i + 50).join(',');
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${chunkIds}&key=${apiKey}`;
    const videoRes = await fetch(videoUrl);

    if (!videoRes.ok) {
      throw new Error(`YouTube API Videos Error: ${videoRes.statusText}`);
    }

    const videoData = await videoRes.json();
    if (videoData.items) {
      allVideoItems = allVideoItems.concat(videoData.items);
    }
  }

  // 3. Format results
  const results = allVideoItems.map((item: any) => {
    const viewCount = parseInt(item.statistics.viewCount || '0', 10);
    const durationStr = item.contentDetails.duration;
    const durationSeconds = parseIsoDuration(durationStr);
    
    return {
      id: item.id,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      viewCount,
      publishedAt: item.snippet.publishedAt.split('T')[0],
      channelTitle: item.snippet.channelTitle,
      durationString: formatDuration(durationSeconds),
      durationSeconds,
    };
  });

  // 4. Filter and sort (元の厳しい条件に戻す)
  return results.filter((r: any) => {
    // 元の動画の長さ制限 (1分未満 または 8分以上を除外)
    if (r.durationSeconds < 60 || r.durationSeconds >= 480) return false;
    
    // 元の再生回数制限
    let requiredViews = 0;
    if (minViews === 1000000) requiredViews = 800000;
    else if (minViews === 10000000) requiredViews = 8000000;
    else if (minViews === 100000000) requiredViews = 80000000;
    
    return r.viewCount >= requiredViews;
  }).sort((a: any, b: any) => b.viewCount - a.viewCount);
}

function parseIsoDuration(duration: string): number {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = parseInt(match?.[1] || '0', 10);
  const minutes = parseInt(match?.[2] || '0', 10);
  const seconds = parseInt(match?.[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}
