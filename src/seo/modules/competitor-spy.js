/**
 * TJP YouTube SEO Engine — Studio 2: Competitor Video Spy (Pure Intelligence Suite)
 * Module: src/seo/modules/competitor-spy.js
 * 
 * 100% Client-Side Engine ($0 APIs):
 *  - Multi-Engine Ingestion Pipeline (Invidious Public API Nodes + CORS Proxies + oEmbed)
 *  - Real Hidden Metadata Tags Extractor (<meta name="keywords"> & JSON keywords)
 *  - Competitor Weakness Diagnostic & Attack Blueprint (Mobile truncation, Missing chapters, Tag gaps)
 *  - Counter-Title Generator (3 Direct attack formulas to out-CTR this competitor)
 *  - "Up Next" Infiltration Bridge Tag Matcher
 *  - Description, Sponsor & External Link X-Ray
 *  - 8-Minute Mid-Roll Monetization Check & Niche RPM Economics
 *  - All-Resolution Thumbnail Kit (1080p, 720p, 480p)
 */

const NICHE_RPM_BENCHMARKS = {
  stories_animation: { name: 'Stories & Animation', inrLow: 30, inrHigh: 65, usdLow: 0.35, usdHigh: 0.75 },
  tech_tutorials: { name: 'Tech, AI & Tutorials', inrLow: 80, inrHigh: 180, usdLow: 1.00, usdHigh: 2.20 },
  finance_business: { name: 'Finance, Crypto & Business', inrLow: 150, inrHigh: 350, usdLow: 1.80, usdHigh: 4.20 },
  vlogs_entertainment: { name: 'Vlogs & Comedy', inrLow: 25, inrHigh: 55, usdLow: 0.30, usdHigh: 0.65 },
  gaming: { name: 'Gaming & Streaming', inrLow: 20, inrHigh: 45, usdLow: 0.25, usdHigh: 0.55 },
  education_jobs: { name: 'Education & Govt Jobs', inrLow: 45, inrHigh: 110, usdLow: 0.55, usdHigh: 1.30 }
};

