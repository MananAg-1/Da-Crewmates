import { once } from "node:events";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";

const PORT = 4177;
const API_BASE = `http://localhost:${PORT}`;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testDbPath = join(tmpdir(), `da-crewmates-regression-${runId}.sqlite`);

let server;

function headers(userId, displayName = userId) {
  return {
    "Content-Type": "application/json",
    "x-user-id": userId,
    "x-display-name": displayName
  };
}

async function request(path, { userId = `tester-${runId}`, displayName = userId, method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(userId, displayName),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API did not become healthy");
}

async function nextSseEvent(reader, decoder) {
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) throw new Error("SSE stream closed");
    buffer += decoder.decode(value, { stream: true });
    const match = buffer.match(/data: (.*)\n\n/);
    if (match) return JSON.parse(match[1]);
  }
}

test.before(async () => {
  server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, API_PORT: String(PORT), APP_DATABASE_PATH: testDbPath, HIDE_GENERATED_CREW: "0" },
    stdio: "ignore"
  });
  await waitForHealth();
});

test.after(async () => {
  if (!server) return;
  server.kill();
  await once(server, "exit").catch(() => {});
  rmSync(testDbPath, { force: true });
});

test("broadcasts feed changes over realtime SSE", async () => {
  const stream = await fetch(`${API_BASE}/api/realtime`);
  assert.equal(stream.ok, true);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  const connected = await nextSseEvent(reader, decoder);
  assert.equal(connected.type, "connected");

  const post = await request("/api/posts", {
    userId: `sse-owner-${runId}`,
    method: "POST",
    body: { title: "SSE sync check", body: "Created from regression test.", tag: "Astrometry", roomId: "cafeteria" }
  });
  assert.equal(post.response.status, 201);

  const event = await nextSseEvent(reader, decoder);
  assert.equal(event.type, "post_created");
  assert.equal(event.payload.post.id, post.data.post.id);
  await reader.cancel();
});

test("allows browser preflight for crew identity headers", async () => {
  const response = await fetch(`${API_BASE}/api/posts`, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-user-id,x-display-name",
      Origin: "http://localhost:5173"
    }
  });
  assert.equal(response.status, 204);
  const allowedHeaders = response.headers.get("access-control-allow-headers") || "";
  assert.match(allowedHeaders.toLowerCase(), /x-user-id/);
  assert.match(allowedHeaders.toLowerCase(), /x-display-name/);
});

test("enforces post ownership on deletion", async () => {
  const owner = `owner-${runId}`;
  const intruder = `intruder-${runId}`;
  const created = await request("/api/posts", {
    userId: owner,
    method: "POST",
    body: { title: "Ownership check", body: "Only the owner can remove this.", tag: "Astrophysics" }
  });
  assert.equal(created.response.status, 201);

  const denied = await request(`/api/posts/${created.data.post.id}`, { userId: intruder, method: "DELETE" });
  assert.equal(denied.response.status, 403);

  const deleted = await request(`/api/posts/${created.data.post.id}`, { userId: owner, method: "DELETE" });
  assert.equal(deleted.response.status, 200);
});

