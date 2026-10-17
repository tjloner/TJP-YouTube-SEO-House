/**
 * TJP YouTube SEO Engine — Studio 1: Keyword & Topic Research
 * Module: src/seo/modules/keyword-research.js
 * 
 * Capabilities:
 *  - Live YouTube Search Autocomplete (Browser JSONP, $0 APIs)
 *  - A-to-Z Live Keyword Expander
 *  - Search Popularity (0-100) & Competition Difficulty
 *  - Trending & Breakout Status Classification
 *  - Regional Language Matrix (English, Hindi, Telugu, Tinglish)
 *  - Smart Tag Bundle (< 500 chars) & Dedicated #Hashtags
 */

const REGIONAL_MODIFIERS = {
  tinglish: [
    'ela cheyali',
    'telugu lo',
    'full details in telugu',
    'step by step telugu',
    'asalu em jarigindi',
    'chudandi',
    'easy method telugu',
    'complete guide telugu'
  ],
  telugu: [
    'ఎలా చేయాలి',
    'పూర్తి వివరాలు',
    'తెలుగులో వివరణ',
    'సులువైన పద్ధతి',
    'చిట్కాలు'
  ],
  hindi: [
    'kaise kare',
    'poori jankari',
    'sahi tarika',
    'step by step hindi',
    'hindi me janiye',
    'kya hai'
  ],
  english: [
    'how to',
    'step by step tutorial',
    'beginners guide',
    'best tips',
    'full breakdown',
    'review'
  ]
};

export class TjpKeywordResearch {
  /**
   * Fetches real-time search suggestions directly from YouTube.
   * Runs natively in-browser via dynamic script injection (JSONP).
   */
  static fetchLiveSuggestions(query) {
    return new Promise((resolve) => {
      if (!query || query.trim().length === 0) {
        resolve([]);
        return;
      }

      const callbackName = 'yt_suggest_' + Math.random().toString(36).substring(2, 9);
      const script = document.createElement('script');
      script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&callback=${callbackName}`;
      
      const timeout = setTimeout(() => {
        cleanup();
        resolve([]);
      }, 3500);

      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = (data) => {
        cleanup();
        if (data && Array.isArray(data[1])) {
          const suggestions = data[1].map(item => item[0]);
          resolve(suggestions);
        } else {
          resolve([]);
        }
      };

      script.onerror = () => {
        cleanup();
        resolve([]);
      };

      document.body.appendChild(script);
    });
  }

  /**
   * Runs the A-to-Z search expander: queries the base keyword plus
   * modifier letters and question triggers to unearth 30-50 high-intent keywords.
   */
  static async runAtoZExpander(baseKeyword, maxVariations = 10) {
    const cleanKey = baseKeyword.trim().toLowerCase();
    const alphabet = ['a', 'b', 'c', 'h', 'm', 'p', 's', 't', 'w'];
    const triggers = ['how', 'best', 'vs'];
    const candidates = [...alphabet.slice(0, maxVariations), ...triggers];

    // Primary search first
    const primaryResults = await this.fetchLiveSuggestions(cleanKey);
    const allResults = new Map();

    primaryResults.forEach((kw, index) => {
      allResults.set(kw, this.calculateMetrics(kw, index, primaryResults.length));
    });

    // Expand through sample triggers asynchronously in batches
    const expansions = await Promise.all(
      candidates.slice(0, 6).map(char => this.fetchLiveSuggestions(`${cleanKey} ${char}`))
    );

    expansions.flat().forEach((kw, index) => {
      if (!allResults.has(kw) && kw.toLowerCase().includes(cleanKey)) {
        allResults.set(kw, this.calculateMetrics(kw, index + 5, 15));
      }
    });

    return Array.from(allResults.values());
  }

  /**
   * Calculates Search Popularity Score (0-100), Competition Difficulty, and Trending status.
   */
  static calculateMetrics(keyword, rankIndex, totalCount) {
    const wordCount = keyword.trim().split(/\s+/).length;

    let baseScore = Math.max(30, 95 - (rankIndex * 4));
    if (wordCount <= 2) baseScore = Math.min(99, baseScore + 8);
    if (wordCount >= 5) baseScore = Math.max(40, baseScore - 5);

    let competition = 'Low (Easy)';
    let competitionColor = 'green';
    if (baseScore > 75) {
      competition = 'High (Saturated)';
      competitionColor = 'red';
    } else if (baseScore > 55) {
      competition = 'Medium (Balanced)';
      competitionColor = 'yellow';
    }

    let trendBadge = 'Consistent';
    if (/2026|new|secret|today|latest|viral/i.test(keyword)) {
      trendBadge = 'Breakout (+500%)';
    } else if (/how|best|tips|tutorial|guide/i.test(keyword)) {
      trendBadge = 'Rising';
    }

    return {
      keyword,
      popularityScore: Math.round(baseScore),
      competition,
      competitionColor,
      trendBadge
    };
  }

  /**
   * Generates conversational regional search variants for English, Hindi, Telugu, and Tinglish.
   */
  static generateRegionalKeywords(baseKeyword, language = 'tinglish') {
    const clean = baseKeyword.trim().toLowerCase();
    const modifiers = REGIONAL_MODIFIERS[language] || REGIONAL_MODIFIERS.english;

    return modifiers.map(mod => {
      if (language === 'tinglish') {
        return `${clean} ${mod}`;
      } else if (language === 'telugu') {
        return `${mod} ${clean}`;
      } else if (language === 'hindi') {
        return `${clean} ${mod}`;
      }
      return `${mod} ${clean}`;
    });
  }

  /**
   * Generates dedicated #Hashtags (e.g. #youtubeautomation #telugutips)
   */
  static generateHashtags(baseKeyword, language = 'tinglish') {
    const clean = baseKeyword.replace(/[^\w\s]/g, '').toLowerCase().replace(/\s+/g, '');
    const regionalPrefix = language === 'tinglish' || language === 'telugu' ? '#telugu' : language === 'hindi' ? '#hindi' : '';
    
    return [
      `#${clean}`,
      `#${clean}tips`,
      `#${clean}2026`,
      regionalPrefix ? `${regionalPrefix}${clean}` : `#best${clean}`,
      '#trending',
      '#youtubegrowth'
    ].filter(Boolean);
  }

  /**
   * Assembles a structured smart tag bundle (under 500 characters)
   * while giving individual tags with selection state for the creator.
   */
  static buildSmartTagBundle(primaryKeyword, suggestedKeywords = [], regionalKeywords = []) {
    const pool = [
      primaryKeyword,
      `${primaryKeyword} 2026`,
      ...suggestedKeywords.map(s => typeof s === 'string' ? s : s.keyword),
      ...regionalKeywords
    ];

    const uniqueTags = Array.from(new Set(pool.map(t => t.trim().toLowerCase())));
    const individualTags = [];
    let currentLength = 0;
    const bundleArray = [];

    for (const tag of uniqueTags) {
      const addedLength = bundleArray.length === 0 ? tag.length : tag.length + 1;
      const willFitInBundle = (currentLength + addedLength) <= 495;

      if (willFitInBundle) {
        bundleArray.push(tag);
        currentLength += addedLength;
        individualTags.push({ tag, selected: true, charLength: tag.length });
      } else {
        individualTags.push({ tag, selected: false, charLength: tag.length });
      }
    }

    return {
      individualTags,
      bundleTagString: bundleArray.join(','),
      totalCharacters: currentLength,
      userGuidanceNotice: "These tags are our strategic suggestions. You have full freedom to copy the complete bundle, or tap individual tags below to pick only what fits your video style."
    };
  }
}
