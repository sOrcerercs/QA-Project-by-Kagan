"use client";

import { useState, useEffect, useRef } from "react";
import styles from "@/app/components/LandingPage.module.css";

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 1.5,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "users": return <svg {...p}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/></svg>;
    case "spark": return <svg {...p}><path d="M5 12l4-2 2-4 2 4 4 2-4 2-2 4-2-4z"/></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case "history": return <svg {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.97"/></svg>;
    case "inbox": return <svg {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>;
    case "phone": return <svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>;
    case "mic": return <svg {...p}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>;
    case "cloud": return <svg {...p}><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"/></svg>;
    case "refresh": return <svg {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>;
    case "check": return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case "chevron": return <svg {...p}><path d="M9 18l6-6-6-6"/></svg>;
    case "chevronDown": return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    default: return null;
  }
}

const formatDateTime = (iso: string, locale = "tr-TR") => {
  const d = new Date(iso);
  return d.toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const SECTION_LABELS: Record<"tr" | "en", Record<string, string>> = {
  tr: {
    home: "Ana Sayfa", evaluations: "Değerlendirmeler", scores: "Skorlarım",
    reports: "Raporlarım", teamreports: "Raporlar", team: "Takımım",
    feedback: "Geri Bildirim", status: "Çağrı Durumu", batch: "Toplu Analiz",
    admin: "Ayarlar", peer: "Nasıl Gidiyorum?", feedbacks: "Geri Bildirimler",
    sync: "Senkronizasyon",
  },
  en: {
    home: "Home", evaluations: "Evaluations", scores: "My Scores",
    reports: "My Reports", teamreports: "Reports", team: "My Team",
    feedback: "Feedback", status: "Calls Status", batch: "Bulk Analysis",
    admin: "Settings", peer: "How Am I Doing?", feedbacks: "Feedbacks",
    sync: "Synchronization",
  },
};

const ACTION_LABELS: Record<"tr" | "en", Record<string, string>> = {
  tr: { LOGIN: "Giriş Yapıldı", LOGOUT: "Çıkış Yapıldı", PAGE_VIEW: "Sayfa Görüntülendi" },
  en: { LOGIN: "Logged In", LOGOUT: "Logged Out", PAGE_VIEW: "Page Viewed" },
};

const PANEL_T = {
  tr: {
    pageTitle: "Ayarlar",
    pageSubtitle: "Sistem yönetimi",
    tabs: {
      users: "Kullanıcılar", prompts: "Promptlar", logs: "Aktivite",
      feedbacks: "Geri Bildirimler", sync: "Senkronizasyon", syncHistory: "Senkron Geçmişi",
      recentCalls: "Son Çağrılar",
    },
    roles: { AGENT: "Danışman", TEAM_LEADER: "Takım Lideri", MANAGER: "Müdür", ADMIN: "Admin" } as Record<string, string>,
    newUser: "Yeni Kullanıcı",
    labelName: "Ad Soyad", labelEmail: "E-posta", labelPassword: "Şifre",
    labelRole: "Rol", labelTeamOptional: "Takım (opsiyonel)", selectTeamLeader: "— Takım lideri seçin —",
    labelManager: "Manager (opsiyonel)", selectManager: "— Manager seçin —", noManager: "Atama yok",
    adding: "Ekleniyor...", addUser: "Kullanıcı Ekle", userCreated: "Kullanıcı oluşturuldu.",
    usersHeading: "Kullanıcılar", usersCount: (n: number) => `${n} kullanıcı`,
    noUsers: "Kullanıcı bulunamadı.", editUserHeading: "Kullanıcıyı Düzenle",
    labelTeam: "Takım", selectTeam: "— Takım seçin —",
    labelNewPassword: "Yeni Şifre (opsiyonel)", passwordPlaceholder: "Değiştirmek için girin",
    saving: "Kaydediliyor...", save: "Kaydet", cancel: "İptal",
    deleteUser: "Kullanıcıyı Sil", deleteConfirmTitle: "Kullanıcıyı pasife al",
    deleteConfirmMsg: (name: string) => `"${name}" adlı kullanıcı devre dışı bırakılacak. Giriş yapamayacak ama geçmiş verileri korunacak. Devam edilsin mi?`,
    deleteConfirmBtn: "Evet, Pasife Al", deleting: "Siliniyor...", deleteSuccess: "Kullanıcı pasife alındı.",
    updateError: "Güncelleme başarısız.", updateSuccess: "Kullanıcı güncellendi!", errorOccurred: "Hata oluştu.",
    newPrompt: "Yeni Prompt", labelPromptName: "Prompt Adı", labelCallType: "Çağrı Tipi",
    callTypeGeneral: "Genel", labelVersion: "Versiyon", labelContent: "İçerik",
    promptContentPlaceholder: "Prompt içeriğini buraya yazın...",
    addingPrompt: "Ekleniyor...", addPrompt: "Prompt Ekle", promptCreated: "Prompt oluşturuldu.",
    promptsHeading: "Promptlar", promptsCount: (n: number) => `${n} prompt`,
    noPrompts: "Prompt bulunamadı.", chars: (n: number) => `${n} karakter`,
    active: "Aktif", inactive: "Pasif",
    viewContent: "İçeriği Göster", hideContent: "Gizle",
    editPrompt: "Düzenle", promptUpdated: "Prompt güncellendi.", promptUpdateFailed: "Güncelleme başarısız.",
    savingPrompt: "Kaydediliyor...", savePrompt: "Kaydet",
    activityLogs: "Aktivite Logları", refresh: "Yenile", loading: "Yükleniyor...",
    noLogs: "Henüz aktivite logu yok.",
    feedbacksHeading: "Geri Bildirimler", noFeedbacks: "Henüz geri bildirim yok.",
    krikoNotConfigured: "Kriko API yapılandırılmamış",
    krikoActive: "Kriko API aktif — Otomatik senkron her 6 saatte bir çalışır",
    krikoNotConfiguredHint: "Lütfen .env.local içine KRIKO_API_KEY ve KRIKO_API_BASE ekleyin.",
    krikoFilter: "Filtre: süre ≥ 2 dk.",
    manualSync: "Manuel Senkronizasyon", labelDate: "Tarih (boş = dün)",
    syncing: "Senkronize Ediliyor...", syncNow: "Şimdi Senkronize Et",
    syncStarted: "Senkronizasyon başlatıldı, lütfen bekleyin (1-3 dakika sürebilir)...",
    ffSyncStarted: "Senkronizasyon başlatıldı, lütfen bekleyin...",
    syncError: "Hata: ", syncFailed: "Senkronizasyon başarısız.",
    syncDone: (imp: number, una: number, ski: number) => `✅ Tamamlandı: ${imp} import, ${una} atanmamış, ${ski} atlandı.`,
    syncFailed2: (n: number) => ` ❌ ${n} başarısız.`,
    syncErrors: "Hatalar: ",
    krikoUnassigned: "Kriko — Atanmamış Çağrılar", ffUnassigned: "Fireflies — Atanmamış Çağrılar",
    selectAgent: "— Danışman seç —", assign: "Ata", transcript: "Transkript",
    ffNotConfigured: "Fireflies API yapılandırılmamış",
    ffActive: (n: number) => n > 0 ? `Fireflies API aktif — Otomatik senkron her 4 saatte bir çalışır · ${n} atanmamış çağrı` : "Fireflies API aktif — Otomatik senkron her 4 saatte bir çalışır",
    ffNotConfiguredHint: "Lütfen .env.local içine FIREFLIES_API_KEY ekleyin.",
    ffFilter: "Filtre: süre ≥ 2 dk, en az 50 karakter transkript.",
    statFetched: "Çekilen", statAnalyzable: "Analiz", statImport: "Import",
    statUnassigned: "Atanmamış", statFailed: "Başarısız",
    allSyncLogs: "Tüm Senkronizasyon Kayıtları", noSyncLogs: "Henüz senkron yapılmamış.",
    syncStatusSuccess: "Başarılı", syncStatusEmpty: "Sonuç Yok", syncStatusPartial: "Kısmi Hata",
    syncStatusError: "Hata", syncStatusInterrupted: "Yarım Kaldı",
    syncStatusInterruptedDesc: "Sunucu yeniden başlatıldı veya istek zaman aşımına uğradı. Bu senkronizasyon tamamlanamadı.",
    syncStatusEmptyDesc: "API bağlantısı başarılı fakat bu tarihte uygun çağrı bulunamadı.",
    syncErrDetail: "Hata Detayı",
    recentCallsHeading: "Son Çekilen Çağrılar",
    recentCallsSubtitle: (n: number) => `Son ${n} kayıt`,
    recentCallsTotal: (n: number) => `Toplam ${n} kayıt`,
    recentCallsDupOk: "Mükerrer yok",
    recentCallsDupWarn: (n: number) => `${n} mükerrer tespit edildi`,
    recentCallsEmpty: "Henüz çağrı çekilmemiş.",
    recentCallsImportedAt: "Eklenme",
    recentCallsUnassigned: "Atanmamış",
    locale: "tr-TR",
    tabReclassify: "Şüpheli Sınıflandırmalar",
    reclassifyScanDesc: "Transkriptlerde anahtar kelimeler aranır. Gemini kullanılmaz, API maliyeti yoktur.",
    reclassifyScan: "Tara",
    reclassifyScanning: "Taranıyor...",
    reclassifyNoSuspicious: "Şüpheli sınıflandırma bulunamadı.",
    reclassifyFix: "Düzelt",
    reclassifyDone: "Done",
    reclassifyGoTo: "Değerlendirmeye git",
    reclassifyFixAll: (n: number) => `Tümünü Düzelt (${n} değerlendirme)`,
    reclassifyProgress: (done: number, total: number) => `${done} / ${total} tamamlandı`,
    reclassifyHeader: ["Danışman", "Müşteri", "Mevcut", "Öneri", "Aksiyon"] as string[],
    reclassifyScanResult: (total: number, count: number) => `${total} değerlendirme tarandı, ${count} şüpheli bulundu.`,
  },
  en: {
    pageTitle: "Settings",
    pageSubtitle: "System management",
    tabs: {
      users: "Users", prompts: "Prompts", logs: "Activity",
      feedbacks: "Feedback", sync: "Sync", syncHistory: "Sync History",
      recentCalls: "Recent Calls",
    },
    roles: { AGENT: "Agent", TEAM_LEADER: "Team Leader", MANAGER: "Manager", ADMIN: "Admin" } as Record<string, string>,
    newUser: "New User",
    labelName: "Full Name", labelEmail: "Email", labelPassword: "Password",
    labelRole: "Role", labelTeamOptional: "Team (optional)", selectTeamLeader: "— Select team leader —",
    labelManager: "Manager (optional)", selectManager: "— Select manager —", noManager: "No assignment",
    adding: "Adding...", addUser: "Add User", userCreated: "User created.",
    usersHeading: "Users", usersCount: (n: number) => `${n} user${n !== 1 ? "s" : ""}`,
    noUsers: "No users found.", editUserHeading: "Edit User",
    labelTeam: "Team", selectTeam: "— Select team —",
    labelNewPassword: "New Password (optional)", passwordPlaceholder: "Enter to change",
    saving: "Saving...", save: "Save", cancel: "Cancel",
    deleteUser: "Delete User", deleteConfirmTitle: "Deactivate user",
    deleteConfirmMsg: (name: string) => `"${name}" will be deactivated. They won't be able to log in, but their historical data will be preserved. Continue?`,
    deleteConfirmBtn: "Yes, Deactivate", deleting: "Deleting...", deleteSuccess: "User deactivated.",
    updateError: "Update failed.", updateSuccess: "User updated!", errorOccurred: "An error occurred.",
    newPrompt: "New Prompt", labelPromptName: "Prompt Name", labelCallType: "Call Type",
    callTypeGeneral: "General", labelVersion: "Version", labelContent: "Content",
    promptContentPlaceholder: "Enter prompt content here...",
    addingPrompt: "Adding...", addPrompt: "Add Prompt", promptCreated: "Prompt created.",
    promptsHeading: "Prompts", promptsCount: (n: number) => `${n} prompt${n !== 1 ? "s" : ""}`,
    noPrompts: "No prompts found.", chars: (n: number) => `${n} chars`,
    active: "Active", inactive: "Inactive",
    viewContent: "View Content", hideContent: "Hide",
    editPrompt: "Edit", promptUpdated: "Prompt updated.", promptUpdateFailed: "Update failed.",
    savingPrompt: "Saving...", savePrompt: "Save",
    activityLogs: "Activity Logs", refresh: "Refresh", loading: "Loading...",
    noLogs: "No activity logs yet.",
    feedbacksHeading: "Feedback", noFeedbacks: "No feedback yet.",
    krikoNotConfigured: "Kriko API not configured",
    krikoActive: "Kriko API active — Auto sync runs every 6 hours",
    krikoNotConfiguredHint: "Please add KRIKO_API_KEY and KRIKO_API_BASE to .env.local.",
    krikoFilter: "Filter: duration ≥ 2 min.",
    manualSync: "Manual Sync", labelDate: "Date (empty = yesterday)",
    syncing: "Syncing...", syncNow: "Sync Now",
    syncStarted: "Sync started, please wait (may take 1–3 minutes)...",
    ffSyncStarted: "Sync started, please wait...",
    syncError: "Error: ", syncFailed: "Sync failed.",
    syncDone: (imp: number, una: number, ski: number) => `✅ Done: ${imp} imported, ${una} unassigned, ${ski} skipped.`,
    syncFailed2: (n: number) => ` ❌ ${n} failed.`,
    syncErrors: "Errors: ",
    krikoUnassigned: "Kriko — Unassigned Calls", ffUnassigned: "Fireflies — Unassigned Calls",
    selectAgent: "— Select agent —", assign: "Assign", transcript: "Transcript",
    ffNotConfigured: "Fireflies API not configured",
    ffActive: (n: number) => n > 0 ? `Fireflies API active — Auto sync runs every 4 hours · ${n} unassigned call${n !== 1 ? "s" : ""}` : "Fireflies API active — Auto sync runs every 4 hours",
    ffNotConfiguredHint: "Please add FIREFLIES_API_KEY to .env.local.",
    ffFilter: "Filter: duration ≥ 2 min, transcript ≥ 50 chars.",
    statFetched: "Fetched", statAnalyzable: "Analyzed", statImport: "Imported",
    statUnassigned: "Unassigned", statFailed: "Failed",
    allSyncLogs: "All Sync Records", noSyncLogs: "No syncs performed yet.",
    syncStatusSuccess: "Success", syncStatusEmpty: "No Results", syncStatusPartial: "Partial Error",
    syncStatusError: "Error", syncStatusInterrupted: "Interrupted",
    syncStatusInterruptedDesc: "Server restarted or request timed out. This sync did not complete.",
    syncStatusEmptyDesc: "API connection successful but no eligible calls found for this date.",
    syncErrDetail: "Error Detail",
    recentCallsHeading: "Recently Imported Calls",
    recentCallsSubtitle: (n: number) => `Last ${n} records`,
    recentCallsTotal: (n: number) => `${n} total records`,
    recentCallsDupOk: "No duplicates",
    recentCallsDupWarn: (n: number) => `${n} duplicate${n !== 1 ? "s" : ""} detected`,
    recentCallsEmpty: "No calls imported yet.",
    recentCallsImportedAt: "Imported",
    recentCallsUnassigned: "Unassigned",
    locale: "en-US",
    tabReclassify: "Suspicious Classifications",
    reclassifyScanDesc: "Keywords are scanned in transcripts. No Gemini calls, no API cost.",
    reclassifyScan: "Scan",
    reclassifyScanning: "Scanning...",
    reclassifyNoSuspicious: "No suspicious classifications found.",
    reclassifyFix: "Fix",
    reclassifyDone: "Done",
    reclassifyGoTo: "Go to evaluation",
    reclassifyFixAll: (n: number) => `Fix All (${n} evaluations)`,
    reclassifyProgress: (done: number, total: number) => `${done} / ${total} completed`,
    reclassifyHeader: ["Consultant", "Customer", "Current", "Suggestion", "Action"] as string[],
    reclassifyScanResult: (total: number, count: number) => `${total} evaluations scanned, ${count} suspicious found.`,
  },
};

const roleFg: Record<string, string> = {
  ADMIN: "#fbbf24", TEAM_LEADER: "#34d399", MANAGER: "#a855f7", AGENT: "var(--accent)",
};
const roleBg: Record<string, string> = {
  ADMIN: "rgba(251,191,36,.12)", TEAM_LEADER: "rgba(52,211,153,.12)",
  MANAGER: "rgba(168,85,247,.12)", AGENT: "rgba(59,130,246,.12)",
};

type AdminTab = "users" | "prompts" | "logs" | "feedbacks" | "sync" | "syncHistory" | "recentCalls" | "reclassify";

interface Props {
  user: { id: string; name: string; role: string; email: string };
  lang: "tr" | "en";
  initialTab?: AdminTab;
}

export default function AdminPanel({ user, lang, initialTab = "users" }: Props) {
  const t = PANEL_T[lang];
  const roleLabel = (role: string) => t.roles[role] || role;
  const fmtDate = (iso: string) => formatDateTime(iso, t.locale);

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  /* ── users ── */
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("AGENT");
  const [newUserLeaderId, setNewUserLeaderId] = useState("");
  const [newUserLoading, setNewUserLoading] = useState(false);
  const [newUserMsg, setNewUserMsg] = useState("");
  const [newUserMsgOk, setNewUserMsgOk] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("AGENT");
  const [editTeamId, setEditTeamId] = useState("");
  const [newUserManagerId, setNewUserManagerId] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editUserMsg, setEditUserMsg] = useState("");
  const [editUserStatus, setEditUserStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── prompts ── */
  const [prompts, setPrompts] = useState<any[]>([]);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptVersion, setEditPromptVersion] = useState("");
  const [editPromptContent, setEditPromptContent] = useState("");
  const [editPromptLoading, setEditPromptLoading] = useState(false);
  const [editPromptMsg, setEditPromptMsg] = useState("");
  const [editPromptMsgOk, setEditPromptMsgOk] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptCallType, setNewPromptCallType] = useState("SECOND_CALL");
  const [newPromptVersion, setNewPromptVersion] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [newPromptLoading, setNewPromptLoading] = useState(false);
  const [newPromptMsg, setNewPromptMsg] = useState("");
  const [newPromptMsgOk, setNewPromptMsgOk] = useState(false);

  /* ── logs ── */
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  /* ── feedbacks ── */
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  /* ── kriko ── */
  const [krikoStatus, setKrikoStatus] = useState<any>(null);
  const [krikoSyncing, setKrikoSyncing] = useState(false);
  const [krikoSyncDate, setKrikoSyncDate] = useState("");
  const [krikoMsg, setKrikoMsg] = useState("");
  const [krikoLastResult, setKrikoLastResult] = useState<any>(null);
  const [krikoProgress, setKrikoProgress] = useState(0);
  const [krikoSecondsLeft, setKrikoSecondsLeft] = useState(0);
  const krikoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unassignedItems, setUnassignedItems] = useState<any[]>([]);
  const [reassignSelections, setReassignSelections] = useState<Record<string, string>>({});
  const [expandedUnassignedId, setExpandedUnassignedId] = useState<string | null>(null);

  /* ── fireflies ── */
  const [firefliesStatus, setFirefliesStatus] = useState<any>(null);
  const [firefliesSyncing, setFirefliesSyncing] = useState(false);
  const [firefliesSyncDate, setFirefliesSyncDate] = useState("");
  const [firefliesMsg, setFirefliesMsg] = useState("");
  const [firefliesLastResult, setFirefliesLastResult] = useState<any>(null);
  const [ffProgress, setFfProgress] = useState(0);
  const [ffSecondsLeft, setFfSecondsLeft] = useState(0);
  const ffTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── recent calls ── */
  const [recentCallsData, setRecentCallsData] = useState<any>(null);
  const [recentCallsLoading, setRecentCallsLoading] = useState(false);

  /* ── reclassify ── */
  const [suspiciousItems, setSuspiciousItems] = useState<Array<{
    id: string; agentName: string; customerName: string;
    storedCallType: string; suggestedCallType: string;
  }>>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [bulkFixing, setBulkFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState<{ done: number; total: number } | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  /* ── fetchers ── */
  const fetchUsers = () =>
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []));
  const fetchTeams = () =>
    fetch("/api/teams").then(r => r.json()).then(d => setTeams(d.teams || []));
  const fetchPrompts = () =>
    fetch("/api/prompts").then(r => r.json()).then(d => setPrompts(d.prompts || []));
  const fetchLogs = async () => {
    setLogsLoading(true);
    const res = await fetch("/api/admin/logs");
    const d = await res.json();
    setLogs(d.logs || []);
    setLogsLoading(false);
  };
  const fetchFeedbacks = async () => {
    setFeedbacksLoading(true);
    const res = await fetch("/api/feedback");
    const d = await res.json();
    setFeedbacks(d.feedbacks || []);
    setFeedbacksLoading(false);
  };
  const fetchKrikoStatus = async () => {
    const res = await fetch("/api/calls/sync");
    if (res.ok) setKrikoStatus(await res.json());
  };
  const fetchUnassigned = async () => {
    const res = await fetch("/api/calls/unassigned");
    if (res.ok) setUnassignedItems((await res.json()).items || []);
  };
  const fetchFirefliesStatus = async () => {
    const res = await fetch("/api/calls/sync-fireflies");
    if (res.ok) setFirefliesStatus(await res.json());
  };
  const fetchRecentCalls = async () => {
    setRecentCallsLoading(true);
    const res = await fetch("/api/calls/recent");
    if (res.ok) setRecentCallsData(await res.json());
    setRecentCallsLoading(false);
  };

  useEffect(() => {
    fetchUsers(); fetchTeams(); fetchPrompts();
    if (initialTab === "logs") fetchLogs();
    if (initialTab === "feedbacks") fetchFeedbacks();
    if (initialTab === "sync") { fetchKrikoStatus(); fetchFirefliesStatus(); fetchUnassigned(); }
    if (initialTab === "syncHistory") { fetchKrikoStatus(); fetchFirefliesStatus(); }
    if (initialTab === "recentCalls") fetchRecentCalls();
  }, []);

  useEffect(() => {
    if (!krikoSyncing && !firefliesSyncing) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [krikoSyncing, firefliesSyncing]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    if (tab === "logs") fetchLogs();
    if (tab === "feedbacks") fetchFeedbacks();
    if (tab === "sync") { fetchKrikoStatus(); fetchFirefliesStatus(); fetchUnassigned(); }
    if (tab === "syncHistory") { fetchKrikoStatus(); fetchFirefliesStatus(); }
    if (tab === "recentCalls") fetchRecentCalls();
  };

  const handleScanClassifications = async () => {
    setScanLoading(true);
    setScanMsg("");
    setSuspiciousItems([]);
    try {
      const res = await fetch("/api/admin/scan-classifications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errorOccurred);
      setSuspiciousItems(data.items ?? []);
      setScanMsg(PANEL_T[lang].reclassifyScanResult(data.total, data.items?.length ?? 0));
    } catch (err: any) {
      setScanMsg(err.message);
    } finally {
      setScanLoading(false);
    }
  };

  const handleFixOne = async (item: typeof suspiciousItems[0]) => {
    setFixingId(item.id);
    try {
      const res = await fetch(`/api/evaluations/${item.id}/re-classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType: item.suggestedCallType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t.errorOccurred);
      }
      setSuspiciousItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err: any) {
      setScanMsg(err.message);
    } finally {
      setFixingId(null);
    }
  };

  // "Done" — stored call type is correct; mark verified so it drops off the
  // suspicious list (now and on future scans).
  const handleVerifyOne = async (item: typeof suspiciousItems[0]) => {
    setVerifyingId(item.id);
    try {
      const res = await fetch(`/api/evaluations/${item.id}/verify-classification`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t.errorOccurred);
      }
      setSuspiciousItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err: any) {
      setScanMsg(err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleFixAll = async () => {
    if (bulkFixing || suspiciousItems.length === 0) return;
    setBulkFixing(true);
    setFixProgress({ done: 0, total: suspiciousItems.length });
    const items = [...suspiciousItems];
    for (let i = 0; i < items.length; i++) {
      try {
        const res = await fetch(`/api/evaluations/${items[i].id}/re-classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callType: items[i].suggestedCallType }),
        });
        if (res.ok) setSuspiciousItems(prev => prev.filter(x => x.id !== items[i].id));
      } catch { /* continue */ }
      setFixProgress({ done: i + 1, total: items.length });
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 1000));
    }
    setBulkFixing(false);
    setFixProgress(null);
  };

  /* ── user handlers ── */
  const handleUserRowClick = (u: any) => {
    if (editingUserId === u.id) {
      setEditingUserId(null); setEditUserMsg(""); setEditUserStatus("idle"); return;
    }
    setEditingUserId(u.id);
    setEditName(u.name || ""); setEditEmail(u.email || "");
    setEditRole(u.role || "AGENT"); setEditTeamId(u.teamId || u.team?.id || "");
    setEditManagerId(u.managerId || "");
    setEditNewPassword(""); setEditUserMsg(""); setEditUserStatus("idle");
  };

  const handleSaveUser = async () => {
    if (!editingUserId) return;
    setEditUserStatus("saving"); setEditUserMsg("");
    const body: any = { name: editName, email: editEmail, role: editRole, teamId: editTeamId || null };
    if (editRole === "TEAM_LEADER") body.managerId = editManagerId || null;
    if (editNewPassword) body.newPassword = editNewPassword;
    const res = await fetch(`/api/users/${editingUserId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setEditUserStatus("error"); setEditUserMsg(data.error || t.updateError); return; }
    setEditUserStatus("success"); setEditUserMsg(t.updateSuccess);
    setEditNewPassword(""); fetchUsers();
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) return;
    setNewUserLoading(true); setNewUserMsg("");
    const res = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newUserName, email: newUserEmail, password: newUserPassword, role: newUserRole, leaderId: newUserLeaderId || null, managerId: newUserRole === "TEAM_LEADER" ? (newUserManagerId || null) : undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setNewUserMsgOk(false); setNewUserMsg(data.error || t.errorOccurred); }
    else {
      setNewUserMsgOk(true); setNewUserMsg(t.userCreated);
      setNewUserName(""); setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("AGENT"); setNewUserLeaderId(""); setNewUserManagerId("");
      fetchUsers();
    }
    setNewUserLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/users/${deleteConfirmId}`, { method: "DELETE" });
    const data = await res.json();
    setDeleteLoading(false);
    if (!res.ok) {
      setEditUserMsg(data.error || t.errorOccurred);
      setEditUserStatus("error");
    } else {
      setDeleteConfirmId(null);
      setEditingUserId(null);
      setEditUserMsg("");
      fetchUsers();
    }
  };

  /* ── prompt handlers ── */
  const handleAddPrompt = async () => {
    if (!newPromptName || !newPromptContent || !newPromptVersion) return;
    setNewPromptLoading(true); setNewPromptMsg("");
    const res = await fetch("/api/prompts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPromptName, callType: newPromptCallType, content: newPromptContent, version: newPromptVersion }),
    });
    const data = await res.json();
    if (!res.ok) { setNewPromptMsgOk(false); setNewPromptMsg(data.error || t.errorOccurred); }
    else {
      setNewPromptMsgOk(true); setNewPromptMsg(t.promptCreated);
      setNewPromptName(""); setNewPromptVersion(""); setNewPromptContent(""); setNewPromptCallType("SECOND_CALL");
      fetchPrompts();
    }
    setNewPromptLoading(false);
  };

  const handleTogglePrompt = async (p: any) => {
    await fetch(`/api/prompts/${p.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchPrompts();
  };

  const handleStartEditPrompt = (p: any) => {
    setEditingPromptId(p.id);
    setEditPromptName(p.name);
    setEditPromptVersion(p.version);
    setEditPromptContent(p.content);
    setEditPromptMsg("");
    setExpandedPromptId(null);
  };

  const handleSaveEditPrompt = async () => {
    if (!editingPromptId || !editPromptName || !editPromptContent || !editPromptVersion) return;
    setEditPromptLoading(true); setEditPromptMsg("");
    const res = await fetch(`/api/prompts/${editingPromptId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editPromptName, content: editPromptContent, version: editPromptVersion, isActive: true }),
    });
    const data = await res.json();
    if (!res.ok) { setEditPromptMsgOk(false); setEditPromptMsg(data.error || t.errorOccurred); }
    else {
      setEditPromptMsgOk(true); setEditPromptMsg(t.promptUpdated);
      setEditingPromptId(null);
      fetchPrompts();
    }
    setEditPromptLoading(false);
  };

  /* ── feedback handler ── */
  const handleMarkFeedbackRead = async (id: string) => {
    await fetch(`/api/feedback/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, isRead: true } : f));
  };

  const SYNC_ESTIMATED_SECS = 240;

  const startSyncTimer = (
    setProgress: (v: number) => void,
    setSeconds: (v: number) => void,
    timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
  ) => {
    setProgress(0);
    setSeconds(SYNC_ESTIMATED_SECS);
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      const pct = Math.min(95, Math.round((elapsed / SYNC_ESTIMATED_SECS) * 100));
      const left = Math.max(0, SYNC_ESTIMATED_SECS - elapsed);
      setProgress(pct);
      setSeconds(left);
    }, 1000);
  };

  const stopSyncTimer = (
    setProgress: (v: number) => void,
    setSeconds: (v: number) => void,
    timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
  ) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setProgress(100);
    setSeconds(0);
    setTimeout(() => setProgress(0), 1200);
  };

  /* ── kriko sync ── */
  const handleKrikoSync = async () => {
    setKrikoSyncing(true); setKrikoMsg(t.syncStarted);
    setKrikoLastResult(null);
    startSyncTimer(setKrikoProgress, setKrikoSecondsLeft, krikoTimerRef);
    const body: any = {}; if (krikoSyncDate) body.date = krikoSyncDate;
    const res = await fetch("/api/calls/sync", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    stopSyncTimer(setKrikoProgress, setKrikoSecondsLeft, krikoTimerRef);
    if (!res.ok) setKrikoMsg(t.syncError + (data.error || t.syncFailed));
    else {
      setKrikoLastResult(data);
      let msg = t.syncDone(data.imported, data.unassigned, data.skipped);
      if (data.failed > 0) msg += t.syncFailed2(data.failed);
      if (data.errors?.length) msg += `\n${t.syncErrors}${data.errors.join(" | ")}`;
      setKrikoMsg(msg);
      fetchKrikoStatus(); fetchUnassigned();
    }
    setKrikoSyncing(false);
  };

  const handleReassign = async (evalId: string) => {
    const agentId = reassignSelections[evalId]; if (!agentId) return;
    const res = await fetch(`/api/evaluations/${evalId}/reassign`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }),
    });
    if (res.ok) {
      setUnassignedItems(prev => prev.filter(i => i.id !== evalId));
      setReassignSelections(prev => { const n = { ...prev }; delete n[evalId]; return n; });
    }
  };

  /* ── fireflies sync ── */
  const handleFirefliesSync = async () => {
    setFirefliesSyncing(true); setFirefliesMsg(t.ffSyncStarted);
    setFirefliesLastResult(null);
    startSyncTimer(setFfProgress, setFfSecondsLeft, ffTimerRef);
    const body: any = {}; if (firefliesSyncDate) body.date = firefliesSyncDate;
    const res = await fetch("/api/calls/sync-fireflies", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    stopSyncTimer(setFfProgress, setFfSecondsLeft, ffTimerRef);
    if (!res.ok) setFirefliesMsg(t.syncError + (data.error || t.syncFailed));
    else {
      setFirefliesLastResult(data);
      let msg = t.syncDone(data.imported, data.unassigned, data.skipped);
      if (data.failed > 0) msg += t.syncFailed2(data.failed);
      if (data.errors?.length) msg += `\n${t.syncErrors}${data.errors.join(" | ")}`;
      setFirefliesMsg(msg);
      fetchFirefliesStatus();
    }
    setFirefliesSyncing(false);
  };

  /* ── shared styles ── */
  const tabBtnStyle = (active: boolean) => ({
    padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontSize: 11.5,
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" as const,
    border: active ? "1px solid var(--accent)" : "1px solid var(--rule)",
    background: active ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.04)",
    color: active ? "var(--accent)" : "var(--fg-dim)",
  });

  const syncResultGrid = (result: any) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 12 }}>
      {[
        [t.statFetched, result.totalFetched, "var(--fg)"],
        [t.statAnalyzable, result.analyzable, "var(--accent)"],
        [t.statImport, result.imported, "#34d399"],
        [t.statUnassigned, result.unassigned, "#fbbf24"],
        [t.statFailed, result.failed, "#f87171"],
      ].map(([label, value, color]) => (
        <div key={label as string} style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--rule)", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 9.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{label as string}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: color as string }}>{(value as number) ?? 0}</div>
        </div>
      ))}
    </div>
  );

  const isAdmin = user.role === "ADMIN";
  const managers = users.filter((u: any) => u.role === "MANAGER");
  const managerOptions = user.role === "MANAGER" ? managers.filter((m: any) => m.id === user.id) : managers;
  const allTabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: "users", label: t.tabs.users, icon: "users" },
    { key: "prompts", label: t.tabs.prompts, icon: "spark" },
    { key: "logs", label: t.tabs.logs, icon: "history" },
    { key: "feedbacks", label: t.tabs.feedbacks, icon: "inbox" },
    { key: "sync", label: t.tabs.sync, icon: "cloud" },
    { key: "syncHistory", label: t.tabs.syncHistory, icon: "history" },
    { key: "recentCalls", label: t.tabs.recentCalls, icon: "phone" },
    { key: "reclassify", label: t.tabReclassify, icon: "refresh" },
  ];
  const adminOnlyTabs: AdminTab[] = ["logs", "feedbacks", "sync", "syncHistory", "recentCalls", "reclassify"];
  const tabs = isAdmin ? allTabs : allTabs.filter(tb => !adminOnlyTabs.includes(tb.key));

  const unreadCount = feedbacks.filter(f => !f.isRead).length;

  return (
    <div className={styles.page}>
      <style>{`@keyframes syncPulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* ── Delete confirmation modal ── */}
      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-card, #1a1a2e)", border: "1px solid var(--rule)", borderRadius: 14, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 12 }}>{t.deleteConfirmTitle}</div>
            <p style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.6, margin: "0 0 20px" }}>{t.deleteConfirmMsg(deleteConfirmName)}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 12.5, color: "var(--fg-faint)", background: "none", border: "none", cursor: "pointer", padding: "6px 12px" }}>{t.cancel}</button>
              <button onClick={handleDeleteUser} disabled={deleteLoading} style={{ fontSize: 12.5, background: "rgba(248,113,113,.15)", border: "1px solid rgba(248,113,113,.4)", color: "#f87171", borderRadius: 8, padding: "6px 16px", cursor: "pointer", opacity: deleteLoading ? 0.6 : 1 }}>
                {deleteLoading ? t.deleting : t.deleteConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={styles.pageHd}>
        <h1 className={styles.pageH1}>{t.pageTitle}</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-faint)" }}>{t.pageSubtitle}</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => handleTabChange(tb.key)} style={tabBtnStyle(activeTab === tb.key)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Icon name={tb.icon} size={12} />
              {tb.label}
              {tb.key === "feedbacks" && unreadCount > 0 && (
                <span style={{ background: "#f87171", color: "white", borderRadius: "50%", fontSize: 9, minWidth: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, padding: "0 3px" }}>{unreadCount}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ── USERS ── */}
      {activeTab === "users" && (
        <>
          <div className={styles.card} style={{ padding: 20 }}>
            <div className={styles.sectHd}>
              <h2><Icon name="users" size={15} />{t.newUser}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <div><label className={styles.fbLabel}>{t.labelName}</label><input className={styles.formInput} value={newUserName} onChange={e => { setNewUserName(e.target.value); setNewUserMsg(""); }} placeholder="John Doe" /></div>
              <div><label className={styles.fbLabel}>{t.labelEmail}</label><input type="email" className={styles.formInput} value={newUserEmail} onChange={e => { setNewUserEmail(e.target.value); setNewUserMsg(""); }} placeholder="john@estenove.com" /></div>
              <div><label className={styles.fbLabel}>{t.labelPassword}</label><input type="password" className={styles.formInput} value={newUserPassword} onChange={e => { setNewUserPassword(e.target.value); setNewUserMsg(""); }} placeholder="••••••••" /></div>
              <div>
                <label className={styles.fbLabel}>{t.labelRole}</label>
                <select className={styles.formSelect} value={newUserRole} onChange={e => { setNewUserRole(e.target.value); if (e.target.value !== "AGENT") setNewUserLeaderId(""); }}>
                  <option value="AGENT">{t.roles.AGENT}</option>
                  <option value="TEAM_LEADER">{t.roles.TEAM_LEADER}</option>
                  {isAdmin && <option value="MANAGER">{t.roles.MANAGER}</option>}
                  {isAdmin && <option value="ADMIN">{t.roles.ADMIN}</option>}
                </select>
              </div>
              {newUserRole === "AGENT" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.fbLabel}>{t.labelTeamOptional}</label>
                  <select className={styles.formSelect} value={newUserLeaderId} onChange={e => setNewUserLeaderId(e.target.value)}>
                    <option value="">{t.selectTeamLeader}</option>
                    {users.filter((u: any) => u.role === "TEAM_LEADER").map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              {newUserRole === "TEAM_LEADER" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.fbLabel}>{t.labelManager}</label>
                  <select className={styles.formSelect} value={newUserManagerId} onChange={e => setNewUserManagerId(e.target.value)}>
                    <option value="">{t.selectManager}</option>
                    {managerOptions.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {newUserMsg && <p style={{ color: newUserMsgOk ? "#34d399" : "#f87171", fontSize: 12, marginTop: 10 }}>{newUserMsg}</p>}
            <button onClick={handleAddUser} disabled={newUserLoading || !newUserName || !newUserEmail || !newUserPassword} className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 14, borderRadius: 9, opacity: (newUserLoading || !newUserName || !newUserEmail || !newUserPassword) ? 0.45 : 1 }}>
              <Icon name="plus" size={13} /><span>{newUserLoading ? t.adding : t.addUser}</span>
            </button>
          </div>

          <div className={styles.card} style={{ padding: "8px 0" }}>
            <div className={styles.sectHd} style={{ padding: "4px 18px 8px" }}>
              <h2><Icon name="users" size={15} />{t.usersHeading}</h2>
              <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{t.usersCount(users.length)}</span>
            </div>
            {users.length === 0 ? <div className={styles.emptyMsg}>{t.noUsers}</div> : users.map((u: any) => {
              const isExpanded = editingUserId === u.id;
              return (
                <div key={u.id}>
                  <div onClick={() => handleUserRowClick(u)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", cursor: "pointer", transition: "background 120ms", background: isExpanded ? "rgba(255,255,255,.04)" : "transparent" }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.03)"; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(59,130,246,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>{u.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{u.email}{u.team ? ` · ${u.team.name}` : ""}{u.role === "TEAM_LEADER" && u.manager ? ` · ${u.manager.name}` : ""}</div>
                    </div>
                    <span style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 5, fontFamily: "'JetBrains Mono', monospace", background: roleBg[u.role] || "rgba(255,255,255,.06)", color: roleFg[u.role] || "var(--fg-faint)" }}>{roleLabel(u.role)}</span>
                    <span style={{ color: "var(--fg-faint)", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 200ms" }}><Icon name="chevron" size={14} /></span>
                  </div>
                  {isExpanded && (
                    <div style={{ margin: "0 12px 10px", padding: 18, borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--rule)" }}>
                      <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 14 }}>{t.editUserHeading}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div><label className={styles.fbLabel}>{t.labelName}</label><input className={styles.formInput} value={editName} onChange={e => { setEditName(e.target.value); setEditUserMsg(""); setEditUserStatus("idle"); }} /></div>
                        <div><label className={styles.fbLabel}>{t.labelEmail}</label><input type="email" className={styles.formInput} value={editEmail} onChange={e => { setEditEmail(e.target.value); setEditUserMsg(""); setEditUserStatus("idle"); }} /></div>
                        <div>
                          <label className={styles.fbLabel}>{t.labelRole}</label>
                          <select className={styles.formSelect} value={editRole} onChange={e => { setEditRole(e.target.value); if (e.target.value !== "AGENT") setEditTeamId(""); setEditUserMsg(""); setEditUserStatus("idle"); }}>
                            <option value="AGENT">{t.roles.AGENT}</option>
                            <option value="TEAM_LEADER">{t.roles.TEAM_LEADER}</option>
                            {isAdmin && <option value="MANAGER">{t.roles.MANAGER}</option>}
                            {isAdmin && <option value="ADMIN">{t.roles.ADMIN}</option>}
                          </select>
                        </div>
                        {editRole === "AGENT" ? (
                          <div><label className={styles.fbLabel}>{t.labelTeam}</label>
                            <select className={styles.formSelect} value={editTeamId} onChange={e => { setEditTeamId(e.target.value); setEditUserMsg(""); setEditUserStatus("idle"); }}>
                              <option value="">{t.selectTeam}</option>
                              {teams.filter((tm: any) => tm.leader).map((tm: any) => <option key={tm.id} value={tm.id}>{tm.leader.name}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div><label className={styles.fbLabel}>{t.labelNewPassword}</label><input type="password" className={styles.formInput} value={editNewPassword} onChange={e => { setEditNewPassword(e.target.value); setEditUserMsg(""); setEditUserStatus("idle"); }} placeholder={t.passwordPlaceholder} /></div>
                        )}
                        {editRole === "AGENT" && (
                          <div style={{ gridColumn: "1 / -1" }}><label className={styles.fbLabel}>{t.labelNewPassword}</label><input type="password" className={styles.formInput} value={editNewPassword} onChange={e => { setEditNewPassword(e.target.value); setEditUserMsg(""); setEditUserStatus("idle"); }} placeholder={t.passwordPlaceholder} /></div>
                        )}
                        {editRole === "TEAM_LEADER" && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label className={styles.fbLabel}>{t.labelManager}</label>
                            <select className={styles.formSelect} value={editManagerId} onChange={e => { setEditManagerId(e.target.value); setEditUserMsg(""); setEditUserStatus("idle"); }}>
                              <option value="">{t.noManager}</option>
                              {managerOptions.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                        <button onClick={handleSaveUser} disabled={editUserStatus === "saving"} className={`${styles.btn} ${styles.btnPrimary}`} style={{ borderRadius: 9, opacity: editUserStatus === "saving" ? 0.6 : 1 }}>
                          {editUserStatus === "saving" ? t.saving : t.save}
                        </button>
                        <button onClick={() => { setEditingUserId(null); setEditUserMsg(""); setEditUserStatus("idle"); setEditManagerId(""); }} style={{ fontSize: 12.5, color: "var(--fg-faint)", background: "none", border: "none", cursor: "pointer" }}>{t.cancel}</button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => { setDeleteConfirmId(u.id); setDeleteConfirmName(u.name); }}
                            style={{ fontSize: 12, color: "#f87171", background: "none", border: "0.5px solid rgba(248,113,113,.3)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginLeft: "auto" }}
                          >
                            {t.deleteUser}
                          </button>
                        )}
                        {editUserMsg && <span style={{ fontSize: 12, color: editUserStatus === "success" ? "#34d399" : "#f87171" }}>{editUserMsg}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── PROMPTS ── */}
      {activeTab === "prompts" && (
        <>
          <div className={styles.card} style={{ padding: 20 }}>
            <div className={styles.sectHd}><h2><Icon name="spark" size={15} />{t.newPrompt}</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <div><label className={styles.fbLabel}>{t.labelPromptName}</label><input className={styles.formInput} value={newPromptName} onChange={e => { setNewPromptName(e.target.value); setNewPromptMsg(""); }} placeholder="Sales Analysis" /></div>
              <div>
                <label className={styles.fbLabel}>{t.labelCallType}</label>
                <select className={styles.formSelect} value={newPromptCallType} onChange={e => setNewPromptCallType(e.target.value)}>
                  <option value="FIRST_CALL">First Call</option><option value="SECOND_CALL">Second Call</option><option value="FOLLOW_UP">Follow-up</option><option value="GENERAL">{t.callTypeGeneral}</option>
                </select>
              </div>
              <div><label className={styles.fbLabel}>{t.labelVersion}</label><input className={styles.formInput} value={newPromptVersion} onChange={e => { setNewPromptVersion(e.target.value); setNewPromptMsg(""); }} placeholder="10.29" /></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label className={styles.fbLabel}>{t.labelContent}</label>
              <textarea className={styles.formInput} rows={8} value={newPromptContent} onChange={e => { setNewPromptContent(e.target.value); setNewPromptMsg(""); }} placeholder={t.promptContentPlaceholder} style={{ resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
            </div>
            {newPromptMsg && <p style={{ color: newPromptMsgOk ? "#34d399" : "#f87171", fontSize: 12, marginTop: 10 }}>{newPromptMsg}</p>}
            <button onClick={handleAddPrompt} disabled={newPromptLoading || !newPromptName || !newPromptContent || !newPromptVersion} className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 14, borderRadius: 9, opacity: (newPromptLoading || !newPromptName || !newPromptContent || !newPromptVersion) ? 0.45 : 1 }}>
              <Icon name="plus" size={13} /><span>{newPromptLoading ? t.addingPrompt : t.addPrompt}</span>
            </button>
          </div>

          <div className={styles.card}>
            <div className={styles.sectHd}><h2><Icon name="spark" size={15} />{t.promptsHeading}</h2><span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{t.promptsCount(prompts.length)}</span></div>
            <div style={{ marginTop: 8 }}>
              {prompts.length === 0 ? <div className={styles.emptyMsg}>{t.noPrompts}</div> : prompts.map((p: any) => (
                <div key={p.id} style={{ borderBottom: "0.5px solid var(--rule)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--fg)" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>v{p.version} · {p.callType?.replace("_", " ")} · {t.chars(p.content?.length ?? 0)}</div>
                    </div>
                    <button
                      onClick={() => { setExpandedPromptId(expandedPromptId === p.id ? null : p.id); setEditingPromptId(null); }}
                      style={{ fontSize: 11, cursor: "pointer", background: "none", border: "none", color: "var(--accent)", padding: "2px 6px", borderRadius: 4 }}
                    >
                      {expandedPromptId === p.id ? t.hideContent : t.viewContent}
                    </button>
                    <button
                      onClick={() => editingPromptId === p.id ? setEditingPromptId(null) : handleStartEditPrompt(p)}
                      style={{ fontSize: 11, cursor: "pointer", background: editingPromptId === p.id ? "rgba(59,130,246,.15)" : "none", border: editingPromptId === p.id ? "0.5px solid rgba(59,130,246,.4)" : "none", color: "var(--fg-dim)", padding: "2px 8px", borderRadius: 4 }}
                    >
                      {editingPromptId === p.id ? t.cancel : t.editPrompt}
                    </button>
                    <button onClick={() => handleTogglePrompt(p)} style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 5, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", border: "0.5px solid var(--rule)", background: p.isActive ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.06)", color: p.isActive ? "#34d399" : "var(--fg-faint)" }}>
                      {p.isActive ? t.active : t.inactive}
                    </button>
                  </div>
                  {expandedPromptId === p.id && editingPromptId !== p.id && (
                    <pre style={{ margin: "0 0 10px", padding: "12px", borderRadius: 8, background: "rgba(0,0,0,.25)", border: "0.5px solid var(--rule)", fontSize: 11, color: "var(--fg-dim)", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 400, overflowY: "auto" }}>
                      {p.content}
                    </pre>
                  )}
                  {editingPromptId === p.id && (
                    <div style={{ margin: "0 0 12px", padding: "14px", borderRadius: 8, background: "rgba(59,130,246,.05)", border: "0.5px solid rgba(59,130,246,.2)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label className={styles.fbLabel}>{t.labelPromptName}</label>
                          <input className={styles.formInput} value={editPromptName} onChange={e => setEditPromptName(e.target.value)} />
                        </div>
                        <div>
                          <label className={styles.fbLabel}>{t.labelVersion}</label>
                          <input className={styles.formInput} value={editPromptVersion} onChange={e => setEditPromptVersion(e.target.value)} placeholder="10.29" />
                        </div>
                      </div>
                      <div>
                        <label className={styles.fbLabel}>{t.labelContent}</label>
                        <textarea
                          className={styles.formInput}
                          rows={14}
                          value={editPromptContent}
                          onChange={e => { setEditPromptContent(e.target.value); setEditPromptMsg(""); }}
                          style={{ resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6 }}
                        />
                      </div>
                      {editPromptMsg && <p style={{ color: editPromptMsgOk ? "#34d399" : "#f87171", fontSize: 12, marginTop: 8 }}>{editPromptMsg}</p>}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          onClick={handleSaveEditPrompt}
                          disabled={editPromptLoading || !editPromptName || !editPromptContent || !editPromptVersion}
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          style={{ borderRadius: 8, opacity: (editPromptLoading || !editPromptName || !editPromptContent || !editPromptVersion) ? 0.45 : 1 }}
                        >
                          {editPromptLoading ? t.savingPrompt : t.savePrompt}
                        </button>
                        <button onClick={() => setEditingPromptId(null)} className={styles.btn} style={{ borderRadius: 8 }}>
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── LOGS ── */}
      {activeTab === "logs" && (
        <div className={styles.card}>
          <div className={styles.sectHd}><h2><Icon name="history" size={15} />{t.activityLogs}</h2>
            <button onClick={fetchLogs} className={styles.btnSmall} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="refresh" size={12} />{t.refresh}</button>
          </div>
          {logsLoading ? <div className={styles.emptyMsg}>{t.loading}</div> : logs.length === 0 ? <div className={styles.emptyMsg}>{t.noLogs}</div> : (
            <div style={{ marginTop: 8 }}>
              {logs.map((log: any, i: number) => (
                <div key={log.id ?? i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderBottom: "0.5px solid var(--rule)", gap: 12, flexWrap: "wrap" as const }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(59,130,246,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>{(log.user?.name ?? log.userName ?? "?").charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{log.user?.name ?? log.userName ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{fmtDate(log.createdAt ?? log.timestamp)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 5, fontFamily: "'JetBrains Mono', monospace", background: roleBg[log.user?.role ?? ""] || "rgba(255,255,255,.06)", color: roleFg[log.user?.role ?? ""] || "var(--fg-faint)" }}>{roleLabel(log.user?.role ?? "")}</span>
                    <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 5, fontFamily: "'JetBrains Mono', monospace", background: log.action === "LOGIN" ? "rgba(52,211,153,.12)" : log.action === "LOGOUT" ? "rgba(255,255,255,.04)" : "rgba(59,130,246,.1)", color: log.action === "LOGIN" ? "#34d399" : log.action === "LOGOUT" ? "var(--fg-faint)" : "var(--accent)" }}>{ACTION_LABELS[lang][log.action] ?? log.action}</span>
                    {log.section && (
                      <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 5, fontFamily: "'JetBrains Mono', monospace", background: "rgba(255,255,255,.04)", color: "var(--fg)", border: "0.5px solid var(--rule)" }}>
                        {SECTION_LABELS[lang][log.section] ?? log.section}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FEEDBACKS ── */}
      {activeTab === "feedbacks" && (
        <div className={styles.card}>
          <div className={styles.sectHd}><h2><Icon name="inbox" size={15} />{t.feedbacksHeading}</h2>
            <button onClick={fetchFeedbacks} className={styles.btnSmall} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="refresh" size={12} />{t.refresh}</button>
          </div>
          {feedbacksLoading ? <div className={styles.emptyMsg}>{t.loading}</div> : feedbacks.length === 0 ? <div className={styles.emptyMsg}>{t.noFeedbacks}</div> : (
            <div style={{ marginTop: 8 }}>
              {feedbacks.map((fb: any) => (
                <div key={fb.id} onClick={() => { setExpandedFeedbackId(expandedFeedbackId === fb.id ? null : fb.id); if (!fb.isRead) handleMarkFeedbackRead(fb.id); }}
                  style={{ padding: "12px 4px", borderBottom: "0.5px solid var(--rule)", cursor: "pointer", background: !fb.isRead ? "rgba(59,130,246,.05)" : "transparent", borderRadius: 6, transition: "background 120ms" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{fb.user?.name ?? "—"}</span>
                      <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", background: roleBg[fb.user?.role ?? ""] || "rgba(255,255,255,.06)", color: roleFg[fb.user?.role ?? ""] || "var(--fg-faint)" }}>{roleLabel(fb.user?.role ?? "")}</span>
                      <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", background: "rgba(255,255,255,.04)", color: "var(--fg-faint)", border: "0.5px solid var(--rule)" }}>{fb.category}</span>
                      {!fb.isRead && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{fmtDate(fb.createdAt)}</span>
                      <Icon name="chevronDown" size={14} />
                    </div>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.5, overflow: expandedFeedbackId === fb.id ? "visible" : "hidden", display: "-webkit-box", WebkitBoxOrient: expandedFeedbackId === fb.id ? "unset" as any : "vertical", WebkitLineClamp: expandedFeedbackId === fb.id ? "none" as any : 2 }}>
                    {fb.comment ?? fb.message ?? ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SYNC ── */}
      {activeTab === "sync" && (
        <>
          {/* ── KRIKO ── */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="phone" size={13} /> Kriko
          </div>

          <div style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid", borderColor: krikoStatus?.configured === false ? "rgba(248,113,113,.3)" : "rgba(52,211,153,.3)", background: krikoStatus?.configured === false ? "rgba(248,113,113,.08)" : "rgba(52,211,153,.08)", color: krikoStatus?.configured === false ? "#f87171" : "#34d399" }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{krikoStatus?.configured === false ? t.krikoNotConfigured : t.krikoActive}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>{krikoStatus?.configured === false ? t.krikoNotConfiguredHint : t.krikoFilter}</div>
          </div>

          <div className={styles.card} style={{ padding: 20 }}>
            <div className={styles.sectHd}><h2>{t.manualSync}</h2></div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className={styles.fbLabel}>{t.labelDate}</label>
                <input type="date" className={styles.formInput} value={krikoSyncDate} onChange={e => setKrikoSyncDate(e.target.value)} />
              </div>
              <button onClick={handleKrikoSync} disabled={krikoSyncing || krikoStatus?.configured === false} className={`${styles.btn} ${styles.btnPrimary}`} style={{ borderRadius: 9, opacity: (krikoSyncing || krikoStatus?.configured === false) ? 0.5 : 1 }}>
                <Icon name={krikoSyncing ? "refresh" : "cloud"} size={14} /><span>{krikoSyncing ? t.syncing : t.syncNow}</span>
              </button>
            </div>
            {krikoSyncing && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    {krikoSecondsLeft === 0 ? (lang === "tr" ? "Devam ediyor…" : "Still running…") : (lang === "tr" ? "İşleniyor…" : "Processing…")}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)" }}>
                    {krikoSecondsLeft > 0 ? `${Math.floor(krikoSecondsLeft / 60)}:${String(krikoSecondsLeft % 60).padStart(2, "0")}` : "—"}
                  </span>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "var(--accent)", width: `${krikoProgress}%`, transition: "width 0.9s linear", animation: krikoSecondsLeft === 0 ? "syncPulse 1.5s ease-in-out infinite" : "none" }} />
                </div>
              </div>
            )}
            {krikoMsg && <p style={{ fontSize: 13, marginTop: 10, color: krikoMsg.startsWith(t.syncError) ? "#f87171" : krikoMsg.startsWith("✅") ? "#34d399" : "var(--fg-faint)" }}>{krikoMsg}</p>}
            {krikoLastResult && syncResultGrid(krikoLastResult)}
          </div>

          {unassignedItems.filter((i: any) => !i.source || i.source === "KRIKO").length > 0 && (
            <div className={styles.card} style={{ padding: 20 }}>
              <div className={styles.sectHd}>
                <h2>{t.krikoUnassigned} <span style={{ fontSize: 11, background: "rgba(251,191,36,.15)", color: "#fbbf24", padding: "2px 7px", borderRadius: 5, marginLeft: 6 }}>{unassignedItems.filter((i: any) => !i.source || i.source === "KRIKO").length}</span></h2>
                <button onClick={fetchUnassigned} className={styles.btnSmall} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="refresh" size={12} />{t.refresh}</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                {unassignedItems.filter((i: any) => !i.source || i.source === "KRIKO").map((item: any) => {
                  const isExpanded = expandedUnassignedId === item.id;
                  return (
                    <div key={item.id} style={{ borderRadius: 10, border: "0.5px solid var(--rule)", overflow: "hidden" }}>
                      <button onClick={() => setExpandedUnassignedId(isExpanded ? null : item.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,.02)", cursor: "pointer", border: "none", textAlign: "left" as const, gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{item.customerName}</span>
                          <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 4, background: "rgba(251,191,36,.12)", color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>Kriko: {item.externalAgentName || "—"}</span>
                          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{fmtDate(item.callDate)} · {item.callDuration} · %{item.score}</span>
                        </div>
                        <Icon name={isExpanded ? "chevronDown" : "chevron"} size={14} />
                      </button>
                      {isExpanded && (
                        <div style={{ borderTop: "0.5px solid var(--rule)", padding: "14px 14px 14px", background: "rgba(0,0,0,.15)" }}>
                          {item.transcript && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>{t.transcript}</div>
                              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "10px 12px", maxHeight: 220, overflowY: "auto", border: "0.5px solid var(--rule)" }}>
                                <pre style={{ fontSize: 11, color: "var(--fg-dim)", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6, margin: 0 }}>{item.transcript}</pre>
                              </div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8 }}>
                            <select className={styles.formSelect} style={{ flex: 1 }} value={reassignSelections[item.id] || ""} onChange={e => setReassignSelections({ ...reassignSelections, [item.id]: e.target.value })}>
                              <option value="">{t.selectAgent}</option>
                              {users.filter((u: any) => u.role !== "ADMIN" && u.email !== "unassigned@estenove.local").map((u: any) => <option key={u.id} value={u.id}>{u.name}{u.team?.name ? ` · ${u.team.name}` : ""}</option>)}
                            </select>
                            <button onClick={() => handleReassign(item.id)} disabled={!reassignSelections[item.id]} className={`${styles.btn} ${styles.btnPrimary}`} style={{ borderRadius: 9, padding: "8px 14px", opacity: !reassignSelections[item.id] ? 0.3 : 1 }}>
                              <Icon name="check" size={13} />{t.assign}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── FIREFLIES ── */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginTop: 24, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="mic" size={13} /> Fireflies
          </div>

          <div style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid", borderColor: firefliesStatus?.configured === false ? "rgba(248,113,113,.3)" : "rgba(52,211,153,.3)", background: firefliesStatus?.configured === false ? "rgba(248,113,113,.08)" : "rgba(52,211,153,.08)", color: firefliesStatus?.configured === false ? "#f87171" : "#34d399" }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{firefliesStatus?.configured === false ? t.ffNotConfigured : t.ffActive(firefliesStatus?.unassignedCount ?? 0)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>{firefliesStatus?.configured === false ? t.ffNotConfiguredHint : t.ffFilter}</div>
          </div>

          <div className={styles.card} style={{ padding: 20 }}>
            <div className={styles.sectHd}><h2>{t.manualSync}</h2></div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className={styles.fbLabel}>{t.labelDate}</label>
                <input type="date" className={styles.formInput} value={firefliesSyncDate} onChange={e => setFirefliesSyncDate(e.target.value)} />
              </div>
              <button onClick={handleFirefliesSync} disabled={firefliesSyncing || firefliesStatus?.configured === false} className={`${styles.btn} ${styles.btnPrimary}`} style={{ borderRadius: 9, opacity: (firefliesSyncing || firefliesStatus?.configured === false) ? 0.5 : 1 }}>
                <Icon name={firefliesSyncing ? "refresh" : "cloud"} size={14} /><span>{firefliesSyncing ? t.syncing : t.syncNow}</span>
              </button>
            </div>
            {firefliesSyncing && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    {ffSecondsLeft === 0 ? (lang === "tr" ? "Devam ediyor…" : "Still running…") : (lang === "tr" ? "İşleniyor…" : "Processing…")}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)" }}>
                    {ffSecondsLeft > 0 ? `${Math.floor(ffSecondsLeft / 60)}:${String(ffSecondsLeft % 60).padStart(2, "0")}` : "—"}
                  </span>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "var(--accent)", width: `${ffProgress}%`, transition: "width 0.9s linear", animation: ffSecondsLeft === 0 ? "syncPulse 1.5s ease-in-out infinite" : "none" }} />
                </div>
              </div>
            )}
            {firefliesMsg && <p style={{ fontSize: 13, marginTop: 10, color: firefliesMsg.startsWith(t.syncError) ? "#f87171" : firefliesMsg.startsWith("✅") ? "#34d399" : "var(--fg-faint)" }}>{firefliesMsg}</p>}
            {firefliesLastResult && syncResultGrid(firefliesLastResult)}
          </div>

          {unassignedItems.filter((i: any) => i.source === "FIREFLIES").length > 0 && (
            <div className={styles.card} style={{ padding: 20 }}>
              <div className={styles.sectHd}>
                <h2>{t.ffUnassigned} <span style={{ fontSize: 11, background: "rgba(251,191,36,.15)", color: "#fbbf24", padding: "2px 7px", borderRadius: 5, marginLeft: 6 }}>{unassignedItems.filter((i: any) => i.source === "FIREFLIES").length}</span></h2>
                <button onClick={fetchUnassigned} className={styles.btnSmall} style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="refresh" size={12} />{t.refresh}</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                {unassignedItems.filter((i: any) => i.source === "FIREFLIES").map((item: any) => {
                  const isExpanded = expandedUnassignedId === item.id;
                  return (
                    <div key={item.id} style={{ borderRadius: 10, border: "0.5px solid var(--rule)", overflow: "hidden" }}>
                      <button onClick={() => setExpandedUnassignedId(isExpanded ? null : item.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,.02)", cursor: "pointer", border: "none", textAlign: "left" as const, gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{item.customerName}</span>
                          <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 4, background: "rgba(59,130,246,.12)", color: "#60a5fa", fontFamily: "'JetBrains Mono', monospace" }}>Fireflies: {item.externalAgentName || "—"}</span>
                          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{fmtDate(item.callDate)} · {item.callDuration} · %{item.score}</span>
                        </div>
                        <Icon name={isExpanded ? "chevronDown" : "chevron"} size={14} />
                      </button>
                      {isExpanded && (
                        <div style={{ borderTop: "0.5px solid var(--rule)", padding: "14px 14px 14px", background: "rgba(0,0,0,.15)" }}>
                          {item.transcript && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 6 }}>{t.transcript}</div>
                              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "10px 12px", maxHeight: 220, overflowY: "auto", border: "0.5px solid var(--rule)" }}>
                                <pre style={{ fontSize: 11, color: "var(--fg-dim)", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6, margin: 0 }}>{item.transcript}</pre>
                              </div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8 }}>
                            <select className={styles.formSelect} style={{ flex: 1 }} value={reassignSelections[item.id] || ""} onChange={e => setReassignSelections({ ...reassignSelections, [item.id]: e.target.value })}>
                              <option value="">{t.selectAgent}</option>
                              {users.filter((u: any) => u.role !== "ADMIN" && u.email !== "unassigned@estenove.local").map((u: any) => <option key={u.id} value={u.id}>{u.name}{u.team?.name ? ` · ${u.team.name}` : ""}</option>)}
                            </select>
                            <button onClick={() => handleReassign(item.id)} disabled={!reassignSelections[item.id]} className={`${styles.btn} ${styles.btnPrimary}`} style={{ borderRadius: 9, padding: "8px 14px", opacity: !reassignSelections[item.id] ? 0.3 : 1 }}>
                              <Icon name="check" size={13} />{t.assign}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SYNC HISTORY ── */}
      {activeTab === "syncHistory" && (() => {
        const krikoLogs = (krikoStatus?.logs ?? []).map((l: any) => ({ ...l, source: "KRIKO" }));
        const firefliesLogs = (firefliesStatus?.logs ?? []).map((l: any) => ({ ...l, source: "FIREFLIES" }));
        const allLogs = [...krikoLogs, ...firefliesLogs].sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        return (
          <>
            <div className={styles.card} style={{ padding: 20 }}>
              <div className={styles.sectHd}>
                <h2>{t.allSyncLogs}</h2>
                <button onClick={() => { fetchKrikoStatus(); fetchFirefliesStatus(); }} className={styles.btnSmall} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Icon name="refresh" size={12} />{t.refresh}
                </button>
              </div>
              {allLogs.length === 0 ? (
                <div className={styles.emptyMsg}>{t.noSyncLogs}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {allLogs.map((log: any) => {
                    const status = !log.finishedAt ? "interrupted"
                      : log.error ? "error"
                      : log.failed > 0 ? "partial"
                      : log.imported > 0 ? "success"
                      : "empty";
                    const statusCfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
                      success:     { label: t.syncStatusSuccess,     color: "#34d399", bg: "rgba(52,211,153,.1)",  border: "rgba(52,211,153,.25)"  },
                      empty:       { label: t.syncStatusEmpty,       color: "#94a3b8", bg: "rgba(148,163,184,.08)", border: "rgba(148,163,184,.2)"  },
                      partial:     { label: t.syncStatusPartial,     color: "#fbbf24", bg: "rgba(251,191,36,.1)",  border: "rgba(251,191,36,.3)"   },
                      error:       { label: t.syncStatusError,       color: "#f87171", bg: "rgba(248,113,113,.1)", border: "rgba(248,113,113,.3)"  },
                      interrupted: { label: t.syncStatusInterrupted, color: "#fb923c", bg: "rgba(251,146,60,.1)",  border: "rgba(251,146,60,.3)"   },
                    };
                    const sc = statusCfg[status];
                    const descLine = status === "interrupted" ? t.syncStatusInterruptedDesc
                      : status === "empty" ? t.syncStatusEmptyDesc
                      : null;
                    return (
                      <div key={`${log.source}-${log.id}`} style={{ borderRadius: 8, background: "rgba(255,255,255,.02)", border: `0.5px solid ${status !== "success" && status !== "empty" ? sc.border : "var(--rule)"}`, overflow: "hidden" }}>
                        {/* Ana satır */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", flexWrap: "wrap" as const }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, border: "1px solid", ...(log.source === "KRIKO" ? { background: "rgba(251,191,36,.1)", borderColor: "rgba(251,191,36,.3)", color: "#fbbf24" } : { background: "rgba(59,130,246,.1)", borderColor: "rgba(59,130,246,.3)", color: "#60a5fa" }) }}>
                              {log.source === "KRIKO" ? "Kriko" : "Fireflies"}
                            </span>
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, border: "0.5px solid var(--rule)", background: log.trigger === "CRON" ? "rgba(99,102,241,.12)" : "transparent", color: log.trigger === "CRON" ? "#818cf8" : "var(--fg-faint)" }}>
                              {log.trigger}
                            </span>
                            {/* Durum etiketi */}
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, flexShrink: 0 }}>
                              {sc.label}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {fmtDate(log.startedAt)} · <b style={{ color: "var(--fg)" }}>{log.date}</b>
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                            <span style={{ color: "var(--fg-faint)" }}>📥 <b style={{ color: "#34d399" }}>{log.imported ?? 0}</b></span>
                            <span style={{ color: "var(--fg-faint)" }}>⚠️ <b style={{ color: "#fbbf24" }}>{log.unassigned ?? 0}</b></span>
                            <span style={{ color: "var(--fg-faint)" }}>⏭ <b>{log.skipped ?? 0}</b></span>
                            {log.failed > 0 && <span style={{ color: "var(--fg-faint)" }}>❌ <b style={{ color: "#f87171" }}>{log.failed}</b></span>}
                          </div>
                        </div>
                        {/* Açıklama / hata detayı */}
                        {(descLine || log.error) && (
                          <div style={{ padding: "7px 12px 9px", borderTop: `0.5px solid ${sc.border}`, background: sc.bg }}>
                            {descLine && <p style={{ fontSize: 10.5, color: sc.color, margin: 0, lineHeight: 1.5 }}>{descLine}</p>}
                            {log.error && (
                              <>
                                <p style={{ fontSize: 9.5, fontWeight: 700, color: sc.color, margin: "4px 0 2px", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{t.syncErrDetail}</p>
                                <p style={{ fontSize: 10.5, color: "#f87171", margin: 0, lineHeight: 1.5, wordBreak: "break-all" as const, fontFamily: "monospace" }}>{log.error}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {activeTab === "recentCalls" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className={styles.sectHd} style={{ marginBottom: 0 }}><h2>{t.recentCallsHeading}</h2></div>
            <button onClick={fetchRecentCalls} className={styles.btnSmall} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="refresh" size={12} />{t.refresh}
            </button>
          </div>

          {recentCallsLoading ? (
            <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>{t.loading}</p>
          ) : !recentCallsData ? (
            <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>{t.recentCallsEmpty}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {(["KRIKO", "FIREFLIES"] as const).map(source => {
                const d = source === "KRIKO" ? recentCallsData.kriko : recentCallsData.fireflies;
                const isKriko = source === "KRIKO";
                const accentColor = isKriko ? "#fbbf24" : "#60a5fa";
                const accentBg = isKriko ? "rgba(251,191,36,.1)" : "rgba(59,130,246,.1)";
                const accentBorder = isKriko ? "rgba(251,191,36,.3)" : "rgba(59,130,246,.3)";
                return (
                  <div key={source} className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
                    {/* Başlık */}
                    <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>{source === "KRIKO" ? "Kriko" : "Fireflies"}</span>
                        <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{t.recentCallsTotal(d.total)}</span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: d.duplicateCount === 0 ? "rgba(52,211,153,.1)" : "rgba(248,113,113,.1)",
                        border: `1px solid ${d.duplicateCount === 0 ? "rgba(52,211,153,.3)" : "rgba(248,113,113,.3)"}`,
                        color: d.duplicateCount === 0 ? "#34d399" : "#f87171",
                      }}>
                        {d.duplicateCount === 0 ? t.recentCallsDupOk : t.recentCallsDupWarn(d.duplicateCount)}
                      </span>
                    </div>

                    {/* Liste */}
                    {d.items.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--fg-faint)", padding: "20px 16px" }}>{t.recentCallsEmpty}</p>
                    ) : (
                      <div style={{ maxHeight: 480, overflowY: "auto" }}>
                        {d.items.map((item: any, idx: number) => (
                          <div key={item.id} style={{
                            padding: "10px 16px",
                            borderBottom: idx < d.items.length - 1 ? "0.5px solid var(--rule)" : "none",
                            background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,.015)",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                {item.unassigned && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(251,191,36,.12)", color: "#fbbf24", flexShrink: 0 }}>
                                    {t.recentCallsUnassigned}
                                  </span>
                                )}
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.agentName}
                                </span>
                                {item.externalAgentName && item.externalAgentName !== item.agentName && (
                                  <span style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    ({item.externalAgentName})
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: item.score >= 75 ? "#34d399" : item.score >= 50 ? "#fbbf24" : "#f87171", flexShrink: 0 }}>
                                %{item.score}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                                {new Date(item.callDate).toLocaleDateString(t.locale, { day: "2-digit", month: "short" })}
                              </span>
                              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: accentBg, border: `0.5px solid ${accentBorder}`, color: accentColor, fontFamily: "'JetBrains Mono', monospace" }}>
                                {item.callDuration}
                              </span>
                              <span style={{ fontSize: 10, color: "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                {item.customerName}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {d.total > 25 && (
                      <div style={{ padding: "8px 16px", borderTop: "0.5px solid var(--rule)", fontSize: 10, color: "var(--fg-faint)", textAlign: "center" as const }}>
                        {t.recentCallsSubtitle(25)} · {t.recentCallsTotal(d.total)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "reclassify" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className={styles.sectHd}><h2>{t.reclassifyHeader}</h2></div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--fg-faint)" }}>{t.reclassifyScanDesc}</p>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <button
              onClick={handleScanClassifications}
              disabled={scanLoading || bulkFixing}
              className={styles.btnPrimary}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="refresh" size={13} />
              {scanLoading ? t.reclassifyScanning : t.reclassifyScan}
            </button>

            {suspiciousItems.length > 0 && (
              <button
                onClick={handleFixAll}
                disabled={bulkFixing || scanLoading}
                className={styles.btnSmall}
                style={{ display: "flex", alignItems: "center", gap: 6, color: "#fbbf24", borderColor: "rgba(251,191,36,.3)" }}
              >
                <Icon name="spark" size={12} />
                {t.reclassifyFixAll(suspiciousItems.length)}
              </button>
            )}
          </div>

          {scanMsg && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-dim)" }}>{scanMsg}</p>
          )}

          {fixProgress && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--fg-faint)" }}>{t.reclassifyProgress(fixProgress.done, fixProgress.total)}</p>
              <div style={{ height: 4, background: "var(--rule)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(fixProgress.done / fixProgress.total) * 100}%`, background: "var(--accent)", transition: "width .3s ease", borderRadius: 2 }} />
              </div>
            </div>
          )}

          {suspiciousItems.length === 0 && scanMsg && !scanLoading && (
            <p style={{ margin: 0, fontSize: 13, color: "#34d399" }}>{t.reclassifyNoSuspicious}</p>
          )}

          {suspiciousItems.length > 0 && (
            <div style={{ overflowX: "auto" as const }}>
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                    {["Danışman", "Müşteri", "Mevcut", "Öneri", ""].map((h, i) => (
                      <th key={i} style={{ padding: "8px 10px", textAlign: "left" as const, fontSize: 11, color: "var(--fg-faint)", fontWeight: 600, whiteSpace: "nowrap" as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suspiciousItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: "0.5px solid var(--rule)" }}>
                      <td style={{ padding: "10px 10px", color: "var(--fg)" }}>{item.agentName}</td>
                      <td style={{ padding: "10px 10px", color: "var(--fg-dim)" }}>{item.customerName}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "rgba(248,113,113,.1)", border: "0.5px solid rgba(248,113,113,.3)", color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }}>
                          {item.storedCallType === "FIRST_CALL" ? "1ST" : "2ND"} ❌
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "rgba(52,211,153,.1)", border: "0.5px solid rgba(52,211,153,.3)", color: "#34d399", fontFamily: "'JetBrains Mono', monospace" }}>
                          {item.suggestedCallType === "FIRST_CALL" ? "1ST" : "2ND"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" as const }}>
                          <a
                            href={`/evaluation/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
                          >
                            {t.reclassifyGoTo} ↗
                          </a>
                          <button
                            onClick={() => handleVerifyOne(item)}
                            disabled={verifyingId === item.id || fixingId === item.id || bulkFixing}
                            className={styles.btnSmall}
                            style={{ fontSize: 11, padding: "3px 10px", color: "#34d399", borderColor: "rgba(52,211,153,.4)" }}
                            title={lang === "tr" ? "Tür doğru — listeden kaldır" : "Type is correct — remove from list"}
                          >
                            {verifyingId === item.id ? "..." : t.reclassifyDone}
                          </button>
                          <button
                            onClick={() => handleFixOne(item)}
                            disabled={fixingId === item.id || verifyingId === item.id || bulkFixing}
                            className={styles.btnSmall}
                            style={{ fontSize: 11, padding: "3px 10px" }}
                          >
                            {fixingId === item.id ? "..." : t.reclassifyFix}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
