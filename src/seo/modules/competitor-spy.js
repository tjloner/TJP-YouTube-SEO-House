/**
 * TJP YouTube SEO Engine — Studio 2: Competitor Video Spy (Unbreakable Engine)
 * Module: src/seo/modules/competitor-spy.js
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
   * Universal Ingestion Engine:
   * Parses either raw pasted source or attempts automated extraction.
   */
  static async inspectCompetitorVideo(videoId, rawSourceText = '') {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Priority 1: Direct Raw Source Paste (100% Reliable Offline)
    if (rawSourceText && rawSourceText.trim().length > 10) {
      const parsed = this.parseRawSource(rawSourceText, videoId, targetUrl);
      if (parsed.realTags.length > 0 || parsed.title !== 'Unknown Title') {
        return { success: true, ...parsed, dataSource: 'direct_source_paste' };
      }
    }

    // Priority 2: Public oEmbed API
    return await this.fetchOembedFallback(videoId, targetUrl);
  }

  /**
   * Robust Source Parser: Handles full HTML or isolated snippets
   * e.g., name="keyword" content="..." or name="keywords" content="..."
   */
  static parseRawSource(rawText, videoId, targetUrl) {
    let title = 'Unknown Title';
    let authorName = 'Creator Channel';
    let realTags = [];
    let description = '';
    let durationSeconds = 0;

    // 1. Extract Tags (Matches name="keyword" or name="keywords" or "keywords": [...])
    const metaTagMatch = rawText.match(/(?:name|property)=["']keywords?["']\s+content=["']([^"']*)["']/i) ||
                         rawText.match(/content=["']([^"']*)["']\s+(?:name|property)=["']keywords?["']/i) ||
                         rawText.match(/keywords?=["']([^"']*)["']/i);

    if (metaTagMatch && metaTagMatch[1]) {
      realTags = metaTagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    }

    if (realTags.length === 0) {
      const jsonKeywords = rawText.match(/"keywords":\s*(\[[^\]]+\])/);
      if (jsonKeywords && jsonKeywords[1]) {
        try {
          const parsed = JSON.parse(jsonKeywords[1]);
          if (Array.isArray(parsed)) realTags = parsed.filter(Boolean);
        } catch (e) {}
      }
    }

    // 2. Extract Title
    const titleMatch = rawText.match(/<title>([^<]*)<\/title>/i) ||
                       rawText.match(/<meta\s+name=["']title["']\s+content=["']([^"']*)["']/i) ||
                       rawText.match(/"title":"([^"]*)"/);
    if (titleMatch) {
      title = titleMatch[1].replace(' - YouTube', '').trim();
    } else if (realTags.length > 0) {
      title = realTags[0]; // Fallback to first major tag
    }

    // 3. Extract Author / Channel
    const authorMatch = rawText.match(/<link\s+itemprop=["']name["']\s+content=["']([^"']*)["']/i) ||
                        rawText.match(/"author":"([^"]*)"/) ||
                        rawText.match(/"ownerChannelName":"([^"]*)"/);
    if (authorMatch) authorName = authorMatch[1].trim();

    // 4. Extract Duration (lengthSeconds or approxDurationMs)
    const lengthMatch = rawText.match(/"lengthSeconds":"(\d+)"/);
    const msMatch = rawText.match(/"approxDurationMs":"(\d+)"/);
    if (lengthMatch) {
      durationSeconds = parseInt(lengthMatch[1], 10);
    } else if (msMatch) {
      durationSeconds = Math.round(parseInt(msMatch[1], 10) / 1000);
    } else {
      const minSecMatch = rawText.match(/(\d{1,2}):(\d{2})/);
      if (minSecMatch) durationSeconds = (parseInt(minSecMatch[1], 10) * 60) + parseInt(minSecMatch[2], 10);
    }

    // 5. Extract Description
    const descMatch = rawText.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
                      rawText.match(/"shortDescription":"([^"]*)"/);
    if (descMatch) description = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

    const externalLinks = Array.from(new Set(description.match(/https?:\/\/[^\s]+/g) || []));
    const hashtags = Array.from(new Set(description.match(/#[\w\u0590-\u05ff\u0900-\u097f\u0c00-\u0c7f]+/gi) || []));

    return {
      videoId,
      title,
      authorName,
      authorUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(authorName)}`,
      realTags,
      description: description || 'Source snippet parsed successfully.',
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
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
      if (!response.ok) throw new Error('oEmbed unavailable');
      const data = await response.json();

      return {
        success: true,
        videoId,
        title: data.title || 'Unknown Title',
        authorName: data.author_name || 'Creator',
        authorUrl: data.author_url || '',
        realTags: this.extractFallbackAnchors(data.title || '', data.author_name || ''),
        description: 'Metadata restricted by YouTube. Paste the "name=keyword" line from view-source above for all 25+ real tags.',
        externalLinks: [],
        hashtags: [],
        durationSeconds: 0,
        formattedDuration: 'Paste source for duration',
        isMidrollEligible: false,
        thumbnailKit: this.getThumbnailKit(videoId),
        videoUrl: targetUrl,
        dataSource: 'oembed_basic'
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
    if (!seconds || seconds <= 0) return 'Under 8 Min';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  static detectGenre(text) {
    if (/story|stories|kathalu|kahani|movie|animation|drama|episode|kids|bedtime|moral|మజ్జిగ|బంగారు/i.test(text)) return 'story';
    if (/how to|tutorial|course|learn|coding|guide|tips|setup|method/i.test(text)) return 'tutorial';
    if (/review|vs|comparison|unboxing|price|worth it|test|benchmark/i.test(text)) return 'review';
    return 'general';
  }

  /**
   * GENRE & STORY SMART COUNTER-TITLES:
   * Generates native Telugu/narrative hooks for stories, proof hooks for tutorials!
   */
  static generateCounterTitles(competitorTitle, targetTopic) {
    const genre = this.detectGenre(`${competitorTitle} ${targetTopic}`);
    const isTelugu = /[\u0C00-\u0C7F]/.test(competitorTitle + ' ' + targetTopic);

    // Extract core story name (e.g. "బంగారు మజ్జిగ")
    const primaryName = competitorTitle.split(/[-–—|/]/)[0].trim();

    if (genre === 'story') {
      if (isTelugu) {
        return [
          {
            strategy: '🎬 పార్ట్ 2 / సీక్వెల్ హుక్ (High Demand)',
            title: `${primaryName} పార్ట్ 2 - Bangaru Majjiga Part 2 (New Telugu Moral Stories)`,
            whyItWins: 'ఈ కథ చూసిన ప్రేక్షకులు వెంటనే నెక్స్ట్ పార్ట్ కోసం సెర్చ్ చేస్తారు. ఈ టైటిల్ వాళ్ళని వెంటనే గ్రాబ్ చేస్తుంది.'
          },
          {
            strategy: '🎭 ఎవ్వరికీ తెలియని రహస్యం (Curiosity Twist)',
            title: `${primaryName} కథ లో అసలు నిజం (誰も知らない衝撃 The Untold Mystery)`,
            whyItWins: 'కథ తెలిసిన వాళ్ళు కూడా "ఇందులో ఏం కొత్త ట్విస్ట్ ఉంది?" అని ఆసక్తితో క్లిక్ చేస్తారు.'
          },
          {
            strategy: '💡 అసలైన నీతి & అర్ధం (Deep Moral Lesson)',
            title: `ఈ కథలో దాగి ఉన్న అసలైన నీతి ఇదే! (Moral Stories in Telugu 2026)`,
            whyItWins: 'తల్లిదండ్రులు, ఉపాధ్యాయులు మంచి మెసేజ్ ఉన్న కథల కోసం వెతికేటప్పుడు ఇది టాప్ లో ర్యాంక్ అవుతుంది.'
          }
        ];
      }

      // English / Global Story
      return [
        {
          strategy: '🎬 The Sequel / Next Chapter Hook',
          title: `${primaryName} Part 2: What Happened Next? (Complete Ending)`,
          whyItWins: 'Captures audience momentum. Viewers search continuously for continuation and sequels.'
        },
        {
          strategy: '🎭 The Untold Secret Twist',
          title: `${primaryName}: The Shocking Truth Nobody Told You`,
          whyItWins: 'Promises an unexpected twist or deeper perspective on the familiar tale.'
        },
        {
          strategy: '💡 The Real Moral Explained',
          title: `The Real Moral Behind The ${primaryName} Story (Explained)`,
          whyItWins: 'Attracts viewers searching for deeper meaning and educational value.'
        }
      ];
    }

    // Default Tutorial / Tech
    const cleanTopic = targetTopic.trim() || primaryName;
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

  static auditCompetitorWeaknesses(title, description, tags = [], durationSeconds = 0) {
    const weaknesses = [];

    // Mobile Cutoff Check
    if (title.length > 55) {
      const cutChar = title.slice(0, 52) + '...';
      const hiddenPercent = Math.round(((title.length - 52) / title.length) * 100);
      weaknesses.push({
        type: '❌ Mobile Cutoff Flaw',
        severity: 'critical',
        finding: `Competitor's title is ${title.length} characters long. On mobile phones, viewers only see: "${cutChar}".`,
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
    if (durationSeconds >= 480) {
      weaknesses.push({
        type: '✅ Mid-Roll Monetized (8+ Min)',
        severity: 'good',
        finding: `Video is ${this.formatDuration(durationSeconds)} long. Competitor is monetizing with multiple mid-roll ads.`,
        attackAdvantage: `Match their 8+ minute depth to stay competitive in watch-time velocity and ad revenue.`
      });
    } else if (durationSeconds > 0) {
      weaknesses.push({
        type: '⚠️ Under 8 Minutes (No Mid-Rolls)',
        severity: 'warning',
        finding: `Video is only ${this.formatDuration(durationSeconds)} long. It does NOT qualify for YouTube mid-roll ads.`,
        attackAdvantage: `If you produce an 8+ minute in-depth video on this topic, your potential ad earnings will be 1.65× higher via mid-roll placements.`
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
      advice: `Copy these 3–4 anchor tags into your own video's tags to signal to YouTube's algorithm to recommend your video under "${title}".`
    };
  }

  static detectContentVacuums(targetTopic, competitorTitle = '') {
    const lower = `${competitorTitle} ${targetTopic}`.toLowerCase();
    const isStory = /story|stories|kathalu|kahani|movie|animation|drama|episode|kids|bedtime|మజ్జిగ/i.test(lower);

    let vacuumTemplates = [];
    if (isStory) {
      vacuumTemplates = [
        { suffix: 'part 2', reason: 'High demand for sequels; viewers search continuously for the next episode.' },
        { suffix: 'moral & meaning', reason: 'Parents and teachers search for moral lessons to explain to children.' },
        { suffix: 'full episode', reason: 'Viewers hate short clips and search for full-length uninterrupted stories.' },
        { suffix: 'kids animation', reason: 'High-volume search segment for family-friendly animated content.' }
      ];
    } else {
      vacuumTemplates = [
        { suffix: 'for beginners', reason: 'Entry-level viewers search for step-by-step guidance without complex jargon.' },
        { suffix: 'mistakes to avoid', reason: 'High-CTR query from viewers wanting to avoid common errors.' },
        { suffix: 'complete roadmap 2026', reason: 'Strong authority query for updated current-year frameworks.' },
        { suffix: 'free vs paid comparison', reason: 'High-intent search query for decision-makers.' }
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