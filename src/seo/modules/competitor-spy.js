/**
 * TJP YouTube SEO Engine — Studio 2: Competitor Video Spy (Pro Niche-Adaptive Engine)
 * Module: src/seo/modules/competitor-spy.js
 */

export class TjpCompetitorSpy {
  static extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = cleanUrl.match(regExp);
    return (match && match[1]) ? match[1] : null;
  }

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
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

      const data = await response.json();
      return {
        success: true,
        videoId,
        title: data.title || 'Unknown Title',
        authorName: data.author_name || 'Creator',
        authorUrl: data.author_url || '',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
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
   * Intelligently splits long titles on delimiters (-, |, /, :)
   * so tags are crisp (under 30 chars each) rather than 80-character giant strings.
   */
  static extractSuggestedVideoAnchors(title, authorName) {
    const rawSegments = title
      .split(/[-–—|/:,•]/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 2 && s.length <= 40);

    const cleanAnchors = new Set(rawSegments);
    if (authorName) cleanAnchors.add(authorName.toLowerCase().trim());

    // Fallback: if title had no delimiters, take 2-3 word chunks
    if (cleanAnchors.size <= 1) {
      const words = title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      if (words.length >= 2) cleanAnchors.add(words.slice(0, 3).join(' '));
      if (words.length >= 4) cleanAnchors.add(words.slice(-3).join(' '));
    }

    return {
      suggestedBridgeTags: Array.from(cleanAnchors),
      advice: `These clean anchor tags signal to YouTube's recommendation algorithm to recommend your video under "${title}".`
    };
  }

  /**
   * Niche-Adaptive Content Vacuum Detector:
   * Detects whether content is Entertainment/Story vs Tutorial/Business
   * so it NEVER suggests silly things like "Stories pricing"!
   */
  static detectContentVacuums(targetTopic, competitorTitle = '') {
    const lowerTitle = (competitorTitle + ' ' + targetTopic).toLowerCase();
    
    // Detect Niche:
    const isEntertainment = /story|stories|kathalu|kahani|movie|song|comedy|animation|drama|episode|kids/i.test(lowerTitle);

    let vacuumTopics = [];

    if (isEntertainment) {
      // Entertainment / Stories Vacuums
      vacuumTopics = [
        { suffix: 'part 2', reason: 'High demand for sequels; viewers always search for the continuation.' },
        { suffix: 'moral & meaning', reason: 'Parents and teachers search for moral explanations of stories.' },
        { suffix: 'full episode', reason: 'Viewers hate clips and search for uninterrupted full stories.' },
        { suffix: 'kids animation', reason: 'Massive audience segment searching specifically for child-friendly animation.' }
      ];
    } else {
      // Tutorial / Tech / Business Vacuums
      vacuumTopics = [
        { suffix: 'for beginners', reason: 'Entry-level viewers search for step-by-step guides without complex jargon.' },
        { suffix: 'mistakes to avoid', reason: 'High-CTR search query from viewers wanting to avoid losses.' },
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
   * Regional Audience Aware Revenue Guide:
   * Supports India Traffic (₹ / $) vs US / Tier-1 Traffic
   */
  static estimateRevenueRange(views = 50000, region = 'india') {
    const safeViews = Math.max(1000, parseInt(views, 10) || 50000);

    let lowCpm, highCpm, currencySymbol;

    if (region === 'india') {
      // Indian Audience RPM: ₹35 - ₹100 per 1k views ($0.40 - $1.20)
      lowCpm = 0.40;
      highCpm = 1.20;
      currencySymbol = '$';
    } else {
      // US / Tier 1 Audience RPM: $3.00 - $9.00
      lowCpm = 3.0;
      highCpm = 9.0;
      currencySymbol = '$';
    }

    const lowEst = Math.round((safeViews / 1000) * lowCpm);
    const highEst = Math.round((safeViews / 1000) * highCpm);

    const inrLow = Math.round(lowEst * 84);
    const inrHigh = Math.round(highEst * 84);

    return {
      views: safeViews.toLocaleString(),
      rangeText: region === 'india' 
        ? `₹${inrLow.toLocaleString()} - ₹${inrHigh.toLocaleString()} ($${lowEst} - $${highEst})`
        : `$${lowEst} - $${highEst}`,
      note: region === 'india'
        ? "Realistic Indian regional RPM benchmarks (₹35–₹100 per 1,000 views)."
        : "US / Tier-1 international audience CPM benchmarks ($3–$9 per 1,000 views)."
    };
  }

  /**
   * Niche-Adaptive Pinned Comments (Story vs Tutorial)
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