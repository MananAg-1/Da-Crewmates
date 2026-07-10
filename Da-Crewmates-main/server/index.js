import { createServer } from "node:http";
import { createDecipheriv, createHash, createCipheriv, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(__dirname);

function loadEnvFile() {
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const dataDir = join(__dirname, "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.APP_DATABASE_PATH
  ? resolve(process.env.APP_DATABASE_PATH)
  : join(dataDir, "devspace.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
const PORT = Number(process.env.API_PORT || process.env.PORT || 4000);
const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";
const DEMO_USER_ID = "demo-user";
const APOD_FALLBACK = {
  title: "Station Nebula",
  date: "offline-fallback",
  media_type: "image",
  url: "/game/Assets/apod-fallback.svg",
  hdurl: "https://apod.nasa.gov/apod/astropix.html",
  explanation: "NASA APOD is temporarily unavailable or rate-limited."
};
const APOD_CACHE_TTL_MS = 60 * 60 * 1000;
const APOD_API_TIMEOUT_MS = 5000;
const APOD_HTML_TIMEOUT_MS = 8000;
const ACTIVE_SESSION_WINDOW_MS = 15 * 60 * 1000;
const REPORT_EMAIL_TO = process.env.REPORT_EMAIL_TO || "";
const REPORT_EMAIL_FROM = process.env.REPORT_EMAIL_FROM || process.env.SMTP_USER || "reports@devspace.local";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? 465 : 587));
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;
const SMTP_STARTTLS = process.env.SMTP_STARTTLS !== "false";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const POST_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const HIDE_GENERATED_CREW = process.env.HIDE_GENERATED_CREW !== "0";
const DEFAULT_PRIVACY_SETTINGS = {
  privacyMode: "Enabled",
  dmPermissions: "Crewmates Only",
  contentFilter: "Standard",
  showOnlinePresence: true,
  shareZoneActivity: true,
  criticalAlerts: true,
};
const BAD_WORDS_BY_FILTER = {
  Lenient: [
    "fuck",
    "shit",
    "bitch",
    "cunt",
    "nigger",
    "faggot",
  ],
  Standard: [
    "asshole",
    "bastard",
    "bitch",
    "bullshit",
    "cunt",
    "dick",
    "faggot",
    "fuck",
    "motherfucker",
    "nigger",
    "piss",
    "prick",
    "shit",
    "slut",
    "whore",
  ],
  Strict: [
    "ass",
    "asshole",
    "bastard",
    "bitch",
    "bullshit",
    "crap",
    "cunt",
    "damn",
    "dick",
    "faggot",
    "fuck",
    "hell",
    "idiot",
    "moron",
    "motherfucker",
    "nigger",
    "piss",
    "prick",
    "shit",
    "slut",
    "stupid",
    "whore",
  ],
};
const POST_CATEGORIES = new Set(["Astrophysics", "Astrometry", "Astrogeology", "Astrobiology"]);
const LEGACY_POST_CATEGORY_MAP = {
  Space: "Astrophysics",
  Science: "Astrobiology",
  Tech: "Astrometry",
  Discussion: "Astrogeology",
  Social: "Astrobiology",
  Other: "Astrophysics",
};
const ASTRONOMY_SEED_USER = {
  id: "observatory-crew",
  email: "observatory@devspace.local",
  displayName: "Observatory Crew",
  avatarColor: "purple",
};
const OLD_SEED_POST_TITLES = [
  "Cafeteria meetup",
  "Electrical online",
  "Reactor Calibration",
  "Storage strategy",
  "Admin activity",
  "Oxygen levels stable. Cafeteria meetup in 5.",
  "Electrical is back online. Posting from the power room.",
  "New mission unlocked: Reactor Calibration.",
  "Saved a strategy thread near Storage.",
  "Admin terminal says crew activity is rising.",
  "Debug post check",
  "Node fetch post check",
  "Valid backend post",
];
const ASTRONOMY_SEED_POSTS = [
  {
    id: "seed-astrophysics-cmb-map",
    title: "What does the cosmic microwave background still leave unresolved?",
    body: "Cosmology has precise temperature maps, but questions around inflation, dark matter, and early structure growth still shape how we interpret the CMB.",
    tag: "Astrophysics",
    roomId: "reactor",
    likes: 42,
  },
  {
    id: "seed-astrophysics-solar-oscillations",
    title: "How do solar oscillations reveal the Sun's interior?",
    body: "Helioseismology tracks pressure waves across the solar surface to infer rotation, density, magnetic behavior, and energy transport below the photosphere.",
    tag: "Astrophysics",
    roomId: "reactor",
    likes: 36,
  },
  {
    id: "seed-astrometry-gaia-distance-ladder",
    title: "Why does Gaia astrometry matter for the cosmic distance ladder?",
    body: "Accurate parallax and proper-motion measurements calibrate nearby stars, which strengthens distance estimates used for Cepheids, supernovae, and galaxy-scale measurements.",
    tag: "Astrometry",
    roomId: "navigation",
    likes: 39,
  },
  {
    id: "seed-astrometry-exoplanet-wobble",
    title: "What can tiny stellar wobbles tell us about exoplanets?",
    body: "Astrometric shifts can reveal planetary masses and orbits, especially when paired with transit and radial-velocity observations.",
    tag: "Astrometry",
    roomId: "navigation",
    likes: 31,
  },
  {
    id: "seed-astrogeology-lunar-regolith",
    title: "Why is lunar regolith such a difficult engineering material?",
    body: "Selenography and planetary geology show that lunar dust is sharp, charged, abrasive, and chemically reactive enough to affect habitats, suits, seals, and instruments.",
    tag: "Astrogeology",
    roomId: "storage",
    likes: 34,
  },
  {
    id: "seed-astrogeology-mars-valleys",
    title: "What do Martian valley networks imply about ancient water?",
    body: "Areology compares channel shapes, crater ages, minerals, and sediment deposits to test whether early Mars had persistent rainfall, groundwater, or episodic meltwater.",
    tag: "Astrogeology",
    roomId: "storage",
    likes: 37,
  },
  {
    id: "seed-astrobiology-europa-plumes",
    title: "What would make Europa plume chemistry compelling for life?",
    body: "Astrobiology looks for chemical disequilibrium, organics, salts, and energy gradients that could connect an ocean environment to potential biological processes.",
    tag: "Astrobiology",
    roomId: "medbay",
    likes: 45,
  },
  {
    id: "seed-astrobiology-atmosphere-false-positives",
    title: "Which biosignature gases have the hardest false positives?",
    body: "Astrochemistry helps separate possible biological signals from photochemistry, volcanism, atmospheric escape, and star-planet interaction effects.",
    tag: "Astrobiology",
    roomId: "medbay",
    likes: 41,
  },
];
let apodCache = null;
const ENC_KEY = createHash("sha256")
  .update(process.env.APP_ENCRYPTION_KEY || "devspace-local-encryption-key-change-me")
  .digest();

function now() {
  return new Date().toISOString();
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-user-id,x-display-name",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  const hashBuffer = Buffer.from(hashHex, "hex");
  const suppliedBuffer = scryptSync(password, salt, 64);
  if (hashBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(hashBuffer, suppliedBuffer);
}

function hashEmail(email) {
  return createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex");
}

function encryptText(plainText) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptText(payload) {
  if (!payload || typeof payload !== "string") return "";
  const parts = payload.split(":");
  if (parts.length !== 3) return "";
  const [ivHex, tagHex, cipherHex] = parts;
  const decipher = createDecipheriv("aes-256-gcm", ENC_KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const out = Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()]);
  return out.toString("utf8");
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizePostCategory(value) {
  const raw = String(value || "").trim();
  if (POST_CATEGORIES.has(raw)) return raw;
  return LEGACY_POST_CATEGORY_MAP[raw] || "Astrophysics";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeContentFilter(value) {
  const raw = String(value || "").trim();
  if (raw === "Relaxed") return "Lenient";
  if (["Lenient", "Standard", "Strict"].includes(raw)) return raw;
  return DEFAULT_PRIVACY_SETTINGS.contentFilter;
}

function getBadWordsForFilter(level) {
  const normalized = normalizeContentFilter(level);
  return BAD_WORDS_BY_FILTER[normalized] || BAD_WORDS_BY_FILTER.Standard;
}

function findBlockedWord(text, level) {
  const input = String(text || "");
  return getBadWordsForFilter(level).find((word) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, "i");
    return pattern.test(input);
  }) || "";
}

function validateParentalContent(userId, ...parts) {
  const settings = getUserPrivacySettings(userId);
  const blockedWord = findBlockedWord(parts.join(" "), settings.contentFilter);
  if (!blockedWord) return null;
  return `Parental controls blocked this content under ${settings.contentFilter} filtering.`;
}

function normalizeImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > 2048) throw new Error("Image URL is too long.");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Image URL must be a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Image URL must use HTTP or HTTPS.");
  }
  return parsed.toString();
}

function getUserId(req) {
  const raw = req.headers["x-user-id"];
  if (!raw) return DEMO_USER_ID;
  return String(Array.isArray(raw) ? raw[0] : raw).trim() || DEMO_USER_ID;
}

function getDisplayName(req, userId) {
  const raw = req.headers["x-display-name"];
  const displayName = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
  return displayName || userId.replace(/^guest-/, "").replace(/-/g, " ") || "Crewmate";
}

function ensureRequestUser(req, userId) {
  const existing = get("SELECT id FROM users WHERE id = ?", [userId]);
  if (existing) return;

  const displayName = getDisplayName(req, userId);
  const email = `${userId}@devspace.local`;
  run(
    "INSERT INTO users (id, email, display_name, avatar_color, created_at, email_encrypted, email_lookup) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, email, displayName, "cyan", now(), encryptText(email), hashEmail(email)]
  );
}

const sseClients = new Set();

function broadcastSSE(type, payload) {
  const data = JSON.stringify({ type, payload });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function createNotification(userId, message) {
  const id = randomUUID();
  const timestamp = now();
  run(
    "INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, userId, message, 0, timestamp]
  );
  broadcastSSE("notification_created", { id, userId, message, isRead: false, createdAt: timestamp });
}

function parseEmailList(value) {
  return String(value || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function encodeEmailHeader(value) {
  return String(value || "").replace(/[\r\n]/g, " ").trim();
}

function formatReportEmail(report) {
  const target = report.target ? report.target : "None provided";
  const subject = `[DevSpace] New ${report.type} report`;
  const text = [
    "A new Security report was submitted.",
    "",
    `Report ID: ${report.id}`,
    `Type: ${report.type}`,
    `Reporter: ${report.reporterId}`,
    `Target: ${target}`,
    `Status: ${report.status}`,
    `Created: ${report.createdAt}`,
    "",
    "Details:",
    report.detail,
  ].join("\n");
  return { subject, text };
}

function createSmtpReader(socket) {
  let buffer = "";
  const pending = [];

  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    flush();
  });
  socket.on("error", (error) => {
    while (pending.length) pending.shift().reject(error);
  });

  function flush() {
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line) continue;
      if (/^\d{3} /.test(line) && pending.length) {
        pending.shift().resolve(line);
      }
    }
  }

  return function readResponse() {
    return new Promise((resolve, reject) => {
      pending.push({ resolve, reject });
      flush();
    });
  };
}

async function smtpCommand(socket, readResponse, command, expectedCodes) {
  if (command) socket.write(`${command}\r\n`);
  const response = await readResponse();
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP command failed: ${response}`);
  }
  return response;
}

function connectSmtpSocket() {
  return new Promise((resolve, reject) => {
    const socket = SMTP_SECURE
      ? tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST })
      : net.connect({ host: SMTP_HOST, port: SMTP_PORT });
    socket.setTimeout(10000, () => {
      socket.destroy(new Error("SMTP connection timed out."));
    });
    socket.once(SMTP_SECURE ? "secureConnect" : "connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function upgradeSmtpSocket(socket) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: SMTP_HOST });
    secureSocket.setTimeout(10000, () => {
      secureSocket.destroy(new Error("SMTP TLS upgrade timed out."));
    });
    secureSocket.once("secureConnect", () => resolve(secureSocket));
    secureSocket.once("error", reject);
  });
}

async function sendSmtpMail({ to, from, subject, text }) {
  let socket = await connectSmtpSocket();
  let readResponse = createSmtpReader(socket);
  await smtpCommand(socket, readResponse, "", [220]);
  await smtpCommand(socket, readResponse, "EHLO devspace.local", [250]);

  if (!SMTP_SECURE && SMTP_STARTTLS) {
    await smtpCommand(socket, readResponse, "STARTTLS", [220]);
    socket = await upgradeSmtpSocket(socket);
    readResponse = createSmtpReader(socket);
    await smtpCommand(socket, readResponse, "EHLO devspace.local", [250]);
  }

  if (SMTP_USER && SMTP_PASS) {
    const auth = Buffer.from(`\0${SMTP_USER}\0${SMTP_PASS}`).toString("base64");
    await smtpCommand(socket, readResponse, `AUTH PLAIN ${auth}`, [235]);
  }

  await smtpCommand(socket, readResponse, `MAIL FROM:<${from}>`, [250]);
  for (const recipient of to) {
    await smtpCommand(socket, readResponse, `RCPT TO:<${recipient}>`, [250, 251]);
  }
  await smtpCommand(socket, readResponse, "DATA", [354]);

  const message = [
    `From: ${encodeEmailHeader(from)}`,
    `To: ${to.map(encodeEmailHeader).join(", ")}`,
    `Subject: ${encodeEmailHeader(subject)}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, ".."),
    ".",
  ].join("\r\n");
  await smtpCommand(socket, readResponse, message, [250]);
  await smtpCommand(socket, readResponse, "QUIT", [221]);
  socket.end();
}

