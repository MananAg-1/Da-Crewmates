function getApiBase() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
  }

  if (typeof window === "undefined") return "http://localhost:4000";

  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:4000";
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return `${protocol}//${hostname}:4000`;
  }
  return "";
}

function normalizeApiBase(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

const API_BASE = getApiBase();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function signup(payload) {
  return request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload) {
  return request("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getPosts(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const suffix = query.toString() ? `?${query}` : "";
  return request(`/api/posts${suffix}`);
}

export function createPost(payload) {
  return request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function votePost(postId, type) {
  return request(`/api/posts/${encodeURIComponent(postId)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
}

export function savePost(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}/save`, { method: "POST" });
}

export function unsavePost(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}/save`, { method: "DELETE" });
}

export function markPostSeen(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}/seen`, { method: "POST" });
}

export function getSavedPosts() {
  return request("/api/saved-posts");
}

export function getPostComments(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}/comments`);
}

export function createPostComment(postId, content) {
  return request(`/api/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
