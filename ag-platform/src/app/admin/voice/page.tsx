"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type ToolDef = { name: string; description: string; risk: "low" | "med" | "high"; parameters: Record<string, unknown> };
type CommandResult = {
  success: boolean;
  command_id: string;
  transcript?: string;
  routing?: { tool: string | null; args: Record<string, unknown>; reasoning?: string };
  execution?: { executed: boolean; output?: unknown; reason?: string; requires_confirm?: boolean };
};

const API_BASE = process.env.NEXT_PUBLIC_VOICE_API_URL || "http://localhost:8000";

export default function AdminVoiceConsole() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const authHeaders = useCallback((): Record<string, string> => ({
    "x-voice-admin-key": adminKey,
    "x-user-id": "admin",
  }), [adminKey]);

  const loadTools = useCallback(async () => {
    if (!adminKey) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/voice/tools`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTools(await res.json());
    } catch (err: any) {
      setError(err?.message || "Failed to load tools");
    }
  }, [adminKey, authHeaders]);

  useEffect(() => { loadTools(); }, [loadTools]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => stream.getTracks().forEach((t) => t.stop());
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch (err: any) {
      setError(err?.message || "Microphone unavailable");
    }
  };

  const stopAndSend = async () => {
    const recorder = mediaRef.current;
    if (!recorder) return;
    setRecording(false);
    setBusy(true);

    const stopped: Promise<Blob> = new Promise((resolve) => {
      recorder.addEventListener("stop", () => resolve(new Blob(chunksRef.current, { type: "audio/webm" })), { once: true });
    });
    recorder.stop();
    const audioBlob = await stopped;

    try {
      const form = new FormData();
      form.append("file", audioBlob, "command.webm");
      const res = await fetch(`${API_BASE}/voice/command`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const result: CommandResult = await res.json();
      setHistory((h) => [result, ...h].slice(0, 25));
    } catch (err: any) {
      setError(err?.message || "Voice command failed");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (commandId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/voice/confirm/${commandId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const result = await res.json();
      setHistory((h) => h.map((r) => (r.command_id === commandId ? { ...r, execution: result.execution, success: result.execution.executed } : r)));
    } catch (err: any) {
      setError(err?.message || "Confirmation failed");
    } finally {
      setBusy(false);
    }
  };

  const riskColor = (r: string) =>
    r === "high" ? "#dc2626" : r === "med" ? "#d97706" : r === "low" ? "#16a34a" : "#6b7280";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#facc15" }}>Vyasa Voice Console</h1>
          <p style={{ color: "#a3a3a3", marginTop: 4 }}>Admin-only voice automation. All commands are audited.</p>
        </header>

        <section style={{ background: "#171717", border: "1px solid #262626", padding: 16, borderRadius: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#a3a3a3", textTransform: "uppercase", letterSpacing: 1 }}>Admin Key</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="VOICE_ADMIN_KEY"
            style={{ width: "100%", marginTop: 6, padding: 10, background: "#0a0a0a", color: "#fff", border: "1px solid #262626", borderRadius: 8 }}
          />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "#171717", border: "1px solid #262626", padding: 20, borderRadius: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Microphone</h2>
            {!recording ? (
              <button onClick={startRecording} disabled={!adminKey || busy}
                      style={{ padding: "12px 20px", background: "#facc15", color: "#000", border: 0, borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: !adminKey ? 0.4 : 1 }}>
                ▶ Hold and speak
              </button>
            ) : (
              <button onClick={stopAndSend}
                      style={{ padding: "12px 20px", background: "#dc2626", color: "#fff", border: 0, borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                ⏹ Stop & send
              </button>
            )}
            {busy && <p style={{ marginTop: 12, color: "#a3a3a3" }}>Processing…</p>}
            {error && <p style={{ marginTop: 12, color: "#f87171" }}>{error}</p>}
          </div>

          <div style={{ background: "#171717", border: "1px solid #262626", padding: 20, borderRadius: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Tool Catalog ({tools.length})</h2>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {tools.map((t) => (
                <div key={t.name} style={{ padding: "8px 0", borderBottom: "1px solid #262626" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <code style={{ color: "#facc15" }}>{t.name}</code>
                    <span style={{ fontSize: 11, fontWeight: 700, color: riskColor(t.risk), textTransform: "uppercase" }}>{t.risk}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#a3a3a3", margin: "2px 0 0" }}>{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: "#171717", border: "1px solid #262626", padding: 20, borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recent Commands</h2>
          {history.length === 0 && <p style={{ color: "#737373" }}>No commands yet.</p>}
          {history.map((r) => (
            <div key={r.command_id} style={{ padding: 12, borderBottom: "1px solid #262626" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#737373" }}>#{r.command_id.slice(0, 8)}</span>
                <span style={{ fontSize: 12, color: r.success ? "#22c55e" : "#f87171" }}>{r.success ? "✓ OK" : "• pending / failed"}</span>
              </div>
              <p style={{ margin: 0 }}>“{r.transcript}”</p>
              <p style={{ fontSize: 13, color: "#a3a3a3", margin: "4px 0" }}>
                → {r.routing?.tool ?? "no tool"} {r.routing?.args ? <code>{JSON.stringify(r.routing.args)}</code> : null}
              </p>
              {r.execution?.requires_confirm && (
                <button onClick={() => confirm(r.command_id)} disabled={busy}
                        style={{ marginTop: 6, padding: "6px 14px", background: "#facc15", color: "#000", border: 0, borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
                  Confirm execution
                </button>
              )}
              {r.execution?.output != null && (
                <pre style={{ background: "#0a0a0a", padding: 10, borderRadius: 6, marginTop: 6, fontSize: 12, overflow: "auto" }}>
                  {JSON.stringify(r.execution.output, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
