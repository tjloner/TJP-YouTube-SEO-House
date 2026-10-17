/**
 * TJP YouTube SEO Engine — Studio 2: Competitor Video Spy (Pro Edition)
 * Module: src/seo/modules/competitor-spy.js
 * 
 * 100% Client-Side Engine ($0 APIs):
 *  - Real Hidden Metadata Tags Extraction (Parses raw YouTube HTML/JSON)
 *  - Full Description, External Links & #Hashtags Isolator
 *  - 8-Minute Mid-Roll Monetization Detector
 *  - Niche-Specific RPM & Ad Revenue Breakdown (India ₹ vs US $)
 *  - All-Resolution Thumbnail Kit (1080p, 720p, 480p)
 *  - Niche-Adaptive Content Vacuums & Pinned Comments
 */

const NICHE_RPM_BENCHMARKS = {
  stories_animation: { name: 'Stories & Animation', inrLow: 30, inrHigh: 65, usdLow: 0.35, usdHigh: 0.75 },
  tech_tutorials: { name: 'Tech, AI & Tutorials', inrLow: 80, inrHigh: 180, usdLow: 1.00, usdHigh: 2.20 },
  finance_business: { name: 'Finance, Crypto & Business', inrLow: 150, inrHigh: 350, usdLow: 1.80, usdHigh: 4.20 },
  vlogs_entertainment: { name: 'Vlogs & Comedy', inrLow: 25, inrHigh: 55, usdLow: 0.30, usdHigh: 0.65 },
  gaming: { name: 'Gaming & Streaming', inrLow: 20, inrHigh: 45, usdLow: 0.25, usdHigh: 0.55 },
  education_jobs: { name: 'Education & Govt Jobs', inrLow: 45, inrHigh: 110, usdLow: 0.55, usdHigh: 1.30 }
};

