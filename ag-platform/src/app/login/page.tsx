"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_AG_API || "http://localhost:8000";

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background:
        "radial-gradient(at top left, rgba(250,204,21,0.15), transparent 40%)," +
        "radial-gradient(at bottom right, rgba(99,102,241,0.15), transparent 50%), #0a0a0a",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "rgba(23,23,23,0.7)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(250,204,21,0.2)",
        borderRadius: 20,
        padding: 48,
        width: "min(440px, 92vw)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        textAlign: "center",
      }}>
        <div style={{
          width: 64, height: 64, margin: "0 auto 24px",
          background: "linear-gradient(135deg,#facc15,#a16207)",
          borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#0a0a0a",
          boxShadow: "0 0 30px rgba(250,204,21,0.4)",
        }}>AG</div>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: -0.5 }}>
          AG Digital Office
        </h1>
        <p style={{ color: "#a3a3a3", margin: "0 0 32px", fontSize: 14 }}>
          The autonomous legal operations workspace.
        </p>

        <a
          href={`${API}/auth/login`}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12,
            width: "100%", padding: "14px 20px",
            background: "#fff", color: "#0a0a0a",
            border: 0, borderRadius: 12,
            fontSize: 15, fontWeight: 600, textDecoration: "none",
            transition: "transform 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.6l6.2 5.2c-.4.4 6.5-4.7 6.5-14.8 0-1.3-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </a>

        <p style={{ color: "#737373", marginTop: 24, fontSize: 12 }}>
          Restricted to AG Associates &amp; LUXORANOVA members.
        </p>
      </div>
    </div>
  );
}
