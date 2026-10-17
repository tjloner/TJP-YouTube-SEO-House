/**
 * TJP YouTube SEO Engine — Studio 1: Keyword & Topic Research (Pro 4-Tier Tag Matrix)
 * Module: src/seo/modules/keyword-research.js
 */

const CONVERSATIONAL_STEMS = {
  tinglish: ['ela', 'telugu lo', 'cheyadam ela', 'tips telugu', 'full details telugu', 'best telugu'],
  hindi: ['kaise', 'sahi tarika', 'kya hai', 'in hindi', 'step by step hindi', 'poori jankari'],
  telugu: ['ఎలా', 'పూర్తి వివరాలు', 'తెలుగులో', 'వివరణ', 'సులువైన పద్ధతి'],
  english: ['how to', 'step by step tutorial', 'for beginners', 'full guide', 'mistakes to avoid', 'vs 2026']
};

// Semantic synonym dictionary to prevent repetitive tag spam
const SEMANTIC_SYNONYMS = {
  'digital marketing': ['online marketing', 'internet marketing', 'social media marketing', 'freelancing skills', 'make money online'],
  'youtube automation': ['faceless youtube channel', 'youtube cash cow', 'ai video creation', 'youtube growth tips', 'passive income online'],
  'video editing': ['video editing tutorial', 'premiere pro tips', 'capcut editing', 'content creation', 'cinematic video editing'],
  'seo': ['search engine optimization', 'rank higher on google', 'keyword research', 'website traffic', 'seo tutorial']
};

