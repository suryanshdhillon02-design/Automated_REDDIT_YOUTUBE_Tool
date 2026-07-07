#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════
// CONFIG & CONSTANTS
// ═══════════════════════════════════════════════════════════════

const THEMES = {
  physical: {
    label: "Physical symptoms & side effects",
    kws: ["pain", "painful", "fatigue", "exhausted", "exhaustion", "nausea", "nauseous", "vomit", "vomiting", "neuropathy", "side effects?", "hair loss", "losing my hair", "can'?t sleep", "insomnia", "appetite", "breath", "breathing", "cough", "swelling", "lymphedema", "mouth sores", "hot flashes", "weak", "weakness", "dizzy", "diarrhea", "constipation", "peripheral"]
  },
  neuropathy: {
    label: "Peripheral neuropathy",
    kws: ["tingling", "tingly", "tingl(?:es|ing) in", "numb(?:ness)?", "numbness in (?:my )?(?:fingers?|toes?|hands?|feet|foot)", "burning (?:sensation|feeling|in my)", "pins and needles", "fingertips?", "toenails?", "neuropath(?:y|ic)", "can'?t feel my", "lost feeling", "nerve damage", "nerve pain", "electric shock", "shooting pain", "cold sensitivity", "gloves?", "socks? hurt", "can'?t grip", "dropping things", "balance"]
  },
  cognitive: {
    label: "Chemo-brain / cognitive effects",
    kws: ["brain fog", "chemo brain", "chemo-brain", "chemobrain", "memory", "can'?t remember", "forgetful(?:ness)?", "forget(?:ting)?", "focus", "concentrat(?:e|ion|ing)", "think(?:ing)? clearly", "cognitive", "confusion", "confused", "word(?:s)? (?:won'?t|don'?t) come", "can'?t find (?:the )?word", "mental clarity", "foggy", "mind(?:s)? blank", "processing", "attention"]
  },
  logistical: {
    label: "Logistical barriers & access",
    kws: ["prior auth(?:orization)?", "prior authorization", "insurance (?:denied|rejected|refused|won'?t cover|delay)", "appeal(?:ed|ing)", "scheduling", "wait(?:ed|ing)? (?:weeks?|months?) (?:for|to get|to see)", "appointment (?:delay|canceled|rescheduled)", "transportation", "can'?t (?:get|afford|drive|reach)", "infusion center", "lab work", "billing", "out of pocket", "cost of (?:getting|traveling|treatment)", "pharmacy (?:delay|issue|problem)", "specialty pharmacy", "step therapy", "formulary", "network", "out-of-network", "referral (?:delay|denied|took)"]
  },
  emotional: {
    label: "Emotional & mental health",
    kws: ["scared", "terrified", "afraid", "fear", "anxious", "anxiety", "scanxiety", "depress(?:ed|ion)?", "crying", "cried", "lonely", "alone", "isolat(?:ed|ing|ion)", "hopeless", "overwhelm(?:ed|ing)?", "angry", "anger", "guilt(?:y)?", "panic", "grief", "trauma(?:tized)?", "ptsd"]
  },
  system: {
    label: "Healthcare system & care navigation",
    kws: ["doctor", "doctors", "oncologist", "hospital", "appointment", "waiting", "wait(?:ed|ing)? (?:for|on|weeks|months)", "referral", "scan", "biopsy", "results", "misdiagnos(?:is|ed)", "second opinion", "nurse", "dismissed", "ignored by", "port", "er visit", "care team", "navigator", "patient advocate"]
  },
  financial: {
    label: "Financial & insurance burden",
    kws: ["insurance", "cost", "costs", "afford", "bills?", "debt", "money", "expensive", "copay", "co-pay", "deductible", "denied (?:coverage|claim)", "out of pocket", "fmla", "disability", "medicaid", "medicare", "financial toxicity", "medical debt", "bankruptcy", "fundrais"]
  },
  worklife: {
    label: "Work, family & relationships",
    kws: ["work", "job", "boss", "career", "my kids", "children", "husband", "wife", "partner", "my family", "friends", "caregiver", "relationship", "dating", "marriage", "fertility", "pregnan(?:t|cy)", "disability leave", "short.term disability"]
  },
  uncertainty: {
    label: "Diagnosis, prognosis & uncertainty",
    kws: ["diagnos(?:is|ed)", "stage [0-4iv]+", "recurrence", "came back", "prognosis", "survival", "spread", "metasta(?:sis|tic|sized)", "remission", "terminal", "waiting for results", "don'?t know if", "what if", "scan result", "pet scan", "mri result", "tumor marker", "ca-?125", "psa"]
  }
};

