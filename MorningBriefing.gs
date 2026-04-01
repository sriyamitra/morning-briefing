// ============================================================
//  ☕ MORNING BRIEFING — Google Apps Script (v6)
//  Uses: Gemini 2.5 Flash (free) + Google News RSS (free)
//
//  SETUP INSTRUCTIONS:
//  ─────────────────────────────────────────────────────────
//  1. Get your FREE Gemini API key (no credit card needed):
//       → Go to https://aistudio.google.com
//       → Click "Get API Key" → "Create API Key"
//       → Copy the key (starts with AIzaSy...)
//
//  2. Go to https://script.google.com → New Project
//     Paste this entire file, replacing any existing code
//
//  3. Replace YOUR_GEMINI_API_KEY below with your key
//
//  4. Click ⚙️ Project Settings → Time zone → America/Los_Angeles
//
//  5. Select "setupDailyTrigger" from dropdown → ▶ Run
//     (Grant permissions when prompted)
//
//  ✅ Done! Email arrives every day at 6 AM PT.
//  💡 To test right now: select "sendTestEmail" → ▶ Run
// ============================================================

const CONFIG = {
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",  // ← paste your key here
  TO_EMAIL:       "sriya.mitra697@gmail.com",
  MODEL:          "gemini-2.5-flash",
  MAX_AGE_HOURS:  24,   // only include articles published in last 24 hours
};

// RSS feeds — free, no key needed
// AI uses 3 focused queries merged together to get fresh, varied coverage
const RSS_FEEDS = {
  world: ["https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en"],
  india: ["https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en"],
  ai: [
    "https://news.google.com/rss/search?q=artificial+intelligence+when:1d&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=OpenAI+OR+Anthropic+OR+Gemini+OR+ChatGPT+when:1d&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=AI+model+machine+learning+when:1d&hl=en-US&gl=US&ceid=US:en",
  ],
};

