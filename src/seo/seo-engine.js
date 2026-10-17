/**
 * TJP YouTube SEO Engine — Core Algorithm
 * Module: src/seo/seo-engine.ts
 *
 * Capabilities:
 *  - Deterministic Intent Clustering (Informational, Transactional, Navigational, Curiosity)
 *  - Competitor Gap Analysis (Token extraction & vacuum identification)
 *  - Phonetic & Vernacular Variant Synthesizer (Hinglish/transliterated phonetic shifts)
 *  - 5-Tier Psychological Title Matrix
 *  - Compliant YouTube Description & Tag Distribution (<= 500 chars)
 */
/* ==========================================================================
   2. CONSTANTS & LEXICAL MATRICES
   ========================================================================== */
const STOPWORDS = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'in', 'and', 'or', 'for',
    'to', 'how', 'what', 'why', 'with', 'from', 'by', 'this', 'that', 'you',
    'your', 'i', 'my', 'video', 'channel', 'watch'
]);
const VERNACULAR_PHONETIC_PAIRS = [
    [/kaise\s+kare[n]?/gi, 'how to'],
    [/kya\s+hai/gi, 'explained'],
    [/sahi\s+tarika/gi, 'best method'],
    [/ph/gi, 'f'],
    [/ee/gi, 'i'],
    [/oo/gi, 'u'],
    [/guide/gi, 'tutorial'],
    [/review/gi, 'sach']
];
/* ==========================================================================
   3. INTERNAL ALGORITHMIC HELPERS
   ========================================================================== */
/**
 * Tokenizes text, strips special characters, eliminates stopwords.
 */
function cleanTokens(rawText) {
    return rawText
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 2 && !STOPWORDS.has(t));
}
/**
 * Categorizes primary intent using trigger tokens.
 */
function detectIntent(keyword) {
    const lower = keyword.toLowerCase();
    if (/vs|best|top|worth it|price|review|compare/i.test(lower))
        return 'commercial';
    if (/stop|secret|never|exposed|myth|truth|why i/i.test(lower))
        return 'curiosity';
    if (/guide|complete|masterclass|course|framework|blueprint/i.test(lower))
        return 'authority';
    if (/fix|error|solve|avoid|fast|easy|in \d+ (minutes|steps)/i.test(lower))
        return 'problem-solution';
    return 'informational';
}
/**
 * Extracts Content Vacuums (Tokens present in competitors but absent in target).
 */
function extractContentGaps(targetKeyword, competitorSnippets) {
    const targetTokens = new Set(cleanTokens(targetKeyword));
    const frequencyMap = new Map();
    competitorSnippets.forEach(snippet => {
        const tokens = cleanTokens(snippet);
        tokens.forEach(tok => {
            if (!targetTokens.has(tok)) {
                frequencyMap.set(tok, (frequencyMap.get(tok) || 0) + 1);
            }
        });
    });
    const gaps = [];
    frequencyMap.forEach((count, token) => {
        if (count >= 2) {
            gaps.push({
                keyword: token,
                frequencyInCompetitors: count,
                gapSeverity: count >= 4 ? 'critical' : count === 3 ? 'moderate' : 'opportunity',
                recommendedPlacement: count >= 4 ? 'title' : 'description'
            });
        }
    });
    return gaps.sort((a, b) => b.frequencyInCompetitors - a.frequencyInCompetitors).slice(0, 8);
}
/**
 * Produces Vernacular/Phonetic transliteration variants for non-English/hybrid searches.
 */
function generatePhoneticVariants(baseKeyword) {
    const variants = new Set();
    const lower = baseKeyword.toLowerCase();
    // Pattern swaps
    for (const [regex, replacement] of VERNACULAR_PHONETIC_PAIRS) {
        if (regex.test(lower)) {
            variants.add(lower.replace(regex, replacement).trim());
        }
    }
    // Common phonetic phonetic transliterations (e.g., soundex-adjacent spelling shifts)
    variants.add(`${lower} kaise kare`);
    variants.add(`${lower} step by step tutorial`);
    variants.add(`${lower} secret tricks`);
    return Array.from(variants).filter(v => v !== lower).slice(0, 5);
}
/**
 * Compiles tag sets ensuring the 500-character YouTube boundary is never exceeded.
 */
function buildTagCloud(targetKeyword, phonetic, gaps) {
    const broadAnchors = [targetKeyword, `${targetKeyword} 2026`];
    const topicalLongTail = [
        `how to master ${targetKeyword}`,
        `${targetKeyword} strategy`,
        `${targetKeyword} for beginners`,
        `best ${targetKeyword} tutorial`
    ];
    const gapTags = gaps.map(g => `${targetKeyword} ${g.keyword}`);
    const combinedSet = new Set();
    const pool = [
        ...broadAnchors,
        ...topicalLongTail,
        ...phonetic,
        ...gapTags
    ];
    let currentLength = 0;
    const acceptedTags = [];
    for (const candidate of pool) {
        const cleaned = candidate.trim().toLowerCase();
        // +1 for the comma separator
        const additionalLen = acceptedTags.length === 0 ? cleaned.length : cleaned.length + 1;
        if (currentLength + additionalLen <= 495 && !combinedSet.has(cleaned)) {
            combinedSet.add(cleaned);
            acceptedTags.push(cleaned);
            currentLength += additionalLen;
        }
    }
    return {
        broadAnchors,
        topicalLongTail,
        phoneticVariants: phonetic,
        competitorGaps: gapTags,
        combinedTagString: acceptedTags.join(','),
        charCount: currentLength
    };
}
/**
 * Generates 5 psychological hook titles.
 */