async function emailDevelopersAboutReport(report) {
  const recipients = parseEmailList(REPORT_EMAIL_TO);
  if (!SMTP_HOST || recipients.length === 0) {
    console.warn("Report email skipped: configure SMTP_HOST and REPORT_EMAIL_TO to email devs.");
    return { configured: false, sent: false, reason: "missing SMTP_HOST or REPORT_EMAIL_TO" };
  }

  const email = formatReportEmail(report);
  try {
    await sendSmtpMail({
      to: recipients,
      from: REPORT_EMAIL_FROM,
      subject: email.subject,
      text: email.text,
    });
    return { configured: true, sent: true, recipients };
  } catch (error) {
    console.warn(`Report email failed: ${error.message}`);
    return { configured: true, sent: false, error: error.message };
  }
}

function parseMultipartFile(buffer, contentType, fieldName) {
  const boundaryMatch = String(contentType || "").match(/boundary=([^;]+)/i);
  if (!boundaryMatch) throw new Error("Missing multipart boundary.");

  const boundary = boundaryMatch[1].replace(/^"|"$/g, "");
  const body = buffer.toString("binary");
  const parts = body.split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes(`name="${fieldName}"`)) continue;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) throw new Error("Invalid multipart payload.");

    const header = part.slice(0, headerEnd);
    const filenameMatch = header.match(/filename="([^"]*)"/i);
    const typeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
    let rawContent = part.slice(headerEnd + 4);
    if (rawContent.endsWith("\r\n")) rawContent = rawContent.slice(0, -2);
    const fileBuffer = Buffer.from(rawContent, "binary");
    return {
      filename: filenameMatch ? filenameMatch[1] : "post-image",
      contentType: typeMatch ? typeMatch[1].trim().toLowerCase() : "",
      buffer: fileBuffer,
    };
  }
  throw new Error("Upload must include an image file.");
}

function getCloudinarySignature(params) {
  const base = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${base}${CLOUDINARY_API_SECRET}`).digest("hex");
}

async function uploadPostImageToCloudinary(file) {
  if (!POST_IMAGE_TYPES.has(file.contentType)) {
    throw new Error("Image must be JPEG, PNG, WebP, or GIF.");
  }
  if (!file.buffer.length || file.buffer.length > POST_IMAGE_MAX_BYTES) {
    throw new Error("Image must be 1 byte to 5 MB.");
  }
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "da-crewmates/posts";
  const uploadParams = { folder, timestamp };
  const form = new FormData();
  form.set("file", new Blob([file.buffer], { type: file.contentType }), file.filename || "post-image");
  form.set("api_key", CLOUDINARY_API_KEY);
  form.set("timestamp", String(timestamp));
  form.set("folder", folder);
  form.set("signature", getCloudinarySignature(uploadParams));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  }
  return normalizeImageUrl(data.secure_url);
}

function getTodayDateString() {
  return now().split("T")[0];
}

function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function incrementObjective(userId, type) {
  const today = getTodayDateString();
  const objective = get(
    "SELECT id, current_count, target_count, completed FROM daily_objectives WHERE user_id = ? AND type = ? AND date = ?",
    [userId, type, today]
  );
  if (!objective || objective.completed) return;

  const newCount = objective.current_count + 1;
  const completed = newCount >= objective.target_count ? 1 : 0;

  run(
    "UPDATE daily_objectives SET current_count = ?, completed = ? WHERE id = ?",
    [newCount, completed, objective.id]
  );

  if (completed) {
    const completionId = randomUUID();
    run(
      "INSERT INTO objective_completions (id, user_id, objective_id, completed_at) VALUES (?, ?, ?, ?)",
      [completionId, userId, objective.id, now()]
    );
    createNotification(userId, `Daily Objective Completed: ${type === 'read' ? 'Review 3 transmissions' : type === 'comment' ? 'Add a transmission comment' : 'Send 1 friend request'}`);
  }
  
  broadcastSSE("objective_updated", { userId, type, currentCount: newCount, completed: Boolean(completed) });
}

function setupDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT 'red',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      title TEXT,
      body TEXT,
      tag TEXT NOT NULL DEFAULT 'Astrophysics',
      image_url TEXT,
      room_id TEXT NOT NULL DEFAULT 'cafeteria',
      likes_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_posts (
      user_id TEXT NOT NULL REFERENCES users(id),
      post_id TEXT NOT NULL REFERENCES posts(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      room_id TEXT NOT NULL DEFAULT 'reactor',
      points INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mission_members (
      mission_id TEXT NOT NULL REFERENCES missions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (mission_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  const userCols = all("PRAGMA table_info(users)");
  const hasPasswordHash = userCols.some((col) => col.name === "password_hash");
  const hasEmailEncrypted = userCols.some((col) => col.name === "email_encrypted");
  const hasEmailLookup = userCols.some((col) => col.name === "email_lookup");
  const hasBio = userCols.some((col) => col.name === "bio");
  const hasPrivacyMode = userCols.some((col) => col.name === "privacy_mode");
  const hasDmPermissions = userCols.some((col) => col.name === "dm_permissions");
  const hasContentFilter = userCols.some((col) => col.name === "content_filter");
  const hasShowOnlinePresence = userCols.some((col) => col.name === "show_online_presence");
  const hasShareZoneActivity = userCols.some((col) => col.name === "share_zone_activity");
  const hasCriticalAlerts = userCols.some((col) => col.name === "critical_alerts");
  if (!hasPasswordHash) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  if (!hasEmailEncrypted) db.exec("ALTER TABLE users ADD COLUMN email_encrypted TEXT");
  if (!hasEmailLookup) db.exec("ALTER TABLE users ADD COLUMN email_lookup TEXT");
  if (!hasPrivacyMode) db.exec("ALTER TABLE users ADD COLUMN privacy_mode TEXT DEFAULT 'Enabled'");
  if (!hasDmPermissions) db.exec("ALTER TABLE users ADD COLUMN dm_permissions TEXT DEFAULT 'Crewmates Only'");
  if (!hasContentFilter) db.exec("ALTER TABLE users ADD COLUMN content_filter TEXT DEFAULT 'Standard'");
  if (!hasShowOnlinePresence) db.exec("ALTER TABLE users ADD COLUMN show_online_presence INTEGER DEFAULT 1");
  if (!hasShareZoneActivity) db.exec("ALTER TABLE users ADD COLUMN share_zone_activity INTEGER DEFAULT 1");
  if (!hasCriticalAlerts) db.exec("ALTER TABLE users ADD COLUMN critical_alerts INTEGER DEFAULT 1");
  if (!hasBio) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");
    db.exec("ALTER TABLE users ADD COLUMN decorations TEXT DEFAULT '[]'");
    db.exec("ALTER TABLE users ADD COLUMN favourite_topics TEXT DEFAULT '[]'");
  }
  db.exec("CREATE INDEX IF NOT EXISTS users_email_lookup_idx ON users(email_lookup)");

  const refreshedUserCols = all("PRAGMA table_info(users)");
  const hasStreak = refreshedUserCols.some((col) => col.name === "streak");
  if (!hasStreak) {
    db.exec("ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0");
    db.exec("ALTER TABLE users ADD COLUMN last_active_date TEXT");
  }

  const postCols = all("PRAGMA table_info(posts)");
  const hasUpvotes = postCols.some((col) => col.name === "upvotes_count");
  if (!hasUpvotes) {
    db.exec("ALTER TABLE posts ADD COLUMN upvotes_count INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE posts ADD COLUMN downvotes_count INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE posts ADD COLUMN shares_count INTEGER NOT NULL DEFAULT 0");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id),
      following_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS blocked_users (
      blocker_id TEXT NOT NULL REFERENCES users(id),
      blocked_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (blocker_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS post_votes (
      user_id TEXT NOT NULL REFERENCES users(id),
      post_id TEXT NOT NULL REFERENCES posts(id),
      vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seen_posts (
      user_id TEXT NOT NULL REFERENCES users(id),
      post_id TEXT NOT NULL REFERENCES posts(id),
      seen_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id),
      receiver_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'declined', 'canceled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id1 TEXT NOT NULL REFERENCES users(id),
      user_id2 TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id1, user_id2)
    );

    CREATE TABLE IF NOT EXISTS dm_threads (
      id TEXT PRIMARY KEY,
      user_id1 TEXT NOT NULL REFERENCES users(id),
      user_id2 TEXT NOT NULL REFERENCES users(id),
      is_group INTEGER NOT NULL DEFAULT 0,
      name TEXT,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id1, user_id2)
    );

    CREATE TABLE IF NOT EXISTS dm_thread_members (
      thread_id TEXT NOT NULL REFERENCES dm_threads(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS dm_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES dm_threads(id),
      sender_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS security_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      target TEXT,
      detail TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open', 'resolved')) DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      start_time TEXT NOT NULL,
      end_time TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_objectives (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('read', 'comment', 'request')),
      target_count INTEGER NOT NULL DEFAULT 1,
      current_count INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS objective_completions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      objective_id TEXT NOT NULL REFERENCES daily_objectives(id),
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_visits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      room_id TEXT NOT NULL,
      room_name TEXT NOT NULL,
      entered_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS friend_requests_lookup_idx ON friend_requests(sender_id, receiver_id, status);
    CREATE INDEX IF NOT EXISTS friendships_pair_idx ON friendships(user_id1, user_id2);
    CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id, follower_id);
    CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON blocked_users(blocked_id, blocker_id);
    CREATE INDEX IF NOT EXISTS dm_threads_user1_idx ON dm_threads(user_id1);
    CREATE INDEX IF NOT EXISTS dm_threads_user2_idx ON dm_threads(user_id2);
    CREATE INDEX IF NOT EXISTS dm_thread_members_user_idx ON dm_thread_members(user_id, thread_id);
    CREATE INDEX IF NOT EXISTS dm_messages_thread_idx ON dm_messages(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS security_reports_status_idx ON security_reports(status, created_at);
    CREATE INDEX IF NOT EXISTS room_visits_user_idx ON room_visits(user_id, entered_at);
    CREATE INDEX IF NOT EXISTS room_visits_room_idx ON room_visits(room_id, entered_at);
  `);

  const refreshedPostCols = all("PRAGMA table_info(posts)");
  const hasTitle = refreshedPostCols.some((col) => col.name === "title");
  const hasBody = refreshedPostCols.some((col) => col.name === "body");
  const hasTag = refreshedPostCols.some((col) => col.name === "tag");
  const hasImageUrl = refreshedPostCols.some((col) => col.name === "image_url");
  if (!hasTitle) db.exec("ALTER TABLE posts ADD COLUMN title TEXT");
  if (!hasBody) db.exec("ALTER TABLE posts ADD COLUMN body TEXT");
  if (!hasTag) db.exec("ALTER TABLE posts ADD COLUMN tag TEXT NOT NULL DEFAULT 'Astrophysics'");
  if (!hasImageUrl) db.exec("ALTER TABLE posts ADD COLUMN image_url TEXT");

  const dmMessageCols = all("PRAGMA table_info(dm_messages)");
  const hasReadAt = dmMessageCols.some((col) => col.name === "read_at");
  if (!hasReadAt) db.exec("ALTER TABLE dm_messages ADD COLUMN read_at TEXT");

  const dmThreadCols = all("PRAGMA table_info(dm_threads)");
  const hasIsGroup = dmThreadCols.some((col) => col.name === "is_group");
  const hasThreadName = dmThreadCols.some((col) => col.name === "name");
  const hasOwnerId = dmThreadCols.some((col) => col.name === "owner_id");
  if (!hasIsGroup) db.exec("ALTER TABLE dm_threads ADD COLUMN is_group INTEGER NOT NULL DEFAULT 0");
  if (!hasThreadName) db.exec("ALTER TABLE dm_threads ADD COLUMN name TEXT");
  if (!hasOwnerId) db.exec("ALTER TABLE dm_threads ADD COLUMN owner_id TEXT REFERENCES users(id)");
  db.exec(`
    INSERT OR IGNORE INTO dm_thread_members (thread_id, user_id, joined_at)
    SELECT id, user_id1, created_at FROM dm_threads WHERE is_group = 0
  `);
  db.exec(`
    INSERT OR IGNORE INTO dm_thread_members (thread_id, user_id, joined_at)
    SELECT id, user_id2, created_at FROM dm_threads WHERE is_group = 0
  `);

  run("UPDATE posts SET body = content WHERE body IS NULL OR body = ''");
  run("UPDATE posts SET title = substr(content, 1, 80) WHERE title IS NULL OR title = ''");
  run("UPDATE posts SET tag = 'Astrophysics' WHERE tag IS NULL OR tag = ''");
  run("UPDATE posts SET tag = 'Astrophysics' WHERE tag IN ('Space', 'Other')");
  run("UPDATE posts SET tag = 'Astrobiology' WHERE tag IN ('Science', 'Social')");
  run("UPDATE posts SET tag = 'Astrometry' WHERE tag = 'Tech'");
  run("UPDATE posts SET tag = 'Astrogeology' WHERE tag = 'Discussion'");

  const usersNeedingEmailMigration = all(
    "SELECT id, email FROM users WHERE (email_encrypted IS NULL OR email_lookup IS NULL) AND email IS NOT NULL"
  );
  for (const row of usersNeedingEmailMigration) {
    run("UPDATE users SET email_encrypted = ?, email_lookup = ? WHERE id = ?", [
      encryptText(row.email),
      hashEmail(row.email),
      row.id,
    ]);
  }
}