// ─────────────────────────────────────────────────────────────
//  MAIN — runs automatically every day at 6 AM PT
// ─────────────────────────────────────────────────────────────
function sendMorningBriefing() {
  try {
    Logger.log("📰 Fetching news from RSS feeds...");
    const worldRaw = fetchAndMergeFeeds(RSS_FEEDS.world, 10);
    const indiaRaw = fetchAndMergeFeeds(RSS_FEEDS.india, 10);
    const aiRaw    = fetchAndMergeFeeds(RSS_FEEDS.ai,    15);  // more headroom since we merge 3 feeds

    Logger.log(`  World: ${worldRaw.length} | India: ${indiaRaw.length} | AI: ${aiRaw.length} articles`);

    Logger.log("🤖 Summarising with Gemini...");
    const worldNews = summariseWithGemini("World / Global", worldRaw);
    const indiaNews = summariseWithGemini("India",          indiaRaw);
    const aiNews    = summariseWithGemini("AI & Technology", aiRaw);

    Logger.log("📧 Building and sending email...");
    const html    = buildEmailHTML(worldNews, indiaNews, aiNews);
    const today   = Utilities.formatDate(new Date(), "America/Los_Angeles", "EEEE, MMMM d, yyyy");
    const subject = `☕ Your Morning Briefing — ${today}`;

    GmailApp.sendEmail(CONFIG.TO_EMAIL, subject, "", { htmlBody: html });
    Logger.log("✅ Sent to " + CONFIG.TO_EMAIL);

  } catch (err) {
    Logger.log("❌ Fatal error: " + err.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  FETCH — merge multiple RSS URLs, deduplicate, filter by age
// ─────────────────────────────────────────────────────────────
function fetchAndMergeFeeds(urls, limit) {
  const seen    = new Set();
  const results = [];
  const cutoff  = new Date(Date.now() - CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000);

  for (const url of urls) {
    try {
      const xml   = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText();
      const doc   = XmlService.parse(xml);
      const items = doc.getRootElement().getChild("channel").getChildren("item");

      for (const item of items) {
        const title   = item.getChildText("title") || "";
        const link    = item.getChildText("link")  || "";
        const pubDate = item.getChildText("pubDate");

        // Deduplicate by title (normalised)
        const key = title.toLowerCase().replace(/\s+/g, " ").trim();
        if (seen.has(key)) continue;
        seen.add(key);

        // Filter out stale articles if pubDate is available
        if (pubDate) {
          const articleDate = new Date(pubDate);
          if (!isNaN(articleDate) && articleDate < cutoff) continue;
        }

        results.push({ title, link });
        if (results.length >= limit) break;
      }
    } catch (e) {
      Logger.log(`⚠️ Failed to fetch ${url}: ${e.message}`);
    }
    if (results.length >= limit) break;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
//  GEMINI SUMMARISER — 3-layer fallback
//
//  Layer 1: JSON mode, 3000 tokens          (clean path)
//  Layer 2: Plain text mode, 4096 tokens    (if Layer 1 fails)
//  Layer 3: Raw RSS headlines as-is         (guaranteed delivery)
// ─────────────────────────────────────────────────────────────
function summariseWithGemini(category, headlines) {

  // Layer 1 — JSON mode
  const result1 = tryGeminiCall(category, headlines, "application/json", 3000);
  if (result1) return result1;

  // Layer 2 — plain text, more tokens
  Logger.log(`⚠️ [${category}] Layer 1 failed, retrying without JSON mode...`);
  const result2 = tryGeminiCall(category, headlines, null, 4096);
  if (result2) return result2;

  // Layer 3 — use raw headlines, no Gemini
  Logger.log(`⚠️ [${category}] Both Gemini attempts failed, falling back to raw headlines.`);
  return headlines.slice(0, 5).map(h => ({
    headline: h.title.split(" - ")[0].trim(),
    summary:  "Tap the headline to read the full story.",
    link:     h.link,
  }));
}

function tryGeminiCall(category, headlines, mimeType, maxTokens) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const headlineText = headlines
      .map((h, i) => `ID: ${i}\nTitle: ${h.title}`)
      .join("\n\n");

    const prompt = `You are a friendly news summariser. Here are today's top ${category} headlines.

Pick the 5 most important and DISTINCT stories (no duplicates or near-duplicates).
Return ONLY a JSON array, no markdown, no extra text:
[
  {"id": 0, "headline": "Short headline under 8 words", "summary": "One friendly sentence about what happened."},
  ...
]

Headlines:
${headlineText}`;

    const genConfig = { temperature: 0.3, maxOutputTokens: maxTokens };
    if (mimeType) genConfig.responseMimeType = mimeType;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: genConfig,
    };

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const data = JSON.parse(response.getContentText());

    if (data.error) {
      Logger.log(`[${category}] Gemini API error: ${data.error.message}`);
      return null;
    }

    const finishReason = data.candidates?.[0]?.finishReason;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (finishReason === "MAX_TOKENS") {
      Logger.log(`⚠️ [${category}] MAX_TOKENS hit, attempting partial recovery...`);
      return recoverPartialJSON(raw, headlines);
    }

    const cleaned = raw.replace(/```json|```/g, "").trim();
    try {
      return mapResults(JSON.parse(cleaned), headlines);
    } catch (_) {}

    const start = cleaned.indexOf("[");
    const end   = cleaned.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      try {
        return mapResults(JSON.parse(cleaned.slice(start, end + 1)), headlines);
      } catch (_) {}
    }

    Logger.log(`[${category}] Could not parse response: ${cleaned.slice(0, 150)}`);
    return null;

  } catch (e) {
    Logger.log(`[${category}] Exception: ${e.message}`);
    return null;
  }
}

function mapResults(parsed, headlines) {
  return parsed.map(item => ({
    headline: item.headline,
    summary:  item.summary,
    link:     headlines[item.id]?.link || "#",
  }));
}

function recoverPartialJSON(raw, headlines) {
  const regex = /\{\s*"id"\s*:\s*(\d+)\s*,\s*"headline"\s*:\s*"([^"]+)"\s*,\s*"summary"\s*:\s*"([^"]+)"\s*\}/g;
  const results = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const id = parseInt(match[1]);
    results.push({
      headline: match[2],
      summary:  match[3],
      link:     headlines[id]?.link || "#",
    });
  }
  if (results.length > 0) {
    Logger.log(`Recovered ${results.length} items from truncated response.`);
    return results;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
//  BUILD HTML EMAIL
// ─────────────────────────────────────────────────────────────
function buildEmailHTML(worldNews, indiaNews, aiNews) {
  const today = Utilities.formatDate(
    new Date(), "America/Los_Angeles", "EEEE, MMMM d, yyyy"
  ).toUpperCase();

  function esc(str) {
    return (str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderRows(items) {
    return items.map(item => `
      <p style="font-family:Georgia,serif; font-size:14px; line-height:1.8; color:#1a1209;
                border-bottom:1px solid #ede8e0; padding:9px 0; margin:0;">
        <strong><a href="${esc(item.link)}" style="color:#c0392b; text-decoration:none;">
          ${esc(item.headline)}</a>:</strong> ${esc(item.summary)}
      </p>`).join("");
  }

  function section(emoji, label, items) {
    return `
      <tr><td style="padding-top:24px;">
        <p style="font-size:10px; letter-spacing:3px; text-transform:uppercase;
                  color:#c0392b; font-family:sans-serif; margin:0 0 10px; font-weight:600;">
          ${emoji}&nbsp; ${label}
        </p>
        ${renderRows(items)}
      </td></tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:20px; background:#faf7f2;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="background:#ffffff; border:1px solid #d6cfc4; padding:36px 40px;
         box-shadow:4px 4px 0 #d6cfc4; max-width:580px;">

  <!-- Masthead -->
  <tr><td style="text-align:center; padding-bottom:4px;">
    <p style="font-size:10px; letter-spacing:4px; font-family:sans-serif; color:#7a6e62;
              margin:0 0 8px; text-transform:uppercase;">— Daily Edition —</p>
    <h1 style="font-family:Georgia,serif; font-size:2rem; margin:0; color:#1a1209;">
      ☕ Morning Briefing
    </h1>
    <p style="font-size:10px; letter-spacing:2.5px; font-family:sans-serif; color:#7a6e62;
              margin:8px 0 0; text-transform:uppercase;">${today}</p>
  </td></tr>

  <tr><td style="padding:18px 0 4px;">
    <hr style="border:none; border-top:3px double #1a1209; margin:0;">
  </td></tr>

  ${section("&#127757;", "World News", worldNews)}
  ${section("&#127470;&#127475;", "India News", indiaNews)}
  ${section("&#129302;", "AI & Tech", aiNews)}

  <tr><td style="padding-top:28px; text-align:center;">
    <hr style="border:none; border-top:1px solid #d6cfc4; margin:0 0 14px;">
    <p style="font-size:11px; color:#7a6e62; font-style:italic; margin:0; font-family:Georgia,serif;">
      Delivered at 6 AM PT · News via Google News RSS · Summaries by Gemini 2.5 Flash
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
//  ONE-TIME SETUP
// ─────────────────────────────────────────────────────────────
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendMorningBriefing") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendMorningBriefing")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  Logger.log("✅ Daily trigger set — briefing arrives every day at 6 AM PT.");
  Logger.log("💡 Confirm timezone is America/Los_Angeles in ⚙️ Project Settings.");
}

// ─────────────────────────────────────────────────────────────
//  TEST
// ─────────────────────────────────────────────────────────────
function sendTestEmail() {
  Logger.log("📨 Sending test email now...");
  sendMorningBriefing();
}