// Compile regex patterns
for (const t of Object.values(THEMES)) {
  const pattern = "\\b(" + t.kws.join("|") + ")\\b";
  t.re = new RegExp(pattern, "i");
  t._pat = pattern;
}

const FIRST_PERSON = /\b(i|i'm|i'm|i've|i've|im|my|me|myself|we|we're|our)\b/i;

const DRUGS = [
  "lupron", "leuprolide", "eligard", "zoladex", "goserelin", "casodex", "bicalutamide",
  "abiraterone", "zytiga", "enzalutamide", "xtandi", "darolutamide", "nubeqa",
  "apalutamide", "erleada", "pluvicto", "orgovyx", "relugolix", "adt",
  "tamoxifen", "letrozole", "femara", "anastrozole", "arimidex", "exemestane", "aromasin",
  "herceptin", "trastuzumab", "perjeta", "pertuzumab", "kadcyla", "enhertu",
  "ibrance", "palbociclib", "kisqali", "ribociclib", "verzenio", "abemaciclib",
  "fulvestrant", "faslodex", "trodelvy", "lynparza", "olaparib",
  "keytruda", "pembrolizumab", "opdivo", "nivolumab", "yervoy", "ipilimumab",
  "tagrisso", "osimertinib", "alecensa", "alectinib", "lorbrena", "lorlatinib",
  "tecentriq", "atezolizumab", "imfinzi", "durvalumab",
  "folfox", "folfiri", "folfirinox", "capox", "oxaliplatin", "irinotecan",
  "5-fu", "fluorouracil", "xeloda", "capecitabine", "avastin", "bevacizumab",
  "erbitux", "cetuximab", "vectibix", "panitumumab", "lonsurf", "stivarga", "regorafenib", "fruzaqla",
  "rituxan", "rituximab", "r-chop", "chop", "abvd", "revlimid", "lenalidomide",
  "velcade", "bortezomib", "darzalex", "daratumumab", "imbruvica", "ibrutinib",
  "calquence", "acalabrutinib", "venclexta", "venetoclax", "gleevec", "imatinib",
  "carboplatin", "cisplatin", "pemetrexed", "alimta", "taxol", "paclitaxel",
  "taxotere", "docetaxel", "adriamycin", "doxorubicin", "cytoxan", "cyclophosphamide",
  "gemcitabine", "gemzar", "ac-t"
];
const DRUG_PAT = "\\b(" + DRUGS.map(d => d.replace(/-/g, "\\-")).join("|") + ")\\b";

const BLUEPRINT_DIMS = [
  ["logistical_friction", "Logistical friction — insurance, access, wait times",
    /\b(prior auth(?:orization)?|insurance (?:denied|rejected|refused|delay|won'?t)|appeal(?:ed|ing) (?:to|my|the)|waiting (?:weeks?|months?) (?:for approval|to be seen|for (?:the )?appointment)|appointment (?:got )?(?:canceled|rescheduled|delayed)|can'?t (?:get an? appointment|afford|reach|get to)|transportation|specialty pharmacy|step therapy|out.of.network|formulary|billing (?:error|issue|department)|prior authorization)\b/i],
  ["counterintuitive_advice", "Counterintuitive advice that works",
    /\b(my advice|advice for|i recommend|i'?d recommend|make sure (you|to)|don'?t make my mistake|what helped me|what saved me|pro tip|tip:|lesson learned|if i could go back|wish i('?d| had) (asked|pushed|gotten)|always ask|insist on|push for|get a second opinion|advocate for)\b/i],
  ["myths_mistakes", "Mistakes they've made, myths they've believed",
    /\b(nobody told (me|us)|no one told (me|us)|i had no idea|i didn'?t know|i didn'?t realize|wish i('?d| had) known|i assumed|i thought it (was|meant)|found out (later|too late|weeks later|months later)|turns out|they never (told|mentioned|explained))\b/i],
  ["failed_attempts", "Failed past attempts, things that didn't work",
    /\b(i tried|we tried|didn'?t work|did not work|doesn'?t work|no luck|tried everything|stopped working|made it worse|made things worse|waste of (time|money)|googl(ed|ing)|dr\.? google|webmd|gave up on)\b/i],
  ["doubts_objections", "Doubts, objections, self-limiting beliefs",
    /\b(what if|i'?m afraid to ask|too afraid to|scared to ask|i don'?t want to (seem|be|sound|come across)|am i (overreacting|crazy|wrong|being)|should i even|is it (even )?worth|i doubt|not sure if i (should|can)|don'?t want to be (that|a) (difficult|annoying)|will (they|the doctor) think)\b/i],
  ["desired_outcomes", "Desired outcomes, goals, wishes",
    /\b(i wish|i hope|i hoped|i just want|i want to|i would love|if only|i'?d give anything|my goal|hoping (to|for|that)|i pray|all i want|looking forward to|can'?t wait (to|for))\b/i]
];

const DIM_META = {
  pain_point: { short: "Pain points & struggles", cssVar: "--c-physical" },
  logistical_friction: { short: "Logistical friction", cssVar: "--c-financial" },
  desired_outcomes: { short: "Desired outcomes & wishes", cssVar: "--c-worklife" },
  failed_attempts: { short: "Failed past attempts", cssVar: "--c-financial" },
  doubts_objections: { short: "Doubts & objections", cssVar: "--c-emotional" },
  myths_mistakes: { short: "Myths, mistakes & lies told", cssVar: "--c-uncertainty" },
  counterintuitive_advice: { short: "Counterintuitive advice", cssVar: "--c-system" }
};

const GENERIC_SENTIMENT = /^(i (am|was|feel|felt|was feeling|have been) (so |very |really |extremely )?(sad|upset|devastated|overwhelmed|happy|grateful|blessed|thankful|good|bad|terrible|horrible|awful|fine|okay|ok|nervous|scared|worried|stressed|hopeful|positive|negative)|this (is|was) (so |very |really )?(hard|difficult|tough|sad|scary|overwhelming)|it (is|was|has been) (so |very |really )?(hard|difficult|tough)|(so|very|really|extremely) (hard|difficult|tough|sad|scary)|(stay|staying|keep|keeping) (positive|strong|fighting|hopeful)|(sending|thoughts and) (prayers?|love|support)|god bless|bless (you|your)|thank(s| you) (for sharing|for posting|for this video)|i (cried|sobbed) watching|this (video|comment) (made me|helped me))$/i;
const CLINICAL_SPECIFICITY = /\b(fingers?|toes?|feet|foot|hands?|arms?|legs?|nails?|mouth|throat|stomach|abdomen|chest|nerve|skin|scalp|tongue|bladder|bowel|kidney|liver|brain|spine|lymph|tumor|port|catheter|iv|infusion|chemo(?:therapy)?|radiation|surgery|biopsy|scan|mri|ct|pet|ultrasound|blood (?:work|test|count|draw)|white (?:blood )?cell|red (?:blood )?cell|platelets?|hemoglobin|neutrophil|nausea|vomit|diarrhea|constipat|fatigue|neuropath|tingling|burning|numb|hair|appetite|weight|sleep|insomnia|swelling|lymphedema|cognitive|memory|focus|brain fog|insurance|prior auth|authorization|copay|deductible|pharmacy|appointment|referral|billing|transportation|taxol|paclitaxel|carboplatin|cisplatin|oxaliplatin|folfox|folfiri|capecitabine|xeloda|herceptin|keytruda|opdivo|ibrance|letrozole|tamoxifen|anastrozole|revlimid|velcade|rituxan|bortezomib|irinotecan|gemcitabine|adriamycin|cytoxan|taxotere|docetaxel|5-fu|fluorouracil|avastin|bevacizumab|adt|lupron|enzalutamide|xtandi|ibrutinib|imbruvica|venetoclax|venclexta)\b/i;

function extractDrugs(text) {
  const m = text.match(new RegExp(DRUG_PAT, "gi"));
  return m ? [...new Set(m.map(d => d.toLowerCase()))] : [];
}

function classifyDimension(text) {
  for (const [key, , rx] of BLUEPRINT_DIMS) if (rx.test(text)) return key;
  return "pain_point";
}

// ═══════════════════════════════════════════════════════════════
// YOUTUBE EXTRACTION
// ═══════════════════════════════════════════════════════════════

const YOUTUBE_QUERY_MAP = {
  "breast": ["breast cancer chemotherapy peripheral neuropathy side effects experience", "breast cancer treatment logistical barriers insurance prior authorization", "breast cancer chemo brain fog cognitive side effects patient"],
  "lung": ["lung cancer immunotherapy side effects patient experience", "lung cancer treatment access insurance delays prior authorization", "lung cancer chemotherapy fatigue breathing difficulty patient"],
  "colon": ["colon cancer FOLFOX oxaliplatin neuropathy side effects", "colon cancer treatment scheduling surgery barriers patient", "colon cancer chemotherapy nausea fatigue recovery experience"],
  "colorectal": ["colorectal cancer chemotherapy neuropathy side effects patient", "colorectal cancer treatment insurance prior authorization barriers", "colorectal cancer FOLFIRI FOLFOX side effects experience"],
  "rectal": ["rectal cancer chemoradiation side effects patient experience", "rectal cancer treatment logistical barriers transportation", "rectal cancer surgery recovery complications patient"],
  "pancreatic": ["pancreatic cancer FOLFIRINOX gemcitabine side effects patient", "pancreatic cancer treatment access barriers insurance delays", "pancreatic cancer pain management fatigue weight loss experience"],
  "prostate": ["prostate cancer ADT hormone therapy side effects experience", "prostate cancer treatment prior authorization insurance delays", "prostate cancer radiation fatigue urinary symptoms patient"],
  "ovarian": ["ovarian cancer carboplatin taxol neuropathy side effects", "ovarian cancer treatment insurance barriers scheduling delays", "ovarian cancer chemotherapy fatigue nausea cognitive side effects"],
  "cervical": ["cervical cancer chemoradiation side effects patient experience", "cervical cancer treatment access insurance barriers", "cervical cancer radiation fatigue pelvic pain patient"],
  "thyroid": ["thyroid cancer radioactive iodine side effects fatigue experience", "thyroid cancer treatment logistical barriers insurance", "thyroid cancer surgery recovery complications patient experience"],
};

const REDDIT_SUB_MAP = {
  "breast": ["breastcancer"],
  "lung": ["lungcancer"],
  "colon": ["coloncancer"],
  "colorectal": ["coloncancer"],
  "rectal": ["coloncancer"],
  "pancreatic": ["pancreaticcancer"],
  "prostate": ["ProstateCancer"],
  "ovarian": ["ovariancancer"],
  "cervical": ["cervicalcancer"],
  "thyroid": ["thyroidcancer"],
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function fetchYouTube(cancerType, maxVideos = 20, apiKey) {
  if (!apiKey) {
    log("❌ No YouTube API key provided");
    return [];
  }

  const key = cancerType.toLowerCase().replace(/\s*cancer\s*$/, "");
  const queries = YOUTUBE_QUERY_MAP[key] || [`${cancerType} chemotherapy side effects patient experience`];
  const videos = [];
  const seenIds = new Set();

  for (const query of queries) {
    try {
      log(`🔍 Searching YouTube: "${query}"`);
      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        order: "relevance",
        videoDuration: "medium",
        // Must be an integer 1-50; non-integers make the API 400.
        maxResults: Math.min(Math.max(Math.ceil(maxVideos / queries.length), 1), 50),
        q: query,
        key: apiKey
      });

      const res = await axios.get(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const items = res.data.items || [];

      for (const item of items) {
        const vid = item.id?.videoId;
        if (vid && !seenIds.has(vid)) {
          seenIds.add(vid);
          videos.push({
            id: vid,
            title: item.snippet.title || "(untitled)",
            channel: item.snippet.channelTitle || "",
            description: item.snippet.description || "",
            published: item.snippet.publishedAt || "",
            url: `https://www.youtube.com/watch?v=${vid}`
          });
        }
      }
    } catch (e) {
      const reason = e.response?.data?.error?.errors?.[0]?.reason;
      const apiMsg = e.response?.data?.error?.message || e.message;
      if (reason === "quotaExceeded") {
        log("❌ YouTube API quota exceeded");
        break;
      }
      log(`⚠️  YouTube search failed for "${query}": ${reason || ""} ${apiMsg}`);
    }
  }

  log(`✅ Found ${videos.length} YouTube videos`);
  return videos;
}

async function fetchYouTubeComments(videos, apiKey, maxPerVideo = 100) {
  const comments = [];

  for (const video of videos) {
    try {
      const params = new URLSearchParams({
        part: "snippet",
        order: "relevance",
        textFormat: "plainText",
        maxResults: maxPerVideo,
        videoId: video.id,
        key: apiKey
      });

      const res = await axios.get(`https://www.googleapis.com/youtube/v3/commentThreads?${params}`);
      const items = res.data.items || [];

      for (const item of items) {
        const snippet = item.snippet?.topLevelComment?.snippet;
        if (snippet) {
          comments.push({
            text: snippet.textOriginal || "",
            likes: snippet.likeCount || 0,
            videoId: video.id,
            videoTitle: video.title,
            videoUrl: video.url,
            channel: video.channel
          });
        }
      }
    } catch (e) {
      if (/403|404|disabled/i.test(e.message)) continue;
    }
  }

  return comments;
}

// Arctic Shift is a research archive of Reddit that permits programmatic,
// unauthenticated access — unlike reddit.com, which 403s cloud/CI IP ranges.
// Live Reddit is kept only as a best-effort fallback.
const ARCTIC_SHIFT_URL = "https://arctic-shift.photon-reddit.com/api/posts/search";
const REDDIT_UA = "Mozilla/5.0 (compatible; PatientVoiceExtractor/1.0; +https://github.com/suryanshdhillon02-design/Automated_REDDIT_YOUTUBE_Tool)";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchFromArcticShift(sub, maxPosts) {
  const params = new URLSearchParams({
    subreddit: sub,
    limit: String(Math.min(maxPosts, 100)),
    sort: "desc"
  });
  // Arctic Shift intermittently returns 422/5xx under rapid successive calls
  // (e.g. the 5 CI jobs). Retry with backoff before giving up to the fallback.
  let res;
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await axios.get(`${ARCTIC_SHIFT_URL}?${params}`, {
        headers: { "User-Agent": REDDIT_UA },
        timeout: 30000
      });
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await sleep(attempt * 1500);
    }
  }
  if (!res) throw lastErr;
  const items = Array.isArray(res.data?.data) ? res.data.data : [];
  return items
    .filter(d => d.selftext && d.selftext.length > 20)
    .map(d => ({
      title: d.title || "",
      text: d.selftext || "",
      created: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : "",
      url: d.permalink ? `https://reddit.com${d.permalink}` : (d.url || ""),
      subreddit: sub,
      score: d.score || 0
    }));
}

async function fetchFromLiveReddit(sub, maxPosts) {
  const res = await axios.get(
    `https://www.reddit.com/r/${sub}/new.json?limit=${Math.min(maxPosts, 100)}`,
    { headers: { "User-Agent": REDDIT_UA }, timeout: 30000 }
  );
  const items = res.data?.data?.children || [];
  return items
    .map(i => i.data)
    .filter(d => d.selftext && d.selftext.length > 20)
    .map(d => ({
      title: d.title || "",
      text: d.selftext || "",
      created: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : "",
      url: `https://reddit.com${d.permalink}`,
      subreddit: sub,
      score: d.score || 0
    }));
}

async function fetchReddit(cancerType, maxPosts = 50) {
  const key = cancerType.toLowerCase().replace(/\s*cancer\s*$/, "");
  const subs = REDDIT_SUB_MAP[key] || ["cancer", "cancersurvivors"];
  const posts = [];
  const perSub = Math.ceil(maxPosts / subs.length);

  for (const sub of subs) {
    let got = [];
    try {
      log(`🔍 Searching Reddit (Arctic Shift): r/${sub}`);
      got = await fetchFromArcticShift(sub, perSub);
    } catch (e) {
      log(`⚠️  Arctic Shift failed for r/${sub} (${e.message}) — trying live Reddit…`);
      try {
        got = await fetchFromLiveReddit(sub, perSub);
      } catch (e2) {
        log(`⚠️  Live Reddit also failed for r/${sub}: ${e2.message}`);
      }
    }
    log(`   → ${got.length} posts from r/${sub}`);
    posts.push(...got);
  }

  log(`✅ Found ${posts.length} Reddit posts`);
  return posts;
}

function extractQuotes(comments, source = "youtube") {
  const quotes = [];
  const seen = new Set();

  for (const comment of comments) {
    const text = source === "youtube" ? comment.text : comment.text;
    if (!text) continue;

    const sentences = text.split(/(?<=[.!?])\s+|\n+/);
    for (let s of sentences) {
      s = s.replace(/\s+/g, " ").trim();
      if (s.length < 55 || s.length > 400) continue;
      if (!FIRST_PERSON.test(s)) continue;
      if (GENERIC_SENTIMENT.test(s.trim())) continue;
      if (!CLINICAL_SPECIFICITY.test(s)) continue;

      let theme = null;
      for (const [key, t] of Object.entries(THEMES)) {
        if (t.re.test(s)) {
          theme = key;
          break;
        }
      }

      const dimension = classifyDimension(s);
      if (!theme && dimension === "pain_point") continue;

      const norm = s.toLowerCase().slice(0, 120);
      if (seen.has(norm)) continue;
      seen.add(norm);

      quotes.push({
        text: s,
        theme,
        dimension,
        drugs: extractDrugs(s),
        source,
        ...extractMetadata(comment, source)
      });
    }
  }

  // Sort by priority themes
  const PRIORITY = new Set(["neuropathy", "cognitive", "logistical"]);
  quotes.sort((a, b) => {
    const scoreA = (a.score || 0) + (PRIORITY.has(a.theme) ? 5 : 0);
    const scoreB = (b.score || 0) + (PRIORITY.has(b.theme) ? 5 : 0);
    return scoreB - scoreA;
  });

  return quotes.slice(0, 80);
}

function extractMetadata(comment, source) {
  if (source === "youtube") {
    return {
      channel: comment.channel || "",
      videoTitle: comment.videoTitle || "",
      url: comment.videoUrl || "",
      score: comment.likes || 0
    };
  } else {
    return {
      subreddit: comment.subreddit || "",
      postTitle: comment.title || "",
      url: comment.url || "",
      score: comment.score || 0,
      author: comment.author || "[deleted]"
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const source = args.includes("--source") ? args[args.indexOf("--source") + 1] : "all";
  const cancerType = process.env.CANCER_TYPE || "breast";
  const ytApiKey = process.env.YOUTUBE_API_KEY || "";

  log(`🚀 Starting Patient Voice Extraction`);
  log(`   Cancer type: ${cancerType}`);
  log(`   Source: ${source}`);

  const allQuotes = [];
  const metadata = {
    generatedAt: new Date().toISOString(),
    cancerType,
    sources: []
  };

  // YouTube extraction
  if (source === "youtube" || source === "all") {
    try {
      const videos = await fetchYouTube(cancerType, 20, ytApiKey);
      if (videos.length > 0) {
        const comments = await fetchYouTubeComments(videos, ytApiKey);
        const quotes = extractQuotes(comments, "youtube");
        allQuotes.push(...quotes);

        metadata.sources.push({
          name: "YouTube",
          videosAnalyzed: videos.length,
          commentsAnalyzed: comments.length,
          quotesExtracted: quotes.length
        });

        log(`✅ YouTube: ${quotes.length} quotes extracted from ${comments.length} comments`);
      }
    } catch (e) {
      log(`❌ YouTube extraction failed: ${e.message}`);
    }
  }

  // Reddit extraction
  if (source === "reddit" || source === "all") {
    try {
      const posts = await fetchReddit(cancerType, 50);
      if (posts.length > 0) {
        const quotes = extractQuotes(posts, "reddit");
        allQuotes.push(...quotes);

        metadata.sources.push({
          name: "Reddit",
          postsAnalyzed: posts.length,
          quotesExtracted: quotes.length
        });

        log(`✅ Reddit: ${quotes.length} quotes extracted from ${posts.length} posts`);
      }
    } catch (e) {
      log(`❌ Reddit extraction failed: ${e.message}`);
    }
  }

  // Save results
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `patient_voices_${cancerType.replace(/\s+/g, "_")}_${dateStr}.json`;
  const filepath = path.join(dataDir, filename);

  // Each source is already capped at 80 in extractQuotes(). Keep all quotes from
  // every source here — an earlier slice(0,80) silently dropped all Reddit quotes
  // on "all" runs because YouTube filled the first 80 slots.
  const output = {
    metadata,
    quotes: allQuotes,
    themes: Object.fromEntries(
      Object.entries(THEMES).map(([key, t]) => [
        key,
        {
          label: t.label,
          count: allQuotes.filter(q => q.theme === key).length
        }
      ])
    )
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  log(`✅ Results saved to ${filepath}`);
  log(`📊 Total quotes: ${allQuotes.length}`);
  log(`✨ Done!`);
}

main().catch(e => {
  log(`❌ Fatal error: ${e.message}`);
  process.exit(1);
});