function seedDatabase() {
  const userCount = get("SELECT COUNT(*) AS count FROM users").count;
  if (userCount > 0) return;

  run(
    "INSERT INTO users (id, email, display_name, avatar_color, created_at) VALUES (?, ?, ?, ?, ?)",
    [DEMO_USER_ID, "demo@devspace.local", "DevSpace Crew", "cyan", now()]
  );

  const missions = [
    ["reactor-calibration", "Reactor Calibration", "Coordinate with crew to stabilize the reactor core.", "reactor", 25],
    ["electrical-reset", "Electrical Reset", "Restore power routes and report the fix from Electrical.", "electrical", 15],
    ["cafeteria-rollcall", "Cafeteria Roll Call", "Start a discussion thread and get three crew replies.", "cafeteria", 10],
  ];

  for (const mission of missions) {
    run(
      "INSERT INTO missions (id, title, description, room_id, points, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [...mission, now()]
    );
  }

  const notifications = [
    "Cyan liked your Cafeteria update.",
    "New mission available in Reactor.",
    "Your saved post list is ready in Storage.",
  ];

  for (const message of notifications) {
    run(
      "INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), DEMO_USER_ID, message, 0, now()]
    );
  }

}

function ensureDemoCrewmates() {
  const demoUser = get("SELECT id FROM users WHERE id = ?", [DEMO_USER_ID]);
  if (!demoUser) return;

  const starterCrew = [
    ["cyan-crew", "cyan@devspace.local", "Cyan", "cyan"],
    ["yellow-crew", "yellow@devspace.local", "Yellow", "yellow"],
    ["purple-crew", "purple@devspace.local", "Purple", "purple"],
  ];

  for (const [id, email, displayName, avatarColor] of starterCrew) {
    run(
      "INSERT OR IGNORE INTO users (id, email, display_name, avatar_color, created_at, email_encrypted, email_lookup) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, email, displayName, avatarColor, now(), encryptText(email), hashEmail(email)]
    );
  }

  run("INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)", [DEMO_USER_ID, "cyan-crew", now()]);
  run("INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)", [DEMO_USER_ID, "yellow-crew", now()]);
  run("INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)", ["purple-crew", DEMO_USER_ID, now()]);
}

function serializePost(row) {
  const upvotes = row.upvotes_count ?? row.likes_count ?? 0;
  const downvotes = row.downvotes_count ?? 0;
  return {
    id: row.id,
    authorId: row.user_id,
    authorName: row.display_name,
    title: row.title || String(row.content || "").slice(0, 80) || "(Untitled transmission)",
    body: row.body || row.content || "",
    content: row.body || row.content || "",
    tag: normalizePostCategory(row.tag),
    imageUrl: row.image_url || "",
    roomId: row.room_id,
    score: upvotes,
    likes: upvotes,
    upvotes,
    downvotes,
    shares: row.shares_count || 0,
    commentCount: row.comments_count || 0,
    savedByMe: Boolean(row.saved_by_me),
    seenByMe: Boolean(row.seen_by_me),
    canDelete: row.user_id === row.viewer_id,
    createdAt: row.created_at,
  };
}