const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net'
];

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
   * Main Inspection Pipeline with Multi-Engine Fallback
   */
  static async inspectCompetitorVideo(videoId) {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Tier 1: Try Invidious Public API Nodes (Fastest, unblocked JSON)
    for (const host of INVIDIOUS_INSTANCES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${host}/api/v1/videos/${videoId}`, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const json = await res.json();
          if (json && json.title) {
            return this.formatInvidiousData(json, videoId, targetUrl);
          }
        }
      } catch (err) {}
    }

    // Tier 2: Try Direct CORS Proxy Scrape for <meta name="keywords">
    try {
      const rawHtml = await this.fetchRawHtmlWithTimeout(targetUrl, 4000);
      if (rawHtml) {
        const parsed = this.parseRawYouTubeHtml(rawHtml, videoId, targetUrl);
        if (parsed && parsed.realTags.length > 0) {
          return { success: true, ...parsed, dataSource: 'raw_html_scrape' };
        }
      }
    } catch (err) {}

    // Tier 3: oEmbed Safety Fallback
    return await this.fetchOembedFallback(videoId, targetUrl);
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
      authorUrl: json.authorId ? `https://www.youtube.com/channel/${json.authorId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(json.author || '')}`,
      realTags: tags.length > 0 ? tags : this.extractFallbackAnchors(json.title || '', json.author || ''),
      description: description || 'No description provided.',
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

  static async fetchRawHtmlWithTimeout(targetUrl, timeoutMs = 4000) {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    for (const proxy of proxies) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(proxy, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('name="keywords"')) return text;
        }
      } catch (e) {}
    }
    return null;
  }

  static parseRawYouTubeHtml(html, videoId, targetUrl) {
    const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
    let title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Unknown Title';

    const authorMatch = html.match(/<link\s+itemprop="name"\s+content="([^"]*)"/i) || html.match(/"author":"([^"]*)"/i);
    const authorName = authorMatch ? authorMatch[1].trim() : 'Creator Channel';

    let realTags = [];
    const metaKeywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
    if (metaKeywordsMatch && metaKeywordsMatch[1]) {
      realTags = metaKeywordsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    }

    if (realTags.length === 0) {
      const jsonKeywordsMatch = html.match(/"keywords":\s*(\[[^\]]+\])/);
      if (jsonKeywordsMatch && jsonKeywordsMatch[1]) {
        try { realTags = JSON.parse(jsonKeywordsMatch[1]); } catch (e) {}
      }
    }

    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || html.match(/"shortDescription":"([^"]*)"/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
    const externalLinks = Array.from(new Set(description.match(/https?:\/\/[^\s]+/g) || []));
    const hashtags = Array.from(new Set(description.match(/#[\w\u0590-\u05ff\u0900-\u097f\u0c00-\u0c7f]+/gi) || []));

    const durationMatch = html.match(/"lengthSeconds":"(\d+)"/) || html.match(/itemprop="duration"\s+content="PT(?:(\d+)M)?(?:(\d+)S)?"/i);
    let durationSeconds = 0;
    if (durationMatch) {
      if (durationMatch[1] && durationMatch[2]) {
        durationSeconds = (parseInt(durationMatch[1], 10) * 60) + parseInt(durationMatch[2], 10);
      } else if (durationMatch[1]) {
        durationSeconds = parseInt(durationMatch[1], 10);
      }
    }

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
      isMidrollEligible: durationSeconds >= 480,
      thumbnailKit: this.getThumbnailKit(videoId),
      videoUrl: targetUrl
    };
  }

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

  static extractFallbackAnchors(title, authorName) {
    const rawSegments = title
      .split(/[-–—|/:,•]/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 2 && s.length <= 40);

    const clean = new Set(rawSegments);
    if (authorName) clean.add(authorName.toLowerCase().trim());
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
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  /* ==========================================================================
     PURE COMPETITOR INTELLIGENCE MODULES (Zero Dummy Fluff)
     ========================================================================== */

  /**
   * 1. Competitor Weakness Diagnostic (The Attack Audit)
   * Dissects competitor's metadata for flaws you can exploit.
   */
  static auditCompetitorWeaknesses(title, description, tags = [], durationSeconds = 0, targetTopic = '') {
    const weaknesses = [];

    // Flaw A: Mobile Title Cutoff Check
    if (title.length > 55) {
      const cutChar = title.slice(0, 52) + '...';
      const hiddenPercent = Math.round(((title.length - 52) / title.length) * 100);
      weaknesses.push({
        type: '❌ Mobile Cutoff Flaw',
        severity: 'critical',
        finding: `Competitor's title is ${title.length} characters long. On YouTube Mobile, viewers only see: "${cutChar}".`,
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

    // Flaw B: Description Chapters Check (Google Key Moments)
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

    // Flaw C: Tag Character Budget Saturation
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
        finding: `Competitor utilized their tag box well (${totalTagChars} / 500 chars).`,
        attackAdvantage: `Their tags are saturated. Use Studio 2's Infiltration Bridge to match their top 3 anchors and steal Suggested Video traffic.`
      });
    }

    // Flaw D: 8-Minute Mid-Roll Monetization Check
    if (durationSeconds > 0 && durationSeconds < 480) {
      weaknesses.push({
        type: '⚠️ Under 8 Minutes (No Mid-Rolls)',
        severity: 'warning',
        finding: `Video is only ${this.formatDuration(durationSeconds)} long. It does NOT qualify for YouTube mid-roll ads.`,
        attackAdvantage: `If you produce an 8+ minute in-depth video on this topic, your potential ad earnings will be 1.65× higher via mid-roll placements.`
      });
    }

    return weaknesses;
  }

  /**
   * 2. Counter-Title Generator (Designed to Beat Their Exact Video)
   * Crafts 3 direct psychological counter-attacks against this competitor's title.
   */
  static generateCounterTitles(competitorTitle, targetTopic) {
    const topic = targetTopic || competitorTitle.split(/[-–|/]/)[0].trim();
    const cleanTopic = topic.charAt(0).toUpperCase() + topic.slice(1);

    return [
      {
        strategy: '🔥 The Direct Contrarian (Exposes Flaws)',
        title: `Stop Doing ${cleanTopic} The Old Way: Do This Instead`,
        whyItWins: `Directly challenges the competitor's advice. Viewers click because they fear their current method is outdated or flawed.`
      },
      {
        strategy: '⚡ The Speed & Zero-Friction Hook',
        title: `${cleanTopic} in 8 Minutes: The Simple Blueprint Anyone Can Copy`,
        whyItWins: `Promises the same transformation as the competitor, but in less time and with zero confusion.`
      },
      {
        strategy: '📊 The Hard Proof & Data Hook',
        title: `I Tested ${cleanTopic} for 30 Days (Here Are The Real Results)`,
        whyItWins: `Beats the competitor's theoretical guide with real, undeniable empirical results and proof.`
      }
    ];
  }

  /**
   * 3. "Up Next" Infiltration Bridge Matcher
   * Isolates competitor's primary anchor tags to bridge your video into their sidebar.
   */
  static extractSuggestedVideoAnchors(title, authorName) {
    const rawSegments = title
      .split(/[-–—|/:,•]/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 2 && s.length <= 40);

    const cleanAnchors = new Set(rawSegments);
    if (authorName) cleanAnchors.add(authorName.toLowerCase().trim());

    if (cleanAnchors.size <= 1) {
      const words = title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      if (words.length >= 2) cleanAnchors.add(words.slice(0, 3).join(' '));
      if (words.length >= 4) cleanAnchors.add(words.slice(-3).join(' '));
    }

    return {
      suggestedBridgeTags: Array.from(cleanAnchors),
      advice: `Copy these 3–4 anchor tags into your own video's tags. This signals to YouTube's algorithm that your video is a direct thematic match, triggering placement in their "Suggested Videos" (Up Next) feed.`
    };
  }

  /**
   * 4. Niche-Adaptive Content Vacuums
   */
  static detectContentVacuums(targetTopic, competitorTitle = '') {
    const lower = `${competitorTitle} ${targetTopic}`.toLowerCase();
    const isStory = /story|stories|kathalu|kahani|movie|animation|drama|episode|kids|bedtime/i.test(lower);
    const isTutorial = /how to|tutorial|course|learn|coding|guide|tips|setup|method/i.test(lower);
    const isReview = /review|vs|comparison|unboxing|price|worth it|test|benchmark/i.test(lower);

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
    } else if (isReview) {
      vacuumTemplates = [
        { suffix: 'honest review after 30 days', reason: 'Viewers search for long-term reliability proof before buying.' },
        { suffix: 'pros and cons breakdown', reason: 'Decision-stage viewers look for balanced drawbacks.' },
        { suffix: 'is it worth it in 2026', reason: 'High-converting purchase query for current buyers.' },
        { suffix: 'vs alternatives comparison', reason: 'Viewers considering other competing options.' }
      ];
    } else {
      vacuumTemplates = [
        { suffix: 'explained simply', reason: 'Broad audiences search for easy-to-understand explanations.' },
        { suffix: 'secrets nobody tells you', reason: 'High curiosity hook for non-obvious insights.' },
        { suffix: 'step by step', reason: 'Actionable query for viewers wanting structured steps.' },
        { suffix: 'best practices 2026', reason: 'Up-to-date guidance for current standards.' }
      ];
    }

    return vacuumTemplates.map(v => ({
      topic: `${targetTopic} ${v.suffix}`,
      reason: v.reason
    }));
  }

  /**
   * 5. Real Niche-Based Revenue Economics
   */
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