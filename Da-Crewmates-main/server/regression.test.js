import { once } from "node:events";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const PORT = 4177;
const API_BASE = `http://localhost:${PORT}`;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

let server;

function headers(userId, displayName = userId) {
  return {
    "Content-Type": "application/json",
    "x-user-id": userId,
    "x-display-name": displayName
  };
}

async function request(path, { userId = `tester-${runId}`, method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(userId),
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
    env: { ...process.env, API_PORT: String(PORT) },
    stdio: "ignore"
  });
  await waitForHealth();
});

test.after(async () => {
  if (!server) return;
  server.kill();
  await once(server, "exit").catch(() => {});
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
    body: { title: "SSE sync check", body: "Created from regression test.", tag: "Tech", roomId: "cafeteria" }
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
    body: { title: "Ownership check", body: "Only the owner can remove this.", tag: "Space" }
  });
  assert.equal(created.response.status, 201);

  const denied = await request(`/api/posts/${created.data.post.id}`, { userId: intruder, method: "DELETE" });
  assert.equal(denied.response.status, 403);

  const deleted = await request(`/api/posts/${created.data.post.id}`, { userId: owner, method: "DELETE" });
  assert.equal(deleted.response.status, 200);
});

test("runs friends cycle and daily objectives", async () => {
  const alpha = `alpha-${runId}`;
  const beta = `beta-${runId}`;
  await request("/api/users/me", { userId: beta });
  await request("/api/session/start", { userId: alpha, method: "POST" });
  const secondStart = await request("/api/session/start", { userId: alpha, method: "POST" });
  assert.equal(secondStart.data.objectives.length, 3);

  const friendRequest = await request("/api/friends/request", {
    userId: alpha,
    method: "POST",
    body: { receiverId: beta }
  });
  assert.equal(friendRequest.response.status, 201);

  const accepted = await request("/api/friends/accept", {
    userId: beta,
    method: "POST",
    body: { requestId: friendRequest.data.requestId }
  });
  assert.equal(accepted.response.status, 200);

  const alphaFriends = await request("/api/friends/list", { userId: alpha });
  assert.equal(alphaFriends.data.friends.some((friend) => friend.id === beta), true);

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

  const friendRequest = await request("/api/friends/request", {
    userId: sender,
    method: "POST",
    body: { receiverId: receiver }
  });
  assert.equal(friendRequest.response.status, 201);

  const accepted = await request("/api/friends/accept", {
    userId: receiver,
    method: "POST",
    body: { requestId: friendRequest.data.requestId }
  });
  assert.equal(accepted.response.status, 200);

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

  const receiverRead = await request(`/api/dm/threads/${thread.data.thread.id}/messages`, { userId: receiver });
  assert.equal(receiverRead.response.status, 200);
  assert.equal(receiverRead.data.messages.length, 1);
  assert.equal(receiverRead.data.messages[0].sentByMe, false);

  const threads = await request("/api/dm/threads", { userId: receiver });
  assert.equal(threads.data.threads.some((item) => item.id === thread.data.thread.id), true);
});

test("reports MedBay analytics from persisted activity", async () => {
  const user = `medbay-${runId}`;
  const peer = `medbay-peer-${runId}`;
  await request("/api/users/me", { userId: peer });
  await request("/api/session/start", { userId: user, method: "POST" });

  const created = await request("/api/posts", {
    userId: user,
    method: "POST",
    body: { title: "MedBay real stat", body: "This should count as persisted activity.", tag: "Science", roomId: "medbay" }
  });
  assert.equal(created.response.status, 201);

  await request(`/api/posts/${created.data.post.id}/seen`, { userId: user, method: "POST" });
  await request(`/api/posts/${created.data.post.id}/vote`, { userId: user, method: "POST", body: { type: "up" } });
  await request(`/api/posts/${created.data.post.id}/save`, { userId: user, method: "POST" });
  await request(`/api/posts/${created.data.post.id}/comments`, { userId: user, method: "POST", body: { content: "Real analytics comment." } });

  const friendRequest = await request("/api/friends/request", {
    userId: user,
    method: "POST",
    body: { receiverId: peer }
  });
  assert.equal(friendRequest.response.status, 201);
  await request("/api/friends/accept", { userId: peer, method: "POST", body: { requestId: friendRequest.data.requestId } });
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
  const created = await request("/api/posts", {
    userId: user,
    method: "POST",
    body: { title: "Reactor stat source", body: "Counts toward system status.", tag: "Tech", roomId: "reactor" }
  });
  assert.equal(created.response.status, 201);

  const reactor = await request("/api/system/reactor", { userId: user });
  assert.equal(reactor.response.status, 200);
  assert.ok(reactor.data.reactor.activeSessions >= 1);
  assert.ok(reactor.data.reactor.totalUsers >= 1);
  assert.equal(typeof reactor.data.reactor.openReports, "number");
  assert.equal(reactor.data.reactor.storageCounts.some((item) => item.label === "Posts" && item.count >= 1), true);
  assert.equal(reactor.data.reactor.zones.some((zone) => zone.name === "Reactor"), true);

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
