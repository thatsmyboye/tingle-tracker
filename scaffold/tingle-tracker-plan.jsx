import { useState } from "react";

const phases = [
  {
    id: 1,
    label: "Phase 1",
    title: "Core Loop",
    subtitle: "MVP",
    color: "#7FFFD4",
    accent: "#00CFA8",
    epics: [
      { id: "data-model", label: "Data Model", pts: 8, desc: "Supabase schema, RLS policies, seed data, migrations" },
      { id: "content-ingest", label: "Content Ingest", pts: 5, desc: "YouTube oEmbed/Data API, video player wrapper component" },
      { id: "tingle-logger", label: "Tingle Logger", pts: 8, desc: "Real-time tap/click capture, intensity picker, offline queue for mobile" },
      { id: "heatmap-viz", label: "Heatmap Viz", pts: 5, desc: "Timeline heatmap component — tingle density overlaid on video duration" },
    ],
  },
  {
    id: 2,
    label: "Phase 2",
    title: "Intelligence",
    subtitle: "LLM Layer",
    color: "#B8A9FF",
    accent: "#7C5CFC",
    epics: [
      { id: "trigger-taxonomy", label: "Trigger Taxonomy", pts: 3, desc: "Tag system (visual/aural/tactile-adjacent), admin seeding, creator tagging UI" },
      { id: "llm-pipeline", label: "LLM Pipeline", pts: 13, desc: "Inngest job → Claude analysis → insights_cache; trigger classification from transcript/title" },
      { id: "creator-dashboard", label: "Creator Dashboard", pts: 8, desc: "Insight reports, heatmap explorer, weekly digest emails" },
    ],
  },
  {
    id: 3,
    label: "Phase 3",
    title: "Discovery",
    subtitle: "Network Effects",
    color: "#FFD580",
    accent: "#F5A623",
    epics: [
      { id: "user-profile", label: "User Trigger Profile", pts: 8, desc: "Preference builder, personal tingle history, trigger breakdown charts" },
      { id: "discovery", label: "Discovery Engine", pts: 13, desc: "Creator matching by trigger overlap, playlists by trigger type, community features" },
    ],
  },
];

const dataModel = [
  { table: "creators", desc: "profile, YouTube channel ID, bio", type: "core" },
  { table: "content", desc: "video_id (YT), creator_id, title, duration, thumbnail_url", type: "core" },
  { table: "tingle_events", desc: "user_id, content_id, timestamp_ms, intensity (1–5), notes", type: "core" },
  { table: "trigger_tags", desc: "id, label, category: visual | aural | tactile-adjacent", type: "taxonomy" },
  { table: "content_triggers", desc: "content_id, trigger_tag_id — creator-labeled or LLM-inferred", type: "taxonomy" },
  { table: "user_profiles", desc: "user_id, trigger preferences, discovery settings", type: "user" },
  { table: "insights_cache", desc: "content_id, generated_at, report_json", type: "ai" },
];

const typeColors = {
  core: { bg: "rgba(127,255,212,0.12)", border: "#7FFFD4", text: "#7FFFD4" },
  taxonomy: { bg: "rgba(184,169,255,0.12)", border: "#B8A9FF", text: "#B8A9FF" },
  user: { bg: "rgba(255,213,128,0.12)", border: "#FFD580", text: "#FFD580" },
  ai: { bg: "rgba(255,120,120,0.12)", border: "#FF7878", text: "#FF7878" },
};

const triggers = [
  { cat: "Aural", tags: ["whispering", "soft speaking", "tapping", "crinkling", "scratching", "typing", "binaural", "rain/ambient", "page turning"] },
  { cat: "Visual", tags: ["slow hands", "close-up", "light tracing", "writing", "folding", "brushing", "no eye contact", "eye contact"] },
  { cat: "Tactile-Adjacent", tags: ["scalp massage sim", "ear cleaning sim", "face touching sim", "hair brushing sim"] },
];

const stack = [
  { layer: "Frontend", tech: "Next.js + Expo", note: "Web & mobile (headphone/phone-native audience)" },
  { layer: "Backend/Auth", tech: "Supabase", note: "Schema, RLS, realtime tingle events" },
  { layer: "Jobs", tech: "Inngest", note: "Tingle ingestion → LLM analysis pipeline" },
  { layer: "AI", tech: "Claude API", note: "Trigger classification, creator insight reports" },
  { layer: "Hosting", tech: "Vercel", note: "Same infra as Meridian" },
  { layer: "Monorepo", tech: "Turborepo + pnpm", note: "Shared packages across web/mobile" },
];

