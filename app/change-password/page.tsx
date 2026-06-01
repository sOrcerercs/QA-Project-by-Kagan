"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => {
        if (!data.user) { router.push("/login"); return; }
        if (!data.user.mustChangePassword) { router.push("/"); return; }
        setChecking(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Bir hata oluştu."); return; }
      router.push("/");
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#08090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,.1)", borderTopColor: "var(--accent, #3b82f6)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#08090b", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Şifrenizi Değiştirin</h1>
          <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13 }}>Devam etmek için yeni bir şifre belirleyin.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>Yeni Şifre</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>Şifre Tekrar</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" }}
            />
          </div>

          {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            style={{ background: "#3b82f6", border: "none", borderRadius: 10, padding: "11px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1, transition: "opacity 0.15s" }}
          >
            {isLoading ? "Kaydediliyor..." : "Şifremi Değiştir"}
          </button>
        </form>
      </div>
    </div>
  );
}
