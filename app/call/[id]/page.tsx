"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, User, Clock, ChevronRight, Copy, Check, Phone } from "lucide-react";

const CALL_TYPE_OPTIONS = [
  { value: "AUTO", label: "Otomatik Algıla" },
  { value: "FIRST_CALL", label: "First Call" },
  { value: "SECOND_CALL", label: "Second Call" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "GENERAL", label: "Genel" },
];

export default function CallAnalysisPage() {
  const [transcript, setTranscript] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [callType, setCallType] = useState("AUTO");
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [detectedCallType, setDetectedCallType] = useState("");
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    setCurrentUser(meData.user);

    // Danışman listesini çek
    const usersRes = await fetch("/api/users");
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      setAgents(usersData.users || []);
    }
  };

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = agents.find((a: any) => a.id === agentId);
    if (agent) setAgentName(agent.name);
  };

  const handleAnalyze = async () => {
    if (!transcript.trim() || transcript.trim().length < 50) {
      setError("Lütfen geçerli bir transkript girin.");
      return;
    }
    if (!agentName.trim()) {
      setError("Lütfen değerlendirilecek danışmanı seçin.");
      return;
    }

    setIsLoading(true);
    setError("");
    setReport("");
    setDetectedCallType("");

    const formData = new FormData();
    formData.append("transcript", transcript);
    formData.append("agentName", agentName);
    formData.append("customerName", customerName || "Belirtilmedi");
    formData.append("callDuration", callDuration || "Belirtilmedi");
    formData.append("callType", callType);

    try {
      // Elle tetiklenen tek analiz — düşünme açık (bkz. analyze route).
      formData.append("deepAnalysis", "true");
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analiz sırasında hata oluştu.");
      }

      setReport(data.report);
      setDetectedCallType(data.callType);

      // Raporu veritabanına kaydet — agentId olarak değerlendirilen danışmanın ID'si
      if (data.report) {
        const evalAgentId = selectedAgentId || currentUser?.id;
        await fetch("/api/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: evalAgentId,
            customerName: customerName || "Belirtilmedi",
            callDuration: callDuration || "Belirtilmedi",
            transcript: transcript,
            report: data.report,
            score: data.score || 0,
            callType: data.callType,
            promptId: data.promptId,
            sectionScores: data.sectionScores ?? null,
            weakCriteria: data.weakCriteria ?? null,
            reportData: data.reportData ?? null,
            deepAnalysis: data.deepAnalysis === true,
          }),
        });
      }
    } catch (err: any) {
      setError("Analiz başarısız: " + (err.message || "Bilinmeyen hata"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatReport = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Any line starting with an emoji is a section heading. Matching all
      // pictographs (not a fixed list) keeps every heading on the same style
      // even as the prompt's heading emoji set changes.
      if (/^\p{Extended_Pictographic}/u.test(line)) {
        return (
          <div key={i} className="mt-6 mb-2 text-blue-400 font-bold text-base border-b border-zinc-800 pb-2">
            {line}
          </div>
        );
      }
      if (
        line.startsWith("Temsilci:") || line.startsWith("Müşteri:") ||
        line.startsWith("Görüşme") || line.startsWith("Genel Skor:")
      ) {
        return (
          <div key={i} className="text-zinc-300 text-sm font-medium py-0.5">
            {line}
          </div>
        );
      }
      if (line.startsWith("•")) {
        return (
          <div key={i} className="text-zinc-300 text-sm py-1 pl-2">
            {line}
          </div>
        );
      }
      if (line.startsWith("  Kanıt:")) {
        return (
          <div key={i} className="text-emerald-400 text-xs py-0.5 pl-6 font-mono">
            {line}
          </div>
        );
      }
      if (line.startsWith("  Olması Gereken:")) {
        return (
          <div key={i} className="text-amber-400 text-xs py-0.5 pl-6">
            {line}
          </div>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-1" />;
      return (
        <div key={i} className="text-zinc-400 text-sm py-0.5">
          {line}
        </div>
      );
    });
  };

  return (
    <div className="bg-black text-white min-h-screen font-sans pb-20">
      <header className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Estenove QA — Çağrı Analizi</h1>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Form Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <User className="w-3 h-3" /> Değerlendirilen Danışman *
            </label>
            {agents.length > 0 ? (
              <select
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Danışman seçin</option>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="ör. Mehmet Akgül"
                className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
              />
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <User className="w-3 h-3" /> Müşteri Adı
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ör. John Smith"
              className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <Clock className="w-3 h-3" /> Görüşme Süresi
            </label>
            <input
              type="text"
              value={callDuration}
              onChange={(e) => setCallDuration(e.target.value)}
              placeholder="ör. 18:42"
              className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <Phone className="w-3 h-3" /> Çağrı Tipi
            </label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
            >
              {CALL_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Transkript Alanı */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">
          <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-3">
            <FileText className="w-3 h-3" /> Görüşme Transkripti *
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`Transkripti buraya yapıştırın. Örnek format:\n\n[00:00] SDR: Merhaba, ben Estenove'dan Mehmet...\n[00:05] Müşteri: Merhaba Mehmet Bey...`}
            rows={12}
            className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors resize-none font-mono leading-relaxed"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-[11px] text-zinc-600">
              {transcript.length > 0 ? `${transcript.length} karakter` : ""}
            </p>
            <p className="text-[11px] text-zinc-600">
              {callType === "AUTO" ? "Çağrı tipi otomatik algılanacak" : CALL_TYPE_OPTIONS.find(o => o.value === callType)?.label}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isLoading || !transcript.trim() || !agentName.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Analiz Ediliyor...
            </>
          ) : (
            <>
              Analizi Başlat <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Rapor Çıktısı */}
        {report && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Değerlendirme Raporu</h2>
                {detectedCallType && (
                  <span className="text-xs text-zinc-500">
                    Algılanan tip: {CALL_TYPE_OPTIONS.find(o => o.value === detectedCallType)?.label || detectedCallType}
                  </span>
                )}
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm transition-all border border-zinc-700"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Kopyalandı!" : "Kopyala"}
              </button>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 leading-relaxed">
              {formatReport(report)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
