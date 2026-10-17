/**
 * TJP YouTube SEO Engine — Studio 2: Competitor Video Spy
 * Module: src/seo/modules/competitor-spy.js
 * 
 * 100% Client-Side Engine ($0 APIs):
 *  - YouTube URL & Shorts Ingestion
 *  - Private / Unlisted / Deleted Link Interceptor
 *  - 1-Click HD Thumbnail (1080p) & Asset Grabber
 *  - "Suggested Video" Tag Co-occurrence Matcher
 *  - Competitor Content Vacuum Detector
 *  - Estimated Video Revenue Guide
 *  - High-Engagement Pinned Comment Generator
 */

export class TjpCompetitorSpy {
  /**
   * Extracts clean 11-character Video ID from any YouTube URL format
   * (Regular, youtu.be, mobile, or YouTube Shorts).
   */
  static extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();

    // Standard watch?v=, embed/, shorts/, or youtu.be/
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = cleanUrl.match(regExp);
    return (match && match[1]) ? match[1] : null;
  }

  /**
   * Fetches public metadata using YouTube's zero-cost public oEmbed endpoint.
   * Intercepts Private, Deleted, or Geoblocked videos with clear warnings.
   */
  static async fetchPublicVideoMeta(videoId) {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;

    try {
      const response = await fetch(oembedEndpoint);

      if (response.status === 404 || response.status === 401) {
        return {
          success: false,
          error: 'This video is Private, Unlisted, or has been Deleted. YouTube hides its metadata from public search.'
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        videoId,
        title: data.title || 'Unknown Title',
        authorName: data.author_name || 'Creator',
        authorUrl: data.author_url || '',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        thumbnailFallback: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        embedHtml: data.html || '',
        videoUrl: targetUrl
      };
    } catch (err) {
      return {
        success: false,
        error: 'Unable to reach video metadata. Check if the YouTube link is valid and publicly accessible.'
      };
    }
  }

  /**
   * Isolates the competitor's primary anchor tags to bridge
   * your video into their "Suggested Videos" (Up Next) recommendation rail.
   */
  static extractSuggestedVideoAnchors(title, authorName) {
    const stopWords = new Set(['the', 'and', 'for', 'with', 'how', 'what', 'why', 'this', 'that', 'video', 'in', 'on', 'to']);
    const cleanTokens = title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    const anchors = [
      title.toLowerCase(),
      authorName.toLowerCase(),
      cleanTokens.slice(0, 3).join(' '),
      cleanTokens.slice(-2).join(' ')
    ].filter(Boolean);

    return {
      suggestedBridgeTags: Array.from(new Set(anchors)),
      advice: `Place these 2-3 anchor tags into your video metadata to signal to YouTube's recommendation algorithm that your content is a direct match for viewers watching "${title}".`
    };
  }

  /**
   * Compares competitor titles against your target keyword to find "Content Vacuums"
   * (high-demand topics your competitors completely skipped).
   */
  static detectContentVacuums(targetTopic, competitorTitles = []) {
    const targetTokens = new Set(targetTopic.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const competitorTokens = new Map();

    competitorTitles.forEach(t => {
      t.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).forEach(tok => {
        if (tok.length > 2) {
          competitorTokens.set(tok, (competitorTokens.get(tok) || 0) + 1);
        }
      });
    });

    const highTrafficTopics = [
      'beginner', 'step by step', 'pricing', 'mistakes', 'secrets',
      'full guide', 'results', 'proof', 'free', 'cost', 'review 2026'
    ];

    const vacuums = [];
    highTrafficTopics.forEach(topic => {
      const isMissingInCompetitors = !competitorTitles.some(t => t.toLowerCase().includes(topic));
      if (isMissingInCompetitors) {
        vacuums.push({
          topic: `${targetTopic} ${topic}`,
          reason: `None of the analyzed competitors covered "${topic}". Making a video or chapter on this gives you a clean content vacuum advantage.`
        });
      }
    });

    return vacuums.slice(0, 4);
  }

  /**
   * Estimates Video Ad Earnings Range using real-world YouTube CPM benchmarks ($2 - $12).
   */
  static estimateRevenueRange(views = 50000) {
    const safeViews = Math.max(1000, parseInt(views, 10) || 50000);
    const lowCpm = 2.0;   // Low CPM (Gaming, Entertainment)
    const midCpm = 5.5;   // Mid CPM (Tech, Education, Lifestyle)
    const highCpm = 12.0; // High CPM (Finance, B2B, SaaS)

    const lowEst = Math.round((safeViews / 1000) * lowCpm);
    const midEst = Math.round((safeViews / 1000) * midCpm);
    const highEst = Math.round((safeViews / 1000) * highCpm);

    return {
      views: safeViews.toLocaleString(),
      rangeText: `$${lowEst} - $${highEst}`,
      midpoint: `$${midEst}`,
      note: "Estimated ad revenue based on typical YouTube CPMs across Entertainment ($2/cpm) vs Tech/Finance ($12/cpm)."
    };
  }

  /**
   * Generates 3 High-Engagement Pinned Comment Templates
   * to drive early comment velocity (Debate, Timestamp Summary, Resource Link).
   */
  static generatePinnedComments(videoTitle, primaryKeyword) {
    return [
      {
        type: "🔥 The Debate Question (Highest Comment Velocity)",
        text: `Be honest: what is your biggest struggle when it comes to ${primaryKeyword}? Drop your thoughts below—I'm replying to everyone in the first 2 hours! 👇`
      },
      {
        type: "⏱️ The Highlight Chapter Jump",
        text: `📌 Quick Navigation:\n00:00 - The Core Problem\n02:15 - The Exact Strategy for ${primaryKeyword}\n06:40 - The #1 Mistake to Avoid\n\nWhich chapter helped you the most? Let me know below!`
      },
      {
        type: "🎁 The Resource / Free Checklist Pin",
        text: `Thanks for watching! If you want the complete step-by-step checklist mentioned in this video for ${primaryKeyword}, let me know in the comments and subscribe for next week's breakdown!`
      }
    ];
  }
}
