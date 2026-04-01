# ☕ Morning Briefing

A free, automated daily news digest delivered to your email every morning at 6 AM PT — powered by **Google Apps Script**, **Gemini 2.5 Flash**, and **Google News RSS**.

No servers. No subscriptions. No credit card. Just fresh news in your inbox every day.

---

## 📬 What You Get

A beautifully formatted email with **4-5 summarised stories** in each category:

| Section | Source |
|---|---|
| 🌍 World News | Google News RSS (global headlines) |
| 🇮🇳 India News | Google News RSS (Indian headlines) |
| 🤖 AI & Tech | Google News RSS (3 merged AI feeds) |

Each story has a **friendly one-sentence summary** written by Gemini, with a link to the full article.

---

## 🛠️ Tech Stack

| Tool | Purpose | Cost |
|---|---|---|
| [Google Apps Script](https://script.google.com) | Runs the script + sends email via Gmail | Free |
| [Gemini 2.5 Flash API](https://aistudio.google.com) | Summarises headlines | Free (250 req/day) |
| [Google News RSS](https://news.google.com/rss) | Fetches latest headlines | Free |

---

## 🚀 Setup (5 minutes)

### Step 1 — Get a free Gemini API key
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **"Get API Key"** → **"Create API Key"**
3. Copy the key (starts with `AIzaSy...`)

### Step 2 — Create the Apps Script project
1. Go to [script.google.com](https://script.google.com) → **New Project**
2. Paste the contents of [`MorningBriefing.gs`](./MorningBriefing.gs), replacing all existing code
3. Replace `YOUR_GEMINI_API_KEY` with your key:
   ```js
   GEMINI_API_KEY: "AIzaSy...",
   ```
4. Update `TO_EMAIL` to your email address if needed

### Step 3 — Set the timezone
- Click **⚙️ Project Settings** → **Time zone** → `America/Los_Angeles`

### Step 4 — Activate the daily trigger
- From the function dropdown, select **`setupDailyTrigger`** → click **▶ Run**
- Accept Gmail and network permissions when prompted

### Step 5 — Test it
- Select **`sendTestEmail`** → **▶ Run**
- Check your inbox in ~20 seconds ✉️

---

## ⚙️ Configuration

At the top of `MorningBriefing.gs`:

```js
const CONFIG = {
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",  // your Gemini API key
  TO_EMAIL:       "you@gmail.com",         // recipient email
  MODEL:          "gemini-2.5-flash",      // Gemini model to use
  MAX_AGE_HOURS:  24,                      // only include articles from last N hours
};
```

---

## 🛡️ Fallback Logic

The script never crashes silently — it has 3 layers of fallback for each news category:

| Layer | Trigger | Action |
|---|---|---|
| **1** | Normal | Gemini with JSON mode, 3000 tokens |
| **2** | Layer 1 fails | Gemini plain text, 4096 tokens |
| **3** | Both fail | Raw RSS headlines sent directly |

If Gemini hits a token limit mid-response, regex recovery extracts all complete stories before falling through. **The email always arrives.**

---


## 🔒 Security Note

Never commit your real API key to GitHub. Always use the placeholder:
```js
GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",
```
Keep your actual key only inside the Apps Script editor.

---

## 🙌 Credits

Built with [Google Apps Script](https://script.google.com), [Gemini API](https://aistudio.google.com), and [Google News RSS](https://news.google.com/rss).
