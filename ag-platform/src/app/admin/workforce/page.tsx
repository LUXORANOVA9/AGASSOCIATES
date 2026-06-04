"use client";

import React, { useCallback, useEffect, useState } from "react";

type Staff = {
  id: string; kind: "agent" | "human"; display_name: string; short_name: string;
  agent_module: string | null; phone: string | null; email: string | null;
  state: "online" | "idle" | "offline" | "disabled"; last_heartbeat: string | null;
};
type Capability = { code: string; label: string; category: string; risk: string };
type Grant = { staff_id: string; capability_code: string; enabled: boolean };
type Activity = {
  id: string; source: string; capability_code: string | null; case_id: string | null;
  summary: string; status: string; occurred_at: string;
  staff_short: string | null; staff_label: string | null; staff_kind: string | null;
};
type Summary = {
  staff_by_state: { kind: string; state: string; n: number }[];
  activity_24h_by_source: { source: string; n: number }[];
  anomalies: {
    staff_id: string; bad_events: number; total_events: number;
    short_name: string; display_name: string; state: string;
  }[];
};
type TimelineEntry = {
  id: string; source: string; capability_code: string | null; summary: string;
  status: string; occurred_at: string; staff_label: string | null; staff_kind: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_VOICE_API_URL || "http://localhost:8000";

export default function WorkforceConsole() {
  const [key, setKey] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [grants, setGrants] = useState<Map<string, boolean>>(new Map());
  const [activity, setActivity] = useState<Activity[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ case_id: string; entries: TimelineEntry[] } | null>(null);
  const [audioUrl, setAudioUrl] = useState<{ command_id: string; url: string } | null>(null);

  const headers = useCallback((): HeadersInit => ({ "x-voice-admin-key": key }), [key]);

  const reloadAll = useCallback(async () => {
    if (!key) return;
    setErr(null); setBusy(true);
    try {
      const [m, a, s] = await Promise.all([
        fetch(`${API_BASE}/workforce/matrix`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API_BASE}/workforce/activity?limit=50`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API_BASE}/workforce/summary`, { headers: headers() }).then((r) => r.json()),
      ]);
      setStaff(m.staff); setCaps(m.capabilities);
      setGrants(new Map(m.grants.map((g: Grant) => [`${g.staff_id}::${g.capability_code}`, g.enabled])));
      setActivity(a); setSummary(s);
    } catch (e: any) {
      setErr(e?.message ?? "load failed");
    } finally {
      setBusy(false);
    }
  }, [key, headers]);

  useEffect(() => { reloadAll(); }, [reloadAll]);
  useEffect(() => {
    if (!key) return;
    const t = setInterval(() => {
      fetch(`${API_BASE}/workforce/activity?limit=50`, { headers: headers() })
        .then((r) => r.json()).then(setActivity).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [key, headers]);

  const toggle = async (staff_id: string, code: string, enabled: boolean) => {
    const k = `${staff_id}::${code}`;
    setGrants(new Map(grants.set(k, enabled)));
    await fetch(`${API_BASE}/workforce/matrix/grant`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id, capability_code: code, enabled, granted_by: "admin" }),
    });
  };

  const setState = async (staff_id: string, state: string) => {
    await fetch(`${API_BASE}/workforce/staff/${staff_id}/state`, {
      method: "POST", headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    reloadAll();
  };

  const openTimeline = async (case_id: string) => {
    setTimeline({ case_id, entries: [] });
    try {
      const r = await fetch(`${API_BASE}/workforce/case/${case_id}/timeline`, { headers: headers() });
      const data = await r.json();
      setTimeline({ case_id, entries: data.timeline || [] });
    } catch (e: any) {
      setErr(e?.message || "timeline failed");
    }
  };

  const playAudio = async (command_id: string) => {
    try {
      const r = await fetch(`${API_BASE}/voice/audio/${command_id}`, { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setAudioUrl({ command_id, url: data.url });
    } catch (e: any) {
      setErr(e?.message || "audio fetch failed");
    }
  };

  const dot = (s: string) =>
    s === "online" ? "#22c55e" : s === "idle" ? "#facc15" : s === "offline" ? "#737373" : "#dc2626";
  const riskColor = (r: string) =>
    r === "high" ? "#dc2626" : r === "med" ? "#d97706" : "#16a34a";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#facc15" }}>Workforce Control</h1>
          <p style={{ color: "#a3a3a3" }}>Agentic + human staff, capabilities, live activity.</p>
        </header>

        <section style={{ background: "#171717", border: "1px solid #262626", padding: 12, borderRadius: 12, marginBottom: 16 }}>
          <input type="password" placeholder="VOICE_ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)}
                 style={{ width: "100%", padding: 10, background: "#0a0a0a", color: "#fff", border: "1px solid #262626", borderRadius: 8 }} />
        </section>

        {err && <p style={{ color: "#f87171" }}>{err}</p>}

        {summary?.anomalies?.length ? (
          <section style={{ background: "#7f1d1d", padding: 12, borderRadius: 10, marginBottom: 16, border: "1px solid #dc2626" }}>
            <strong>⚠ Anomaly watch ({summary.anomalies.length}):</strong>{" "}
            {summary.anomalies.map((a) => (
              <span key={a.staff_id} style={{ marginRight: 12 }}>
                {a.display_name} — {a.bad_events}/{a.total_events} bad ({a.state})
              </span>
            ))}
          </section>
        ) : null}

        {summary && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            {summary.staff_by_state.map((c) => (
              <div key={`${c.kind}-${c.state}`} style={{ background: "#171717", padding: 14, borderRadius: 10, border: "1px solid #262626" }}>
                <div style={{ fontSize: 11, color: "#737373", textTransform: "uppercase" }}>{c.kind} / {c.state}</div>
                <div style={{ fontSize: 26, fontWeight: 700 }}>{c.n}</div>
              </div>
            ))}
            {summary.activity_24h_by_source.map((c) => (
              <div key={`src-${c.source}`} style={{ background: "#171717", padding: 14, borderRadius: 10, border: "1px solid #262626" }}>
                <div style={{ fontSize: 11, color: "#737373", textTransform: "uppercase" }}>{c.source} (24h)</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#facc15" }}>{c.n}</div>
              </div>
            ))}
          </section>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) 2fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "#171717", border: "1px solid #262626", borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Roster ({staff.length})</h2>
            {staff.map((s) => (
              <div key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid #262626", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: dot(s.state), display: "inline-block" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{s.display_name}</div>
                  <div style={{ fontSize: 12, color: "#737373" }}>{s.kind} • {s.short_name}</div>
                </div>
                <select value={s.state} onChange={(e) => setState(s.id, e.target.value)}
                        style={{ background: "#0a0a0a", color: "#fff", border: "1px solid #262626", borderRadius: 6, padding: "4px 6px" }}>
                  <option value="online">online</option><option value="idle">idle</option>
                  <option value="offline">offline</option><option value="disabled">disabled</option>
                </select>
              </div>
            ))}
          </div>

          <div style={{ background: "#171717", border: "1px solid #262626", borderRadius: 12, padding: 16, overflowX: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Capability Matrix</h2>
            <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 6, position: "sticky", left: 0, background: "#171717" }}>Capability</th>
                  {staff.map((s) => (
                    <th key={s.id} style={{ padding: 6, color: "#facc15", textAlign: "center", minWidth: 60 }}>{s.short_name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caps.map((c) => (
                  <tr key={c.code} style={{ borderTop: "1px solid #262626" }}>
                    <td style={{ padding: 6, position: "sticky", left: 0, background: "#171717" }}>
                      <div>{c.label}</div>
                      <div style={{ fontSize: 11, color: "#737373" }}>
                        {c.category} • <span style={{ color: riskColor(c.risk) }}>{c.risk}</span>
                      </div>
                    </td>
                    {staff.map((s) => {
                      const k = `${s.id}::${c.code}`;
                      const on = grants.get(k) ?? false;
                      return (
                        <td key={k} style={{ textAlign: "center", padding: 4 }}>
                          <input type="checkbox" checked={on} onChange={(e) => toggle(s.id, c.code, e.target.checked)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ background: "#171717", border: "1px solid #262626", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Live Activity (auto-refresh 4s)</h2>
          {activity.length === 0 && <p style={{ color: "#737373" }}>No activity yet.</p>}
          {activity.map((a: any) => (
            <div key={a.id} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid #262626", fontSize: 13, alignItems: "center" }}>
              <span style={{ width: 60, color: "#737373" }}>{new Date(a.occurred_at).toLocaleTimeString()}</span>
              <span style={{ width: 110, color: "#facc15" }}>{a.staff_label || a.source}</span>
              <span style={{ flex: 1 }}>{a.summary}</span>
              {a.source === "voice" && a.payload?.command_id && (
                <button onClick={() => playAudio(a.payload.command_id)}
                        style={{ background: "transparent", color: "#facc15", border: "1px solid #facc15", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>
                  ▶ replay
                </button>
              )}
              {a.case_id && (
                <button onClick={() => openTimeline(a.case_id)}
                        style={{ background: "transparent", color: "#60a5fa", border: "1px solid #60a5fa", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>
                  case
                </button>
              )}
              <span style={{ width: 50, textAlign: "right", color: a.status === "error" ? "#f87171" : a.status === "warn" ? "#facc15" : "#22c55e" }}>{a.status}</span>
            </div>
          ))}
        </section>

        {timeline && (
          <div onClick={() => setTimeline(null)}
               style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 50 }}>
            <div onClick={(e) => e.stopPropagation()}
                 style={{ background: "#171717", border: "1px solid #262626", borderRadius: 12, padding: 20, width: "min(900px, 90vw)", maxHeight: "85vh", overflowY: "auto" }}>
              <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0, color: "#facc15" }}>Case timeline · {timeline.case_id}</h3>
                <button onClick={() => setTimeline(null)} style={{ background: "transparent", color: "#fff", border: 0, cursor: "pointer", fontSize: 20 }}>×</button>
              </header>
              {timeline.entries.length === 0 && <p style={{ color: "#737373" }}>Loading / no entries.</p>}
              {timeline.entries.map((e) => (
                <div key={e.id} style={{ padding: "6px 0", borderBottom: "1px solid #262626", fontSize: 13 }}>
                  <span style={{ color: "#737373", marginRight: 12 }}>{new Date(e.occurred_at).toLocaleString()}</span>
                  <span style={{ color: "#facc15", marginRight: 12 }}>{e.staff_label || e.source}</span>
                  {e.summary}
                  {e.capability_code && <span style={{ marginLeft: 8, color: "#737373", fontSize: 11 }}>[{e.capability_code}]</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {audioUrl && (
          <div onClick={() => setAudioUrl(null)}
               style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 50 }}>
            <div onClick={(e) => e.stopPropagation()}
                 style={{ background: "#171717", border: "1px solid #262626", borderRadius: 12, padding: 20, width: "min(500px, 90vw)" }}>
              <h3 style={{ marginTop: 0, color: "#facc15" }}>Replay · {audioUrl.command_id.slice(0, 8)}</h3>
              <audio src={audioUrl.url} controls autoPlay style={{ width: "100%" }} />
              <p style={{ fontSize: 11, color: "#737373", marginTop: 8 }}>Presigned URL expires in 60 s.</p>
            </div>
          </div>
        )}

        {busy && <p style={{ color: "#a3a3a3", marginTop: 12 }}>Loading…</p>}
      </div>
    </div>
  );
}
