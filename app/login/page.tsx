"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeNextPath } from "@/app/lib/nextPath";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email ve şifre zorunludur.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Giriş başarısız.");
        return;
      }
      if (data.mustChangePassword) {
        router.push("/change-password");
      } else {
        const next = new URLSearchParams(window.location.search).get("next");
        router.push(safeNextPath(next));
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Aurora background layers (inline, no module) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          background: "radial-gradient(140% 90% at 50% 100%, #061026 0%, #03070f 55%, #02040a 100%)",
          filter: "brightness(.45) saturate(.7)",
        }}
      >
        {/* Sky gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 80% at 80% 110%, rgba(40,70,130,.55), transparent 60%), " +
              "radial-gradient(70% 90% at 15% 105%, rgba(30,90,160,.45), transparent 60%), " +
              "linear-gradient(180deg, #020410 0%, #04081a 40%, #061026 75%, #08183c 100%)",
          }}
        />
        {/* Aurora band 1 */}
        <div
          style={{
            position: "absolute",
            inset: "-20% -10%",
            filter: "blur(60px) saturate(160%)",
            mixBlendMode: "screen",
            opacity: 0.9,
            background:
              "radial-gradient(50% 35% at 30% 55%, rgba(80,255,190,.85), transparent 65%), " +
              "radial-gradient(45% 30% at 65% 50%, rgba(120,230,255,.7), transparent 70%)",
          }}
        />
        {/* Aurora band 2 */}
        <div
          style={{
            position: "absolute",
            inset: "-20% -10%",
            filter: "blur(60px) saturate(160%)",
            mixBlendMode: "screen",
            opacity: 0.7,
            background:
              "radial-gradient(60% 30% at 70% 45%, rgba(160,90,255,.7), transparent 70%), " +
              "radial-gradient(40% 25% at 25% 60%, rgba(255,100,200,.55), transparent 70%)",
          }}
        />
        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.25) 25%, rgba(0,0,0,.15) 50%, rgba(0,0,0,.55) 85%, rgba(0,0,0,.85) 100%)",
          }}
        />
      </div>

      {/* Login card */}
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 380 }}>
        <form
          onSubmit={e => { e.preventDefault(); handleLogin(); }}
          style={{
            background: "rgba(8,12,22,.65)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 16,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Logo + title */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <img
              src="/estenove-mark.png"
              alt="Estenove"
              style={{ width: 44, height: 44, filter: "brightness(0) invert(1)" }}
            />
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 400,
                  fontSize: 22,
                  color: "#ffffff",
                  letterSpacing: "-0.01em",
                }}
              >
                Estenove
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.4)",
                  marginTop: 4,
                }}
              >
                Quality Assurance Platform
              </div>
            </div>
          </div>

          {/* Email field */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.4)",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="ad@estenove.com"
              style={{
                background: "rgba(255,255,255,.04)",
                border: `1px solid ${emailFocus ? "#3b82f6" : "rgba(255,255,255,.14)"}`,
                borderRadius: 9,
                padding: "11px 14px",
                color: "white",
                fontSize: 13,
                outline: "none",
                transition: "border-color 150ms",
                fontFamily: "'Inter', ui-sans-serif, sans-serif",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password field */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.4)",
              }}
            >
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPasswordFocus(true)}
              onBlur={() => setPasswordFocus(false)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              style={{
                background: "rgba(255,255,255,.04)",
                border: `1px solid ${passwordFocus ? "#3b82f6" : "rgba(255,255,255,.14)"}`,
                borderRadius: 9,
                padding: "11px 14px",
                color: "white",
                fontSize: 13,
                outline: "none",
                transition: "border-color 150ms",
                fontFamily: "'Inter', ui-sans-serif, sans-serif",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,.08)",
                border: "1px solid rgba(239,68,68,.25)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#f87171",
                fontSize: 12,
                fontFamily: "'Inter', ui-sans-serif, sans-serif",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              background: isLoading ? "rgba(255,255,255,.08)" : "#3b82f6",
              color: isLoading ? "rgba(255,255,255,.4)" : "white",
              borderRadius: 9,
              padding: "12px 16px",
              fontWeight: 500,
              fontSize: 13.5,
              border: "none",
              cursor: isLoading ? "default" : "pointer",
              fontFamily: "'Inter', ui-sans-serif, sans-serif",
              transition: "background 150ms, filter 150ms",
              letterSpacing: "-0.005em",
            }}
          >
            {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