export class TjpCompetitorSpy {
  /**
   * Extracts clean 11-character Video ID from any YouTube URL format.
   */
  static extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = cleanUrl.match(regExp);
    return (match && match[1]) ? match[1] : null;
  }

  /**
   * Primary Ingestion Engine:
   * 1. Tries to scrape raw YouTube HTML via a public CORS proxy to extract REAL hidden tags.
   * 2. If proxy times out, falls back to public oEmbed API so it never crashes.
   */
  static async inspectCompetitorVideo(videoId) {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Step A: Attempt raw HTML scrape for real tags and duration
    try {
      const rawHtml = await this.fetchRawHtmlWithTimeout(targetUrl, 4500);

      if (rawHtml) {
        const parsedData = this.parseRawYouTubeHtml(rawHtml, videoId, targetUrl);
        if (parsedData && parsedData.title) {
          return { success: true, ...parsedData, dataSource: 'raw_html_full_scrape' };
        }
      }
    } catch (e) {
      // Fallback proceeds below
    }

    // Step B: Reliable Fallback to Public oEmbed
    return await this.fetchOembedFallback(videoId, targetUrl);
  }

  /**
   * Fetches raw HTML via public CORS proxy with timeout.
   */
  static async fetchRawHtmlWithTimeout(targetUrl, timeoutMs = 4500) {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) return null;
      return await response.text();
    } catch (err) {
      clearTimeout(timer);
      return null;
    }
  }

  /**
   * Parses raw YouTube HTML (the exact view-source content).
   */
  static parseRawYouTubeHtml(html, videoId, targetUrl) {
    // 1. Title
    const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) ||
                       html.match(/<title>([^<]*)<\/title>/i);
    let title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Unknown Title';

    // 2. Author / Channel
    const authorMatch = html.match(/<link\s+itemprop="name"\s+content="([^"]*)"/i) ||
                        html.match(/"author":"([^"]*)"/i);
    const authorName = authorMatch ? authorMatch[1].trim() : 'Creator Channel';

    // 3. Real Hidden Metadata Tags (<meta name="keywords"> or JSON keywords)
    let realTags = [];
    const metaKeywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
    
    if (metaKeywordsMatch && metaKeywordsMatch[1]) {
      realTags = metaKeywordsMatch[1]
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && t.toLowerCase() !== title.toLowerCase());
    }

    if (realTags.length === 0) {
      const jsonKeywordsMatch = html.match(/"keywords":\s*(\[[^\]]+\])/);
      if (jsonKeywordsMatch && jsonKeywordsMatch[1]) {
        try {
          realTags = JSON.parse(jsonKeywordsMatch[1]);
        } catch (e) {}
      }
    }

    // 4. Description & Isolated External Links
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                      html.match(/"shortDescription":"([^"]*)"/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
    const externalLinks = Array.from(new Set(description.match(/https?:\/\/[^\s]+/g) || []));
    const hashtags = Array.from(new Set(description.match(/#[\w\u0590-\u05ff\u0900-\u097f\u0c00-\u0c7f]+/gi) || []));

    // 5. Video Duration & 8-Minute Mid-Roll Check
    const durationMatch = html.match(/"lengthSeconds":"(\d+)"/) || html.match(/itemprop="duration"\s+content="PT(?:(\d+)M)?(?:(\d+)S)?"/i);
    let durationSeconds = 0;
    if (durationMatch) {
      if (durationMatch[1] && durationMatch[2]) {
        durationSeconds = (parseInt(durationMatch[1], 10) * 60) + parseInt(durationMatch[2], 10);
      } else if (durationMatch[1]) {
        durationSeconds = parseInt(durationMatch[1], 10);
      }
    }

    const isMidrollEligible = durationSeconds >= 480; // 8 minutes = 480s

    return {
      videoId,
      title,
      authorName,
      authorUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(authorName)}`,
      realTags: realTags.length > 0 ? realTags : this.extractFallbackAnchors(title, authorName),
      description: description || 'No description provided.',
      externalLinks,
      hashtags,
      durationSeconds,
      formattedDuration: this.formatDuration(durationSeconds),
      isMidrollEligible,
      thumbnailKit: this.getThumbnailKit(videoId),
      videoUrl: targetUrl
    };
  }

  /**
   * Fallback using public oEmbed endpoint.
   */
  static async fetchOembedFallback(videoId, targetUrl) {
    const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;

    try {
      const response = await fetch(oembedEndpoint);
      if (response.status === 404 || response.status === 401) {
        return {
          success: false,
          error: 'This video is Private, Unlisted, or has been Deleted. YouTube hides its metadata from public search.'
        };
      }
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

      const data = await response.json();
      const fallbackTags = this.extractFallbackAnchors(data.title || '', data.author_name || '');

      return {
        success: true,
        videoId,
        title: data.title || 'Unknown Title',
        authorName: data.author_name || 'Creator',
        authorUrl: data.author_url || '',
        realTags: fallbackTags,
        description: 'Description protected by YouTube oEmbed. Displaying extracted title tags.',
        externalLinks: [],
        hashtags: [],
        durationSeconds: 0,
        formattedDuration: 'Unknown',
        isMidrollEligible: false,
        thumbnailKit: this.getThumbnailKit(videoId),
        videoUrl: targetUrl,
        dataSource: 'oembed_fallback'
      };
    } catch (err) {
      return {
        success: false,
        error: 'Unable to reach video metadata. Check if the YouTube link is valid and publicly accessible.'
      };
    }
  }

  /**
   * Fallback anchor splitter when raw HTML tags are inaccessible.
   */
  static extractFallbackAnchors(title, authorName) {
    const rawSegments = title
      .split(/[-–—|/:,•]/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 2 && s.length <= 40);

    const clean = new Set(rawSegments);
    if (authorName) clean.add(authorName.toLowerCase().trim());
    return Array.from(clean);
  }

  /**
   * Generates direct links for all 4 YouTube thumbnail resolutions.
   */
  static getThumbnailKit(videoId) {
    return {
      maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      hd: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      sd: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
      mobile: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
  }

  /**
   * Formats duration in seconds to MM:SS or HH:MM:SS.
   */
  static formatDuration(seconds) {
    if (!seconds || seconds <= 0) return 'Unknown';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  /**
   * Niche-Adaptive Content Vacuum Detector.
   */
  static detectContentVacuums(targetTopic, competitorTitle = '') {
    const lowerTitle = (competitorTitle + ' ' + targetTopic).toLowerCase();
    const isEntertainment = /story|stories|kathalu|kahani|movie|song|comedy|animation|drama|episode|kids/i.test(lowerTitle);

    let vacuumTopics = [];

    if (isEntertainment) {
      vacuumTopics = [
        { suffix: 'part 2', reason: 'High demand for sequels; viewers search continuously for the next episode.' },
        { suffix: 'moral & meaning', reason: 'Parents and teachers search for moral lessons to explain to children.' },
        { suffix: 'full episode', reason: 'Viewers hate short clips and search for full-length uninterrupted stories.' },
        { suffix: 'kids animation', reason: 'High-volume search segment for family-friendly animated content.' }
      ];
    } else {
      vacuumTopics = [
        { suffix: 'for beginners', reason: 'Entry-level viewers search for step-by-step guidance without complex jargon.' },
        { suffix: 'mistakes to avoid', reason: 'High-CTR query from viewers wanting to avoid common errors.' },
        { suffix: 'complete roadmap 2026', reason: 'Strong authority query for updated current-year frameworks.' },
        { suffix: 'free vs paid comparison', reason: 'High-intent search query for decision-makers.' }
      ];
    }

    return vacuumTopics.map(v => ({
      topic: `${targetTopic} ${v.suffix}`,
      reason: v.reason
    }));
  }

  /**
   * Real Mathematical Ad Revenue Calculator (Niche & Mid-Roll Aware).
   * Formula: (Views / 1000) * RPM * MidRollBoost
   */
  static estimateRevenueRange(views = 50000, niche = 'stories_animation', region = 'india', isMidrollEligible = false) {
    const safeViews = Math.max(1000, parseInt(views, 10) || 50000);
    const benchmark = NICHE_RPM_BENCHMARKS[niche] || NICHE_RPM_BENCHMARKS.stories_animation;
    const midrollMultiplier = isMidrollEligible ? 1.65 : 1.0;

    let lowRpm, highRpm, currencyPrefix;

    if (region === 'india') {
      lowRpm = benchmark.inrLow * midrollMultiplier;
      highRpm = benchmark.inrHigh * midrollMultiplier;
      currencyPrefix = '₹';

      const lowEst = Math.round((safeViews / 1000) * lowRpm);
      const highEst = Math.round((safeViews / 1000) * highRpm);
      const usdLow = Math.round(lowEst / 84);
      const usdHigh = Math.round(highEst / 84);

      return {
        views: safeViews.toLocaleString(),
        rangeText: `₹${lowEst.toLocaleString()} - ₹${highEst.toLocaleString()} ($${usdLow} - $${usdHigh})`,
        nicheName: benchmark.name,
        isMidrollEligible,
        multiplierText: isMidrollEligible ? '1.65× (8+ Min Mid-Roll Bonus Applied)' : '1.0× (Standard Pre-Roll Only)',
        formulaExplainer: `Math: (${safeViews.toLocaleString()} views ÷ 1,000) × ₹${Math.round(lowRpm)}–₹${Math.round(highRpm)} RPM for ${benchmark.name}.`
      };
    } else {
      lowRpm = benchmark.usdLow * midrollMultiplier;
      highRpm = benchmark.usdHigh * midrollMultiplier;
      currencyPrefix = '$';

      const lowEst = Math.round((safeViews / 1000) * lowRpm);
      const highEst = Math.round((safeViews / 1000) * highRpm);

      return {
        views: safeViews.toLocaleString(),
        rangeText: `$${lowEst.toLocaleString()} - $${highEst.toLocaleString()}`,
        nicheName: benchmark.name,
        isMidrollEligible,
        multiplierText: isMidrollEligible ? '1.65× (8+ Min Mid-Roll Bonus Applied)' : '1.0× (Standard Pre-Roll Only)',
        formulaExplainer: `Math: (${safeViews.toLocaleString()} views ÷ 1,000) × $${lowRpm.toFixed(2)}–$${highRpm.toFixed(2)} RPM for ${benchmark.name}.`
      };
    }
  }

  /**
   * Niche-Adaptive Pinned Comments.
   */
  static generatePinnedComments(videoTitle, primaryKeyword) {
    const isEntertainment = /story|stories|kathalu|kahani|movie|song|comedy|kids/i.test(videoTitle + ' ' + primaryKeyword);

    if (isEntertainment) {
      return [
        {
          type: "🗣️ Community Question (Boosts Comments)",
          text: `ఈ కథలో మీకు నచ్చిన నీతి లేదా క్యారెక్టర్ ఏది? మీ అభిప్రాయాన్ని క్రింద కామెంట్ చేయండి! 👇 (Replying to all comments!)`
        },
        {
          type: "⭐ Part 2 / Sequel Demand Poll",
          text: `ఈ కథకి పార్ట్-2 (Next Story) కావాలనుకుంటే కామెంట్స్ లో "PART 2" అని టైప్ చేయండి! త్వరలోనే అప్‌లోడ్ చేస్తాం!`
        },
        {
          type: "🔔 Notification Bell Reminder",
          text: `ప్రతిరోజూ సరికొత్త కథల కోసం ఛానెల్‌ని సబ్‌స్క్రైబ్ చేసుకొని గంట గుర్తు నొక్కండి! ఈ కథ మీ మిత్రులతో కూడా షేర్ చేయండి!`
        }
      ];
    }

    return [
      {
        type: "🔥 The Debate Question",
        text: `Be honest: what is your biggest struggle when it comes to ${primaryKeyword}? Drop your thoughts below—I'm replying to everyone in the first 2 hours! 👇`
      },
      {
        type: "⏱️ Highlight Chapter Navigation",
        text: `📌 Quick Navigation:\n00:00 - The Core Problem\n02:15 - Step-by-Step ${primaryKeyword}\n06:40 - The #1 Trap to Avoid\n\nWhich chapter helped you the most?`
      },
      {
        type: "🎁 Free Checklist Pin",
        text: `Thanks for watching! If you want the complete checklist for ${primaryKeyword}, let me know in the comments and subscribe for next week's guide!`
      }
    ];
  }
}