function generateTitles(keyword, intent) {
    const capKey = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    return [
        {
            tier: 'Curiosity Gap',
            title: `The Real Reason Nobody Talks About ${capKey} (Shocking Data)`,
            hookScore: 94,
            intent: 'curiosity'
        },
        {
            tier: 'Metric / Proof',
            title: `I Tested ${capKey} for 30 Days (Here Are The Exact Results)`,
            hookScore: 91,
            intent: 'commercial'
        },
        {
            tier: 'Authority Blueprint',
            title: `The Complete ${capKey} Masterclass for 2026 (Zero to Pro)`,
            hookScore: 89,
            intent: 'authority'
        },
        {
            tier: 'Contrarian Alert',
            title: `Stop Doing ${capKey} The Old Way: Do This Instead`,
            hookScore: 96,
            intent: 'problem-solution'
        },
        {
            tier: 'Zero-Friction',
            title: `${capKey} in 7 Minutes: The Simple Blueprint Anyone Can Copy`,
            hookScore: 88,
            intent: 'informational'
        }
    ];
}
/**
 * Creates dynamic timestamps based on video duration.
 */
function buildTimestamps(keyword, durationMinutes = 10) {
    const safeDuration = Math.max(3, durationMinutes);
    const part = Math.floor(safeDuration / 4);
    return [
        { time: '00:00', label: `Why most people fail with ${keyword}` },
        { time: `0${Math.min(1, part)}:30`, label: `The Core Framework Explained` },
        { time: `0${part * 2}:15`, label: `Step-by-Step Implementation & Proof` },
        { time: `0${part * 3}:45`, label: `Common Traps & Content Vacuums to Avoid` },
        { time: `0${safeDuration - 1}:10`, label: `Summary & Next Steps` }
    ];
}
/**
 * Generates description metadata.
 */
function buildDescription(keyword, timestamps, gaps) {
    const gapKeywords = gaps.slice(0, 5).map(g => g.keyword);
    const hookLine = `Master ${keyword} with this complete, data-backed step-by-step breakdown.`;
    const executiveSummary = `In this video, we uncover the exact mechanics of ${keyword}. If you want to avoid common mistakes and dominate your niche, follow this framework.`;
    const callToAction = `Subscribe for more verified growth strategies and drop your questions about ${keyword} below.`;
    const formattedDescription = [
        hookLine,
        '',
        '📌 SUMMARY:',
        executiveSummary,
        '',
        '⏱️ CHAPTER TIMESTAMPS:',
        ...timestamps.map(t => `${t.time} - ${t.label}`),
        '',
        '🔍 KEY CONCEPTS COVERED:',
        gapKeywords.map(k => `• ${k}`).join('\n') || `• ${keyword} fundamentals`,
        '',
        callToAction
    ].join('\n');
    return {
        hookLine,
        executiveSummary,
        suggestedTimestamps: timestamps,
        semanticKeywordsBlock: gapKeywords,
        callToAction,
        formattedDescription
    };
}
/* ==========================================================================
   4. PRIMARY ENGINE FACADE
   ========================================================================== */
export class TjpSeoEngine {
    /**
     * Main entry point to analyze keywords and competitor snippets client-side.
     */
    static analyze(input) {
        const startTime = performance.now();
        try {
            if (!input.targetKeyword || input.targetKeyword.trim().length === 0) {
                return {
                    success: false,
                    error: 'Target keyword is required to initiate analysis.',
                    executionTimeMs: performance.now() - startTime
                };
            }
            const cleanKey = input.targetKeyword.trim();
            const competitorPool = [
                ...(input.competitorTitles || []),
                ...(input.competitorDescriptions || [])
            ];
            // 1. Intent Detection
            const intent = detectIntent(cleanKey);
            // 2. Competitor Content Gap Extraction
            const contentGaps = extractContentGaps(cleanKey, competitorPool);
            // 3. Phonetic & Vernacular Variations
            const phoneticVariants = generatePhoneticVariants(cleanKey);
            // 4. Tag Allocation System (Strict YouTube <=500 chars)
            const tags = buildTagCloud(cleanKey, phoneticVariants, contentGaps);
            // 5. Psychological Titles Matrix
            const titles = generateTitles(cleanKey, intent);
            // 6. Description & Dynamic Timestamps
            const timestamps = buildTimestamps(cleanKey, input.videoDurationMinutes ?? 10);
            const description = buildDescription(cleanKey, timestamps, contentGaps);
            // 7. Tactical Strategic Brief
            const strategyBrief = {
                recommendedPacing: 'Fast-paced intro (<= 30s) addressing the core curiosity hook immediately.',
                thumbnailVisualCue: `High-contrast red (#fd5d5d) highlight over the primary metric. Avoid cluttered text.`,
                retentionHook: `Tease the common mistake outlined at ${timestamps[3]?.time || 'mid-video'} within the first 15 seconds.`
            };
            const output = {
                intent,
                titles,
                contentGaps,
                tags,
                description,
                strategyBrief
            };
            return {
                success: true,
                data: output,
                executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown internal engine error';
            return {
                success: false,
                error: `Engine execution failed: ${message}`,
                executionTimeMs: performance.now() - startTime
            };
        }
    }
}
