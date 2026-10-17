/**
 * TJP YouTube SEO Engine — Studio 2: Competitor Video Spy (Pro Edition)
 * Module: src/seo/modules/competitor-spy.js
 * 
 * Capabilities:
 *  - High-Speed Edge CORS Proxy (corsproxy.io)
 *  - Flexible HTML Meta Parser (supports name="keyword", name="keywords", and JSON blobs)
 *  - Exact Duration Parser (lengthSeconds & approxDurationMs -> 35:12)
 *  - 100% Offline View-Source Snippet Parser
 *  - Genre-Smart Counter-Title Matrix (Narrative hooks for stories, proof hooks for tutorials)
 *  - Full Description, External Links & Real Tag Extractor
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
  static extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = cleanUrl.match(regExp);
    return (match && match[1]) ? match[1] : null;
  }

  /**
   * Main Inspection Pipeline:
   * 1. Uses corsproxy.io directly to pull raw YouTube watch page HTML.
   * 2. Runs deep regex covering both name="keyword" and name="keywords".
   * 3. Falls back gracefully if network fails.
   */
  static async inspectCompetitorVideo(videoId, optionalRawSource = '') {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Priority 0: If user provided view-source snippet directly
    if (optionalRawSource && optionalRawSource.trim().length > 20) {
      const parsed = this.parseRawYouTubeHtml(optionalRawSource, videoId, targetUrl);
      if (parsed.realTags.length > 0 || parsed.title !== 'Unknown Title') {
        return { success: true, ...parsed, dataSource: 'manual_view_source' };
      }
    }

    // Priority 1: High-Speed Edge CORS Proxy (corsproxy.io)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const html = await res.text();
        const parsed = this.parseRawYouTubeHtml(html, videoId, targetUrl);
        if (parsed.realTags.length > 0 || parsed.durationSeconds > 0) {
          return { success: true, ...parsed, dataSource: 'raw_html_scrape' };
        }
      }
    } catch (e) {}

    // Priority 2: Invidious Public API Mirror
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://invidious.nerdvpn.de/api/v1/videos/${videoId}`, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        if (json && json.title) {
          return this.formatInvidiousData(json, videoId, targetUrl);
        }
      }
    } catch (e) {}

    // Priority 3: Public oEmbed Fallback
    return await this.fetchOembedFallback(videoId, targetUrl);
  }

  /**
   * Deep Parser: Extracts exact data from YouTube HTML source code.
   */
  static parseRawYouTubeHtml(html, videoId, targetUrl) {
    // 1. Title
    const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) ||
                       html.match(/<title>([^<]*)<\/title>/i) ||
                       html.match(/"title":"([^"]*)"/);
    let title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Unknown Title';

    // 2. Author / Channel
    const authorMatch = html.match(/<link\s+itemprop="name"\s+content="([^"]*)"/i) ||
                        html.match(/"author":"([^"]*)"/i) ||
                        html.match(/"ownerChannelName":"([^"]*)"/);
    const authorName = authorMatch ? authorMatch[1].trim() : 'Creator Channel';

    // 3. REAL HIDDEN TAGS (Checks name="keyword", name="keywords", and JSON arrays)
    let realTags = [];
    
    // Pattern A: <meta name="keyword" content="..."> or <meta name="keywords" content="...">
    const metaKeywordsMatch = html.match(/<meta\s+(?:name|property)="keywords?"\s+content="([^"]*)"/i) ||
                              html.match(/content="([^"]*)"\s+name="keywords?"/i) ||
                              html.match(/name="keywords?"\s+content="([^"]*)"/i);

    if (metaKeywordsMatch && metaKeywordsMatch[1]) {
      realTags = metaKeywordsMatch[1]
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    }

    // Pattern B: JSON blob inside ytInitialPlayerResponse
    if (realTags.length === 0) {
      const jsonKeywordsMatch = html.match(/"keywords":\s*(\[[^\]]+\])/);
      if (jsonKeywordsMatch && jsonKeywordsMatch[1]) {
        try {
          const parsed = JSON.parse(jsonKeywordsMatch[1]);
          if (Array.isArray(parsed)) realTags = parsed.filter(Boolean);
        } catch (e) {}
      }
    }

    // 4. Exact Duration (lengthSeconds & approxDurationMs)
    let durationSeconds = 0;
    const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
    const msMatch = html.match(/"approxDurationMs":"(\d+)"/);

    if (lengthMatch && lengthMatch[1]) {
      durationSeconds = parseInt(lengthMatch[1], 10);
    } else if (msMatch && msMatch[1]) {
      durationSeconds = Math.round(parseInt(msMatch[1], 10) / 1000);
    } else {
      const isoDuration = html.match(/itemprop="duration"\s+content="PT(?:(\d+)M)?(?:(\d+)S)?"/i);
      if (isoDuration) {
        const mins = parseInt(isoDuration[1] || '0', 10);
        const secs = parseInt(isoDuration[2] || '0', 10);
        durationSeconds = (mins * 60) + secs;
      }
    }

    // 5. Description, Links, and Hashtags
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                      html.match(/"shortDescription":"([^"]*)"/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
    const externalLinks = Array.from(new Set(description.match(/https?:\/\/[^\s]+/g) || []));
    const hashtags = Array.from(new Set(description.match(/#[\w\u0590-\u05ff\u0900-\u097f\u0c00-\u0c7f]+/gi) || []));

    return {
      videoId,
      title,
      authorName,
      authorUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(authorName)}`,
      realTags: realTags.length > 0 ? realTags : this.extractFallbackAnchors(title, authorName),
      description: description || 'No description provided in metadata.',
      externalLinks,
      hashtags,
      durationSeconds,
      formattedDuration: this.formatDuration(durationSeconds),
      isMidrollEligible: durationSeconds >= 480,
      thumbnailKit: this.getThumbnailKit(videoId),
      videoUrl: targetUrl
    };
  }

  static formatInvidiousData(json, videoId, targetUrl) {
    const tags = Array.isArray(json.keywords) ? json.keywords.filter(Boolean) : [];
    const description = json.description || '';
    const durationSeconds = parseInt(json.lengthSeconds, 10) || 0;
    const externalLinks = Array.from(new Set(description.match(/https?:\/\/[^\s]+/g) || []));
    const hashtags = Array.from(new Set(description.match(/#[\w\u0590-\u05ff\u0900-\u097f\u0c00-\u0c7f]+/gi) || []));

    return {
      success: true,
      videoId,
      title: json.title || 'Unknown Title',
      authorName: json.author || 'Creator Channel',
      authorUrl: json.authorId ? `https://www.youtube.com/channel/${json.authorId}` : '',
      realTags: tags.length > 0 ? tags : this.extractFallbackAnchors(json.title || '', json.author || ''),
      description,
      externalLinks,
      hashtags,
      durationSeconds,
      formattedDuration: this.formatDuration(durationSeconds),
      isMidrollEligible: durationSeconds >= 480,
      thumbnailKit: this.getThumbnailKit(videoId),
      videoUrl: targetUrl,
      dataSource: 'open_source_invidious'
    };
  }

  static async fetchOembedFallback(videoId, targetUrl) {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
      if (!response.ok) throw new Error('oEmbed error');
      const data = await response.json();
      return {
        success: true,
        videoId,
        title: data.title || 'Unknown Title',
        authorName: data.author_name || 'Creator',
        authorUrl: data.author_url || '',
        realTags: this.extractFallbackAnchors(data.title || '', data.author_name || ''),
        description: 'Description protected by YouTube oEmbed. Paste raw view-source snippet below for full instant extraction.',
        externalLinks: [],
        hashtags: [],
        durationSeconds: 0,
        formattedDuration: 'Unknown',
        isMidrollEligible: false,
        thumbnailKit: this.getThumbnailKit(videoId),
        videoUrl: targetUrl,
        dataSource: 'oembed_fallback'
      };
    } catch (e) {
      return { success: false, error: 'Unable to reach video metadata.' };
    }
  }

  static extractFallbackAnchors(title, authorName) {
    const rawSegments = title.split(/[-–—|/:,•]/).map(s => s.trim()).filter(s => s.length > 2 && s.length <= 40);
    const clean = new Set(rawSegments);
    if (authorName) clean.add(authorName.trim());
    return Array.from(clean);
  }

  static getThumbnailKit(videoId) {
    return {
      maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      hd: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      sd: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
      mobile: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
  }

  static formatDuration(seconds) {
    if (!seconds || seconds <= 0) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  static detectGenre(text) {
    if (/story|stories|kathalu|kahani|movie|animation|drama|episode|kids|bedtime|moral/i.test(text)) return 'story';
    if (/how to|tutorial|course|learn|coding|guide|tips|setup|method/i.test(text)) return 'tutorial';
    if (/review|vs|comparison|unboxing|price|worth it|test|benchmark/i.test(text)) return 'review';
    return 'general';
  }

  /**
   * GENRE-SMART COUNTER-TITLE GENERATOR:
   * Narrative/Mystery hooks for stories, proof hooks for tutorials!
   */
  static generateCounterTitles(competitorTitle, targetTopic) {
    const genre = this.detectGenre(`${competitorTitle} ${targetTopic}`);
    const cleanTopic = targetTopic.trim() || competitorTitle.split(/[-–|/]/)[0].trim();

    if (genre === 'story') {
      return [
        {
          strategy: '🎭 The Untold Mystery Hook (High Curiosity)',
          title: `${cleanTopic}: The Untold Truth Nobody Told You (Shocking Ending)`,
          whyItWins: 'Viewers who already know the basic story will click because this promises a secret twist or ending they missed.'
        },
        {
          strategy: '💡 The Hidden Moral Twist (Emotional Depth)',
          title: `Why Everyone Misunderstood The ${cleanTopic} Story (Real Meaning)`,
          whyItWins: 'Challenges common assumptions about the tale. Parents, students, and thinkers click to see the deeper life lesson.'
        },
        {
          strategy: '🎬 The Sequel / Climax Hook',
          title: `${cleanTopic} Part 2: What Happened Next? (Complete Story)`,
          whyItWins: 'Capitalizes on audience momentum. Viewers search continuously for continuation and sequels.'
        }
      ];
    }

    if (genre === 'review') {
      return [
        {
          strategy: '⚠️ The Brutal Truth Warning',
          title: `Why I Stopped Recommending ${cleanTopic} (Don't Buy Yet)`,
          whyItWins: 'Triggers loss aversion. Buyers stop and click to avoid making an expensive mistake.'
        },
        {
          strategy: '📊 The 30-Day Long-Term Test',
          title: `${cleanTopic} After 30 Days of Real Use (The Honest Truth)`,
          whyItWins: 'Beats unboxing videos with real-world durability and reliability data.'
        },
        {
          strategy: '⚔️ The Alternative Showdown',
          title: `${cleanTopic} vs The Competition: Is It Still Worth It in 2026?`,
          whyItWins: 'Directly captures undecided buyers comparing options.'
        }
      ];
    }

    // Default Tutorial / How-To
    return [
      {
        strategy: '🔥 The Direct Contrarian (Exposes Flaws)',
        title: `Stop Doing ${cleanTopic} The Old Way: Do This Instead`,
        whyItWins: 'Directly challenges existing advice. Viewers click fearing their method is outdated.'
      },
      {
        strategy: '⚡ The Speed & Zero-Friction Hook',
        title: `${cleanTopic} in 8 Minutes: The Simple Blueprint Anyone Can Copy`,
        whyItWins: 'Promises the exact same transformation in a fraction of the time.'
      },
      {
        strategy: '📊 The Hard Proof & Data Hook',
        title: `I Tested ${cleanTopic} for 30 Days (Here Are The Real Results)`,
        whyItWins: 'Beats generic theoretical guides with undeniable real-world proof.'
      }
    ];
  }

  static auditCompetitorWeaknesses(title, description, tags = [], durationSeconds = 0, targetTopic = '') {
    const weaknesses = [];

    // Mobile Cutoff Check
    if (title.length > 55) {
      const cutChar = title.slice(0, 52) + '...';
      const hiddenPercent = Math.round(((title.length - 52) / title.length) * 100);
      weaknesses.push({
        type: '❌ Mobile Cutoff Flaw',
        severity: 'critical',
        finding: `Competitor's title is ${title.length} characters long. On mobile feeds, viewers only see: "${cutChar}".`,
        attackAdvantage: `About ${hiddenPercent}% of their title is invisible to mobile scrollers. Keep your title under 50 characters to hook viewers before the cutoff.`
      });
    } else {
      weaknesses.push({
        type: '✅ Mobile Title Optimized',
        severity: 'good',
        finding: `Competitor kept their title short (${title.length} chars). It is fully visible on mobile.`,
        attackAdvantage: `Match their concise title length, but use a stronger emotional or curiosity hook.`
      });
    }

    // Chapters Check
    const hasChapters = /\b\d{1,2}:\d{2}\b/.test(description);
    if (!hasChapters) {
      weaknesses.push({
        type: '❌ Missing Video Chapters',
        severity: 'critical',
        finding: `Competitor did NOT add timestamp chapters in their description.`,
        attackAdvantage: `YouTube rewards videos with chapters by displaying Google Search "Key Moments" and interactive scrub bars. Adding chapters gives you a direct search ranking advantage.`
      });
    } else {
      weaknesses.push({
        type: '✅ Structured Chapters Present',
        severity: 'good',
        finding: `Competitor included video chapters.`,
        attackAdvantage: `Ensure your chapters use search-friendly keywords (e.g., "How to...", "Common Trap") rather than generic labels.`
      });
    }

    // Tag Budget Check
    const totalTagChars = tags.join(',').length;
    if (totalTagChars < 350) {
      weaknesses.push({
        type: '⚠️ Tag Space Left Empty',
        severity: 'warning',
        finding: `Competitor only used ${totalTagChars} / 500 characters in their tag box (${tags.length} tags).`,
        attackAdvantage: `They left ${500 - totalTagChars} characters of free search real estate empty! Fill your tag box to 480+ characters with semantic synonyms to out-index them.`
      });
    } else {
      weaknesses.push({
        type: '✅ Full Tag Saturation',
        severity: 'good',
        finding: `Competitor utilized their tag box well (${totalTagChars} / 500 chars across ${tags.length} tags).`,
        attackAdvantage: `Their tags are saturated. Use Studio 2's Infiltration Bridge to match their top 3 anchors and steal Suggested Video traffic.`
      });
    }

    // Duration Check
    if (durationSeconds > 0 && durationSeconds < 480) {
      weaknesses.push({
        type: '⚠️ Under 8 Minutes (No Mid-Rolls)',
        severity: 'warning',
        finding: `Video is only ${this.formatDuration(durationSeconds)} long. It does NOT qualify for YouTube mid-roll ads.`,
        attackAdvantage: `If you produce an 8+ minute in-depth video on this topic, your potential ad earnings will be 1.65× higher via mid-roll placements.`
      });
    } else if (durationSeconds >= 480) {
      weaknesses.push({
        type: '✅ Mid-Roll Monetized (8+ Min)',
        severity: 'good',
        finding: `Video is ${this.formatDuration(durationSeconds)} long. Competitor is monetizing with multiple mid-roll ads.`,
        attackAdvantage: `Match their 8+ minute depth to stay competitive in watch-time velocity and ad revenue.`
      });
    }

    return weaknesses;
  }

  static extractSuggestedVideoAnchors(title, authorName) {
    const rawSegments = title.split(/[-–—|/:,•]/).map(s => s.trim().toLowerCase()).filter(s => s.length > 2 && s.length <= 40);
    const cleanAnchors = new Set(rawSegments);
    if (authorName) cleanAnchors.add(authorName.toLowerCase().trim());
    return {
      suggestedBridgeTags: Array.from(cleanAnchors),
      advice: `Copy these clean anchor tags into your own video's tags to signal to YouTube's algorithm to recommend your video under "${title}".`
    };
  }

  static detectContentVacuums(targetTopic, competitorTitle = '') {
    const lower = `${competitorTitle} ${targetTopic}`.toLowerCase();
    const isStory = /story|stories|kathalu|kahani|movie|animation|drama|episode|kids|bedtime/i.test(lower);
    const isTutorial = /how to|tutorial|course|learn|coding|guide|tips|setup|method/i.test(lower);

    let vacuumTemplates = [];
    if (isStory) {
      vacuumTemplates = [
        { suffix: 'part 2', reason: 'High demand for sequels; viewers search continuously for the next episode.' },
        { suffix: 'moral & meaning', reason: 'Parents and teachers search for moral lessons to explain to children.' },
        { suffix: 'full episode', reason: 'Viewers hate short clips and search for full-length uninterrupted stories.' },
        { suffix: 'kids animation', reason: 'High-volume search segment for family-friendly animated content.' }
      ];
    } else if (isTutorial) {
      vacuumTemplates = [
        { suffix: 'for beginners', reason: 'Entry-level viewers search for step-by-step guidance without complex jargon.' },
        { suffix: 'mistakes to avoid', reason: 'High-CTR query from viewers wanting to avoid common errors.' },
        { suffix: 'complete roadmap 2026', reason: 'Strong authority query for updated current-year frameworks.' },
        { suffix: 'free tools & resources', reason: 'High-intent search query for budget-conscious viewers.' }
      ];
    } else {
      vacuumTemplates = [
        { suffix: 'explained simply', reason: 'Broad audiences search for easy-to-understand explanations.' },
        { suffix: 'secrets nobody tells you', reason: 'High curiosity hook for non-obvious insights.' },
        { suffix: 'step by step', reason: 'Actionable query for viewers wanting structured steps.' },
        { suffix: 'best practices 2026', reason: 'Up-to-date guidance for current standards.' }
      ];
    }

    return vacuumTemplates.map(v => ({ topic: `${targetTopic} ${v.suffix}`, reason: v.reason }));
  }

  static estimateRevenueRange(views = 50000, niche = 'stories_animation', region = 'india', isMidrollEligible = false) {
    const safeViews = Math.max(1000, parseInt(views, 10) || 50000);
    const benchmark = NICHE_RPM_BENCHMARKS[niche] || NICHE_RPM_BENCHMARKS.stories_animation;
    const midrollMultiplier = isMidrollEligible ? 1.65 : 1.0;

    let lowRpm, highRpm;
    if (region === 'india') {
      lowRpm = benchmark.inrLow * midrollMultiplier;
      highRpm = benchmark.inrHigh * midrollMultiplier;

      const lowEst = Math.round((safeViews / 1000) * lowRpm);
      const highEst = Math.round((safeViews / 1000) * highRpm);
      const usdLow = Math.round(lowEst / 84);
      const usdHigh = Math.round(highEst / 84);

      return {
        views: safeViews.toLocaleString(),
        rangeText: `₹${lowEst.toLocaleString()} - ₹${highEst.toLocaleString()} ($${usdLow} - $${usdHigh})`,
        nicheName: benchmark.name,
        isMidrollEligible,
        multiplierText: isMidrollEligible ? '1.65× (8+ Min Mid-Roll Bonus Active)' : '1.0× (Standard Pre-Roll Only)',
        formulaExplainer: `Math: (${safeViews.toLocaleString()} views ÷ 1,000) × ₹${Math.round(lowRpm)}–₹${Math.round(highRpm)} RPM for ${benchmark.name}.`
      };
    } else {
      lowRpm = benchmark.usdLow * midrollMultiplier;
      highRpm = benchmark.usdHigh * midrollMultiplier;
      const lowEst = Math.round((safeViews / 1000) * lowRpm);
      const highEst = Math.round((safeViews / 1000) * highRpm);

      return {
        views: safeViews.toLocaleString(),
        rangeText: `$${lowEst.toLocaleString()} - $${highEst.toLocaleString()}`,
        nicheName: benchmark.name,
        isMidrollEligible,
        multiplierText: isMidrollEligible ? '1.65× (8+ Min Mid-Roll Bonus Active)' : '1.0× (Standard Pre-Roll Only)',
        formulaExplainer: `Math: (${safeViews.toLocaleString()} views ÷ 1,000) × $${lowRpm.toFixed(2)}–$${highRpm.toFixed(2)} RPM for ${benchmark.name}.`
      };
    }
  }
}