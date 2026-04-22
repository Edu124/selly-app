import React from "react";
import { Link } from "react-router-dom";

const DOWNLOAD_URL = "https://github.com/Edu124/Codeforge-ai/releases/download/v0.3.4/Codeforge.AI_0.3.4_x64_en-US.msi.zip";
const VERSION      = "v0.3.4";

const features = [
  { icon: "📊", title: "Excel Add-in",             desc: "Ask AI questions about any selected cells or ranges. Generate formulas, analyse trends, summarise data — without leaving Excel." },
  { icon: "📝", title: "Word Add-in",              desc: "Select any text and ask AI to explain, rewrite, summarise or translate it. Full document privacy guaranteed." },
  { icon: "📑", title: "PowerPoint Add-in",        desc: "Generate slide content, rewrite speaker notes, and summarise presentations — all offline inside PowerPoint." },
  { icon: "💻", title: "VS Code Extension",        desc: "AI sees your open file and selected code. Explain, Refactor, Fix Bugs, Add Comments — apply directly into your editor." },
  { icon: "🌐", title: "Browser Extension",        desc: "AI sidebar for any webpage. Includes automation recording, task bots, and Power BI dashboard integration." },
  { icon: "📈", title: "Financial Analyst",        desc: "Link multiple Excel workbooks, run AI-powered valuations, risk analysis, and scenario modelling — completely offline." },
];

const privacyPoints = [
  { title: "Zero internet required",    desc: "The AI model runs entirely on your CPU. Works in air-gapped environments with no network connection." },
  { title: "No cloud processing",       desc: "Your files and questions never touch an external server — ever. Complete on-device execution." },
  { title: "No account needed",         desc: "No sign-up, no email, no subscription portal for the desktop app itself. Download and use immediately." },
  { title: "No training on your data",  desc: "Unlike cloud AI tools, your inputs are never used to train any model or shared with third parties." },
  { title: "GDPR & HIPAA friendly",     desc: "Because no data leaves your machine, you maintain full compliance with data protection regulations." },
  { title: "Audit-friendly",            desc: "IT teams can verify with certainty that zero data leaves the machine — full transparency and control." },
];

