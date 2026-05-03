"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const roleLabel = (role: string) =>
  ({ AGENT: "Danışman", TEAM_LEADER: "Takım Lideri", MANAGER: "Müdür", ADMIN: "Admin" }[role] || role);

const roleColor = (role: string) =>
  ({
    AGENT: "text-primary bg-primary/10 border-primary/20",
    TEAM_LEADER: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    MANAGER: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    ADMIN: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  }[role] || "text-on-surface-variant bg-surface-container border-outline-variant");

const feedbackCategoryLabel = (cat: string) =>
  ({
    evaluation: "Değerlendirme",
    ui: "Arayüz",
    report: "Raporlar",
    scoring: "Puanlama",
    other: "Diğer",
  }[cat] || cat);

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as "users" | "prompts" | "logs" | "feedbacks") || "users";
  const [activeTab, setActiveTab] = useState<"users" | "prompts" | "logs" | "feedbacks">(initialTab);

  // Auth / theme / lang
  const [user, setUser] = useState<any>(null);

  // Users tab state
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("AGENT");
  const [newLeaderId, setNewLeaderId] = useState("");
  const [addUserMsg, setAddUserMsg] = useState("");

  // Edit user state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editMsg, setEditMsg] = useState("");
  const [editStatus, setEditStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Prompts tab state
  const [prompts, setPrompts] = useState<any[]>([]);
  const [promptName, setPromptName] = useState("");
  const [promptCallType, setPromptCallType] = useState("SECOND_CALL");
  const [promptVersion, setPromptVersion] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [promptMsg, setPromptMsg] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  // Logs tab state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Feedbacks tab state
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem("estenove-theme");
    const dark = savedTheme !== "light";
    document.documentElement.classList.toggle("light", !dark);

    // Auth check
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { router.replace("/login"); return; }
        if (!["ADMIN", "MANAGER"].includes(d.user.role)) { router.replace("/"); return; }
        setUser(d.user);
        fetchUsers();
        fetchPrompts();
        fetchTeams();
        if (initialTab === "logs") fetchLogs();
        if (initialTab === "feedbacks") fetchFeedbacks();
      });
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users || []);
  };

  const fetchTeams = async () => {
    const res = await fetch("/api/teams");
    const data = await res.json();
    setTeams(data.teams || []);
  };

  const fetchPrompts = async () => {
    const res = await fetch("/api/prompts");
    const data = await res.json();
    setPrompts(data.prompts || []);
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    const res = await fetch("/api/admin/logs");
    const data = await res.json();
    setLogs(data.logs || []);
    setLogsLoading(false);
  };

  const fetchFeedbacks = async () => {
    setFeedbacksLoading(true);
    const res = await fetch("/api/feedback");
    const data = await res.json();
    setFeedbacks(data.feedbacks || []);
    setFeedbacksLoading(false);
  };

  const handleAddUser = async () => {
    if (!newName || !newEmail || !newPassword) {
      setAddUserMsg("Tüm alanları doldurun.");
      return;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole, leaderId: newLeaderId || null }),
    });
    const data = await res.json();
    if (!res.ok) { setAddUserMsg(data.error || "Hata oluştu."); return; }
    setAddUserMsg("Kullanıcı oluşturuldu!");
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("AGENT"); setNewLeaderId("");
    fetchUsers();
  };

  const handleUserRowClick = (u: any) => {
    if (editingUser?.id === u.id) {
      // collapse if same user clicked again
      setEditingUser(null);
      setEditMsg("");
      setEditStatus("idle");
      return;
    }
    setEditingUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role || "AGENT");
    setEditTeamId(u.teamId || u.team?.id || "");
    setEditNewPassword("");
    setEditMsg("");
    setEditStatus("idle");
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setEditStatus("saving");
    setEditMsg("");
    const body: any = {
      name: editName,
      email: editEmail,
      role: editRole,
      teamId: editTeamId || null,
    };
    if (editNewPassword) body.newPassword = editNewPassword;
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setEditStatus("error");
      setEditMsg(data.error || "Güncelleme başarısız.");
      return;
    }
    setEditStatus("success");
    setEditMsg("Kullanıcı güncellendi!");
    setEditNewPassword("");
    await fetchUsers();
    // Re-sync editingUser from fresh list
    const refreshRes = await fetch("/api/users");
    const refreshData = await refreshRes.json();
    const updated = (refreshData.users || []).find((u: any) => u.id === editingUser.id);
    if (updated) setEditingUser(updated);
  };

  const handleSavePrompt = async () => {
    if (!promptName || !promptCallType || !promptContent || !promptVersion) {
      setPromptMsg("Tüm alanları doldurun.");
      return;
    }
    if (editingPromptId) {
      const res = await fetch(`/api/prompts/${editingPromptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: promptName, content: promptContent, version: promptVersion, isActive: true }),
      });
      if (!res.ok) { setPromptMsg("Güncelleme başarısız."); return; }
      setPromptMsg("Prompt güncellendi!");
    } else {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: promptName, callType: promptCallType, content: promptContent, version: promptVersion }),
      });
      if (!res.ok) { setPromptMsg("Oluşturma başarısız."); return; }
      setPromptMsg("Prompt oluşturuldu!");
    }
    setPromptName(""); setPromptCallType("SECOND_CALL"); setPromptVersion(""); setPromptContent(""); setEditingPromptId(null);
    fetchPrompts();
  };

  const handleEditPrompt = (p: any) => {
    setPromptName(p.name);
    setPromptCallType(p.callType);
    setPromptVersion(p.version);
    setPromptContent(p.content);
    setEditingPromptId(p.id);
    setPromptMsg("");
  };

  const handleTogglePrompt = async (p: any) => {
    await fetch(`/api/prompts/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchPrompts();
  };

  const handleMarkFeedbackRead = async (id: string) => {
    await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, isRead: true } : f)));
  };

  const unreadCount = feedbacks.filter((f) => !f.isRead).length;

  const handleTabChange = (tab: "users" | "prompts" | "logs" | "feedbacks") => {
    setActiveTab(tab);
    setAddUserMsg("");
    setPromptMsg("");
    if (tab === "logs") fetchLogs();
    if (tab === "feedbacks") fetchFeedbacks();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-outline border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-container-low border-b border-outline-variant px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight">Admin Ayarları</h1>
            <p className="text-xs text-on-surface-variant">{user.name} · {roleLabel(user.role)}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-2">
          {(["users", "prompts", "logs", "feedbacks"] as const).map((tab) => {
            const tabMeta = {
              users: { icon: "group", label: "Kullanıcılar" },
              prompts: { icon: "edit_note", label: "Promptlar" },
              logs: { icon: "history", label: "Aktivite Logları" },
              feedbacks: { icon: "inbox", label: "Geri Bildirimler" },
            }[tab];
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab
                    ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <MIcon name={tabMeta.icon} className="text-base" />
                {tabMeta.label}
                {tab === "feedbacks" && unreadCount > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-error text-on-error text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── USERS TAB ── */}
        {activeTab === "users" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Add user form */}
            <div className="bg-surface-container rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Yeni Kullanıcı Ekle</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">Ad Soyad</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setAddUserMsg(""); }}
                    placeholder="Ad Soyad"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">E-posta</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setAddUserMsg(""); }}
                    placeholder="ornek@estenove.com"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">Şifre</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setAddUserMsg(""); }}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">Rol</label>
                  <select
                    value={newRole}
                    onChange={(e) => { setNewRole(e.target.value); if (e.target.value !== "AGENT") setNewLeaderId(""); }}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="AGENT">Danışman</option>
                    <option value="TEAM_LEADER">Takım Lideri</option>
                    <option value="MANAGER">Müdür</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                {newRole === "AGENT" && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-on-surface-variant font-semibold block mb-1">Takım (opsiyonel)</label>
                    <select
                      value={newLeaderId}
                      onChange={(e) => setNewLeaderId(e.target.value)}
                      className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    >
                      <option value="">— Takım lideri seçin —</option>
                      {users.filter((u) => u.role === "TEAM_LEADER").map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleAddUser}
                  className="bg-primary hover:opacity-90 text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm transition-all"
                >
                  Kullanıcı Ekle
                </button>
                {addUserMsg && (
                  <p className={`text-sm ${addUserMsg.includes("oluşturuldu") ? "text-emerald-400" : "text-error"}`}>
                    {addUserMsg}
                  </p>
                )}
              </div>
            </div>

            {/* User list */}
            <div className="bg-surface-container rounded-3xl p-4 space-y-1">
              {users.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">Henüz kullanıcı yok.</p>
              ) : (
                users.map((u, i) => (
                  <div key={u.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleUserRowClick(u)}
                      className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-colors ${
                        editingUser?.id === u.id
                          ? "bg-surface-container-high"
                          : "hover:bg-surface-container-high"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary text-sm font-bold select-none">
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{u.name}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}{u.team ? ` · ${u.team.name}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${roleColor(u.role)}`}>
                          {roleLabel(u.role)}
                        </span>
                        <MIcon
                          name={editingUser?.id === u.id ? "expand_less" : "expand_more"}
                          className="text-base text-on-surface-variant"
                        />
                      </div>
                    </motion.div>

                    {/* Inline edit panel */}
                    {editingUser?.id === u.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-2 mb-2 bg-surface-container-lowest rounded-2xl p-5 space-y-4 border border-outline-variant"
                      >
                        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Kullanıcıyı Düzenle</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">Ad Soyad</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => { setEditName(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                              className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">E-posta</label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => { setEditEmail(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                              className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">Rol</label>
                            <select
                              value={editRole}
                              onChange={(e) => { setEditRole(e.target.value); if (e.target.value !== "AGENT") setEditTeamId(""); setEditMsg(""); setEditStatus("idle"); }}
                              className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            >
                              <option value="AGENT">Danışman</option>
                              <option value="TEAM_LEADER">Takım Lideri</option>
                              <option value="MANAGER">Müdür</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                          </div>
                          {editRole === "AGENT" && (
                            <div>
                              <label className="text-xs text-on-surface-variant font-semibold block mb-1">Takım (opsiyonel)</label>
                              <select
                                value={editTeamId}
                                onChange={(e) => { setEditTeamId(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                                className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                              >
                                <option value="">— Takım lideri seçin —</option>
                                {teams.filter((t) => t.leader).map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.leader.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className={editRole === "AGENT" ? "" : "md:col-span-2"}>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">Yeni Şifre (opsiyonel)</label>
                            <input
                              type="password"
                              value={editNewPassword}
                              onChange={(e) => { setEditNewPassword(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                              placeholder="Değiştirmek için girin"
                              className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={handleSaveUser}
                            disabled={editStatus === "saving"}
                            className="bg-primary hover:opacity-90 disabled:opacity-60 text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2"
                          >
                            {editStatus === "saving" && (
                              <span className="w-3.5 h-3.5 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                            )}
                            Kaydet
                          </button>
                          <button
                            onClick={() => { setEditingUser(null); setEditMsg(""); setEditStatus("idle"); }}
                            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                          >
                            İptal
                          </button>
                          {editMsg && (
                            <p className={`text-sm ${editStatus === "success" ? "text-emerald-400" : "text-error"}`}>
                              {editMsg}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── PROMPTS TAB ── */}
        {activeTab === "prompts" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Prompt form */}
            <div className="bg-surface-container rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                {editingPromptId ? "Prompt Düzenle" : "Yeni Prompt Ekle"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">Prompt Adı</label>
                  <input
                    type="text"
                    value={promptName}
                    onChange={(e) => { setPromptName(e.target.value); setPromptMsg(""); }}
                    placeholder="Prompt Adı"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">Çağrı Tipi</label>
                  <select
                    value={promptCallType}
                    onChange={(e) => setPromptCallType(e.target.value)}
                    disabled={!!editingPromptId}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
                  >
                    <option value="FIRST_CALL">First Call</option>
                    <option value="SECOND_CALL">Second Call</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="GENERAL">Genel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">Versiyon</label>
                  <input
                    type="text"
                    value={promptVersion}
                    onChange={(e) => { setPromptVersion(e.target.value); setPromptMsg(""); }}
                    placeholder="örn. 10.29"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant font-semibold block mb-1">İçerik</label>
                <textarea
                  value={promptContent}
                  onChange={(e) => { setPromptContent(e.target.value); setPromptMsg(""); }}
                  placeholder="Prompt içeriğini buraya yazın..."
                  rows={10}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none font-mono"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSavePrompt}
                  className="bg-primary hover:opacity-90 text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm transition-all"
                >
                  {editingPromptId ? "Güncelle" : "Oluştur"}
                </button>
                {editingPromptId && (
                  <button
                    onClick={() => {
                      setEditingPromptId(null);
                      setPromptName(""); setPromptCallType("SECOND_CALL");
                      setPromptVersion(""); setPromptContent(""); setPromptMsg("");
                    }}
                    className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    İptal
                  </button>
                )}
                {promptMsg && (
                  <p className={`text-sm ${promptMsg.includes("başarısız") || promptMsg.includes("doldurun") ? "text-error" : "text-emerald-400"}`}>
                    {promptMsg}
                  </p>
                )}
              </div>
            </div>

            {/* Prompt list */}
            <div className="bg-surface-container rounded-3xl p-4 space-y-1">
              {prompts.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">Henüz prompt eklenmemiş.</p>
              ) : (
                prompts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-surface-container-high transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
                        <MIcon name="edit_note" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{p.name}</p>
                        <p className="text-xs text-on-surface-variant">v{p.version} · {p.content?.length ?? 0} karakter · {p.callType?.replace("_", " ")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleTogglePrompt(p)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                          p.isActive
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-outline-variant bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        {p.isActive ? "Aktif" : "Pasif"}
                      </button>
                      <button
                        onClick={() => handleEditPrompt(p)}
                        className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        Düzenle
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── LOGS TAB ── */}
        {activeTab === "logs" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-surface-container rounded-3xl p-4 space-y-1">
              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-outline border-t-primary rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">Henüz aktivite logu yok.</p>
              ) : (
                logs.map((log, i) => (
                  <motion.div
                    key={log.id ?? i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-surface-container-high transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                        <MIcon name="person" className="text-base" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{log.user?.name ?? log.userName ?? "—"}</p>
                        <p className="text-xs text-on-surface-variant">{formatDateTime(log.createdAt ?? log.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${roleColor(log.user?.role ?? log.role ?? "")}`}>
                        {roleLabel(log.user?.role ?? log.role ?? "")}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                          log.action === "LOGIN"
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── FEEDBACKS TAB ── */}
        {activeTab === "feedbacks" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-surface-container rounded-3xl p-4 space-y-1">
              {feedbacksLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-outline border-t-primary rounded-full animate-spin" />
                </div>
              ) : feedbacks.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">Henüz geri bildirim yok.</p>
              ) : (
                feedbacks.map((fb, i) => (
                  <motion.div
                    key={fb.id ?? i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => {
                      setExpandedFeedbackId(expandedFeedbackId === fb.id ? null : fb.id);
                      if (!fb.isRead) handleMarkFeedbackRead(fb.id);
                    }}
                    className={`p-4 rounded-2xl transition-colors cursor-pointer ${
                      !fb.isRead
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-surface-container-high"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high flex-shrink-0 flex items-center justify-center text-on-surface-variant">
                          <MIcon name="chat_bubble" className="text-base" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-on-surface">
                              {fb.user?.name ?? fb.userName ?? "—"}
                            </p>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${roleColor(fb.user?.role ?? fb.role ?? "")}`}>
                              {roleLabel(fb.user?.role ?? fb.role ?? "")}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-outline-variant bg-surface-container text-on-surface-variant">
                              {feedbackCategoryLabel(fb.category)}
                            </span>
                            {!fb.isRead && (
                              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className={`text-sm text-on-surface mt-2 leading-relaxed ${expandedFeedbackId === fb.id ? "" : "line-clamp-2 text-xs text-on-surface-variant"}`}>
                            {fb.comment ?? fb.message ?? ""}
                          </p>
                          {expandedFeedbackId !== fb.id && (
                            <p className="text-[10px] text-primary mt-1">Devamını görmek için tıklayın</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-xs text-on-surface-variant">
                          {formatDateTime(fb.createdAt ?? fb.timestamp)}
                        </p>
                        <MIcon
                          name={expandedFeedbackId === fb.id ? "expand_less" : "expand_more"}
                          className="text-base text-on-surface-variant"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
