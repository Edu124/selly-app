import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else { setDone(true); setTimeout(() => navigate("/portal"), 2000); }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <div className="auth-sidebar-logo">Code<span>Forge</span> AI</div>
          <div className="auth-sidebar-title">Set a new password</div>
          <div className="auth-sidebar-sub">Choose a strong password for your CodeForge AI account.</div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-box">
          <h1 className="auth-form-title">New password</h1>
          <p className="auth-form-sub">Enter your new password below.</p>

          {done && <div className="alert alert-success">Password updated! Redirecting…</div>}
          {error && <div className="alert alert-error">{error}</div>}
          {!validSession && !done && (
            <div className="alert alert-error">
              Invalid or expired reset link. <Link to="/login" style={{ color: "var(--purple)" }}>Request a new one</Link>.
            </div>
          )}

          {validSession && !done && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input type="password" className="form-input" placeholder="At least 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <input type="password" className="form-input" placeholder="Repeat password"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: 14 }} disabled={loading}>
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}

          <div className="auth-footer-link" style={{ marginTop: 24 }}>
            <Link to="/login">← Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