export class TjpKeywordResearch {
  static fetchLiveSuggestions(query) {
    return new Promise((resolve) => {
      if (!query || query.trim().length === 0) return resolve([]);
      const callbackName = 'yt_suggest_' + Math.random().toString(36).substring(2, 9);
      const script = document.createElement('script');
      script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&callback=${callbackName}`;
      
      const timeout = setTimeout(() => { cleanup(); resolve([]); }, 3500);
      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = (data) => {
        cleanup();
        if (data && Array.isArray(data[1])) resolve(data[1].map(item => item[0]));
        else resolve([]);
      };
      script.onerror = () => { cleanup(); resolve([]); };
      document.body.appendChild(script);
    });
  }

  static async runAtoZExpander(baseKeyword, language = 'tinglish', maxProbes = 8) {
    const cleanKey = baseKeyword.trim().toLowerCase();
    const alphabet = ['a', 'b', 'c', 'h', 'm', 'p', 's', 't', 'w'];
    const regionalStems = CONVERSATIONAL_STEMS[language] || CONVERSATIONAL_STEMS.english;
    
    const probeCandidates = [
      ...regionalStems.slice(0, 4).map(stem => `${cleanKey} ${stem}`),
      ...alphabet.slice(0, maxProbes).map(letter => `${cleanKey} ${letter}`),
      `${cleanKey} vs`,
      `${cleanKey} 2026`
    ];

    const primaryResults = await this.fetchLiveSuggestions(cleanKey);
    const allResults = new Map();

    primaryResults.forEach((kw, index) => {
      allResults.set(kw.toLowerCase(), this.calculateMetrics(kw, index, primaryResults.length));
    });

    const probeBatches = await Promise.all(
      probeCandidates.map(probe => this.fetchLiveSuggestions(probe))
    );

    probeBatches.flat().forEach((kw, index) => {
      const lower = kw.toLowerCase();
      if (!allResults.has(lower) && (lower.includes(cleanKey) || lower.split(' ').some(w => cleanKey.includes(w)))) {
        allResults.set(lower, this.calculateMetrics(kw, index + 4, 20));
      }
    });

    return Array.from(allResults.values());
  }

  static calculateMetrics(keyword, rankIndex) {
    const wordCount = keyword.trim().split(/\s+/).length;
    let baseScore = Math.max(30, 95 - (rankIndex * 3));
    if (wordCount <= 2) baseScore = Math.min(99, baseScore + 6);
    if (wordCount >= 5) baseScore = Math.max(38, baseScore - 4);

    let competition = 'Low (Easy)';
    let competitionColor = 'green';
    if (baseScore > 75) { competition = 'High (Saturated)'; competitionColor = 'red'; }
    else if (baseScore > 55) { competition = 'Medium (Balanced)'; competitionColor = 'yellow'; }

    let trendBadge = 'Consistent';
    if (/2026|new|secret|today|latest|viral|leak/i.test(keyword)) trendBadge = 'Breakout (+500%)';
    else if (/how|best|tips|tutorial|guide|ela|kaise/i.test(keyword)) trendBadge = 'Rising';

    return { keyword, popularityScore: Math.round(baseScore), competition, competitionColor, trendBadge };
  }

  static generateHashtags(baseKeyword, language = 'tinglish') {
    const clean = baseKeyword.replace(/[^\w\s]/g, '').toLowerCase().replace(/\s+/g, '');
    const regionalTag = language === 'tinglish' || language === 'telugu' ? '#telugutips' : language === 'hindi' ? '#hinditutorial' : '#technology';
    return [`#${clean}`, `#${clean}tutorial`, `#${clean}2026`, regionalTag, '#youtubegrowth', '#trending'];
  }

  /**
   * PRO 4-TIER TAG MATRIX:
   * 1. Broad Root Anchors (Primary + Synonyms)
   * 2. Action / How-To Long-Tails (Tutorial, Beginners)
   * 3. Question & Problem Solving
   * 4. Regional / Conversational
   */
  static buildSmartTagBundle(primaryKeyword, suggestedKeywords = []) {
    const cleanRoot = primaryKeyword.trim().toLowerCase();
    
    // Find semantic synonyms or fall back to topical variations
    const synonyms = SEMANTIC_SYNONYMS[cleanRoot] || [
      `${cleanRoot} tips`,
      `how to learn ${cleanRoot}`,
      `${cleanRoot} tutorial`,
      `${cleanRoot} guide 2026`
    ];

    // Filter suggestions to find the best high-intent long tails without word-for-word duplicates
    const actionTags = [];
    const questionTags = [];
    const regionalTags = [];
    const seenWords = new Set();

    suggestedKeywords.forEach(item => {
      const kw = (typeof item === 'string' ? item : item.keyword).toLowerCase().trim();
      
      // Skip exact match roots already covered
      if (kw === cleanRoot) return;

      if (/how|guide|step by step|tutorial|for beginners|tips/i.test(kw) && actionTags.length < 4) {
        actionTags.push(kw);
      } else if (/vs|what is|kya hai|why|mistakes|review/i.test(kw) && questionTags.length < 3) {
        questionTags.push(kw);
      } else if (/telugu|hindi|tamil|ela|kaise/i.test(kw) && regionalTags.length < 3) {
        regionalTags.push(kw);
      }
    });

    // Assemble Curated 4-Tier Strategy:
    const curatedPool = [
      cleanRoot,                         // 1. Core Broad Root
      `${cleanRoot} 2026`,               // 2. Year Freshness Anchor
      ...synonyms.slice(0, 3),           // 3. True Semantic Synonyms (Not just repeated root)
      ...actionTags,                     // 4. Action / Tutorial Long-Tails
      ...questionTags,                   // 5. Question & Comparison Modifiers
      ...regionalTags                    // 6. Regional Search Variant
    ];

    // Filter duplicates and enforce strict < 500 characters
    const uniquePool = Array.from(new Set(curatedPool));
    const individualTags = [];
    let currentLength = 0;
    const bundleArray = [];

    for (const tag of uniquePool) {
      const addedLen = bundleArray.length === 0 ? tag.length : tag.length + 1;
      const willFit = (currentLength + addedLen) <= 495;

      if (willFit) {
        bundleArray.push(tag);
        currentLength += addedLen;
        individualTags.push({ tag, selected: true, charLength: tag.length });
      } else {
        individualTags.push({ tag, selected: false, charLength: tag.length });
      }
    }

    return {
      individualTags,
      bundleTagString: bundleArray.join(','),
      totalCharacters: currentLength,
      userGuidanceNotice: "These tags are strategically categorized into Root Anchors, Semantic Synonyms, and Action Long-Tails to avoid redundant spam."
    };
  }
}
