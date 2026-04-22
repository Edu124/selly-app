import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const DOWNLOAD_URL = "https://github.com/Edu124/Codeforge-ai/releases/download/v0.3.4/Codeforge.AI_0.3.4_x64_en-US.msi.zip";
const VERSION      = "0.3.4";
const RELEASE_DATE = "12 Mar 2026";

const changelog = [
  { version: "v0.3.4", note: "Financial Analyst extension — link multiple workbooks, valuation, risk analysis, charts, AI chat. 30+ prompt templates. Fixed Install & Restart updater." },
  { version: "v0.3.3", note: "Browser extension with Power BI integration and automation recorder. Improved Excel formula generation." },
  { version: "v0.3.2", note: "VS Code extension improvements — Apply to Editor now works with multi-cursor. Bug fixes." },
  { version: "v0.3.1", note: "Word Add-in: full document summarisation and rewrite modes. Performance improvements." },
  { version: "v0.3.0", note: "PowerPoint Add-in added. Excel add-in now supports named ranges and pivot table analysis." },
];

export default function PortalPage() {
  const { user, profile, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const licenseKey  = profile?.license_key || "TRIAL-XXXX-XXXX-XXXX";
  const plan        = profile?.plan || "trial";
  const isActive    = plan === "pro" || plan === "team";

  async function copyLicense() {
    await navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const a = document.createElement("a");
    a.href = DOWNLOAD_URL;
    a.download = `Codeforge.AI_${VERSION}_x64_en-US.msi.zip`;
    a.click();
  }

  return (
    <div className="portal-layout">
      {/* Nav */}
      <nav className="portal-nav">
        <div className="portal-nav-logo">Code<span>Forge</span> AI</div>
        <div className="portal-nav-right">
          <span className="portal-nav-user">{user?.email}</span>
          <button className="btn btn-outline btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      {/* Body */}
      <div className="portal-body">
        <div className="portal-greeting">Hey, {displayName} 👋</div>
        <div className="portal-sub">Your CodeForge AI account — download, license key, and release notes.</div>

        {/* Stats cards */}
        <div className="portal-cards">
          <div className="portal-card">
            <div className="portal-card-label">Plan</div>
            <div className="portal-card-value" style={{ textTransform: "capitalize" }}>{plan}</div>
            <div className={`portal-card-badge`} style={isActive
              ? { background: "var(--green-dim)", color: "var(--green)" }
              : { background: "var(--purple-dim)", color: "var(--purple)" }
            }>
              {isActive ? "✓ Active" : "⏱ Trial — 14 days"}
            </div>
          </div>

          <div className="portal-card">
            <div className="portal-card-label">Latest version</div>
            <div className="portal-card-value">v{VERSION}</div>
            <div className="portal-card-sub">Released {RELEASE_DATE}</div>
          </div>

          <div className="portal-card">
            <div className="portal-card-label">Platform</div>
            <div className="portal-card-value">Windows</div>
            <div className="portal-card-sub">64-bit · Windows 10 / 11</div>
          </div>

          <div className="portal-card">
            <div className="portal-card-label">Extensions</div>
            <div className="portal-card-value">6 included</div>
            <div className="portal-card-sub">Excel · Word · PPT · VSCode · Browser · Finance</div>
          </div>
        </div>

        {/* Download card */}
        <div className="download-card">
          <div className="download-card-info">
            <div className="download-card-version">v{VERSION}</div>
            <div className="download-card-title">CodeForge AI Desktop</div>
            <div className="download-card-meta">
              Windows installer (.msi) · ~95 MB · Includes all 6 extensions<br />
              After installing, load your extension from the Office ribbon or VS Code.
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleDownload}>
            ⬇ Download v{VERSION}
          </button>
        </div>

        {/* License key */}
        <div className="license-box">
          <div className="license-box-label">Your License Key</div>
          <div className="license-key-row">
            <div className="license-key">{licenseKey}</div>
            <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copyLicense}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 10 }}>
            Enter this key when the app asks on first launch. Keep it safe — it's tied to your account.
          </p>
        </div>

        {/* Install guide */}
        <div className="portal-card" style={{ marginBottom: 24 }}>
          <div className="portal-card-label" style={{ marginBottom: 16 }}>Quick install guide</div>
          {[
            ["1", "Download the .msi.zip file above"],
            ["2", "Extract the zip and run the .msi installer"],
            ["3", "Launch CodeForge AI — it starts the local AI server automatically"],
            ["4", "In Excel/Word/PowerPoint: Home ribbon → Add-ins → My Add-ins → upload the manifest file"],
            ["5", "In VS Code: Ctrl+Shift+P → Install from VSIX → select the .vsix file from the install folder"],
            ["6", "Enter your license key on first launch and you're ready"],
          ].map(([n, step]) => (
            <div key={n} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "flex-start" }}>
              <div style={{
                minWidth: 26, height: 26, borderRadius: "50%",
                background: "var(--purple-dim)", color: "var(--purple)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>{n}</div>
              <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, paddingTop: 3 }}>{step}</div>
            </div>
          ))}
        </div>

        {/* Changelog */}
        <div className="changelog-card">
          <div className="changelog-title">Release Notes</div>
          {changelog.map(c => (
            <div key={c.version} className="changelog-entry">
              <div className="changelog-version">{c.version}</div>
              <div className="changelog-note">{c.note}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, padding: "20px 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>Need help? Email <a href="mailto:hello@codeforgeai.com" style={{ color: "var(--purple)" }}>hello@codeforgeai.com</a></p>
          {!isActive && (
            <a href="mailto:hello@codeforgeai.com?subject=Upgrade to Pro" className="btn btn-primary btn-sm">
              ⚡ Upgrade to Pro — ₹2,999
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