export default function LandingPage() {
  return (
    <div>
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="nav-logo">Code<span>Forge</span> AI</div>
          <div className="nav-links">
            <a href="#features"  className="nav-link">Features</a>
            <a href="#privacy"   className="nav-link">Privacy</a>
            <a href="#pricing"   className="nav-link">Pricing</a>
          </div>
          <div className="nav-actions">
            <Link to="/login"    className="btn btn-ghost btn-sm">Sign In</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Now with Financial Analyst Extension
        </div>
        <h1 className="hero-title">
          Private AI for <span className="highlight">Excel, Word</span><br />
          & VS Code
        </h1>
        <p className="hero-sub">
          A powerful AI assistant that runs 100% on your computer.
          No internet. No data leaks. No subscriptions per user.
        </p>
        <div className="hero-actions">
          <a href={DOWNLOAD_URL} className="btn btn-primary btn-lg" download>
            ⬇ Download for Windows
          </a>
          <Link to="/register" className="btn btn-outline btn-lg">
            Create Account
          </Link>
        </div>
        <p className="hero-note">Windows 10/11 · {VERSION} · Free 14-day trial</p>
      </section>

      {/* ── Works with ───────────────────────────────────────────────── */}
      <div className="works-with">
        <p className="works-with-label">Works inside your existing tools</p>
        <div className="works-with-logos">
          {[
            { icon: "📊", name: "Microsoft Excel" },
            { icon: "📝", name: "Microsoft Word" },
            { icon: "📑", name: "PowerPoint" },
            { icon: "💻", name: "VS Code" },
            { icon: "🌐", name: "Chrome" },
            { icon: "📈", name: "Power BI" },
          ].map(l => (
            <div key={l.name} className="works-logo">
              <span className="works-logo-icon">{l.icon}</span>
              {l.name}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="features" id="features">
        <div className="container">
          <p className="section-label">Six Extensions</p>
          <h2 className="section-title">AI built into the tools<br />you already use</h2>
          <p className="section-sub">Each extension connects directly to your application — no copy-pasting, no browser tabs.</p>
          <div className="features-grid">
            {features.map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────────────────────── */}
      <section className="privacy-section" id="privacy">
        <div className="privacy-inner">
          <div>
            <p className="section-label">100% Private</p>
            <h2 className="section-title">Your data never leaves your computer</h2>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              Unlike ChatGPT and Copilot, CodeForge AI runs entirely on your machine.
              Ideal for finance, legal, healthcare, and any team handling confidential data.
            </p>
          </div>
          <div className="privacy-checks">
            {privacyPoints.map(p => (
              <div key={p.title} className="privacy-check">
                <div className="privacy-check-icon">✓</div>
                <div>
                  <div className="privacy-check-title">{p.title}</div>
                  <div className="privacy-check-desc">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section className="pricing" id="pricing">
        <div className="container">
          <p className="section-label">Pricing</p>
          <h2 className="section-title">Simple, one-time pricing</h2>
          <p className="section-sub" style={{ margin: "0 auto 60px" }}>
            Pay once, use forever. No per-user fees. No cloud subscription.
          </p>
          <div className="pricing-cards">
            {/* Free trial */}
            <div className="pricing-card">
              <div className="pricing-name">Free Trial</div>
              <div className="pricing-price"><span>₹</span>0</div>
              <div className="pricing-period">14 days, no card required</div>
              <ul className="pricing-features">
                <li>All 6 extensions included</li>
                <li>Full AI capabilities</li>
                <li>Unlimited queries</li>
                <li>Excel, Word & PowerPoint</li>
                <li>VS Code integration</li>
              </ul>
              <Link to="/register" className="btn btn-outline" style={{ width: "100%" }}>
                Start Free Trial
              </Link>
            </div>

            {/* Pro */}
            <div className="pricing-card featured">
              <div className="pricing-popular">Most Popular</div>
              <div className="pricing-name">Professional</div>
              <div className="pricing-price"><span>₹</span>2,999</div>
              <div className="pricing-period">one-time payment · lifetime license</div>
              <ul className="pricing-features">
                <li>Everything in Free Trial</li>
                <li>Lifetime updates</li>
                <li>Financial Analyst extension</li>
                <li>Browser extension + automation</li>
                <li>Priority support</li>
                <li>1 machine, transferable</li>
              </ul>
              <Link to="/register" className="btn btn-primary" style={{ width: "100%" }}>
                Buy Now
              </Link>
            </div>

            {/* Team */}
            <div className="pricing-card">
              <div className="pricing-name">Team</div>
              <div className="pricing-price" style={{ fontSize: 32 }}>Contact Us</div>
              <div className="pricing-period">5+ seats · volume discount</div>
              <ul className="pricing-features">
                <li>All Professional features</li>
                <li>Centralised license management</li>
                <li>Offline deployment package</li>
                <li>Dedicated onboarding</li>
                <li>SLA support</li>
              </ul>
              <a href="mailto:hello@codeforgeai.com" className="btn btn-outline" style={{ width: "100%" }}>
                Get a Quote
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="container">
          <h2 className="cta-title">Ready to try it?</h2>
          <p className="cta-sub">Download CodeForge AI today. 14-day free trial. No credit card required.</p>
          <div className="hero-actions">
            <a href={DOWNLOAD_URL} className="btn btn-primary btn-lg" download>
              ⬇ Download for Windows
            </a>
            <Link to="/register" className="btn btn-outline btn-lg">
              Create Account
            </Link>
          </div>
          <p className="hero-note" style={{ marginTop: 20 }}>{VERSION} · Windows 10 / 11 · 64-bit</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-logo">Code<span>Forge</span> AI</div>
        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="#privacy">Privacy</a>
          <a href="#pricing">Pricing</a>
          <Link to="/login">Sign In</Link>
          <Link to="/register">Register</Link>
          <a href="mailto:hello@codeforgeai.com">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} CodeForge AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
