import { createServer } from "node:http";
import { createDecipheriv, createHash, createCipheriv, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "devspace.sqlite"));
const PORT = Number(process.env.API_PORT || 4000);
const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";
const DEMO_USER_ID = "demo-user";
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
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
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

function getUserId(req) {
  const raw = req.headers["x-user-id"];
  if (!raw) return DEMO_USER_ID;
  return Array.isArray(raw) ? raw[0] : raw;
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
  if (!hasPasswordHash) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  if (!hasEmailEncrypted) db.exec("ALTER TABLE users ADD COLUMN email_encrypted TEXT");
  if (!hasEmailLookup) db.exec("ALTER TABLE users ADD COLUMN email_lookup TEXT");
  if (!hasBio) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");
    db.exec("ALTER TABLE users ADD COLUMN decorations TEXT DEFAULT '[]'");
    db.exec("ALTER TABLE users ADD COLUMN favourite_topics TEXT DEFAULT '[]'");
  }
  db.exec("CREATE INDEX IF NOT EXISTS users_email_lookup_idx ON users(email_lookup)");

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
  `);

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

  const posts = [
    ["Cyan", "Oxygen levels stable. Cafeteria meetup in 5.", "cafeteria", 12],
    ["Red", "Electrical is back online. Posting from the power room.", "electrical", 8],
    ["Yellow", "New mission unlocked: Reactor Calibration.", "reactor", 15],
    ["Purple", "Saved a strategy thread near Storage.", "storage", 6],
    ["Green", "Admin terminal says crew activity is rising.", "admin", 11],
  ];

  for (const [author, content, roomId, likes] of posts) {
    const userId = `${author.toLowerCase()}-crew`;
    run(
      "INSERT INTO users (id, email, display_name, avatar_color, created_at) VALUES (?, ?, ?, ?, ?)",
      [userId, `${author.toLowerCase()}@devspace.local`, author, author.toLowerCase(), now()]
    );
    run(
      "INSERT INTO posts (id, user_id, content, room_id, likes_count, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), userId, content, roomId, likes, now()]
    );
  }

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

function serializePost(row) {
  return {
    id: row.id,
    authorName: row.display_name,
    content: row.content,
    roomId: row.room_id,
    likes: row.likes_count,
    upvotes: row.upvotes_count || 0,
    downvotes: row.downvotes_count || 0,
    shares: row.shares_count || 0,
    createdAt: row.created_at,
  };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "GET" && pathname === "/api/health") return json(res, 200, { ok: true });
  if (req.method === "GET" && pathname === "/api/space/apod") {
    try {
      const apodRes = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!apodRes.ok) {
        return json(res, apodRes.status, { error: `NASA APOD request failed (${apodRes.status}).` });
      }
      const apodData = await apodRes.json();
      return json(res, 200, { success: true, node: "APOD", data: apodData });
    } catch (error) {
      return json(res, 502, { error: "APOD fetch failed." });
    }
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

  if (req.method === "GET" && pathname === "/api/users/me") {
    const user = get("SELECT id, email, email_encrypted, display_name, avatar_color, created_at FROM users WHERE id = ?", [userId]);
    if (!user) return json(res, 404, { error: "User not found." });
    return json(res, 200, {
      user: {
        id: user.id,
        email: user.email_encrypted ? decryptText(user.email_encrypted) : user.email,
        displayName: user.display_name,
        avatarColor: user.avatar_color,
        createdAt: user.created_at,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/posts") {
    const rows = all(
      `SELECT posts.*, users.display_name
       FROM posts
       JOIN users ON users.id = posts.user_id
       ORDER BY posts.created_at DESC
       LIMIT 50`
    );
    return json(res, 200, { posts: rows.map(serializePost) });
  }

  if (req.method === "POST" && pathname === "/api/posts") {
    const body = await readBody(req);
    const content = String(body.content || "").trim();
    const roomId = String(body.roomId || "cafeteria").trim();

    if (content.length < 1 || content.length > 280) {
      return json(res, 400, { error: "Post content must be 1-280 characters." });
    }

    const id = randomUUID();
    run(
      "INSERT INTO posts (id, user_id, content, room_id, likes_count, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userId, content, roomId, 0, now()]
    );

    const post = get(
      `SELECT posts.*, users.display_name
       FROM posts
       JOIN users ON users.id = posts.user_id
       WHERE posts.id = ?`,
      [id]
    );
    return json(res, 201, { post: serializePost(post) });
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

  if (req.method === "GET" && pathname === "/api/saved-posts") {
    const rows = all(
      `SELECT posts.*, users.display_name
       FROM saved_posts
       JOIN posts ON posts.id = saved_posts.post_id
       JOIN users ON users.id = posts.user_id
       WHERE saved_posts.user_id = ?
       ORDER BY saved_posts.created_at DESC`,
      [userId]
    );
    return json(res, 200, { posts: rows.map(serializePost) });
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
    const user = get("SELECT id, display_name, avatar_color, bio, decorations, favourite_topics, created_at FROM users WHERE id = ?", [profileId]);
    if (!user) return json(res, 404, { error: "User not found." });
    
    const followers = get("SELECT COUNT(*) as count FROM follows WHERE following_id = ?", [profileId]).count;
    const following = get("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", [profileId]).count;
    
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
        createdAt: user.created_at
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

  const followMatch = pathname.match(/^\/api\/users\/([^/]+)\/follow$/);
  if (req.method === "POST" && followMatch) {
    const followingId = followMatch[1];
    if (followingId === userId) return json(res, 400, { error: "Cannot follow yourself." });
    const target = get("SELECT id FROM users WHERE id = ?", [followingId]);
    if (!target) return json(res, 404, { error: "User not found." });

    run("INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)", [userId, followingId, now()]);
    return json(res, 200, { followed: true });
  }

  const unfollowMatch = pathname.match(/^\/api\/users\/([^/]+)\/unfollow$/);
  if (req.method === "POST" && unfollowMatch) {
    const followingId = unfollowMatch[1];
    run("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", [userId, followingId]);
    return json(res, 200, { unfollowed: true });
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
        run(`UPDATE posts SET ${type}votes_count = ${type}votes_count - 1 WHERE id = ?`, [postId]);
      } else {
        run("UPDATE post_votes SET vote_type = ? WHERE user_id = ? AND post_id = ?", [type, userId, postId]);
        const otherType = type === "up" ? "down" : "up";
        run(`UPDATE posts SET ${type}votes_count = ${type}votes_count + 1, ${otherType}votes_count = ${otherType}votes_count - 1 WHERE id = ?`, [postId]);
      }
    } else {
      run("INSERT INTO post_votes (user_id, post_id, vote_type, created_at) VALUES (?, ?, ?, ?)", [userId, postId, type, now()]);
      run(`UPDATE posts SET ${type}votes_count = ${type}votes_count + 1 WHERE id = ?`, [postId]);
    }
    
    const updatedStats = get("SELECT upvotes_count, downvotes_count FROM posts WHERE id = ?", [postId]);
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

    const post = get("SELECT id FROM posts WHERE id = ?", [postId]);
    if (!post) return json(res, 404, { error: "Post not found." });

    const id = randomUUID();
    run("INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)", [id, postId, userId, content, now()]);
    
    const newComment = get(`SELECT comments.*, users.display_name FROM comments JOIN users ON users.id = comments.user_id WHERE comments.id = ?`, [id]);
    
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

  return json(res, 404, { error: "Route not found." });
}

setupDatabase();
seedDatabase();

const server = createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    json(res, 500, { error: "Internal server error." });
  });
});

server.listen(PORT, () => {
  console.log(`DevSpace API running at http://localhost:${PORT}`);
});
