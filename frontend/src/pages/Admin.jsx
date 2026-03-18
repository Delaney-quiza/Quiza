import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";

const S = { mono: "'JetBrains Mono', monospace", serif: "'Playfair Display', serif" };
const STATUS_COLORS = { pending: "#f59e0b", approved: "#22c55e", rejected: "#ef4444", used: "#6b7280" };
const TABS = ["Review Queue", "All Questions", "Schedule", "Generate", "Analytics"];

// ═══════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════

export default function Admin() {
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadStats(); }, []);
  const loadStats = async () => { try { setStats(await api.getQuestionStats()); } catch {} };

  const logout = () => { api.clearAdminToken(); navigate("/admin/login"); };

  return (
    <div style={{ minHeight: "100vh", background: "#08080a", fontFamily: S.mono }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1a1e", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontFamily: S.serif, fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>Sport<span style={{ color: "#22c55e" }}>Q</span></h1>
          <span style={{ color: "#333", fontSize: 12 }}>Admin CMS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {stats && (
            <div style={{ display: "flex", gap: 16 }}>
              {[{ l: "Pending", v: stats.pending, c: "#f59e0b" }, { l: "Approved", v: stats.approved, c: "#22c55e" }, { l: "Total", v: stats.total, c: "#888" }].map(s => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, color: s.c, fontWeight: 700 }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase" }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={logout} style={{ background: "#1a1a1e", border: "1px solid #2a2a2e", borderRadius: 8, padding: "8px 16px", color: "#888", fontSize: 11 }}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #1a1a1e", padding: "0 24px", display: "flex", gap: 0 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${i === tab ? "#22c55e" : "transparent"}`, padding: "14px 20px", color: i === tab ? "#fff" : "#555", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, transition: "all .2s" }}>
            {t}{t === "Review Queue" && stats?.pending > 0 && <span style={{ background: "#f59e0b", color: "#000", borderRadius: 100, padding: "2px 8px", marginLeft: 8, fontSize: 10, fontWeight: 700 }}>{stats.pending}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {tab === 0 && <ReviewQueue onUpdate={loadStats} />}
        {tab === 1 && <AllQuestions onUpdate={loadStats} />}
        {tab === 2 && <Schedule />}
        {tab === 3 && <Generate onUpdate={loadStats} />}
        {tab === 4 && <Analytics />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// REVIEW QUEUE
// ═══════════════════════════════════════

function ReviewQueue({ onUpdate }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  const load = async () => { setLoading(true); try { const d = await api.getQuestions({ status: "pending" }); setQuestions(d.questions); } catch {} setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleAction = async (id, action) => {
    try { await api.updateQuestion(id, { status: action === "approve" ? "approved" : "rejected" }); load(); onUpdate(); } catch {}
  };

  const handleBulk = async (action) => {
    if (selected.size === 0) return;
    try { await api.bulkUpdateQuestions([...selected], action); setSelected(new Set()); load(); onUpdate(); } catch {}
  };

  const toggleSelect = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(questions.length === selected.size ? new Set() : new Set(questions.map(q => q.id)));

  if (loading) return <LoadingState />;
  if (questions.length === 0) return <EmptyState icon="✅" title="Queue Empty" desc="No questions pending review. Generate more with the AI pipeline." />;

  return (
    <div>
      {/* Bulk actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={selectAll} style={btnStyle("#1a1a1e")}>{selected.size === questions.length ? "Deselect All" : "Select All"}</button>
          {selected.size > 0 && <>
            <button onClick={() => handleBulk("approve")} style={btnStyle("#064e2a", "#22c55e")}>✓ Approve {selected.size}</button>
            <button onClick={() => handleBulk("reject")} style={btnStyle("#4e0606", "#ef4444")}>✗ Reject {selected.size}</button>
          </>}
        </div>
        <span style={{ color: "#555", fontSize: 12 }}>{questions.length} pending</span>
      </div>

      {/* Question cards */}
      {questions.map(q => (
        <QuestionReviewCard key={q.id} question={q} selected={selected.has(q.id)} onToggle={() => toggleSelect(q.id)} onApprove={() => handleAction(q.id, "approve")} onReject={() => handleAction(q.id, "reject")} />
      ))}
    </div>
  );
}

function QuestionReviewCard({ question: q, selected, onToggle, onApprove, onReject }) {
  const [editing, setEditing] = useState(false);
  const [editQ, setEditQ] = useState(q.question);
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d];

  return (
    <div style={{ background: "#111113", border: `1px solid ${selected ? "#3b82f6" : "#1a1a1e"}`, borderRadius: 14, padding: 20, marginBottom: 12, transition: "border-color .2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <input type="checkbox" checked={selected} onChange={onToggle} style={{ marginTop: 4, accentColor: "#3b82f6" }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ background: STATUS_COLORS.pending + "22", color: STATUS_COLORS.pending, padding: "2px 10px", borderRadius: 100, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>{q.status}</span>
            <span style={{ color: "#555", fontSize: 10 }}>{q.category}</span>
            <span style={{ color: "#444", fontSize: 10 }}>{q.difficulty}</span>
            {q.source === "ai_generated" && <span style={{ color: "#8b5cf6", fontSize: 10 }}>🤖 AI</span>}
            {q.ai_confidence && <span style={{ color: "#444", fontSize: 10 }}>{Math.round(q.ai_confidence * 100)}% conf</span>}
          </div>
          <p style={{ color: "#e8e8e8", fontSize: 14, lineHeight: 1.5, margin: "0 0 12px" }}>{q.question}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {opts.map((opt, i) => (
              <div key={i} style={{ background: i === q.correct_answer ? "#0a2a1a" : "#0d0d0f", border: `1px solid ${i === q.correct_answer ? "#22c55e33" : "#1a1a1e"}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: i === q.correct_answer ? "#4ade80" : "#888" }}>
                <span style={{ color: "#555", marginRight: 6 }}>{String.fromCharCode(65 + i)}</span>{opt}
                {i === q.correct_answer && <span style={{ marginLeft: 6 }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={onApprove} style={{ background: "#064e2a", border: "none", borderRadius: 8, padding: "8px 14px", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>Approve</button>
          <button onClick={onReject} style={{ background: "#4e0606", border: "none", borderRadius: 8, padding: "8px 14px", color: "#f87171", fontSize: 11, fontWeight: 600 }}>Reject</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// ALL QUESTIONS
// ═══════════════════════════════════════

function AllQuestions({ onUpdate }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", category: "" });
  const [categories, setCategories] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => { setLoading(true); try { const d = await api.getQuestions(filter); setQuestions(d.questions); const c = await api.getCategories(); setCategories(c.categories); } catch {} setLoading(false); };
  useEffect(() => { load(); }, [filter.status, filter.category]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))} style={selectStyle}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={filter.category} onChange={e => setFilter(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={btnStyle("#22c55e", "#fff")}>+ Add Question</button>
      </div>

      {showAdd && <AddQuestionForm categories={categories} onAdd={() => { load(); onUpdate(); setShowAdd(false); }} />}

      {loading ? <LoadingState /> : questions.length === 0 ? <EmptyState icon="📝" title="No Questions" desc="No questions match your filters." /> : (
        <div>
          <div style={{ color: "#555", fontSize: 12, marginBottom: 12 }}>{questions.length} questions</div>
          {questions.map(q => {
            const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
            return (
              <div key={q.id} style={{ background: "#111113", border: "1px solid #1a1a1e", borderRadius: 12, padding: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ background: (STATUS_COLORS[q.status] || "#555") + "22", color: STATUS_COLORS[q.status] || "#555", padding: "2px 8px", borderRadius: 100, fontSize: 9, fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{q.status}</span>
                <span style={{ color: "#555", fontSize: 11, whiteSpace: "nowrap" }}>{q.category}</span>
                <p style={{ flex: 1, color: "#ccc", fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.question}</p>
                <span style={{ color: "#444", fontSize: 10, whiteSpace: "nowrap" }}>{q.source === "ai_generated" ? "🤖" : "✍️"}</span>
                <button onClick={async () => { await api.deleteQuestion(q.id); load(); onUpdate(); }} style={{ background: "none", border: "none", color: "#4e0606", fontSize: 14 }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddQuestionForm({ categories, onAdd }) {
  const allCats = ["SA Rugby", "SA Cricket", "SA Football", "Formula 1", "Golf", "Tennis", "Premier League", "Champions League", "Olympics", "World Football"];
  const [form, setForm] = useState({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: 0, category: allCats[0], difficulty: "medium" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await api.createQuestion({ ...form, status: "approved" }); onAdd(); } catch {}
    setSaving(false);
  };

  const inputStyle = { width: "100%", background: "#0d0d0f", border: "1px solid #2a2a2e", borderRadius: 8, padding: "10px 14px", color: "#e8e8e8", fontFamily: S.mono, fontSize: 13, outline: "none" };

  return (
    <div style={{ background: "#111113", border: "1px solid #222", borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <h3 style={{ color: "#fff", fontSize: 14, margin: "0 0 16px", fontWeight: 700 }}>Add Question</h3>
      <div style={{ marginBottom: 12 }}>
        <input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} style={inputStyle} placeholder="Question text..." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {["a", "b", "c", "d"].map((l, i) => (
          <div key={l} style={{ position: "relative" }}>
            <input value={form[`option_${l}`]} onChange={e => setForm(p => ({ ...p, [`option_${l}`]: e.target.value }))} style={{ ...inputStyle, paddingLeft: 36 }} placeholder={`Option ${l.toUpperCase()}`} />
            <label style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
              <input type="radio" name="correct" checked={form.correct_answer === i} onChange={() => setForm(p => ({ ...p, correct_answer: i }))} style={{ accentColor: "#22c55e" }} />
            </label>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} style={selectStyle}>
          {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <button onClick={handleSave} disabled={saving || !form.question || !form.option_a} style={btnStyle("#22c55e", "#fff")}>
        {saving ? "Saving..." : "Save Question"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
// SCHEDULE
// ═══════════════════════════════════════

function Schedule() {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const end = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];
      const d = await api.getSchedule(today, end);
      setSchedule(d);
    } catch {} setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAutoSchedule = async () => {
    if (!schedule?.unscheduled?.length) return;
    try { await api.autoSchedule(schedule.unscheduled.slice(0, 7)); load(); } catch {}
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ color: "#fff", fontSize: 16, margin: 0, fontWeight: 700 }}>Next 30 Days</h3>
        {schedule?.unscheduled?.length > 0 && (
          <button onClick={handleAutoSchedule} style={btnStyle("#22c55e", "#fff")}>Auto-Schedule Next 7 Days</button>
        )}
      </div>

      {schedule?.scheduled?.map(s => (
        <div key={s.quiz_date} style={{ background: "#111113", border: "1px solid #1a1a1e", borderRadius: 12, padding: "14px 18px", marginBottom: 8, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", minWidth: 100 }}>{s.quiz_date}</div>
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {[s.q1_category, s.q2_category, s.q3_category].map((c, i) => (
              <span key={i} style={{ background: "#1a1a1e", color: "#888", padding: "3px 10px", borderRadius: 100, fontSize: 10 }}>{c}</span>
            ))}
          </div>
          <span style={{ color: s.is_published ? "#22c55e" : "#f59e0b", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
            {s.is_published ? "Published" : "Draft"}
          </span>
        </div>
      ))}

      {schedule?.unscheduled?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: "#f59e0b", fontSize: 12, margin: "0 0 12px", fontWeight: 600, textTransform: "uppercase" }}>Unscheduled ({schedule.unscheduled.length} days)</h4>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {schedule.unscheduled.map(d => (
              <span key={d} style={{ background: "#1a1a1e", color: "#888", padding: "6px 12px", borderRadius: 8, fontSize: 11 }}>{d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════

function Generate({ onUpdate }) {
  const [count, setCount] = useState(21);
  const [generating, setGenerating] = useState(false);
  const [batches, setBatches] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => { loadBatches(); }, []);
  const loadBatches = async () => { try { const d = await api.getGenerationBatches(); setBatches(d.batches); } catch {} };

  const handleGenerate = async () => {
    setGenerating(true); setMessage("");
    try {
      const res = await api.generateQuestions(count);
      setMessage(`Generation started! Batch #${res.batch_id} — ${count} questions being created...`);
      setTimeout(() => { loadBatches(); onUpdate(); }, 5000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
    setGenerating(false);
  };

  return (
    <div>
      <div style={{ background: "#111113", border: "1px solid #222", borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <h3 style={{ color: "#fff", fontSize: 16, margin: "0 0 4px", fontWeight: 700 }}>🤖 AI Question Generator</h3>
        <p style={{ color: "#555", fontSize: 12, margin: "0 0 20px" }}>Uses Claude to generate SA-weighted sports trivia. Questions land in the review queue for approval.</p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <label style={{ color: "#888", fontSize: 12 }}>Questions:</label>
          <select value={count} onChange={e => setCount(+e.target.value)} style={selectStyle}>
            <option value={7}>7 (1 day buffer)</option>
            <option value={21}>21 (1 week buffer)</option>
            <option value={42}>42 (2 week buffer)</option>
          </select>
          <button onClick={handleGenerate} disabled={generating} style={btnStyle(generating ? "#1a1a1e" : "#22c55e", "#fff")}>
            {generating ? "Generating..." : "Generate Questions"}
          </button>
        </div>

        {message && <div style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 10, padding: "12px 16px", color: "#aaa", fontSize: 12 }}>{message}</div>}
      </div>

      <h3 style={{ color: "#fff", fontSize: 14, margin: "0 0 12px", fontWeight: 700 }}>Generation History</h3>
      {batches.map(b => (
        <div key={b.id} style={{ background: "#111113", border: "1px solid #1a1a1e", borderRadius: 10, padding: "12px 18px", marginBottom: 8, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#555", fontSize: 11 }}>#{b.id}</span>
          <span style={{ color: b.status === "completed" ? "#22c55e" : b.status === "failed" ? "#ef4444" : "#f59e0b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{b.status}</span>
          <span style={{ color: "#888", fontSize: 11 }}>{b.questions_generated} generated</span>
          <span style={{ color: "#555", fontSize: 10, marginLeft: "auto" }}>{new Date(b.created_at).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { try { setData(await api.getAnalytics(30)); } catch {} setLoading(false); })(); }, []);
  if (loading) return <LoadingState />;
  if (!data) return <EmptyState icon="📊" title="No Data" desc="Analytics will appear once players start playing." />;

  return (
    <div>
      {/* Top metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { l: "Total Players", v: data.total_players, i: "👥" },
          { l: "Active (7d)", v: data.active_players_7d, i: "📱" },
          { l: "Questions", v: data.question_stats?.total || 0, i: "📝" },
          { l: "Pending Review", v: data.question_stats?.pending || 0, i: "⏳" },
        ].map(m => (
          <div key={m.l} style={{ background: "#111113", border: "1px solid #1a1a1e", borderRadius: 14, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{m.i}</div>
            <div style={{ fontSize: 24, color: "#fff", fontWeight: 700 }}>{m.v}</div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: .5, marginTop: 4 }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Daily stats table */}
      <h3 style={{ color: "#fff", fontSize: 14, margin: "0 0 12px", fontWeight: 700 }}>Daily Performance</h3>
      <div style={{ background: "#111113", border: "1px solid #1a1a1e", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", padding: "12px 18px", borderBottom: "1px solid #1a1a1e" }}>
          {["Date", "Players", "Avg Score", "Perfect", "Avg Time"].map(h => (
            <div key={h} style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: .5, fontWeight: 600 }}>{h}</div>
          ))}
        </div>
        {(data.daily_stats || []).map(d => (
          <div key={d.quiz_date} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", padding: "10px 18px", borderBottom: "1px solid #0d0d0f" }}>
            <div style={{ color: "#ccc", fontSize: 12 }}>{d.quiz_date}</div>
            <div style={{ color: "#888", fontSize: 12 }}>{d.players}</div>
            <div style={{ color: "#888", fontSize: 12 }}>{Math.round(d.avg_score)}</div>
            <div style={{ color: "#888", fontSize: 12 }}>{d.perfect_count}</div>
            <div style={{ color: "#888", fontSize: 12 }}>{d.avg_time ? `${d.avg_time.toFixed(1)}s` : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════

function LoadingState() {
  return <div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontSize: 32, animation: "spin 1s linear infinite", display: "inline-block" }}>⚽</div><p style={{ color: "#555", marginTop: 12, fontSize: 12 }}>Loading...</p></div>;
}

function EmptyState({ icon, title, desc }) {
  return <div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div><h3 style={{ color: "#fff", fontSize: 16, margin: "0 0 8px", fontWeight: 700 }}>{title}</h3><p style={{ color: "#555", fontSize: 12 }}>{desc}</p></div>;
}

const btnStyle = (bg, color = "#ccc") => ({ background: bg, border: "none", borderRadius: 8, padding: "8px 16px", color, fontFamily: S.mono, fontSize: 11, fontWeight: 600 });
const selectStyle = { background: "#0d0d0f", border: "1px solid #2a2a2e", borderRadius: 8, padding: "8px 14px", color: "#ccc", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, outline: "none" };
