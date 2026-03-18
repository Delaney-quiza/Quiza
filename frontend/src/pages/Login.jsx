import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.adminLogin(email, password);
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const S = { mono: "'JetBrains Mono', monospace", serif: "'Playfair Display', serif" };

  return (
    <div style={{ minHeight: "100vh", background: "#08080a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: S.mono }}>
      <div style={{ width: "100%", maxWidth: 400, animation: "fadeScale .5s ease both" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: S.serif, fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
            Sport<span style={{ color: "#22c55e" }}>Q</span> <span style={{ color: "#555", fontSize: 16, fontWeight: 400 }}>Admin</span>
          </h1>
          <p style={{ color: "#444", fontSize: 12 }}>Content Management System</p>
        </div>

        <div style={{ background: "#111113", border: "1px solid #222", borderRadius: 16, padding: 32 }}>
          {error && <div style={{ background: "#2a1a1a", border: "1px solid #4e0606", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#f87171", fontSize: 13 }}>{error}</div>}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: "100%", background: "#0d0d0f", border: "1px solid #2a2a2e", borderRadius: 10, padding: "14px 16px", color: "#e8e8e8", fontFamily: S.mono, fontSize: 14, outline: "none" }}
              placeholder="admin@sportq.app" />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: "100%", background: "#0d0d0f", border: "1px solid #2a2a2e", borderRadius: 10, padding: "14px 16px", color: "#e8e8e8", fontFamily: S.mono, fontSize: 14, outline: "none" }}
              placeholder="••••••••" />
          </div>

          <button onClick={handleSubmit} disabled={loading || !email || !password}
            style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: loading ? "#1a1a1e" : "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff", fontFamily: S.mono, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, color: "#333", fontSize: 11 }}>
          <a href="/" style={{ color: "#555", textDecoration: "none" }}>← Back to quiz</a>
        </p>
      </div>
    </div>
  );
}