test("normalizes posts into astronomy categories", async () => {
  const author = `category-${runId}`;
  const created = await request("/api/posts", {
    userId: author,
    method: "POST",
    body: { title: "Legacy category migration", body: "Old clients should map Tech into Astrometry.", tag: "Tech" }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.post.tag, "Astrometry");

  const filtered = await request("/api/posts?tag=Astrometry", { userId: author });
  assert.equal(filtered.data.posts.some((post) => post.id === created.data.post.id && post.tag === "Astrometry"), true);
});

test("stores optional post image CDN URLs", async () => {
  const author = `image-post-${runId}`;
  const imageUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
  const created = await request("/api/posts", {
    userId: author,
    method: "POST",
    body: {
      title: "Image CDN post",
      body: "This post should carry a CDN image URL.",
      tag: "Astrophysics",
      imageUrl
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.post.imageUrl, imageUrl);

  const posts = await request("/api/posts?feed=new&limit=100", { userId: author });
  assert.equal(posts.data.posts.some((post) => post.id === created.data.post.id && post.imageUrl === imageUrl), true);
});

test("rejects unsupported post image uploads", async () => {
  const boundary = `boundary-${runId}`;
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="image"; filename="note.txt"`,
    "Content-Type: text/plain",
    "",
    "not an image",
    `--${boundary}--`,
    ""
  ].join("\r\n");
  const response = await fetch(`${API_BASE}/api/post-images`, {
    method: "POST",
    headers: {
      ...headers(`image-upload-${runId}`),
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    body
  });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /JPEG|PNG|WebP|GIF/);
});

test("rejects oversized post image uploads", async () => {
  const boundary = `oversized-${runId}`;
  const oversizedBytes = "a".repeat(5 * 1024 * 1024 + 1);
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="image"; filename="large.png"`,
    "Content-Type: image/png",
    "",
    oversizedBytes,
    `--${boundary}--`,
    ""
  ].join("\r\n");
  const response = await fetch(`${API_BASE}/api/post-images`, {
    method: "POST",
    headers: {
      ...headers(`oversized-image-${runId}`),
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    body
  });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /5 MB/);
});

test("seeds astronomy posts under observatory crew", async () => {
  const posts = await request("/api/posts?feed=new&limit=100", { userId: `seed-viewer-${runId}` });
  assert.equal(posts.response.status, 200);
  const observatoryPosts = posts.data.posts.filter((post) => post.authorId === "observatory-crew");
  assert.equal(observatoryPosts.length >= 8, true);
  assert.equal(observatoryPosts.every((post) => ["Astrophysics", "Astrometry", "Astrogeology", "Astrobiology"].includes(post.tag)), true);
  assert.equal(posts.data.posts.some((post) => post.title === "Cafeteria meetup"), false);
});

test("runs mutual-follow friend cycle and daily objectives", async () => {
  const alpha = `alpha-${runId}`;
  const beta = `beta-${runId}`;
  await request("/api/users/me", { userId: beta, displayName: "Beta Follow Target" });
  await request("/api/session/start", { userId: alpha, method: "POST" });
  const secondStart = await request("/api/session/start", { userId: alpha, method: "POST" });
  assert.equal(secondStart.data.objectives.length, 3);

  const followed = await request(`/api/users/${encodeURIComponent(beta)}/follow`, {
    userId: alpha,
    method: "POST"
  });
  assert.equal(followed.response.status, 200);
  assert.equal(followed.data.relationship, "following");

  const betaView = await request("/api/friends/list", { userId: beta });
  assert.equal(betaView.data.followers.some((follower) => follower.id === alpha), true);
  assert.equal(betaView.data.friends.some((friend) => friend.id === alpha), false);

  const followedBack = await request(`/api/users/${encodeURIComponent(alpha)}/follow`, {
    userId: beta,
    method: "POST"
  });
  assert.equal(followedBack.response.status, 200);
  assert.equal(followedBack.data.relationship, "friend");

  const alphaFriends = await request("/api/friends/list", { userId: alpha });
  assert.equal(alphaFriends.data.friends.some((friend) => friend.id === beta), true);
  assert.equal(alphaFriends.data.following.some((crewmate) => crewmate.relationship === "friend"), true);

  const search = await request(`/api/users/search?q=${encodeURIComponent("Beta Follow")}`, { userId: alpha });
  assert.equal(search.response.status, 200);
  const betaSearch = search.data.users.find((user) => user.id === beta);
  assert.equal(betaSearch.relationship, "friend");

  const session = await request("/api/session/active", { userId: alpha });
  const requestObjective = session.data.objectives.find((objective) => objective.type === "request");
  assert.equal(requestObjective.completed, 1);
  await request("/api/session/end", { userId: alpha, method: "POST" });
});

test("supports friend-scoped direct messages", async () => {
  const sender = `dm-sender-${runId}`;
  const receiver = `dm-receiver-${runId}`;
  const stranger = `dm-stranger-${runId}`;
  await request("/api/users/me", { userId: receiver });
  await request("/api/users/me", { userId: stranger });

  const deniedThread = await request("/api/dm/threads", {
    userId: sender,
    method: "POST",
    body: { receiverId: stranger }
  });
  assert.equal(deniedThread.response.status, 403);

  const oneWayFollow = await request(`/api/users/${encodeURIComponent(receiver)}/follow`, {
    userId: sender,
    method: "POST"
  });
  assert.equal(oneWayFollow.response.status, 200);

  const stillDenied = await request("/api/dm/threads", {
    userId: sender,
    method: "POST",
    body: { receiverId: receiver }
  });
  assert.equal(stillDenied.response.status, 403);

  const mutualFollow = await request(`/api/users/${encodeURIComponent(sender)}/follow`, { userId: receiver, method: "POST" });
  assert.equal(mutualFollow.response.status, 200);
  assert.equal(mutualFollow.data.relationship, "friend");

  const thread = await request("/api/dm/threads", {
    userId: sender,
    method: "POST",
    body: { receiverId: receiver }
  });
  assert.equal(thread.response.status, 200);
  assert.equal(thread.data.thread.otherUser.id, receiver);

  const sent = await request(`/api/dm/threads/${thread.data.thread.id}/messages`, {
    userId: sender,
    method: "POST",
    body: { body: "Meet in Communications." }
  });
  assert.equal(sent.response.status, 201);
  assert.equal(sent.data.message.body, "Meet in Communications.");
  assert.equal(sent.data.message.sentByMe, true);
  assert.equal(sent.data.message.read, false);

  const receiverRead = await request(`/api/dm/threads/${thread.data.thread.id}/messages`, { userId: receiver });
  assert.equal(receiverRead.response.status, 200);
  assert.equal(receiverRead.data.messages.length, 1);
  assert.equal(receiverRead.data.messages[0].sentByMe, false);
  assert.equal(receiverRead.data.messages[0].read, true);
  assert.equal(typeof receiverRead.data.messages[0].readAt, "string");

  const senderRead = await request(`/api/dm/threads/${thread.data.thread.id}/messages`, { userId: sender });
  assert.equal(senderRead.response.status, 200);
  assert.equal(senderRead.data.messages[0].sentByMe, true);
  assert.equal(senderRead.data.messages[0].read, true);
  assert.equal(typeof senderRead.data.messages[0].createdAt, "string");
  assert.equal(typeof senderRead.data.messages[0].readAt, "string");

  const threads = await request("/api/dm/threads", { userId: receiver });
  assert.equal(threads.data.threads.some((item) => item.id === thread.data.thread.id), true);
});

test("enforces persisted shields privacy settings", async () => {
  const target = `privacy-target-${runId}`;
  const stranger = `privacy-stranger-${runId}`;
  const friend = `privacy-friend-${runId}`;
  const hiddenFollowed = `privacy-hidden-followed-${runId}`;
  await request("/api/users/me", { userId: target, displayName: "Private Shield Target" });
  await request("/api/users/me", { userId: stranger });
  await request("/api/users/me", { userId: friend });
  await request("/api/users/me", { userId: hiddenFollowed, displayName: "Hidden Followed Crew" });
  const profilePost = await request("/api/posts", {
    userId: target,
    method: "POST",
    body: { title: "Visible profile post", body: "Friends should see this on the profile.", tag: "Astrobiology", roomId: "cafeteria" }
  });
  assert.equal(profilePost.response.status, 201);

  await request(`/api/users/${encodeURIComponent(friend)}/follow`, { userId: target, method: "POST" });
  await request(`/api/users/${encodeURIComponent(target)}/follow`, { userId: friend, method: "POST" });
  await request(`/api/users/${encodeURIComponent(hiddenFollowed)}/follow`, { userId: target, method: "POST" });
  await request("/api/users/me/privacy", {
    userId: hiddenFollowed,
    method: "PATCH",
    body: { privacyMode: "Friends Only" }
  });

  const updated = await request("/api/users/me/privacy", {
    userId: target,
    method: "PATCH",
    body: {
      privacyMode: "Friends Only",
      dmPermissions: "Everyone",
      contentFilter: "Strict",
      showOnlinePresence: false,
      shareZoneActivity: false,
      criticalAlerts: false
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.privacySettings.privacyMode, "Friends Only");
  assert.equal(updated.data.privacySettings.showOnlinePresence, false);

  const hiddenSearch = await request(`/api/users/search?q=${encodeURIComponent("Private Shield")}`, { userId: stranger });
  assert.equal(hiddenSearch.data.users.some((user) => user.id === target), false);

  const friendSearch = await request(`/api/users/search?q=${encodeURIComponent("Private Shield")}`, { userId: friend });
  assert.equal(friendSearch.data.users.some((user) => user.id === target), true);

  const hiddenProfile = await request(`/api/users/${encodeURIComponent(target)}/profile`, { userId: stranger });
  assert.equal(hiddenProfile.response.status, 403);

  const visibleProfile = await request(`/api/users/${encodeURIComponent(target)}/profile`, { userId: friend });
  assert.equal(visibleProfile.response.status, 200);
  assert.equal(visibleProfile.data.profile.onlinePresenceVisible, false);
  assert.equal(visibleProfile.data.profile.posts.some((post) => post.id === profilePost.data.post.id), true);
  assert.equal(visibleProfile.data.profile.friends.some((user) => user.id === friend), true);
  assert.equal(visibleProfile.data.profile.followers.some((user) => user.id === friend), true);
  assert.equal(visibleProfile.data.profile.following.some((user) => user.id === friend), true);
  assert.equal(visibleProfile.data.profile.following.some((user) => user.displayName === "Hidden Followed Crew"), true);

  const dmAllowed = await request("/api/dm/threads", {
    userId: stranger,
    method: "POST",
    body: { receiverId: target }
  });
  assert.equal(dmAllowed.response.status, 200);

  await request("/api/users/me/privacy", {
    userId: target,
    method: "PATCH",
    body: { privacyMode: "Enabled", dmPermissions: "Followers" }
  });
  const followerAllowed = await request("/api/dm/threads", {
    userId: stranger,
    method: "POST",
    body: { receiverId: target }
  });
  assert.equal(followerAllowed.response.status, 403);

  await request(`/api/users/${encodeURIComponent(target)}/follow`, { userId: stranger, method: "POST" });
  const followerThread = await request("/api/dm/threads", {
    userId: stranger,
    method: "POST",
    body: { receiverId: target }
  });
  assert.equal(followerThread.response.status, 200);

  const beforeReactor = await request("/api/system/reactor", { userId: target });
  const beforeActive = beforeReactor.data.reactor.activeSessions;
  const beforeActivity = beforeReactor.data.reactor.headlineStats.find((item) => item.label === "Total Activity").value;
  await request("/api/session/start", { userId: target, method: "POST" });
  await request("/api/rooms/visit", {
    userId: target,
    method: "POST",
    body: { roomId: "shields-private", roomName: "Shields Private" }
  });
  const afterReactor = await request("/api/system/reactor", { userId: target });
  const afterActivity = afterReactor.data.reactor.headlineStats.find((item) => item.label === "Total Activity").value;
  assert.equal(afterReactor.data.reactor.activeSessions, beforeActive);
  assert.equal(afterActivity, beforeActivity);
  assert.equal(afterReactor.data.reactor.topTopics.some((topic) => topic.label === "Shields Private"), false);
  await request("/api/session/end", { userId: target, method: "POST" });
});

test("blocks prevent follow and direct message access", async () => {
  const blocker = `blocker-${runId}`;
  const blocked = `blocked-${runId}`;
  await request("/api/users/me", { userId: blocked, displayName: "Blocked Crew" });

  await request(`/api/users/${encodeURIComponent(blocked)}/follow`, { userId: blocker, method: "POST" });
  await request(`/api/users/${encodeURIComponent(blocker)}/follow`, { userId: blocked, method: "POST" });

  const thread = await request("/api/dm/threads", {
    userId: blocker,
    method: "POST",
    body: { receiverId: blocked }
  });
  assert.equal(thread.response.status, 200);

  const block = await request("/api/users/me/blocked-users", {
    userId: blocker,
    method: "POST",
    body: { blockedUserId: blocked }
  });
  assert.equal(block.response.status, 200);

  const blockedList = await request("/api/users/me/blocked-users", { userId: blocker });
  assert.equal(blockedList.data.blockedUsers.some((user) => user.id === blocked), true);

  const followDenied = await request(`/api/users/${encodeURIComponent(blocker)}/follow`, {
    userId: blocked,
    method: "POST"
  });
  assert.equal(followDenied.response.status, 403);

  const messageDenied = await request(`/api/dm/threads/${thread.data.thread.id}/messages`, {
    userId: blocker,
    method: "POST",
    body: { body: "This should not send." }
  });
  assert.equal(messageDenied.response.status, 403);

  const threadHidden = await request("/api/dm/threads", { userId: blocker });
  assert.equal(threadHidden.data.threads.some((item) => item.id === thread.data.thread.id), false);
});

test("reports MedBay analytics from persisted activity", async () => {
  const user = `medbay-${runId}`;
  const peer = `medbay-peer-${runId}`;
  await request("/api/users/me", { userId: peer });
  await request("/api/session/start", { userId: user, method: "POST" });
  const visit = await request("/api/rooms/visit", {
    userId: user,
    method: "POST",
    body: { roomId: "medbay", roomName: "MedBay" }
  });
  assert.equal(visit.response.status, 201);

  const created = await request("/api/posts", {
    userId: user,
    method: "POST",
    body: { title: "MedBay real stat", body: "This should count as persisted activity.", tag: "Astrobiology", roomId: "electrical" }
  });
  assert.equal(created.response.status, 201);

  await request(`/api/posts/${created.data.post.id}/seen`, { userId: user, method: "POST" });
  await request(`/api/posts/${created.data.post.id}/vote`, { userId: user, method: "POST", body: { type: "up" } });
  await request(`/api/posts/${created.data.post.id}/save`, { userId: user, method: "POST" });
  await request(`/api/posts/${created.data.post.id}/comments`, { userId: user, method: "POST", body: { content: "Real analytics comment." } });

  await request(`/api/users/${encodeURIComponent(peer)}/follow`, {
    userId: user,
    method: "POST"
  });
  await request(`/api/users/${encodeURIComponent(user)}/follow`, { userId: peer, method: "POST" });
  const thread = await request("/api/dm/threads", { userId: user, method: "POST", body: { receiverId: peer } });
  await request(`/api/dm/threads/${thread.data.thread.id}/messages`, {
    userId: user,
    method: "POST",
    body: { body: "MedBay should count this DM." }
  });

  const analytics = await request("/api/users/me/analytics?range=day", { userId: user });
  assert.equal(analytics.response.status, 200);
  const stats = Object.fromEntries(analytics.data.analytics.stats.map((stat) => [stat.label, stat.value]));
  assert.equal(stats["Posts Viewed"], "1");
  assert.equal(stats.Messages, "1");
  assert.equal(stats["Saved/Votes"], "2");
  assert.ok(analytics.data.analytics.focus > 0);
  assert.equal(analytics.data.analytics.zones.some((zone) => zone.name === "Medbay" || zone.name === "MedBay"), true);
  await request("/api/session/end", { userId: user, method: "POST" });
});

test("backs Reactor and Security with persisted data", async () => {
  const user = `system-${runId}`;
  await request("/api/session/start", { userId: user, method: "POST" });
  await request("/api/rooms/visit", {
    userId: user,
    method: "POST",
    body: { roomId: "reactor", roomName: "Reactor" }
  });
  const created = await request("/api/posts", {
    userId: user,
    method: "POST",
    body: { title: "Reactor stat source", body: "Counts toward system status.", tag: "Astrometry", roomId: "electrical" }
  });
  assert.equal(created.response.status, 201);

  const reactor = await request("/api/system/reactor", { userId: user });
  assert.equal(reactor.response.status, 200);
  assert.ok(reactor.data.reactor.activeSessions >= 1);
  assert.ok(reactor.data.reactor.totalUsers >= 1);
  assert.equal(typeof reactor.data.reactor.openReports, "number");
  assert.equal(reactor.data.reactor.headlineStats.some((item) => item.label === "Registered Crew" && item.value >= 1), true);
  assert.equal(reactor.data.reactor.headlineStats.some((item) => item.label === "Total Activity" && item.value >= 1), true);
  assert.equal(reactor.data.reactor.activityMix.some((item) => item.label === "Posts" && item.count >= 1), true);
  assert.equal(reactor.data.reactor.topTopics.some((item) => item.label === "Astrometry" && item.count >= 1), true);
  assert.equal(reactor.data.reactor.networkStats.some((item) => item.label === "Active Rate"), true);

  const emptySecurity = await request("/api/security/reports", { userId: user });
  assert.equal(emptySecurity.response.status, 200);
  const initialOpen = emptySecurity.data.openCount;

  const report = await request("/api/security/reports", {
    userId: user,
    method: "POST",
    body: { type: "bug", target: "Reactor", detail: "System status regression check." }
  });
  assert.equal(report.response.status, 201);
  assert.equal(report.data.report.status, "open");
  assert.equal(report.data.overview.openCount, initialOpen + 1);

  const security = await request("/api/security/reports", { userId: user });
  assert.equal(security.data.reports.some((item) => item.id === report.data.report.id), true);
  await request("/api/session/end", { userId: user, method: "POST" });
});

test("shares a post through a friend DM", async () => {
  const sender = `share-sender-${runId}`;
  const receiver = `share-receiver-${runId}`;
  await request("/api/users/me", { userId: receiver, displayName: "Share Receiver" });

  const created = await request("/api/posts", {
    userId: sender,
    method: "POST",
    body: { title: "Shareable transmission", body: "This should arrive in another crewmate's inbox.", tag: "Astrometry", roomId: "electrical" }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.post.shares, 0);

  await request(`/api/users/${encodeURIComponent(receiver)}/follow`, {
    userId: sender,
    method: "POST"
  });
  await request(`/api/users/${encodeURIComponent(sender)}/follow`, { userId: receiver, method: "POST" });

  const thread = await request("/api/dm/threads", {
    userId: sender,
    method: "POST",
    body: { receiverId: receiver }
  });
  assert.equal(thread.response.status, 200);

  const message = await request(`/api/dm/threads/${thread.data.thread.id}/messages`, {
    userId: sender,
    method: "POST",
    body: { body: `Shared post: ${created.data.post.title}` }
  });
  assert.equal(message.response.status, 201);

  const shared = await request(`/api/posts/${created.data.post.id}/share`, { userId: sender, method: "POST" });
  assert.equal(shared.response.status, 200);
  assert.equal(shared.data.shares, 1);

  const receiverRead = await request(`/api/dm/threads/${thread.data.thread.id}/messages`, { userId: receiver });
  assert.equal(receiverRead.response.status, 200);
  assert.equal(receiverRead.data.messages.some((item) => item.body.includes("Shared post: Shareable transmission")), true);

  const posts = await request("/api/posts?feed=new", { userId: receiver });
  const sharedPost = posts.data.posts.find((post) => post.id === created.data.post.id);
  assert.equal(sharedPost.shares, 1);
});
