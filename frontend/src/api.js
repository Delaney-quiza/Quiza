// frontend/src/api.js
// API client for SportQ backend

const API_BASE = "/api";

// ═══════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════

export function getPlayerToken() {
  return localStorage.getItem("sportq_player_token");
}

export function setPlayerToken(token) {
  localStorage.setItem("sportq_player_token", token);
}

export function getAdminToken() {
  return localStorage.getItem("sportq_admin_token");
}

export function setAdminToken(token) {
  localStorage.setItem("sportq_admin_token", token);
}

export function clearAdminToken() {
  localStorage.removeItem("sportq_admin_token");
}

// ═══════════════════════════════════════
// REQUEST HELPERS
// ═══════════════════════════════════════

async function playerRequest(path, options = {}) {
  const token = getPlayerToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Player-Token": token || "",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

async function adminRequest(path, options = {}) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearAdminToken();
    window.location.href = "/admin/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

// ═══════════════════════════════════════
// PLAYER API
// ═══════════════════════════════════════

export async function registerPlayer(displayName) {
  const data = await playerRequest("/player/register", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName }),
  });
  setPlayerToken(data.token);
  return data;
}

export async function ensurePlayer() {
  let token = getPlayerToken();
  if (!token) {
    const data = await registerPlayer(null);
    token = data.token;
  }
  return token;
}

export async function getPlayerStats() {
  return playerRequest("/player/stats");
}

export async function getTodayResult() {
  return playerRequest("/player/today");
}

// ═══════════════════════════════════════
// QUIZ API
// ═══════════════════════════════════════

export async function getTodayQuiz() {
  const res = await fetch(`${API_BASE}/quiz/today`);
  if (!res.ok) throw new Error("No quiz available today");
  return res.json();
}

export async function submitQuiz(answers, timings, startTime) {
  return playerRequest("/quiz/submit", {
    method: "POST",
    body: JSON.stringify({
      answers,
      timings,
      start_time: startTime,
    }),
  });
}

// ═══════════════════════════════════════
// ADMIN API
// ═══════════════════════════════════════

export async function adminLogin(email, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  setAdminToken(data.token);
  return data;
}

export async function getQuestions(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  return adminRequest(`/admin/questions?${params}`);
}

export async function createQuestion(question) {
  return adminRequest("/admin/questions", {
    method: "POST",
    body: JSON.stringify(question),
  });
}

export async function updateQuestion(id, updates) {
  return adminRequest(`/admin/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteQuestion(id) {
  return adminRequest(`/admin/questions/${id}`, { method: "DELETE" });
}

export async function bulkUpdateQuestions(ids, action) {
  return adminRequest("/admin/questions/bulk", {
    method: "POST",
    body: JSON.stringify({ ids, action }),
  });
}

export async function getQuestionStats() {
  return adminRequest("/admin/questions/stats");
}

export async function getCategories() {
  return adminRequest("/admin/questions/categories");
}

export async function getSchedule(start, end) {
  const params = new URLSearchParams({ start, end }).toString();
  return adminRequest(`/admin/schedule?${params}`);
}

export async function scheduleQuiz(date, questionIds) {
  return adminRequest("/admin/schedule", {
    method: "POST",
    body: JSON.stringify({ date, question_ids: questionIds }),
  });
}

export async function autoSchedule(dates) {
  return adminRequest("/admin/schedule/auto", {
    method: "POST",
    body: JSON.stringify({ dates }),
  });
}

export async function generateQuestions(count = 21, categories = null) {
  return adminRequest("/admin/generate", {
    method: "POST",
    body: JSON.stringify({ count, categories }),
  });
}

export async function getGenerationBatches() {
  return adminRequest("/admin/generate/batches");
}

export async function getAnalytics(days = 30) {
  return adminRequest(`/admin/analytics?days=${days}`);
}
