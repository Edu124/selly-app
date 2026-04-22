import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    if (error) setError(error.message);
    else setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-sidebar">
          <div className="auth-sidebar-content">
            <div className="auth-sidebar-logo">Code<span>Forge</span> AI</div>
            <div className="auth-sidebar-title">Almost there!</div>
            <div className="auth-sidebar-sub">Check your inbox to verify your email address and unlock your download.</div>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form-box" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>📬</div>
            <h1 className="auth-form-title">Check your email</h1>
            <p style={{ color: "var(--text-2)", marginBottom: 32, lineHeight: 1.65 }}>
              We sent a confirmation link to <strong style={{ color: "var(--text-1)" }}>{email}</strong>.
              Click it to activate your account and get access to your download.
            </p>
            <div className="alert alert-info">
              Didn't receive it? Check your spam folder or{" "}
              <a href="#" onClick={e => { e.preventDefault(); setDone(false); }} style={{ color: "var(--purple)" }}>
                try again
              </a>.
            </div>
            <Link to="/login" className="btn btn-outline" style={{ width: "100%", marginTop: 20 }}>
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      {/* Sidebar */}
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <div className="auth-sidebar-logo">Code<span>Forge</span> AI</div>
          <div className="auth-sidebar-title">Start your free 14-day trial</div>
          <div className="auth-sidebar-sub">
            No credit card required. Full access to all 6 extensions from day one.
          </div>
          <div className="auth-feature-list">
            {[
              "Excel, Word & PowerPoint add-ins",
              "VS Code & Browser extensions",
              "Financial Analyst for multi-workbook AI",
              "30+ built-in prompt templates",
              "Runs 100% offline on your machine",
            ].map(f => (
              <div key={f} className="auth-feature">
                <div className="auth-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="auth-form-side">
        <div className="auth-form-box">
          <h1 className="auth-form-title">Create account</h1>
          <p className="auth-form-sub">
            Already have one? <Link to="/login">Sign in</Link>
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Your name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Work email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "14px", marginTop: 4 }}
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create free account →"}
            </button>

            <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", lineHeight: 1.5 }}>
              By creating an account you agree to our{" "}
              <a href="#" style={{ color: "var(--text-2)" }}>Terms of Service</a> and{" "}
              <a href="#" style={{ color: "var(--text-2)" }}>Privacy Policy</a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