function selectPostsForUser({ userId, where = "", params = [], orderBy = "posts.created_at DESC", limit = 50 }) {
  return all(
    `SELECT posts.*,
      COALESCE(users.display_name, posts.user_id, 'Crewmate') AS display_name,
      ? AS viewer_id,
      COUNT(comments.id) AS comments_count,
      CASE WHEN saved_posts.post_id IS NULL THEN 0 ELSE 1 END AS saved_by_me,
      CASE WHEN seen_posts.post_id IS NULL THEN 0 ELSE 1 END AS seen_by_me
     FROM posts
     LEFT JOIN users ON users.id = posts.user_id
     LEFT JOIN comments ON comments.post_id = posts.id
     LEFT JOIN saved_posts
       ON saved_posts.post_id = posts.id
      AND saved_posts.user_id = ?
     LEFT JOIN seen_posts
       ON seen_posts.post_id = posts.id
      AND seen_posts.user_id = ?
     ${where}
     GROUP BY posts.id
     ORDER BY ${orderBy}
     LIMIT ?`,
    [userId, userId, userId, ...params, limit]
  ).map(serializePost);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function cleanHtmlText(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function absoluteApodUrl(path) {
  try {
    return new URL(path, "https://apod.nasa.gov/apod/").toString();
  } catch {
    return "";
  }
}

function ensureAstronomySeedContent() {
  for (const title of OLD_SEED_POST_TITLES) {
    run("DELETE FROM saved_posts WHERE post_id IN (SELECT id FROM posts WHERE title = ?)", [title]);
    run("DELETE FROM seen_posts WHERE post_id IN (SELECT id FROM posts WHERE title = ?)", [title]);
    run("DELETE FROM post_votes WHERE post_id IN (SELECT id FROM posts WHERE title = ?)", [title]);
    run("DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE title = ?)", [title]);
    run("DELETE FROM posts WHERE title = ?", [title]);
  }

  run(
    `INSERT OR IGNORE INTO users (id, email, display_name, avatar_color, created_at, email_encrypted, email_lookup)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      ASTRONOMY_SEED_USER.id,
      ASTRONOMY_SEED_USER.email,
      ASTRONOMY_SEED_USER.displayName,
      ASTRONOMY_SEED_USER.avatarColor,
      now(),
      encryptText(ASTRONOMY_SEED_USER.email),
      hashEmail(ASTRONOMY_SEED_USER.email),
    ]
  );

  for (const post of ASTRONOMY_SEED_POSTS) {
    run(
      `INSERT OR IGNORE INTO posts (id, user_id, content, title, body, tag, image_url, room_id, likes_count, upvotes_count, downvotes_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        post.id,
        ASTRONOMY_SEED_USER.id,
        post.body,
        post.title,
        post.body,
        post.tag,
        "",
        post.roomId,
        post.likes,
        post.likes,
        0,
        now(),
      ]
    );
  }
}

async function fetchApodFromApi() {
  const apodRes = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(NASA_API_KEY)}&thumbs=true`, {
    signal: AbortSignal.timeout(APOD_API_TIMEOUT_MS),
  });
  if (!apodRes.ok) {
    const upstreamBody = await apodRes.text().catch(() => "");
    const error = new Error(`NASA APOD API request failed (${apodRes.status}).`);
    error.status = apodRes.status;
    error.body = upstreamBody.slice(0, 500);
    throw error;
  }

  const apodData = await apodRes.json();
  return { ...apodData, source: "api" };
}

async function fetchApodFromHtml() {
  const htmlRes = await fetch("https://apod.nasa.gov/apod/astropix.html", {
    signal: AbortSignal.timeout(APOD_HTML_TIMEOUT_MS),
  });
  if (!htmlRes.ok) {
    throw new Error(`NASA APOD HTML request failed (${htmlRes.status}).`);
  }

  const html = await htmlRes.text();
  const titleMatch = html.match(/<center>\s*<b>\s*([\s\S]*?)\s*<\/b>/i) || html.match(/<b>\s*([\s\S]*?)\s*<\/b>/i);
  const linkedImageMatch = html.match(/<a\s+href="([^"]+)"[^>]*>\s*<img/i);
  const imageMatch = html.match(/<img[^>]+src="([^"]+)"/i);
  const explanationMatch = html.match(/<b>\s*Explanation:\s*<\/b>\s*([\s\S]*?)(?:<p>\s*<center>|<center>|<\/body>)/i);
  const dateMatch = html.match(/<p>\s*<center>\s*<b>[\s\S]*?<\/b>\s*<br>\s*([^<\n]+)/i);

  const imagePath = imageMatch ? imageMatch[1] : "";
  const hdPath = linkedImageMatch ? linkedImageMatch[1] : imagePath;

  if (!titleMatch || !imagePath) {
    throw new Error("NASA APOD HTML response did not include a title and image.");
  }

  return {
    title: cleanHtmlText(titleMatch[1]),
    date: cleanHtmlText(dateMatch ? dateMatch[1] : ""),
    media_type: "image",
    url: absoluteApodUrl(imagePath),
    hdurl: absoluteApodUrl(hdPath) || "https://apod.nasa.gov/apod/astropix.html",
    explanation: cleanHtmlText(explanationMatch ? explanationMatch[1] : ""),
    source: "html"
  };
}

function orderedUserPair(userId, otherUserId) {
  return userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
}

function areFriends(userId, otherUserId) {
  return Boolean(
    get("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", [userId, otherUserId]) &&
    get("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", [otherUserId, userId])
  );
}

function hasBlocked(blockerId, blockedId) {
  return Boolean(get("SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?", [blockerId, blockedId]));
}

function areBlockedEitherWay(userId, otherUserId) {
  return hasBlocked(userId, otherUserId) || hasBlocked(otherUserId, userId);
}

function normalizePrivacySettings(row = {}) {
  const privacyModes = new Set(["Enabled", "Friends Only", "Public"]);
  const dmOptions = new Set(["Crewmates Only", "Followers", "Everyone"]);
  const privacyMode = privacyModes.has(row.privacy_mode || row.privacyMode) ? (row.privacy_mode || row.privacyMode) : DEFAULT_PRIVACY_SETTINGS.privacyMode;
  const dmPermissions = dmOptions.has(row.dm_permissions || row.dmPermissions) ? (row.dm_permissions || row.dmPermissions) : DEFAULT_PRIVACY_SETTINGS.dmPermissions;
  const contentFilter = normalizeContentFilter(row.content_filter || row.contentFilter);
  return {
    privacyMode,
    dmPermissions,
    contentFilter,
    showOnlinePresence: row.show_online_presence === undefined && row.showOnlinePresence === undefined
      ? DEFAULT_PRIVACY_SETTINGS.showOnlinePresence
      : Boolean(row.show_online_presence ?? row.showOnlinePresence),
    shareZoneActivity: row.share_zone_activity === undefined && row.shareZoneActivity === undefined
      ? DEFAULT_PRIVACY_SETTINGS.shareZoneActivity
      : Boolean(row.share_zone_activity ?? row.shareZoneActivity),
    criticalAlerts: row.critical_alerts === undefined && row.criticalAlerts === undefined
      ? DEFAULT_PRIVACY_SETTINGS.criticalAlerts
      : Boolean(row.critical_alerts ?? row.criticalAlerts),
  };
}

function getUserPrivacySettings(targetId) {
  const row = get(
    "SELECT privacy_mode, dm_permissions, content_filter, show_online_presence, share_zone_activity, critical_alerts FROM users WHERE id = ?",
    [targetId]
  );
  return normalizePrivacySettings(row || {});
}

function canViewCrewProfile(viewerId, targetId) {
  if (viewerId === targetId) return true;
  if (areBlockedEitherWay(viewerId, targetId)) return false;
  const settings = getUserPrivacySettings(targetId);
  if (settings.privacyMode === "Public" || settings.privacyMode === "Enabled") return true;
  if (settings.privacyMode === "Friends Only") return areFriends(viewerId, targetId);
  return false;
}

function canDmUser(senderId, receiverId) {
  if (senderId === receiverId) return false;
  if (areBlockedEitherWay(senderId, receiverId)) return false;
  const settings = getUserPrivacySettings(receiverId);
  if (settings.dmPermissions === "Everyone") return true;
  if (settings.dmPermissions === "Followers") {
    return Boolean(get("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", [senderId, receiverId]));
  }
  return areFriends(senderId, receiverId);
}

function getVisibleCrewConnections(profileId, viewerId) {
  const friends = all(
    `SELECT users.id, users.display_name, users.avatar_color, mine.created_at
     FROM follows mine
     JOIN follows theirs
       ON theirs.follower_id = mine.following_id
      AND theirs.following_id = mine.follower_id
     JOIN users ON users.id = mine.following_id
     WHERE mine.follower_id = ?
     ORDER BY mine.created_at DESC
     LIMIT 24`,
    [profileId]
  ).map((row) => serializeCrewmateWithRelationship(row, viewerId, { connectedAt: row.created_at }));

  const following = all(
    `SELECT users.id, users.display_name, users.avatar_color, follows.created_at
     FROM follows
     JOIN users ON users.id = follows.following_id
     WHERE follows.follower_id = ?
     ORDER BY follows.created_at DESC
     LIMIT 24`,
    [profileId]
  ).map((row) => serializeCrewmateWithRelationship(row, viewerId, { connectedAt: row.created_at }));

  const followers = all(
    `SELECT users.id, users.display_name, users.avatar_color, follows.created_at
     FROM follows
     JOIN users ON users.id = follows.follower_id
     WHERE follows.following_id = ?
     ORDER BY follows.created_at DESC
     LIMIT 24`,
    [profileId]
  ).map((row) => serializeCrewmateWithRelationship(row, viewerId, { connectedAt: row.created_at }));

  return { friends, following, followers };
}

function getCrewRelationship(viewerId, targetId) {
  if (viewerId === targetId) return "self";
  if (hasBlocked(viewerId, targetId)) return "blocked";
  if (hasBlocked(targetId, viewerId)) return "blockedBy";
  const viewerFollows = Boolean(get("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", [viewerId, targetId]));
  const targetFollows = Boolean(get("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", [targetId, viewerId]));
  if (viewerFollows && targetFollows) return "friend";
  if (viewerFollows) return "following";
  if (targetFollows) return "follower";
  return "none";
}

function getThreadForUsers(userId, otherUserId) {
  const [u1, u2] = orderedUserPair(userId, otherUserId);
  return get("SELECT * FROM dm_threads WHERE user_id1 = ? AND user_id2 = ? AND is_group = 0", [u1, u2]);
}

function createThreadForUsers(userId, otherUserId) {
  const [u1, u2] = orderedUserPair(userId, otherUserId);
  const existing = getThreadForUsers(userId, otherUserId);
  if (existing) return existing;

  const id = randomUUID();
  const timestamp = now();
  run(
    "INSERT INTO dm_threads (id, user_id1, user_id2, is_group, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, u1, u2, 0, null, userId, timestamp, timestamp]
  );
  run("INSERT OR IGNORE INTO dm_thread_members (thread_id, user_id, joined_at) VALUES (?, ?, ?)", [id, u1, timestamp]);
  run("INSERT OR IGNORE INTO dm_thread_members (thread_id, user_id, joined_at) VALUES (?, ?, ?)", [id, u2, timestamp]);
  return get("SELECT * FROM dm_threads WHERE id = ?", [id]);
}

function getDmThreadForUser(threadId, userId) {
  return get(
    `SELECT dm_threads.*
     FROM dm_threads
     JOIN dm_thread_members ON dm_thread_members.thread_id = dm_threads.id
     WHERE dm_threads.id = ? AND dm_thread_members.user_id = ?`,
    [threadId, userId]
  );
}

function getDmThreadMembers(threadId) {
  return all(
    `SELECT users.id, users.display_name, users.avatar_color, dm_thread_members.joined_at
     FROM dm_thread_members
     JOIN users ON users.id = dm_thread_members.user_id
     WHERE dm_thread_members.thread_id = ?
     ORDER BY dm_thread_members.joined_at ASC`,
    [threadId]
  );
}

function createGroupThread(ownerId, name, memberIds) {
  const id = randomUUID();
  const timestamp = now();
  const uniqueMembers = [...new Set([ownerId, ...memberIds])];
  run(
    "INSERT INTO dm_threads (id, user_id1, user_id2, is_group, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, ownerId, memberIds[0], 1, name, ownerId, timestamp, timestamp]
  );
  for (const memberId of uniqueMembers) {
    run("INSERT OR IGNORE INTO dm_thread_members (thread_id, user_id, joined_at) VALUES (?, ?, ?)", [id, memberId, timestamp]);
  }
  return get("SELECT * FROM dm_threads WHERE id = ?", [id]);
}

function serializeDmThread(row, viewerId) {
  const isGroup = Boolean(row.is_group);
  const members = getDmThreadMembers(row.id);
  const otherUserId = row.user_id1 === viewerId ? row.user_id2 : row.user_id1;
  const otherUser = isGroup ? null : get("SELECT id, display_name, avatar_color FROM users WHERE id = ?", [otherUserId]);
  const lastMessage = get(
    `SELECT dm_messages.*, users.display_name
     FROM dm_messages
     LEFT JOIN users ON users.id = dm_messages.sender_id
     WHERE dm_messages.thread_id = ?
     ORDER BY dm_messages.created_at DESC
     LIMIT 1`,
    [row.id]
  );

  return {
    id: row.id,
    isGroup,
    name: isGroup ? (row.name || "Crew Group") : "",
    ownerId: row.owner_id || null,
    members: members.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      avatarColor: member.avatar_color || "cyan",
    })),
    otherUser: isGroup ? null : {
      id: otherUserId,
      displayName: otherUser?.display_name || otherUserId,
      avatarColor: otherUser?.avatar_color || "cyan",
    },
    lastMessage: lastMessage ? {
      id: lastMessage.id,
      senderId: lastMessage.sender_id,
      senderName: lastMessage.display_name || lastMessage.sender_id,
      body: lastMessage.body,
      createdAt: lastMessage.created_at,
      readAt: lastMessage.read_at || null,
      read: Boolean(lastMessage.read_at),
    } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeDmMessage(row, viewerId) {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    senderName: row.display_name || row.sender_id,
    body: row.body,
    sentByMe: row.sender_id === viewerId,
    createdAt: row.created_at,
    readAt: row.read_at || null,
    read: Boolean(row.read_at),
  };
}

function startDateForRange(range) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (range === "week") date.setDate(date.getDate() - 6);
  if (range === "month") date.setDate(date.getDate() - 29);
  return date.toISOString();
}

function minutesBetween(start, end) {
  if (!start) return 0;
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return 0;
  return Math.round((endTime - startTime) / 60000);
}

function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours <= 0) return `${remaining}m`;
  return `${hours}h ${String(remaining).padStart(2, "0")}m`;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toTitleLabel(value) {
  return String(value || "Other")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Other";
}

function isGeneratedRegressionUserId(userId) {
  if (!HIDE_GENERATED_CREW) return false;
  return /^(alpha|beta|owner|intruder|sse-owner|dm-sender|dm-receiver|dm-stranger|medbay|medbay-peer|system|share-sender|share-receiver)-\d{10,}-[a-f0-9]+(?:-\d+)?$/i.test(String(userId || ""));
}

function cleanCrewDisplayName(row) {
  const id = String(row?.id || "");
  const rawName = String(row?.display_name || row?.displayName || "").trim();
  if (!rawName || rawName === id || isGeneratedRegressionUserId(rawName)) {
    return "Crewmate";
  }
  return rawName;
}

function serializeCrewmateRow(row, extra = {}) {
  return {
    ...extra,
    id: row.id,
    displayName: cleanCrewDisplayName(row),
    avatarColor: row.avatar_color,
  };
}

function serializeCrewmateWithRelationship(row, viewerId, extra = {}) {
  return serializeCrewmateRow(row, {
    ...extra,
    relationship: getCrewRelationship(viewerId, row.id),
  });
}

function visibleCrewFilterSql(alias = "users") {
  return HIDE_GENERATED_CREW
    ? `AND ${alias}.id NOT GLOB 'alpha-[0-9]*'
       AND ${alias}.id NOT GLOB 'beta-[0-9]*'
       AND ${alias}.id NOT GLOB 'owner-[0-9]*'
       AND ${alias}.id NOT GLOB 'intruder-[0-9]*'
       AND ${alias}.id NOT GLOB 'sse-owner-[0-9]*'
       AND ${alias}.id NOT GLOB 'dm-sender-[0-9]*'
       AND ${alias}.id NOT GLOB 'dm-receiver-[0-9]*'
       AND ${alias}.id NOT GLOB 'dm-stranger-[0-9]*'
       AND ${alias}.id NOT GLOB 'medbay-[0-9]*'
       AND ${alias}.id NOT GLOB 'medbay-peer-[0-9]*'
       AND ${alias}.id NOT GLOB 'system-[0-9]*'
       AND ${alias}.id NOT GLOB 'share-sender-[0-9]*'
       AND ${alias}.id NOT GLOB 'share-receiver-[0-9]*'`
    : "";
}

function getMedbayAnalytics(userId, range) {
  const safeRange = ["day", "week", "month"].includes(range) ? range : "day";
  const since = startDateForRange(safeRange);

  const sessions = all(
    "SELECT start_time, end_time FROM sessions WHERE user_id = ? AND start_time >= ?",
    [userId, since]
  );
  const usageMinutes = sessions.reduce((total, session) => total + minutesBetween(session.start_time, session.end_time), 0);
  const activeDays = new Set(sessions.map((session) => String(session.start_time || "").slice(0, 10))).size;

  const seenCount = get("SELECT COUNT(*) AS count FROM seen_posts WHERE user_id = ? AND seen_at >= ?", [userId, since]).count;
  const createdPosts = get("SELECT COUNT(*) AS count FROM posts WHERE user_id = ? AND created_at >= ?", [userId, since]).count;
  const commentsMade = get("SELECT COUNT(*) AS count FROM comments WHERE user_id = ? AND created_at >= ?", [userId, since]).count;
  const votesCast = get("SELECT COUNT(*) AS count FROM post_votes WHERE user_id = ? AND created_at >= ?", [userId, since]).count;
  const savedCount = get("SELECT COUNT(*) AS count FROM saved_posts WHERE user_id = ? AND created_at >= ?", [userId, since]).count;
  const dmSent = get("SELECT COUNT(*) AS count FROM dm_messages WHERE sender_id = ? AND created_at >= ?", [userId, since]).count;
  const friendCount = get(
    `SELECT COUNT(*) AS count
     FROM follows mine
     JOIN follows theirs
       ON theirs.follower_id = mine.following_id
      AND theirs.following_id = mine.follower_id
     WHERE mine.follower_id = ?`,
    [userId]
  ).count;
  const objectives = all("SELECT completed FROM daily_objectives WHERE user_id = ? AND date >= ?", [userId, since.slice(0, 10)]);
  const completedObjectives = objectives.filter((objective) => objective.completed).length;
  const completionRate = objectives.length ? completedObjectives / objectives.length : 0;

  const zoneRows = all(
    `SELECT room_name, room_id, COUNT(*) AS count
     FROM room_visits
     WHERE user_id = ? AND entered_at >= ?
     GROUP BY room_name, room_id`,
    [userId, since]
  );
  const zoneCounts = new Map([
    ["Cafeteria", seenCount],
    ["Communications", dmSent],
    ["Electrical", createdPosts],
    ["Storage", savedCount],
    ["Weapons", votesCast],
  ]);
  for (const row of zoneRows) {
    const label = row.room_name || toTitleLabel(row.room_id);
    zoneCounts.set(label, (zoneCounts.get(label) || 0) + row.count);
  }
  const zoneTotal = [...zoneCounts.values()].reduce((sum, value) => sum + value, 0);
  const zones = [...zoneCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count], index) => ({
      name,
      percent: zoneTotal ? clampPercent((count / zoneTotal) * 100) : 0,
      color: ["#00d4ff", "#0f766e", "#ef3340", "#8338ec", "#f6c243"][index] || "#6c757d",
    }));

  if (zones.length === 0) {
    zones.push({ name: "No activity yet", percent: 0, color: "#6c757d" });
  }

  const engagementActions = createdPosts + commentsMade + votesCast + savedCount + dmSent;
  const focusScore = clampPercent(35 + completionRate * 30 + Math.min(25, engagementActions * 4) + Math.min(10, friendCount * 2) - Math.max(0, usageMinutes - 180) / 12);
  const replySignal = clampPercent(Math.min(100, dmSent * 18 + friendCount * 8));
  const exploreSignal = clampPercent(Math.min(100, zones.length * 18 + seenCount * 3));
  const creationSignal = clampPercent(Math.min(100, createdPosts * 25 + commentsMade * 10 + votesCast * 5));

  const rangeLabel = safeRange === "day" ? "today" : safeRange === "week" ? "last 7 days" : "last 30 days";
  const notes = [
    objectives.length
      ? `${completedObjectives}/${objectives.length} daily objectives complete for ${rangeLabel}.`
      : `No objectives recorded for ${rangeLabel} yet.`,
    engagementActions
      ? `${engagementActions} tracked interactions are backed by SQLite.`
      : "No tracked interactions yet; open rooms and interact to build analytics.",
    dmSent
      ? `${dmSent} direct message${dmSent === 1 ? "" : "s"} sent from Communications.`
      : "No Communications messages sent in this range."
  ];

  return {
    range: safeRange,
    focus: focusScore,
    stats: [
      { label: "Usage Time", value: formatDuration(usageMinutes), trend: `${sessions.length} session${sessions.length === 1 ? "" : "s"}` },
      { label: "Posts Viewed", value: String(seenCount), trend: `${commentsMade} comment${commentsMade === 1 ? "" : "s"} made` },
      { label: "Messages", value: String(dmSent), trend: `${friendCount} friend${friendCount === 1 ? "" : "s"}` },
      { label: "Saved/Votes", value: String(savedCount + votesCast), trend: `${createdPosts} post${createdPosts === 1 ? "" : "s"} created` },
    ],
    zones,
    signals: [
      { label: "Objective Completion", value: `${Math.round(completionRate * 100)}%`, percent: clampPercent(completionRate * 100) },
      { label: "Reply Activity", value: dmSent ? "Active" : "Quiet", percent: replySignal },
      { label: "Explore Balance", value: zones.length > 2 ? "Balanced" : "Narrow", percent: exploreSignal },
      { label: "Creation Health", value: createdPosts || commentsMade ? "Contributing" : "Reading", percent: creationSignal },
    ],
    notes,
    updatedAt: now(),
  };
}

function getReactorStatus() {
  const today = getTodayDateString();
  const activeSince = new Date(Date.now() - ACTIVE_SESSION_WINDOW_MS).toISOString();
  const users = get("SELECT COUNT(*) AS count FROM users").count;
  const activeSessions = get(
    `SELECT COUNT(*) AS count
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.end_time IS NULL
       AND sessions.start_time >= ?
       AND COALESCE(users.show_online_presence, 1) = 1`,
    [activeSince]
  ).count;
  const sessionsToday = get(
    `SELECT COUNT(*) AS count
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.start_time >= ?
       AND COALESCE(users.show_online_presence, 1) = 1`,
    [`${today}T00:00:00.000Z`]
  ).count;
  const posts = get("SELECT COUNT(*) AS count FROM posts").count;
  const comments = get("SELECT COUNT(*) AS count FROM comments").count;
  const dmMessages = get("SELECT COUNT(*) AS count FROM dm_messages").count;
  const roomVisits = get(
    `SELECT COUNT(*) AS count
     FROM room_visits
     JOIN users ON users.id = room_visits.user_id
     WHERE COALESCE(users.share_zone_activity, 1) = 1`
  ).count;
  const reportsOpen = get("SELECT COUNT(*) AS count FROM security_reports WHERE status = 'open'").count;
  const objectivesToday = get("SELECT COUNT(*) AS count FROM daily_objectives WHERE date = ?", [today]).count;
  const completedToday = get("SELECT COUNT(*) AS count FROM daily_objectives WHERE date = ? AND completed = 1", [today]).count;
  const totalActivity = posts + comments + dmMessages + roomVisits;
  const votes = get("SELECT COUNT(*) AS count FROM post_votes").count;
  const saves = get("SELECT COUNT(*) AS count FROM saved_posts").count;
  const follows = get("SELECT COUNT(*) AS count FROM follows").count;
  const friendships = get(
    `SELECT COUNT(*) AS count
     FROM follows mine
     JOIN follows theirs
       ON theirs.follower_id = mine.following_id
      AND theirs.following_id = mine.follower_id
     WHERE mine.follower_id < mine.following_id`
  ).count;
  const shares = get("SELECT COALESCE(SUM(shares_count), 0) AS count FROM posts").count;
  const activeRate = users ? clampPercent((activeSessions / users) * 100) : 0;
  const objectiveRate = objectivesToday ? clampPercent((completedToday / objectivesToday) * 100) : 0;
  const postsPerCrew = users ? (posts / users).toFixed(1) : "0.0";

  const topicRows = all(
    `SELECT tag, COUNT(*) AS count, COALESCE(SUM(upvotes_count), 0) AS upvotes, COALESCE(SUM(shares_count), 0) AS shares
     FROM posts
     GROUP BY tag
     ORDER BY count DESC, upvotes DESC
     LIMIT 6`
  );
  const topTopics = topicRows.length ? topicRows.map((row, index) => ({
    label: normalizePostCategory(row.tag),
    count: row.count,
    meta: `${row.upvotes} likes | ${row.shares} shares`,
    color: ["#00d4ff", "#0f766e", "#ef3340", "#8338ec", "#f6c243", "#10b981", "#6c757d", "#efa9fa"][index] || "#6c757d",
  })) : [{ label: "No topics yet", count: 0, meta: "Create a post to start tracking topics.", color: "#6c757d" }];

  const activityMix = [
    { label: "Posts", count: posts, color: "#00d4ff" },
    { label: "Comments", count: comments, color: "#0f766e" },
    { label: "DMs", count: dmMessages, color: "#8338ec" },
    { label: "Votes", count: votes, color: "#ef3340" },
    { label: "Saves", count: saves, color: "#f6c243" },
    { label: "Shares", count: shares, color: "#10b981" },
  ];

  const networkStats = [
    { label: "Follow Links", value: follows, detail: `${friendships} mutual connection${friendships === 1 ? "" : "s"}` },
    { label: "Posts per Crew", value: postsPerCrew, detail: `${posts} total post${posts === 1 ? "" : "s"}` },
    { label: "Active Rate", value: `${activeRate}%`, detail: `${activeSessions}/${users} visible active` },
    { label: "Objective Rate", value: `${objectiveRate}%`, detail: `${completedToday}/${objectivesToday} completed today` },
  ];

  return {
    status: reportsOpen > 0 ? "Security Review Needed" : "Community Stats Live",
    visitorsToday: sessionsToday,
    activeSessions,
    totalUsers: users,
    openReports: reportsOpen,
    headlineStats: [
      { label: "Registered Crew", value: users, detail: `${activeSessions} visible active now` },
      { label: "Total Activity", value: totalActivity, detail: "Posts, comments, DMs, and visible visits" },
      { label: "Engagement", value: votes + saves + shares, detail: `${votes} votes | ${saves} saves | ${shares} shares` },
      { label: "Open Reports", value: reportsOpen, detail: reportsOpen ? "Security review needed" : "No open tickets" },
    ],
    activityMix,
    topTopics,
    networkStats,
    updatedAt: now(),
  };
}

function serializeSecurityReport(row) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    type: row.type,
    target: row.target || "",
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getSecurityOverview() {
  const rows = all("SELECT * FROM security_reports ORDER BY created_at DESC LIMIT 25");
  const reports = rows.map(serializeSecurityReport);
  return {
    openCount: reports.filter((report) => report.status === "open").length,
    reports,
  };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "HEAD" && pathname === "/api/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,x-user-id,x-display-name",
    });
    return res.end();
  }
  if (req.method === "GET" && pathname === "/api/health") return json(res, 200, { ok: true });
  if (req.method === "GET" && pathname === "/api/space/apod") {
    if (apodCache && Date.now() - apodCache.cachedAt < APOD_CACHE_TTL_MS) {
      return json(res, 200, {
        success: true,
        cached: true,
        node: "APOD",
        configuredKey: NASA_API_KEY !== "DEMO_KEY",
        data: apodCache.data
      });
    }

    const errors = [];

    try {
      const apodData = await fetchApodFromApi();
      apodCache = { cachedAt: Date.now(), data: apodData };
      return json(res, 200, {
        success: true,
        cached: false,
        node: "APOD",
        configuredKey: NASA_API_KEY !== "DEMO_KEY",
        data: apodData
      });
    } catch (error) {
      errors.push({
        source: "api",
        status: error.status,
        message: String(error && error.message ? error.message : error).slice(0, 500),
        body: error.body
      });
    }

    try {
      const apodData = await fetchApodFromHtml();
      apodCache = { cachedAt: Date.now(), data: apodData };
      return json(res, 200, {
        success: true,
        cached: false,
        node: "APOD",
        configuredKey: NASA_API_KEY !== "DEMO_KEY",
        warning: "NASA APOD API timed out; using official APOD page backup.",
        errors,
        data: apodData
      });
    } catch (error) {
      errors.push({
        source: "html",
        message: String(error && error.message ? error.message : error).slice(0, 500)
      });
    }

    return json(res, 200, {
      success: false,
      node: "APOD",
      configuredKey: NASA_API_KEY !== "DEMO_KEY",
      warning: "APOD fetch failed.",
      errors,
      data: APOD_FALLBACK
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/signup") {
    const body = await readBody(req);
    const displayName = String(body.displayName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const avatarColor = String(body.avatarColor || "cyan").trim() || "cyan";

    if (!displayName) return json(res, 400, { error: "Display name is required." });
    if (!email || !email.includes("@")) return json(res, 400, { error: "Valid email is required." });
    if (password.length < 6) return json(res, 400, { error: "Password must be at least 6 characters." });

    const existing = get("SELECT id, display_name, avatar_color, password_hash FROM users WHERE email_lookup = ?", [hashEmail(email)]);
    if (existing) {
      if (!existing.password_hash) {
        run("UPDATE users SET password_hash = ?, display_name = ?, avatar_color = ? WHERE id = ?", [
          hashPassword(password),
          displayName || existing.display_name,
          avatarColor || existing.avatar_color,
          existing.id,
        ]);
        return json(res, 200, {
          user: { id: existing.id, email, displayName: displayName || existing.display_name, avatarColor: avatarColor || existing.avatar_color },
        });
      }
      return json(res, 409, { error: "Email already exists." });
    }

    const baseId = slugify(displayName) || "crewmate";
    let userId = baseId;
    let attempt = 1;
    while (get("SELECT id FROM users WHERE id = ?", [userId])) {
      attempt += 1;
      userId = `${baseId}-${attempt}`;
    }

    run(
      "INSERT INTO users (id, email, display_name, avatar_color, created_at, password_hash, email_encrypted, email_lookup) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, email, displayName, avatarColor, now(), hashPassword(password), encryptText(email), hashEmail(email)]
    );

    return json(res, 201, {
      user: { id: userId, email, displayName, avatarColor },
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const identity = String(body.identity || "").trim();
    const password = String(body.password || "");
    const authProvider = String(body.authProvider || "").trim().toLowerCase();

    if (!identity) return json(res, 400, { error: "Crew name or email is required." });

    let user = identity.includes("@")
      ? get("SELECT id, email, display_name, avatar_color, password_hash, email_encrypted FROM users WHERE email_lookup = ?", [
          hashEmail(identity),
        ])
      : get("SELECT id, email, display_name, avatar_color, password_hash, email_encrypted FROM users WHERE lower(display_name) = lower(?)", [identity]);

    if (!user && authProvider === "google" && identity.includes("@")) {
      const fallbackName = String(body.displayName || identity.split("@")[0] || "Google Crew").trim();
      const baseId = slugify(fallbackName) || "google-crew";
      let userId = baseId;
      let attempt = 1;
      while (get("SELECT id FROM users WHERE id = ?", [userId])) {
        attempt += 1;
        userId = `${baseId}-${attempt}`;
      }

      run(
        "INSERT INTO users (id, email, display_name, avatar_color, created_at, password_hash, email_encrypted, email_lookup) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          userId,
          identity.toLowerCase(),
          fallbackName,
          "cyan",
          now(),
          null,
          encryptText(identity.toLowerCase()),
          hashEmail(identity),
        ]
      );

      user = get("SELECT id, email, display_name, avatar_color, password_hash, email_encrypted FROM users WHERE id = ?", [userId]);
    }

    if (!user) return json(res, 404, { error: "User not found. Please sign up first." });

    if (authProvider !== "google") {
      if (!user.password_hash) {
        return json(res, 400, { error: "This account has no password yet. Please sign up again or use Google." });
      }
      if (!verifyPassword(password, user.password_hash)) {
        return json(res, 401, { error: "Invalid password." });
      }
    }

    return json(res, 200, {
      user: {
        id: user.id,
        email: user.email_encrypted ? decryptText(user.email_encrypted) : user.email,
        displayName: user.display_name,
        avatarColor: user.avatar_color,
      },
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/reset-password") {
    const body = await readBody(req);
    const identity = String(body.identity || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!identity) return json(res, 400, { error: "Crew name or email is required." });
    if (newPassword.length < 6) return json(res, 400, { error: "New password must be at least 6 characters." });

    const user = identity.includes("@")
      ? get("SELECT id FROM users WHERE email_lookup = ?", [hashEmail(identity)])
      : get("SELECT id FROM users WHERE lower(display_name) = lower(?)", [identity]);

    if (!user) return json(res, 404, { error: "User not found." });

    run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(newPassword), user.id]);
    return json(res, 200, { reset: true, userId: user.id });
  }

  const userId = getUserId(req);
  ensureRequestUser(req, userId);

  if (req.method === "GET" && pathname === "/api/users/me") {
    const user = get("SELECT id, email, email_encrypted, display_name, avatar_color, created_at, privacy_mode, dm_permissions, content_filter, show_online_presence, share_zone_activity, critical_alerts FROM users WHERE id = ?", [userId]);
    if (!user) return json(res, 404, { error: "User not found." });
    return json(res, 200, {
      user: {
        id: user.id,
        email: user.email_encrypted ? decryptText(user.email_encrypted) : user.email,
        displayName: user.display_name,
        avatarColor: user.avatar_color,
        createdAt: user.created_at,
        privacySettings: normalizePrivacySettings(user),
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/users/me/privacy") {
    const user = get("SELECT privacy_mode, dm_permissions, content_filter, show_online_presence, share_zone_activity, critical_alerts FROM users WHERE id = ?", [userId]);
    if (!user) return json(res, 404, { error: "User not found." });
    return json(res, 200, { privacySettings: normalizePrivacySettings(user) });
  }

  if (req.method === "PATCH" && pathname === "/api/users/me/privacy") {
    const body = await readBody(req);
    const current = get("SELECT privacy_mode, dm_permissions, content_filter, show_online_presence, share_zone_activity, critical_alerts FROM users WHERE id = ?", [userId]);
    if (!current) return json(res, 404, { error: "User not found." });
    const currentSettings = normalizePrivacySettings(current);
    const nextSettings = normalizePrivacySettings({
      privacyMode: body.privacyMode ?? currentSettings.privacyMode,
      dmPermissions: body.dmPermissions ?? currentSettings.dmPermissions,
      contentFilter: body.contentFilter ?? currentSettings.contentFilter,
      showOnlinePresence: body.showOnlinePresence ?? currentSettings.showOnlinePresence,
      shareZoneActivity: body.shareZoneActivity ?? currentSettings.shareZoneActivity,
      criticalAlerts: body.criticalAlerts ?? currentSettings.criticalAlerts,
    });
    run(
      `UPDATE users
       SET privacy_mode = ?,
           dm_permissions = ?,
           content_filter = ?,
           show_online_presence = ?,
           share_zone_activity = ?,
           critical_alerts = ?
       WHERE id = ?`,
      [
        nextSettings.privacyMode,
        nextSettings.dmPermissions,
        nextSettings.contentFilter,
        nextSettings.showOnlinePresence ? 1 : 0,
        nextSettings.shareZoneActivity ? 1 : 0,
        nextSettings.criticalAlerts ? 1 : 0,
        userId,
      ]
    );
    broadcastSSE("privacy_settings_changed", { userId, privacySettings: nextSettings });
    return json(res, 200, { privacySettings: nextSettings });
  }

  if (req.method === "GET" && pathname === "/api/users/me/analytics") {
    const range = url.searchParams.get("range") || "day";
    return json(res, 200, { analytics: getMedbayAnalytics(userId, range) });
  }

  if (req.method === "POST" && pathname === "/api/rooms/visit") {
    const body = await readBody(req);
    const roomId = String(body.roomId || "").trim().toLowerCase();
    const roomName = String(body.roomName || toTitleLabel(roomId)).trim();
    if (!roomId || roomId.length > 64) return json(res, 400, { error: "Room ID is required." });
    if (!roomName || roomName.length > 80) return json(res, 400, { error: "Room name is required." });

    const id = randomUUID();
    const enteredAt = now();
    run(
      "INSERT INTO room_visits (id, user_id, room_id, room_name, entered_at) VALUES (?, ?, ?, ?, ?)",
      [id, userId, roomId, roomName, enteredAt]
    );
    const visit = { id, userId, roomId, roomName, enteredAt };
    if (getUserPrivacySettings(userId).shareZoneActivity) {
      broadcastSSE("room_visit_created", { visit });
    }
    return json(res, 201, { visit });
  }

  if (req.method === "GET" && pathname === "/api/system/reactor") {
    return json(res, 200, { reactor: getReactorStatus() });
  }

  if (req.method === "GET" && pathname === "/api/security/reports") {
    return json(res, 200, getSecurityOverview());
  }

  if (req.method === "POST" && pathname === "/api/security/report-email-test") {
    const email = await emailDevelopersAboutReport({
      id: "test-email",
      reporterId: userId,
      type: "test",
      target: "Developer email setup",
      detail: "This is a test email from the DevSpace Security report notification setup.",
      status: "open",
      createdAt: now(),
    });
    return json(res, email.sent ? 200 : 500, { email });
  }

  if (req.method === "POST" && pathname === "/api/security/reports") {
    const body = await readBody(req);
    const type = String(body.type || "other").trim().toLowerCase();
    const target = String(body.target || "").trim();
    const detail = String(body.detail || "").trim();
    const allowedTypes = new Set(["harassment", "spam", "impersonation", "bug", "other"]);
    if (!allowedTypes.has(type)) return json(res, 400, { error: "Invalid report type." });
    if (detail.length < 5 || detail.length > 1000) return json(res, 400, { error: "Report detail must be 5-1000 characters." });

    const id = randomUUID();
    const timestamp = now();
    run(
      "INSERT INTO security_reports (id, reporter_id, type, target, detail, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, userId, type, target, detail, "open", timestamp, timestamp]
    );
    const report = serializeSecurityReport(get("SELECT * FROM security_reports WHERE id = ?", [id]));
    const email = await emailDevelopersAboutReport(report);
    broadcastSSE("security_report_created", { report });
    return json(res, 201, { report, overview: getSecurityOverview(), email });
  }

  if (req.method === "GET" && pathname === "/api/posts") {
    const feed = String(url.searchParams.get("feed") || "new");
    const rawTag = String(url.searchParams.get("tag") || "").trim();
    const tag = rawTag ? normalizePostCategory(rawTag) : "";
    const unseenOnly = url.searchParams.get("unseen") === "1";
    const mineOnly = url.searchParams.get("mine") === "1";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
    const whereParts = [];
    const params = [];

    if (mineOnly) {
      whereParts.push("posts.user_id = ?");
      params.push(userId);
    }
    if (tag) {
      whereParts.push("posts.tag = ?");
      params.push(tag);
    }
    if (unseenOnly) {
      whereParts.push("seen_posts.post_id IS NULL");
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const orderBy = {
      top: "posts.upvotes_count DESC, comments_count DESC, posts.created_at DESC",
      rising: "(posts.upvotes_count - posts.downvotes_count + comments_count * 2) DESC, posts.created_at DESC",
      controversial: "MIN(posts.upvotes_count, posts.downvotes_count) * 1.0 / MAX(posts.upvotes_count + posts.downvotes_count, 1) DESC, comments_count DESC",
      new: "posts.created_at DESC",
    }[feed] || "posts.created_at DESC";

    return json(res, 200, { posts: selectPostsForUser({ userId, where, params, orderBy, limit }) });
  }

  if (req.method === "POST" && pathname === "/api/post-images") {
    try {
      const buffer = await readRawBody(req, POST_IMAGE_MAX_BYTES + 512_000);
      const file = parseMultipartFile(buffer, req.headers["content-type"], "image");
      const imageUrl = await uploadPostImageToCloudinary(file);
      return json(res, 201, { imageUrl });
    } catch (error) {
      const message = error.message || "Image upload failed.";
      const status = /not configured/i.test(message) ? 503 : /too large|5 MB|jpeg|png|webp|gif|multipart|image file/i.test(message) ? 400 : 502;
      return json(res, status, { error: message });
    }
  }

  if (req.method === "POST" && pathname === "/api/posts") {
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    const postBody = String(body.body || body.content || "").trim();
    const tag = normalizePostCategory(body.tag);
    const roomId = String(body.roomId || "cafeteria").trim();
    let imageUrl = "";

    if (title.length < 1 || title.length > 120) {
      return json(res, 400, { error: "Post title must be 1-120 characters." });
    }
    if (postBody.length < 1 || postBody.length > 2000) {
      return json(res, 400, { error: "Post body must be 1-2000 characters." });
    }
    const parentalError = validateParentalContent(userId, title, postBody);
    if (parentalError) return json(res, 400, { error: parentalError });
    try {
      imageUrl = normalizeImageUrl(body.imageUrl);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }

    const id = randomUUID();
    run(
      "INSERT INTO posts (id, user_id, content, title, body, tag, image_url, room_id, likes_count, upvotes_count, downvotes_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, userId, postBody, title, postBody, tag, imageUrl, roomId, 0, 0, 0, now()]
    );

    const posts = selectPostsForUser({ userId, where: "WHERE posts.id = ?", params: [id], limit: 1 });
    broadcastSSE("post_created", { post: posts[0] });
    return json(res, 201, { post: posts[0] });
  }

  const deletePostMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (req.method === "DELETE" && deletePostMatch) {
    const postId = deletePostMatch[1];
    const post = get("SELECT id, user_id FROM posts WHERE id = ?", [postId]);
    if (!post) return json(res, 404, { error: "Post not found." });
    if (post.user_id !== userId) return json(res, 403, { error: "Only the post owner can delete this post." });

    run("DELETE FROM saved_posts WHERE post_id = ?", [postId]);
    run("DELETE FROM seen_posts WHERE post_id = ?", [postId]);
    run("DELETE FROM post_votes WHERE post_id = ?", [postId]);
    run("DELETE FROM comments WHERE post_id = ?", [postId]);
    run("DELETE FROM posts WHERE id = ?", [postId]);
    broadcastSSE("post_deleted", { postId });
    return json(res, 200, { deleted: true, postId });
  }

  const savePostMatch = pathname.match(/^\/api\/posts\/([^/]+)\/save$/);
  if (req.method === "POST" && savePostMatch) {
    const postId = savePostMatch[1];
    const post = get("SELECT id FROM posts WHERE id = ?", [postId]);
    if (!post) return json(res, 404, { error: "Post not found." });

    run(
      "INSERT OR IGNORE INTO saved_posts (user_id, post_id, created_at) VALUES (?, ?, ?)",
      [userId, postId, now()]
    );
    return json(res, 200, { saved: true, postId });
  }

  const unsavePostMatch = pathname.match(/^\/api\/posts\/([^/]+)\/save$/);
  if (req.method === "DELETE" && unsavePostMatch) {
    const postId = unsavePostMatch[1];
    run("DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?", [userId, postId]);
    return json(res, 200, { saved: false, postId });
  }

  const seenPostMatch = pathname.match(/^\/api\/posts\/([^/]+)\/seen$/);
  if (req.method === "POST" && seenPostMatch) {
    const postId = seenPostMatch[1];
    const post = get("SELECT id FROM posts WHERE id = ?", [postId]);
    if (!post) return json(res, 404, { error: "Post not found." });

    const result = run(
      "INSERT OR IGNORE INTO seen_posts (user_id, post_id, seen_at) VALUES (?, ?, ?)",
      [userId, postId, now()]
    );
    if (result.changes > 0) {
      incrementObjective(userId, "read");
    }
    return json(res, 200, { seen: true, postId });
  }

  if (req.method === "DELETE" && seenPostMatch) {
    run("DELETE FROM seen_posts WHERE user_id = ? AND post_id = ?", [userId, seenPostMatch[1]]);
    return json(res, 200, { seen: false, postId: seenPostMatch[1] });
  }

  if (req.method === "GET" && pathname === "/api/saved-posts") {
    return json(res, 200, {
      posts: selectPostsForUser({
        userId,
        where: "WHERE saved_posts.post_id IS NOT NULL",
        orderBy: "saved_posts.created_at DESC",
        limit: 100,
      }),
    });
  }

  if (req.method === "GET" && pathname === "/api/missions") {
    const missions = all(
      `SELECT missions.*,
        CASE WHEN mission_members.user_id IS NULL THEN 0 ELSE 1 END AS joined
       FROM missions
       LEFT JOIN mission_members
         ON mission_members.mission_id = missions.id
        AND mission_members.user_id = ?
       ORDER BY missions.created_at DESC`,
      [userId]
    ).map((mission) => ({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      roomId: mission.room_id,
      points: mission.points,
      joined: Boolean(mission.joined),
      createdAt: mission.created_at,
    }));

    return json(res, 200, { missions });
  }

  const joinMissionMatch = pathname.match(/^\/api\/missions\/([^/]+)\/join$/);
  if (req.method === "POST" && joinMissionMatch) {
    const missionId = joinMissionMatch[1];
    const mission = get("SELECT id FROM missions WHERE id = ?", [missionId]);
    if (!mission) return json(res, 404, { error: "Mission not found." });

    run(
      "INSERT OR IGNORE INTO mission_members (mission_id, user_id, joined_at) VALUES (?, ?, ?)",
      [missionId, userId, now()]
    );
    return json(res, 200, { joined: true, missionId });
  }

  if (req.method === "GET" && pathname === "/api/notifications") {
    const notifications = all(
      "SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    ).map((notification) => ({
      id: notification.id,
      message: notification.message,
      isRead: Boolean(notification.is_read),
      createdAt: notification.created_at,
    }));
    return json(res, 200, { notifications });
  }

  const readNotificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (req.method === "PATCH" && readNotificationMatch) {
    run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [readNotificationMatch[1], userId]);
    return json(res, 200, { read: true, notificationId: readNotificationMatch[1] });
  }

  // --- Profile Systems ---
  
  const userProfileMatch = pathname.match(/^\/api\/users\/([^/]+)\/profile$/);
  if (req.method === "GET" && userProfileMatch) {
    const profileId = userProfileMatch[1];
    const user = get("SELECT id, display_name, avatar_color, bio, decorations, favourite_topics, created_at, privacy_mode, show_online_presence, share_zone_activity FROM users WHERE id = ?", [profileId]);
    if (!user) return json(res, 404, { error: "User not found." });
    if (!canViewCrewProfile(userId, profileId)) return json(res, 403, { error: "This profile is private." });
    
    const followers = get("SELECT COUNT(*) as count FROM follows WHERE following_id = ?", [profileId]).count;
    const following = get("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", [profileId]).count;
    const settings = normalizePrivacySettings(user);
    const connections = getVisibleCrewConnections(profileId, userId);
    const posts = selectPostsForUser({
      userId,
      where: "WHERE posts.user_id = ?",
      params: [profileId],
      orderBy: "posts.created_at DESC",
      limit: 12,
    });
    
    return json(res, 200, {
      profile: {
        id: user.id,
        displayName: user.display_name,
        avatarColor: user.avatar_color,
        bio: user.bio || "",
        decorations: JSON.parse(user.decorations || "[]"),
        favouriteTopics: JSON.parse(user.favourite_topics || "[]"),
        followersCount: followers,
        followingCount: following,
        createdAt: user.created_at,
        onlinePresenceVisible: settings.showOnlinePresence,
        zoneActivityVisible: settings.shareZoneActivity,
        privacyMode: settings.privacyMode,
        relationship: getCrewRelationship(userId, profileId),
        posts,
        friends: connections.friends,
        following: connections.following,
        followers: connections.followers,
      }
    });
  }

  if (req.method === "PATCH" && pathname === "/api/users/me/profile") {
    const body = await readBody(req);
    const bio = body.bio !== undefined ? String(body.bio) : null;
    const decorations = Array.isArray(body.decorations) ? JSON.stringify(body.decorations) : null;
    const favouriteTopics = Array.isArray(body.favouriteTopics) ? JSON.stringify(body.favouriteTopics) : null;
    
    const currentUser = get("SELECT bio, decorations, favourite_topics FROM users WHERE id = ?", [userId]);
    if (!currentUser) return json(res, 404, { error: "User not found." });

    const newBio = bio !== null ? bio : currentUser.bio;
    const newDecorations = decorations !== null ? decorations : currentUser.decorations;
    const newTopics = favouriteTopics !== null ? favouriteTopics : currentUser.favourite_topics;

    run("UPDATE users SET bio = ?, decorations = ?, favourite_topics = ? WHERE id = ?", [newBio, newDecorations, newTopics, userId]);
    return json(res, 200, { updated: true });
  }

  if (req.method === "GET" && pathname === "/api/users/me/crewmates") {
    const hiddenFilter = visibleCrewFilterSql("users");
    const following = all(
      `SELECT users.id, users.display_name, users.avatar_color, follows.created_at
       FROM follows
       JOIN users ON users.id = follows.following_id
       WHERE follows.follower_id = ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
       ORDER BY follows.created_at DESC`,
      [userId, userId, userId]
    ).filter((row) => canViewCrewProfile(userId, row.id)).map((row) => serializeCrewmateWithRelationship(row, userId, { connectedAt: row.created_at }));

    const followers = all(
      `SELECT users.id, users.display_name, users.avatar_color, follows.created_at
       FROM follows
       JOIN users ON users.id = follows.follower_id
       WHERE follows.following_id = ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
       ORDER BY follows.created_at DESC`,
      [userId, userId, userId]
    ).filter((row) => canViewCrewProfile(userId, row.id)).map((row) => serializeCrewmateWithRelationship(row, userId, { connectedAt: row.created_at }));

    const friends = following.filter((row) => row.relationship === "friend");

    const suggestions = all(
      `SELECT users.id, users.display_name, users.avatar_color
       FROM users
       WHERE users.id <> ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
         AND users.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
       ORDER BY users.created_at DESC
       LIMIT 8`,
      [userId, userId, userId, userId]
    ).filter((row) => canViewCrewProfile(userId, row.id)).map((row) => serializeCrewmateWithRelationship(row, userId));

    return json(res, 200, {
      friends,
      following,
      followers,
      suggestions,
      counts: {
        friends: friends.length,
        following: following.length,
        followers: followers.length,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/users/search") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (query.length < 1) return json(res, 200, { users: [] });
    const like = `%${query}%`;
    const hiddenFilter = visibleCrewFilterSql("users");
    const users = all(
      `SELECT users.id, users.display_name, users.avatar_color
       FROM users
       WHERE users.id <> ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
         AND (users.display_name LIKE ? OR users.id LIKE ?)
       ORDER BY users.display_name COLLATE NOCASE ASC, users.created_at DESC
       LIMIT 20`,
      [userId, userId, like, like]
    ).filter((row) => !isGeneratedRegressionUserId(row.id) && canViewCrewProfile(userId, row.id)).map((row) => serializeCrewmateWithRelationship(row, userId));
    return json(res, 200, { users });
  }

  if (req.method === "GET" && pathname === "/api/users/me/blocked-users") {
    const blockedUsers = all(
      `SELECT users.id, users.display_name, users.avatar_color, blocked_users.created_at
       FROM blocked_users
       JOIN users ON users.id = blocked_users.blocked_id
       WHERE blocked_users.blocker_id = ?
       ORDER BY blocked_users.created_at DESC`,
      [userId]
    ).map((row) => serializeCrewmateRow(row, { blockedAt: row.created_at, relationship: "blocked" }));
    return json(res, 200, { blockedUsers });
  }

  if (req.method === "POST" && pathname === "/api/users/me/blocked-users") {
    const body = await readBody(req);
    const blockedUserId = String(body.blockedUserId || "").trim();
    if (!blockedUserId) return json(res, 400, { error: "Blocked user ID is required." });
    if (blockedUserId === userId) return json(res, 400, { error: "Cannot block yourself." });
    const target = get("SELECT id FROM users WHERE id = ?", [blockedUserId]);
    if (!target) return json(res, 404, { error: "User not found." });

    const timestamp = now();
    run("INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)", [userId, blockedUserId, timestamp]);
    run("DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)", [userId, blockedUserId, blockedUserId, userId]);
    const [u1, u2] = orderedUserPair(userId, blockedUserId);
    run("DELETE FROM friendships WHERE user_id1 = ? AND user_id2 = ?", [u1, u2]);
    run("DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", [userId, blockedUserId, blockedUserId, userId]);
    broadcastSSE("friend_list_changed", { userId, otherUserId: blockedUserId });
    return json(res, 200, { blocked: true });
  }

  const unblockMatch = pathname.match(/^\/api\/users\/me\/blocked-users\/([^/]+)$/);
  if (req.method === "DELETE" && unblockMatch) {
    const blockedUserId = decodeURIComponent(unblockMatch[1]);
    run("DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?", [userId, blockedUserId]);
    broadcastSSE("friend_list_changed", { userId, otherUserId: blockedUserId });
    return json(res, 200, { unblocked: true });
  }

  const followMatch = pathname.match(/^\/api\/users\/([^/]+)\/follow$/);
  if (req.method === "POST" && followMatch) {
    const followingId = decodeURIComponent(followMatch[1]);
    if (followingId === userId) return json(res, 400, { error: "Cannot follow yourself." });
    const target = get("SELECT id FROM users WHERE id = ?", [followingId]);
    if (!target) return json(res, 404, { error: "User not found." });
    if (areBlockedEitherWay(userId, followingId)) return json(res, 403, { error: "Cannot follow a blocked crewmate." });
    if (!canViewCrewProfile(userId, followingId)) return json(res, 403, { error: "This profile is private." });

    run("INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)", [userId, followingId, now()]);
    incrementObjective(userId, "request");
    broadcastSSE("friend_list_changed", { followerId: userId, followingId });
    return json(res, 200, { followed: true, relationship: getCrewRelationship(userId, followingId) });
  }

  const unfollowMatch = pathname.match(/^\/api\/users\/([^/]+)\/unfollow$/);
  if (req.method === "POST" && unfollowMatch) {
    const followingId = decodeURIComponent(unfollowMatch[1]);
    run("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", [userId, followingId]);
    broadcastSSE("friend_list_changed", { followerId: userId, followingId });
    return json(res, 200, { unfollowed: true, relationship: getCrewRelationship(userId, followingId) });
  }

  // --- Post Social Features ---

  const postVoteMatch = pathname.match(/^\/api\/posts\/([^/]+)\/vote$/);
  if (req.method === "POST" && postVoteMatch) {
    const postId = postVoteMatch[1];
    const body = await readBody(req);
    const type = String(body.type || "");
    if (type !== "up" && type !== "down") return json(res, 400, { error: "Vote type must be 'up' or 'down'." });
    
    const post = get("SELECT id FROM posts WHERE id = ?", [postId]);
    if (!post) return json(res, 404, { error: "Post not found." });

    const existingVote = get("SELECT vote_type FROM post_votes WHERE user_id = ? AND post_id = ?", [userId, postId]);

    if (existingVote) {
      if (existingVote.vote_type === type) {
        run("DELETE FROM post_votes WHERE user_id = ? AND post_id = ?", [userId, postId]);
        if (type === "up") {
          run("UPDATE posts SET upvotes_count = upvotes_count - 1 WHERE id = ?", [postId]);
        } else {
          run("UPDATE posts SET upvotes_count = upvotes_count + 1, downvotes_count = downvotes_count - 1 WHERE id = ?", [postId]);
        }
      } else {
        run("UPDATE post_votes SET vote_type = ? WHERE user_id = ? AND post_id = ?", [type, userId, postId]);
        const otherType = type === "up" ? "down" : "up";
        if (type === "up") {
          run("UPDATE posts SET upvotes_count = upvotes_count + 2, downvotes_count = downvotes_count - 1 WHERE id = ?", [postId]);
        } else {
          run("UPDATE posts SET upvotes_count = upvotes_count - 2, downvotes_count = downvotes_count + 1 WHERE id = ?", [postId]);
        }
      }
    } else {
      run("INSERT INTO post_votes (user_id, post_id, vote_type, created_at) VALUES (?, ?, ?, ?)", [userId, postId, type, now()]);
      if (type === "up") {
        run("UPDATE posts SET upvotes_count = upvotes_count + 1 WHERE id = ?", [postId]);
      } else {
        run("UPDATE posts SET upvotes_count = upvotes_count - 1, downvotes_count = downvotes_count + 1 WHERE id = ?", [postId]);
      }
    }
    
    const updatedStats = get("SELECT upvotes_count, downvotes_count FROM posts WHERE id = ?", [postId]);
    broadcastSSE("vote_changed", { postId, upvotes: updatedStats.upvotes_count, downvotes: updatedStats.downvotes_count });
    return json(res, 200, { voted: true, upvotes: updatedStats.upvotes_count, downvotes: updatedStats.downvotes_count });
  }

  const postCommentsMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
  if (req.method === "GET" && postCommentsMatch) {
    const postId = postCommentsMatch[1];
    const comments = all(
      `SELECT comments.*, users.display_name 
       FROM comments 
       JOIN users ON users.id = comments.user_id 
       WHERE comments.post_id = ? 
       ORDER BY comments.created_at ASC`, [postId]
    ).map(row => ({
      id: row.id,
      authorName: row.display_name,
      content: row.content,
      createdAt: row.created_at
    }));
    return json(res, 200, { comments });
  }

  if (req.method === "POST" && postCommentsMatch) {
    const postId = postCommentsMatch[1];
    const body = await readBody(req);
    const content = String(body.content || "").trim();
    if (content.length < 1 || content.length > 500) return json(res, 400, { error: "Comment must be 1-500 characters." });
    const parentalError = validateParentalContent(userId, content);
    if (parentalError) return json(res, 400, { error: parentalError });

    const post = get("SELECT id FROM posts WHERE id = ?", [postId]);
    if (!post) return json(res, 404, { error: "Post not found." });

    const id = randomUUID();
    run("INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)", [id, postId, userId, content, now()]);
    
    const newComment = get(`SELECT comments.*, users.display_name FROM comments JOIN users ON users.id = comments.user_id WHERE comments.id = ?`, [id]);
    
    incrementObjective(userId, "comment");
    broadcastSSE("comment_created", {
      postId,
      comment: {
        id: newComment.id,
        authorName: newComment.display_name,
        content: newComment.content,
        createdAt: newComment.created_at
      }
    });

    return json(res, 201, { 
      comment: {
        id: newComment.id,
        authorName: newComment.display_name,
        content: newComment.content,
        createdAt: newComment.created_at
      }
    });
  }

  const postShareMatch = pathname.match(/^\/api\/posts\/([^/]+)\/share$/);
  if (req.method === "POST" && postShareMatch) {
    const postId = postShareMatch[1];
    const post = get("SELECT id FROM posts WHERE id = ?", [postId]);
    if (!post) return json(res, 404, { error: "Post not found." });

    run("UPDATE posts SET shares_count = shares_count + 1 WHERE id = ?", [postId]);
    const updated = get("SELECT shares_count FROM posts WHERE id = ?", [postId]);
    return json(res, 200, { shared: true, shares: updated.shares_count });
  }

  // --- Direct Messages ---

  if (req.method === "GET" && pathname === "/api/dm/threads") {
    const rows = all(
      `SELECT dm_threads.*
       FROM dm_threads
       JOIN dm_thread_members ON dm_thread_members.thread_id = dm_threads.id
       WHERE dm_thread_members.user_id = ?
       ORDER BY dm_threads.updated_at DESC`,
      [userId]
    ).filter((row) => row.is_group || !areBlockedEitherWay(userId, row.user_id1 === userId ? row.user_id2 : row.user_id1));
    return json(res, 200, { threads: rows.map((row) => serializeDmThread(row, userId)) });
  }

  if (req.method === "POST" && pathname === "/api/dm/groups") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const memberIds = Array.isArray(body.memberIds)
      ? [...new Set(body.memberIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : [];
    if (name.length < 1 || name.length > 60) return json(res, 400, { error: "Group name must be 1-60 characters." });
    if (memberIds.length < 2 || memberIds.length > 8) return json(res, 400, { error: "Choose 2-8 friends for a group." });
    if (memberIds.includes(userId)) return json(res, 400, { error: "You are already included in the group." });

    for (const memberId of memberIds) {
      const member = get("SELECT id FROM users WHERE id = ?", [memberId]);
      if (!member) return json(res, 404, { error: "A selected crewmate was not found." });
      if (areBlockedEitherWay(userId, memberId)) return json(res, 403, { error: "Groups cannot include blocked crewmates." });
      if (getCrewRelationship(userId, memberId) !== "friend") return json(res, 403, { error: "Groups can only include mutual friends." });
      if (!canDmUser(userId, memberId)) return json(res, 403, { error: "A selected crewmate's DM permissions prevent group messages." });
    }

    const thread = createGroupThread(userId, name, memberIds);
    const sender = get("SELECT display_name FROM users WHERE id = ?", [userId]);
    for (const memberId of memberIds) {
      createNotification(memberId, `${sender?.display_name || userId} added you to ${name}.`);
    }
    broadcastSSE("dm_group_created", { threadId: thread.id, memberIds: [userId, ...memberIds] });
    return json(res, 201, { thread: serializeDmThread(thread, userId) });
  }

  if (req.method === "POST" && pathname === "/api/dm/threads") {
    const body = await readBody(req);
    const receiverId = String(body.receiverId || "").trim();
    if (!receiverId) return json(res, 400, { error: "Receiver ID is required." });
    if (receiverId === userId) return json(res, 400, { error: "Cannot DM yourself." });

    const receiver = get("SELECT id FROM users WHERE id = ?", [receiverId]);
    if (!receiver) return json(res, 404, { error: "User not found." });
    if (areBlockedEitherWay(userId, receiverId)) return json(res, 403, { error: "This DM is blocked." });
    if (!canDmUser(userId, receiverId)) return json(res, 403, { error: "This crewmate's DM permissions prevent that message." });

    const thread = createThreadForUsers(userId, receiverId);
    return json(res, 200, { thread: serializeDmThread(thread, userId) });
  }

  const dmMessagesMatch = pathname.match(/^\/api\/dm\/threads\/([^/]+)\/messages$/);
  if (req.method === "GET" && dmMessagesMatch) {
    const threadId = dmMessagesMatch[1];
    const thread = getDmThreadForUser(threadId, userId);
    if (!thread) return json(res, 404, { error: "DM thread not found." });
    const isGroup = Boolean(thread.is_group);
    const otherUserId = thread.user_id1 === userId ? thread.user_id2 : thread.user_id1;
    if (!isGroup && areBlockedEitherWay(userId, otherUserId)) return json(res, 403, { error: "This DM is blocked." });

    const readAt = now();
    const unreadFromOther = all(
      "SELECT id, sender_id FROM dm_messages WHERE thread_id = ? AND sender_id <> ? AND read_at IS NULL",
      [threadId, userId]
    );
    if (unreadFromOther.length > 0) {
      run(
        "UPDATE dm_messages SET read_at = ? WHERE thread_id = ? AND sender_id <> ? AND read_at IS NULL",
        [readAt, threadId, userId]
      );
      const senderIds = [...new Set(unreadFromOther.map((message) => message.sender_id))];
      broadcastSSE("dm_messages_read", {
        threadId,
        readerId: userId,
        senderIds,
        messageIds: unreadFromOther.map((message) => message.id),
        readAt,
      });
    }

    const messages = all(
      `SELECT dm_messages.*, users.display_name
       FROM dm_messages
       LEFT JOIN users ON users.id = dm_messages.sender_id
       WHERE dm_messages.thread_id = ?
       ORDER BY dm_messages.created_at ASC
       LIMIT 100`,
      [threadId]
    ).map((row) => serializeDmMessage(row, userId));

    return json(res, 200, { thread: serializeDmThread(thread, userId), messages });
  }

  if (req.method === "POST" && dmMessagesMatch) {
    const threadId = dmMessagesMatch[1];
    const thread = getDmThreadForUser(threadId, userId);
    if (!thread) return json(res, 404, { error: "DM thread not found." });
    const isGroup = Boolean(thread.is_group);
    const otherUserId = thread.user_id1 === userId ? thread.user_id2 : thread.user_id1;
    const members = getDmThreadMembers(threadId);
    if (!isGroup && areBlockedEitherWay(userId, otherUserId)) return json(res, 403, { error: "This DM is blocked." });
    if (!isGroup && !canDmUser(userId, otherUserId)) return json(res, 403, { error: "This crewmate's DM permissions prevent that message." });
    if (isGroup) {
      for (const member of members) {
        if (member.id === userId) continue;
        if (areBlockedEitherWay(userId, member.id)) return json(res, 403, { error: "This group includes a blocked crewmate." });
      }
    }

    const body = await readBody(req);
    const content = String(body.body || body.content || "").trim();
    if (content.length < 1 || content.length > 1000) return json(res, 400, { error: "Message must be 1-1000 characters." });
    const parentalError = validateParentalContent(userId, content);
    if (parentalError) return json(res, 400, { error: parentalError });

    const id = randomUUID();
    const timestamp = now();
    run("INSERT INTO dm_messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)", [id, threadId, userId, content, timestamp]);
    run("UPDATE dm_threads SET updated_at = ? WHERE id = ?", [timestamp, threadId]);

    const row = get(
      `SELECT dm_messages.*, users.display_name
       FROM dm_messages
       LEFT JOIN users ON users.id = dm_messages.sender_id
       WHERE dm_messages.id = ?`,
      [id]
    );
    const message = serializeDmMessage(row, userId);
    const receiverIds = isGroup
      ? members.map((member) => member.id).filter((id) => id !== userId)
      : [thread.user_id1 === userId ? thread.user_id2 : thread.user_id1];
    for (const receiverId of receiverIds) {
      createNotification(receiverId, isGroup ? `${message.senderName} posted in ${thread.name || "Crew Group"}.` : `${message.senderName} sent you a DM.`);
    }
    broadcastSSE("dm_message_created", { threadId, receiverIds, senderId: userId, message });
    return json(res, 201, { message });
  }

  // --- Friends System Endpoints ---

  if (req.method === "GET" && pathname === "/api/friends/list") {
    const hiddenFilter = visibleCrewFilterSql("users");
    const friends = all(
      `SELECT users.id, users.display_name, users.avatar_color, mine.created_at
       FROM follows mine
       JOIN follows theirs
         ON theirs.follower_id = mine.following_id
        AND theirs.following_id = mine.follower_id
       JOIN users ON users.id = mine.following_id
       WHERE mine.follower_id = ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
       ORDER BY mine.created_at DESC`,
      [userId, userId, userId]
    ).filter((row) => canViewCrewProfile(userId, row.id)).map(row => serializeCrewmateWithRelationship(row, userId, { connectedAt: row.created_at }));

    const following = all(
      `SELECT users.id, users.display_name, users.avatar_color, follows.created_at
       FROM follows
       JOIN users ON users.id = follows.following_id
       WHERE follows.follower_id = ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
      ORDER BY follows.created_at DESC`,
      [userId, userId, userId]
    ).filter((row) => canViewCrewProfile(userId, row.id)).map(row => serializeCrewmateWithRelationship(row, userId, { connectedAt: row.created_at }));

    const followers = all(
      `SELECT users.id, users.display_name, users.avatar_color, follows.created_at
       FROM follows
       JOIN users ON users.id = follows.follower_id
       WHERE follows.following_id = ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
      ORDER BY follows.created_at DESC`,
      [userId, userId, userId]
    ).filter((row) => canViewCrewProfile(userId, row.id)).map(row => serializeCrewmateWithRelationship(row, userId, { connectedAt: row.created_at }));

    const blockedUsers = all(
      `SELECT users.id, users.display_name, users.avatar_color, blocked_users.created_at
       FROM blocked_users
       JOIN users ON users.id = blocked_users.blocked_id
       WHERE blocked_users.blocker_id = ?
       ORDER BY blocked_users.created_at DESC`,
      [userId]
    ).map(row => serializeCrewmateRow(row, { blockedAt: row.created_at, relationship: "blocked" }));

    const suggestions = all(
      `SELECT users.id, users.display_name, users.avatar_color
       FROM users
       WHERE users.id <> ?
         ${hiddenFilter}
         AND users.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
         AND users.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
         AND users.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = ?)
       ORDER BY users.created_at DESC
       LIMIT 10`,
      [userId, userId, userId, userId]
    ).filter((row) => canViewCrewProfile(userId, row.id)).map(row => serializeCrewmateWithRelationship(row, userId));

    return json(res, 200, {
      friends,
      incoming: [],
      outgoing: [],
      following,
      followers,
      suggestions,
      blockedUsers,
      counts: {
        friends: friends.length,
        following: following.length,
        followers: followers.length,
        blocked: blockedUsers.length,
      },
    });
  }

  if (req.method === "POST" && pathname === "/api/friends/request") {
    const body = await readBody(req);
    const receiverId = String(body.receiverId || "").trim();
    if (!receiverId) return json(res, 400, { error: "Receiver ID is required." });
    if (receiverId === userId) return json(res, 400, { error: "Cannot request friendship with yourself." });

    const receiver = get("SELECT id, display_name FROM users WHERE id = ?", [receiverId]);
    if (!receiver) return json(res, 404, { error: "User not found." });
    if (!canViewCrewProfile(userId, receiverId)) return json(res, 403, { error: "This profile is private." });

    const u1 = userId < receiverId ? userId : receiverId;
    const u2 = userId < receiverId ? receiverId : userId;
    const friendship = get("SELECT 1 FROM friendships WHERE user_id1 = ? AND user_id2 = ?", [u1, u2]);
    if (friendship) return json(res, 400, { error: "You are already friends with this crewmate." });

    const existingRequest = get(
      "SELECT id, sender_id FROM friend_requests WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND status = 'pending'",
      [userId, receiverId, receiverId, userId]
    );

    if (existingRequest) {
      if (existingRequest.sender_id === userId) {
        return json(res, 400, { error: "A friend request is already pending." });
      } else {
        const timestamp = now();
        run("UPDATE friend_requests SET status = 'accepted', updated_at = ? WHERE id = ?", [timestamp, existingRequest.id]);
        run("INSERT OR IGNORE INTO friendships (user_id1, user_id2, created_at) VALUES (?, ?, ?)", [u1, u2, timestamp]);
        
        const sender = get("SELECT display_name FROM users WHERE id = ?", [userId]);
        createNotification(receiverId, `${sender.display_name} accepted your friend request.`);
        broadcastSSE("friend_request_accepted", { senderId: receiverId, receiverId: userId });
        incrementObjective(userId, "request");
        return json(res, 200, { status: "accepted", requestId: existingRequest.id });
      }
    }

    const id = randomUUID();
    const timestamp = now();
    run(
      "INSERT INTO friend_requests (id, sender_id, receiver_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userId, receiverId, "pending", timestamp, timestamp]
    );

    const sender = get("SELECT display_name FROM users WHERE id = ?", [userId]);
    createNotification(receiverId, `${sender.display_name} sent you a friend request.`);
    broadcastSSE("friend_request_created", { senderId: userId, receiverId });
    incrementObjective(userId, "request");
    return json(res, 201, { status: "pending", requestId: id });
  }

  if (req.method === "POST" && pathname === "/api/friends/accept") {
    const body = await readBody(req);
    const requestId = String(body.requestId || "").trim();
    const senderId = String(body.senderId || "").trim();

    let request;
    if (requestId) {
      request = get("SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'pending'", [requestId, userId]);
    } else if (senderId) {
      request = get("SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'", [senderId, userId]);
    }

    if (!request) return json(res, 404, { error: "Pending friend request not found." });

    const u1 = request.sender_id < userId ? request.sender_id : userId;
    const u2 = request.sender_id < userId ? userId : request.sender_id;
    const timestamp = now();

    run("UPDATE friend_requests SET status = 'accepted', updated_at = ? WHERE id = ?", [timestamp, request.id]);
    run("INSERT OR IGNORE INTO friendships (user_id1, user_id2, created_at) VALUES (?, ?, ?)", [u1, u2, timestamp]);

    const receiver = get("SELECT display_name FROM users WHERE id = ?", [userId]);
    createNotification(request.sender_id, `${receiver.display_name} accepted your friend request.`);
    broadcastSSE("friend_request_accepted", { senderId: request.sender_id, receiverId: userId });

    return json(res, 200, { accepted: true });
  }

  if (req.method === "POST" && pathname === "/api/friends/decline") {
    const body = await readBody(req);
    const requestId = String(body.requestId || "").trim();
    const senderId = String(body.senderId || "").trim();

    let request;
    if (requestId) {
      request = get("SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'pending'", [requestId, userId]);
    } else if (senderId) {
      request = get("SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'", [senderId, userId]);
    }

    if (!request) return json(res, 404, { error: "Pending friend request not found." });

    const timestamp = now();
    run("UPDATE friend_requests SET status = 'declined', updated_at = ? WHERE id = ?", [timestamp, request.id]);
    return json(res, 200, { declined: true });
  }

  if (req.method === "POST" && pathname === "/api/friends/cancel") {
    const body = await readBody(req);
    const requestId = String(body.requestId || "").trim();
    const receiverId = String(body.receiverId || "").trim();

    let request;
    if (requestId) {
      request = get("SELECT * FROM friend_requests WHERE id = ? AND sender_id = ? AND status = 'pending'", [requestId, userId]);
    } else if (receiverId) {
      request = get("SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'", [userId, receiverId]);
    }

    if (!request) return json(res, 404, { error: "Pending friend request not found." });

    const timestamp = now();
    run("UPDATE friend_requests SET status = 'canceled', updated_at = ? WHERE id = ?", [timestamp, request.id]);
    return json(res, 200, { canceled: true });
  }

  if (req.method === "POST" && pathname === "/api/friends/remove") {
    const body = await readBody(req);
    const friendId = String(body.friendId || "").trim();
    if (!friendId) return json(res, 400, { error: "Friend ID is required." });

    const u1 = userId < friendId ? userId : friendId;
    const u2 = userId < friendId ? friendId : userId;

    run("DELETE FROM friendships WHERE user_id1 = ? AND user_id2 = ?", [u1, u2]);
    run("DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", [userId, friendId, friendId, userId]);

    return json(res, 200, { removed: true });
  }

  // --- Daily Focus Objectives & Sessions ---

  if (req.method === "POST" && pathname === "/api/session/start") {
    const today = getTodayDateString();
    const staleBefore = new Date(Date.now() - ACTIVE_SESSION_WINDOW_MS).toISOString();
    run("UPDATE sessions SET end_time = ? WHERE user_id = ? AND end_time IS NULL AND start_time < ?", [now(), userId, staleBefore]);
    
    let objectives = all("SELECT * FROM daily_objectives WHERE user_id = ? AND date = ?", [userId, today]);
    
    if (objectives.length === 0) {
      const obj1Id = randomUUID();
      const obj2Id = randomUUID();
      const obj3Id = randomUUID();
      
      run("INSERT INTO daily_objectives (id, user_id, title, type, target_count, current_count, completed, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [obj1Id, userId, "Review 3 transmissions", "read", 3, 0, 0, today]);
      run("INSERT INTO daily_objectives (id, user_id, title, type, target_count, current_count, completed, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [obj2Id, userId, "Add a transmission comment", "comment", 1, 0, 0, today]);
      run("INSERT INTO daily_objectives (id, user_id, title, type, target_count, current_count, completed, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [obj3Id, userId, "Follow 1 crewmate", "request", 1, 0, 0, today]);
        
      objectives = all("SELECT * FROM daily_objectives WHERE user_id = ? AND date = ?", [userId, today]);
      
      const userRecord = get("SELECT streak, last_active_date FROM users WHERE id = ?", [userId]);
      const yesterday = getYesterdayDateString();
      let newStreak = userRecord.streak || 0;
      
      if (userRecord.last_active_date === yesterday) {
        newStreak += 1;
      } else if (userRecord.last_active_date !== today) {
        newStreak = 1;
      }
      
      run("UPDATE users SET streak = ?, last_active_date = ? WHERE id = ?", [newStreak, today, userId]);
    }
    
    let session = get("SELECT * FROM sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1", [userId]);
    if (!session) {
      const sessionId = randomUUID();
      run("INSERT INTO sessions (id, user_id, start_time, end_time) VALUES (?, ?, ?, ?)", [sessionId, userId, now(), null]);
      session = get("SELECT * FROM sessions WHERE id = ?", [sessionId]);
    }
    
    const userRecord = get("SELECT streak FROM users WHERE id = ?", [userId]);
    return json(res, 200, { session, objectives, streak: userRecord.streak || 0 });
  }

  if (req.method === "GET" && pathname === "/api/session/active") {
    const today = getTodayDateString();
    const objectives = all("SELECT * FROM daily_objectives WHERE user_id = ? AND date = ?", [userId, today]);
    const session = get("SELECT * FROM sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1", [userId]);
    const userRecord = get("SELECT streak FROM users WHERE id = ?", [userId]);
    
    return json(res, 200, { session: session || null, objectives, streak: userRecord ? (userRecord.streak || 0) : 0 });
  }

  if (req.method === "POST" && pathname === "/api/session/end") {
    run("UPDATE sessions SET end_time = ? WHERE user_id = ? AND end_time IS NULL", [now(), userId]);
    return json(res, 200, { ended: true });
  }

  if (req.method === "GET" && pathname === "/api/realtime") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  return json(res, 404, { error: "Route not found." });
}

setupDatabase();
seedDatabase();
ensureAstronomySeedContent();
ensureDemoCrewmates();

const server = createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    json(res, 500, { error: "Internal server error." });
  });
});

server.listen(PORT, () => {
  console.log(`DevSpace API running at http://localhost:${PORT}`);
});