export default function TingleTrackerPlan() {
  const [activePhase, setActivePhase] = useState(1);
  const [activeTab, setActiveTab] = useState("roadmap");

  const phase = phases.find((p) => p.id === activePhase);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0F",
      color: "#E8E8F0",
      fontFamily: "'DM Mono', 'Fira Code', monospace",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #2A2A3F; border-radius: 2px; }
        .tab-btn { transition: all 0.2s; cursor: pointer; border: none; }
        .tab-btn:hover { opacity: 0.8; }
        .phase-btn { transition: all 0.25s; cursor: pointer; border: none; }
        .phase-btn:hover { transform: translateY(-1px); }
        .epic-card { transition: all 0.2s; }
        .epic-card:hover { transform: translateX(3px); }
        .pulse { animation: pulse 3s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent); background-size: 200% 100%; animation: shimmer 3s infinite; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1E1E2E",
        padding: "28px 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(180deg, #0D0D18 0%, #0A0A0F 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: 40, height: 40,
            background: "radial-gradient(circle, #7FFFD4 0%, #00CFA8 60%, #004D40 100%)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 0 20px rgba(127,255,212,0.3)",
          }}>✦</div>
          <div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#F0F0FF",
            }}>Tingle Tracker</div>
            <div style={{ fontSize: 11, color: "#555577", letterSpacing: "0.08em", marginTop: 1 }}>
              PRODUCT PLAN · v0.1
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {["roadmap", "data", "triggers", "stack"].map((t) => (
            <button key={t} className="tab-btn" onClick={() => setActiveTab(t)} style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background: activeTab === t ? "#1E1E2E" : "transparent",
              color: activeTab === t ? "#7FFFD4" : "#555577",
              border: activeTab === t ? "1px solid #2A2A3F" : "1px solid transparent",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 36px", maxWidth: 960, margin: "0 auto" }}>

        {/* ROADMAP TAB */}
        {activeTab === "roadmap" && (
          <div>
            {/* Value Props */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32,
            }}>
              {[
                { icon: "◉", label: "Creators", desc: "Tingle heatmaps + LLM trigger analysis → better content decisions", color: "#7FFFD4" },
                { icon: "◎", label: "Listeners", desc: "Log tingle moments, build a personal trigger profile, discover creators", color: "#B8A9FF" },
                { icon: "◈", label: "Network", desc: "Match listeners to creators by trigger overlap — compounding discovery", color: "#FFD580" },
              ].map((v) => (
                <div key={v.label} className="shimmer" style={{
                  padding: "18px 20px",
                  background: "#0D0D18",
                  border: "1px solid #1E1E2E",
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 20, color: v.color, marginBottom: 8 }}>{v.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#C0C0D8", marginBottom: 6 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: "#4A4A66", lineHeight: 1.6 }}>{v.desc}</div>
                </div>
              ))}
            </div>

            {/* Phase Selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {phases.map((p) => (
                <button key={p.id} className="phase-btn" onClick={() => setActivePhase(p.id)} style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontSize: 12,
                  background: activePhase === p.id ? `rgba(${p.id===1?"127,255,212":p.id===2?"184,169,255":"255,213,128"},0.12)` : "#0D0D18",
                  color: activePhase === p.id ? p.color : "#3A3A56",
                  border: `1px solid ${activePhase === p.id ? p.color : "#1E1E2E"}`,
                  fontFamily: "inherit",
                  letterSpacing: "0.04em",
                  boxShadow: activePhase === p.id ? `0 0 14px ${p.color}22` : "none",
                }}>
                  {p.label} · {p.title}
                  <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.6 }}>{p.subtitle}</span>
                </button>
              ))}
            </div>

            {/* Epics */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {phase.epics.map((e) => (
                <div key={e.id} className="epic-card" style={{
                  padding: "16px 20px",
                  background: "#0D0D18",
                  border: `1px solid #1E1E2E`,
                  borderLeft: `3px solid ${phase.color}`,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                }}>
                  <div style={{
                    minWidth: 36, height: 36,
                    background: `${phase.color}18`,
                    border: `1px solid ${phase.color}44`,
                    borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: phase.color, fontWeight: 500,
                  }}>{e.pts}pt</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#C0C0D8", fontWeight: 500 }}>{e.label}</span>
                      <code style={{ fontSize: 10, color: "#3A3A56", background: "#141420", padding: "1px 6px", borderRadius: 3 }}>{e.id}</code>
                    </div>
                    <div style={{ fontSize: 11, color: "#4A4A66", lineHeight: 1.6 }}>{e.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total pts */}
            <div style={{
              padding: "12px 20px",
              background: "#0D0D18",
              border: "1px solid #1E1E2E",
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 11, color: "#3A3A56", letterSpacing: "0.06em" }}>TOTAL STORY POINTS — ALL PHASES</span>
              <span style={{ fontSize: 20, color: "#7FFFD4", fontFamily: "'Playfair Display', serif" }}>
                {phases.flatMap(p => p.epics).reduce((s, e) => s + e.pts, 0)} pts
              </span>
            </div>
          </div>
        )}

        {/* DATA TAB */}
        {activeTab === "data" && (
          <div>
            <div style={{ fontSize: 12, color: "#3A3A56", letterSpacing: "0.08em", marginBottom: 20, textTransform: "uppercase" }}>
              Supabase Schema — Core Tables
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {dataModel.map((t) => {
                const c = typeColors[t.type];
                return (
                  <div key={t.table} style={{
                    padding: "14px 18px",
                    background: c.bg,
                    border: `1px solid ${c.border}33`,
                    borderRadius: 8,
                    display: "grid",
                    gridTemplateColumns: "180px 1fr 80px",
                    alignItems: "center",
                    gap: 16,
                  }}>
                    <code style={{ fontSize: 12, color: c.text }}>{t.table}</code>
                    <span style={{ fontSize: 11, color: "#4A4A66", lineHeight: 1.5 }}>{t.desc}</span>
                    <span style={{
                      fontSize: 9, color: c.text, background: `${c.border}22`,
                      padding: "2px 8px", borderRadius: 10, textAlign: "center",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>{t.type}</span>
                  </div>
                );
              })}
            </div>

            {/* Key relationships */}
            <div style={{
              padding: "18px 20px",
              background: "#0D0D18",
              border: "1px solid #1E1E2E",
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 2,
              color: "#3A3A56",
            }}>
              <div style={{ color: "#555577", marginBottom: 8, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Key Relationships</div>
              <div><code style={{ color: "#7FFFD4" }}>tingle_events.content_id</code> → <code style={{ color: "#7FFFD4" }}>content.id</code></div>
              <div><code style={{ color: "#B8A9FF" }}>content_triggers</code> joins <code style={{ color: "#7FFFD4" }}>content</code> ↔ <code style={{ color: "#B8A9FF" }}>trigger_tags</code> (many-to-many)</div>
              <div><code style={{ color: "#FFD580" }}>user_profiles.trigger_preferences</code> → JSONB array of <code style={{ color: "#B8A9FF" }}>trigger_tag.id</code></div>
              <div><code style={{ color: "#FF7878" }}>insights_cache</code> is write-through from Inngest job, keyed by <code style={{ color: "#7FFFD4" }}>content_id</code></div>
            </div>
          </div>
        )}

        {/* TRIGGERS TAB */}
        {activeTab === "triggers" && (
          <div>
            <div style={{ fontSize: 12, color: "#3A3A56", letterSpacing: "0.08em", marginBottom: 20, textTransform: "uppercase" }}>
              Trigger Taxonomy — Seed Data
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {triggers.map((cat, i) => {
                const colors = ["#7FFFD4", "#B8A9FF", "#FFD580"];
                const c = colors[i];
                return (
                  <div key={cat.cat} style={{
                    padding: "16px 20px",
                    background: "#0D0D18",
                    border: `1px solid #1E1E2E`,
                    borderLeft: `3px solid ${c}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 10, color: c, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{cat.cat}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {cat.tags.map((tag) => (
                        <span key={tag} style={{
                          padding: "4px 10px",
                          background: `${c}14`,
                          border: `1px solid ${c}33`,
                          borderRadius: 20,
                          fontSize: 11,
                          color: "#8A8AAA",
                        }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{
              marginTop: 16,
              padding: "14px 18px",
              background: "#0D0D18",
              border: "1px solid #1E1E2E",
              borderRadius: 8,
              fontSize: 11,
              color: "#3A3A56",
              lineHeight: 1.7,
            }}>
              <span style={{ color: "#555577" }}>LLM classification: </span>
              Claude will ingest video title, description, and transcript (via YouTube captions API) and return a ranked list of trigger_tag matches. Creator can confirm or override. This seeds <code style={{ color: "#B8A9FF" }}>content_triggers</code> automatically.
            </div>
          </div>
        )}

        {/* STACK TAB */}
        {activeTab === "stack" && (
          <div>
            <div style={{ fontSize: 12, color: "#3A3A56", letterSpacing: "0.08em", marginBottom: 20, textTransform: "uppercase" }}>
              Technical Stack
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {stack.map((s) => (
                <div key={s.layer} style={{
                  padding: "14px 20px",
                  background: "#0D0D18",
                  border: "1px solid #1E1E2E",
                  borderRadius: 8,
                  display: "grid",
                  gridTemplateColumns: "120px 180px 1fr",
                  alignItems: "center",
                  gap: 20,
                }}>
                  <span style={{ fontSize: 10, color: "#3A3A56", letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.layer}</span>
                  <code style={{ fontSize: 12, color: "#7FFFD4" }}>{s.tech}</code>
                  <span style={{ fontSize: 11, color: "#4A4A66" }}>{s.note}</span>
                </div>
              ))}
            </div>

            <div style={{
              padding: "18px 20px",
              background: "#0D0D18",
              border: "1px solid #1E1E2E",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, color: "#555577", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Claude Code CLAUDE.md Epics</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {phases.flatMap(p => p.epics).map((e) => (
                  <code key={e.id} style={{
                    padding: "4px 10px",
                    background: "#141420",
                    border: "1px solid #1E1E2E",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#6A6A8A",
                  }}>{e.id}</code>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{
        padding: "16px 36px",
        borderTop: "1px solid #1E1E2E",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 10, color: "#2A2A3F", letterSpacing: "0.06em" }}>
          TINGLE TRACKER — PRODUCT PLAN · FOR CLAUDE CODE
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          {phases.map(p => (
            <span key={p.id} style={{ fontSize: 10, color: "#2A2A3F" }}>
              {p.title}: <span style={{ color: p.color }}>{p.epics.reduce((s,e)=>s+e.pts,0)}pt</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
