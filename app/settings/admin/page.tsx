"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const roleColor = (role: string) =>
  ({
    AGENT: "text-primary bg-primary/10 border-primary/20",
    TEAM_LEADER: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    MANAGER: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    ADMIN: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  }[role] || "text-on-surface-variant bg-surface-container border-outline-variant");

const formatDateTime = (iso: string, locale = "tr-TR") => {
  const d = new Date(iso);
  return d.toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ADMIN_T = {
  tr: {
    pageTitle: "Admin Ayarları",
    tabUsers: "Kullanıcılar", tabPrompts: "Promptlar", tabLogs: "Aktivite Logları",
    tabFeedbacks: "Geri Bildirimler", tabSync: "Senkronizasyon", tabSyncHistory: "Senkron Geçmişi",
    addUser: "Yeni Kullanıcı Ekle", fullName: "Ad Soyad", email: "E-posta",
    password: "Şifre", role: "Rol", team: "Takım (opsiyonel)",
    selectTeamLeader: "— Takım lideri seçin —",
    selectManager: "— Manager seçin —",
    managerLabel: "Manager (opsiyonel)",
    noManager: "Atama yok",
    addUserBtn: "Kullanıcı Ekle",
    noUsers: "Henüz kullanıcı yok.", lastLogin: "Son giriş:", editUser: "Kullanıcıyı Düzenle",
    newPassword: "Yeni Şifre (opsiyonel)", newPasswordPlaceholder: "Değiştirmek için girin",
    save: "Kaydet", cancel: "İptal",
    editPromptTitle: "Prompt Düzenle", newPromptTitle: "Yeni Prompt Ekle",
    promptName: "Prompt Adı", callType: "Çağrı Tipi", version: "Versiyon", content: "İçerik",
    promptContentPlaceholder: "Prompt içeriğini buraya yazın...",
    update: "Güncelle", create: "Oluştur",
    noPrompts: "Henüz prompt eklenmemiş.", chars: "karakter",
    active: "Aktif", passive: "Pasif", edit: "Düzenle", general: "Genel",
    viewContent: "İçeriği Göster", hideContent: "Gizle",
    noLogs: "Henüz aktivite logu yok.", noFilteredLogs: "Filtreyle eşleşen kayıt bulunamadı.",
    allUsers: "Tüm Kullanıcılar", allActions: "Tüm İşlemler", refresh: "Yenile", clearFilter: "Filtreyi Temizle",
    noFeedbacks: "Henüz geri bildirim yok.", readMore: "Devamını görmek için tıklayın",
    krikoNotConfigured: "Kriko API yapılandırılmamış",
    krikoActive: "Kriko API aktif — Otomatik senkron her 30 dakikada bir çalışır",
    krikoNotConfiguredDesc: "Lütfen .env.local içine KRIKO_API_KEY ve KRIKO_API_BASE ekleyin, ardından sunucuyu yeniden başlatın.",
    krikoActiveDesc: "Filtre: status=completed, süre ≥ 2 dk. Eşleşmeyen danışmanlar 'Atanmamış' olarak kaydedilir.",
    meetNotConfigured: "Google Meet alma yapılandırılmamış",
    meetActive: "Google Meet aktif — Apps Script transkript gönderdikçe kuyruğa düşer",
    meetNotConfiguredDesc: "Lütfen .env.local içine MEET_INGEST_SECRET ekleyin.",
    meetActiveDesc: (uc: number) => `Danışman driveEmail ile eşleşir; eşleşmeyen çağrılar 'Atanmamış' olarak kaydedilir.${uc > 0 ? ` · ${uc} atanmamış çağrı var.` : ""}`,
    meetQueueTitle: "Kuyruk", meetDrain: "Kuyruğu Çevir", meetStop: "Durdur",
    meetPendingCount: (n: number) => `${n} transkript işlenmeyi bekliyor`,
    meetQueueEmpty: "Kuyrukta bekleyen transkript yok.",
    meetExhaustedCount: (n: number) => `${n} satır 3 denemede de tamamlanamadı — kuyruktan düştü`,
    meetRequeue: "Sıkışanları Yeniden Kuyruğa Al", meetRequeuing: "Kuyruğa alınıyor...",
    meetRequeueDone: (n: number) => `${n} satır yeniden kuyruğa alındı.`,
    meetLastRecord: (d: string) => `Son kayıt: ${d}`, meetNoRecordYet: "Henüz kayıt gelmedi.",
    meetSkipReasons: "Elenen Sebepler",
    meetDriveEmailError: "Drive e-postası bağlanamadı.",
    allMeetAssigned: "Tüm Google Meet çağrıları danışmanlara atanmış.",
    manualSync: "Manuel Senkronizasyon", datePlaceholder: "Tarih (boş = bugün)",
    syncing: "Senkronize Ediliyor...", syncNow: "Şimdi Senkronize Et",
    totalFetched: "Toplam Çekilen", analyzable: "Analiz Edilebilir",
    importedLabel: "İmport", unassignedLabel: "Atanmamış", failedLabel: "Başarısız",
    unassignedCalls: "Atanmamış Çağrılar", allAssigned: "Tüm çağrılar danışmanlara atanmış.",
    transcript: "Transkript", selectAgent: "— Danışman seç —", assign: "Ata",
    syncHistoryTitle: "Tüm Senkronizasyon Kayıtları", noSyncHistory: "Henüz senkron yapılmamış.",
    tabReclassify: "Şüpheli Sınıflandırmalar",
    reclassifyScan: "Tara",
    reclassifyScanning: "Taranıyor...",
    reclassifyNoSuspicious: "Şüpheli sınıflandırma bulunamadı.",
    reclassifyFix: "Düzelt",
    reclassifyFixAll: (n: number) => `Tümünü Düzelt (${n} değerlendirme)`,
    reclassifyFixing: "Düzeltiliyor...",
    reclassifyProgress: (done: number, total: number) => `${done} / ${total} tamamlandı`,
    reclassifyFixed: "Düzeltildi",
    reclassifyHeader: ["Danışman", "Müşteri", "Mevcut", "Öneri", "Aksiyon"] as string[],
    reclassifyScanDesc: "Transkriptlerde anahtar kelimeler aranır. Gemini kullanılmaz, API maliyeti yoktur.",
    reclassifyScanResult: (total: number, count: number) => `${total} değerlendirme tarandı, ${count} şüpheli bulundu.`,
    fillAllFields: "Tüm alanları doldurun.", userCreated: "Kullanıcı oluşturuldu!",
    userUpdated: "Kullanıcı güncellendi!", updateFailed: "Güncelleme başarısız.", errorOccurred: "Hata oluştu.",
    promptCreated: "Prompt oluşturuldu!", promptUpdated: "Prompt güncellendi!",
    promptCreateFailed: "Oluşturma başarısız.", promptUpdateFailed: "Güncelleme başarısız.",
    syncStarted: "Senkronizasyon başlatıldı, lütfen bekleyin...",
    krikoSyncStarted: "Senkronizasyon başlatıldı, lütfen bekleyin (1-3 dakika sürebilir)...",
    syncFailed: "Senkronizasyon başarısız.",
    syncDone: (imp: number, una: number, sk: number, fa: number) =>
      `✅ Tamamlandı: ${imp} import, ${una} atanmamış, ${sk} atlandı, ${fa} başarısız.`,
    roles: { AGENT: "Danışman", TEAM_LEADER: "Takım Lideri", MANAGER: "Müdür", ADMIN: "Admin" } as Record<string, string>,
    feedbackCats: { evaluation: "Değerlendirme", ui: "Arayüz", report: "Raporlar", scoring: "Puanlama", other: "Diğer" } as Record<string, string>,
    locale: "tr-TR",
  },
  en: {
    pageTitle: "Admin Settings",
    tabUsers: "Users", tabPrompts: "Prompts", tabLogs: "Activity Logs",
    tabFeedbacks: "Feedbacks", tabSync: "Synchronization", tabSyncHistory: "Sync History",
    addUser: "Add New User", fullName: "Full Name", email: "Email",
    password: "Password", role: "Role", team: "Team (optional)",
    selectTeamLeader: "— Select team leader —",
    selectManager: "— Select manager —",
    managerLabel: "Manager (optional)",
    noManager: "No assignment",
    addUserBtn: "Add User",
    noUsers: "No users yet.", lastLogin: "Last login:", editUser: "Edit User",
    newPassword: "New Password (optional)", newPasswordPlaceholder: "Enter to change",
    save: "Save", cancel: "Cancel",
    editPromptTitle: "Edit Prompt", newPromptTitle: "New Prompt",
    promptName: "Prompt Name", callType: "Call Type", version: "Version", content: "Content",
    promptContentPlaceholder: "Enter prompt content here...",
    update: "Update", create: "Create",
    noPrompts: "No prompts added yet.", chars: "characters",
    active: "Active", passive: "Inactive", edit: "Edit", general: "General",
    viewContent: "View Content", hideContent: "Hide",
    noLogs: "No activity logs yet.", noFilteredLogs: "No records match the filter.",
    allUsers: "All Users", allActions: "All Actions", refresh: "Refresh", clearFilter: "Clear Filter",
    noFeedbacks: "No feedbacks yet.", readMore: "Click to read more",
    krikoNotConfigured: "Kriko API not configured",
    krikoActive: "Kriko API active — Auto-sync runs every 30 minutes",
    krikoNotConfiguredDesc: "Add KRIKO_API_KEY and KRIKO_API_BASE to .env.local, then restart the server.",
    krikoActiveDesc: "Filter: status=completed, duration ≥ 2 min. Unmatched agents saved as 'Unassigned'.",
    meetNotConfigured: "Google Meet ingest not configured",
    meetActive: "Google Meet active — queued as Apps Script sends transcripts",
    meetNotConfiguredDesc: "Add MEET_INGEST_SECRET to .env.local.",
    meetActiveDesc: (uc: number) => `Matched by consultant driveEmail; unmatched calls saved as 'Unassigned'.${uc > 0 ? ` · ${uc} unassigned calls.` : ""}`,
    meetQueueTitle: "Queue", meetDrain: "Drain Queue", meetStop: "Stop",
    meetPendingCount: (n: number) => `${n} transcript${n !== 1 ? "s" : ""} waiting to be processed`,
    meetQueueEmpty: "Nothing waiting in the queue.",
    meetExhaustedCount: (n: number) => `${n} row${n !== 1 ? "s" : ""} failed all 3 attempts — stuck outside the queue`,
    meetRequeue: "Requeue Stuck Rows", meetRequeuing: "Requeuing...",
    meetRequeueDone: (n: number) => `${n} row${n !== 1 ? "s" : ""} requeued.`,
    meetLastRecord: (d: string) => `Last record: ${d}`, meetNoRecordYet: "No records yet.",
    meetSkipReasons: "Skip Reasons",
    meetDriveEmailError: "Could not link Drive email.",
    allMeetAssigned: "All Google Meet calls assigned to agents.",
    manualSync: "Manual Synchronization", datePlaceholder: "Date (empty = today)",
    syncing: "Syncing...", syncNow: "Sync Now",
    totalFetched: "Total Fetched", analyzable: "Analyzable",
    importedLabel: "Imported", unassignedLabel: "Unassigned", failedLabel: "Failed",
    unassignedCalls: "Unassigned Calls", allAssigned: "All calls assigned to agents.",
    transcript: "Transcript", selectAgent: "— Select agent —", assign: "Assign",
    syncHistoryTitle: "All Sync Records", noSyncHistory: "No syncs performed yet.",
    tabReclassify: "Suspicious Classifications",
    reclassifyScan: "Scan",
    reclassifyScanning: "Scanning...",
    reclassifyNoSuspicious: "No suspicious classifications found.",
    reclassifyFix: "Fix",
    reclassifyFixAll: (n: number) => `Fix All (${n} evaluations)`,
    reclassifyFixing: "Fixing...",
    reclassifyProgress: (done: number, total: number) => `${done} / ${total} completed`,
    reclassifyFixed: "Fixed",
    reclassifyHeader: ["Consultant", "Customer", "Current", "Suggestion", "Action"] as string[],
    reclassifyScanDesc: "Keywords are scanned in transcripts. No Gemini calls, no API cost.",
    reclassifyScanResult: (total: number, count: number) => `${total} evaluations scanned, ${count} suspicious found.`,
    fillAllFields: "Please fill in all fields.", userCreated: "User created!",
    userUpdated: "User updated!", updateFailed: "Update failed.", errorOccurred: "An error occurred.",
    promptCreated: "Prompt created!", promptUpdated: "Prompt updated!",
    promptCreateFailed: "Creation failed.", promptUpdateFailed: "Update failed.",
    syncStarted: "Sync started, please wait...",
    krikoSyncStarted: "Sync started, please wait (may take 1-3 minutes)...",
    syncFailed: "Sync failed.",
    syncDone: (imp: number, una: number, sk: number, fa: number) =>
      `✅ Completed: ${imp} imported, ${una} unassigned, ${sk} skipped, ${fa} failed.`,
    roles: { AGENT: "Agent", TEAM_LEADER: "Team Leader", MANAGER: "Manager", ADMIN: "Admin" } as Record<string, string>,
    feedbackCats: { evaluation: "Evaluation", ui: "Interface", report: "Reports", scoring: "Scoring", other: "Other" } as Record<string, string>,
    locale: "en-GB",
  },
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

const SECTION_ICONS: Record<string, string> = {
  home: "home", evaluations: "assignment", scores: "grade",
  reports: "insert_chart", teamreports: "bar_chart", team: "group",
  feedback: "flag", status: "call", batch: "upload",
  admin: "settings", peer: "compare_arrows", feedbacks: "inbox", sync: "sync",
};

const ACTION_LABELS: Record<"tr" | "en", Record<string, string>> = {
  tr: { LOGIN: "Giriş Yapıldı", LOGOUT: "Çıkış Yapıldı", PAGE_VIEW: "Sayfa Görüntülendi" },
  en: { LOGIN: "Logged In", LOGOUT: "Logged Out", PAGE_VIEW: "Page Viewed" },
};

// GET /api/calls/ingest-meet'in döndürdüğü durum şekli.
type MeetStatus = {
  configured: boolean;
  pending: number;
  skipped: number;
  imported: number;
  exhausted: number;
  unassignedCount: number;
  sonKayit: string | null;
  elenenSebepler: { skipReason: string | null; _count: number }[];
};

function AdminSettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const initialTab = (rawTab === "kriko" || rawTab === "fireflies" ? "sync" : rawTab ?? "users") as "users" | "prompts" | "logs" | "feedbacks" | "sync" | "syncHistory" | "reclassify";
  const [activeTab, setActiveTab] = useState<"users" | "prompts" | "logs" | "feedbacks" | "sync" | "syncHistory" | "reclassify">(initialTab);

  // Auth / theme / lang
  const [user, setUser] = useState<any>(null);
  const [lang, setLang] = useState<"tr" | "en">("tr");

  // Users tab state
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("AGENT");
  const [newLeaderId, setNewLeaderId] = useState("");
  const [newManagerId, setNewManagerId] = useState("");
  const [addUserMsg, setAddUserMsg] = useState("");

  // Edit user state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editMsg, setEditMsg] = useState("");
  const [editStatus, setEditStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Prompts tab state
  const [prompts, setPrompts] = useState<any[]>([]);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState("");
  const [promptCallType, setPromptCallType] = useState("SECOND_CALL");
  const [promptVersion, setPromptVersion] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [promptMsg, setPromptMsg] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  // Logs tab state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logUserFilter, setLogUserFilter] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("");

  // Feedbacks tab state
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  // Kriko tab state
  const [krikoStatus, setKrikoStatus] = useState<any>(null);
  const [krikoSyncing, setKrikoSyncing] = useState(false);
  const [krikoSyncDate, setKrikoSyncDate] = useState(""); // YYYY-MM-DD; boş = bugün
  const [krikoMsg, setKrikoMsg] = useState("");
  const [krikoLastResult, setKrikoLastResult] = useState<any>(null);
  const [unassignedItems, setUnassignedItems] = useState<any[]>([]);
  const [reassignSelections, setReassignSelections] = useState<Record<string, string>>({});
  const [expandedUnassignedId, setExpandedUnassignedId] = useState<string | null>(null);

  // Google Meet tab state (itme modeli — keşif yok, kuyruk admin panelden çevrilir)
  const [meetStatus, setMeetStatus] = useState<MeetStatus | null>(null);
  const [meetRunning, setMeetRunning] = useState(false);
  const [meetPending, setMeetPending] = useState(0);
  const [meetRequeuing, setMeetRequeuing] = useState(false);
  const [meetRequeueMsg, setMeetRequeueMsg] = useState("");
  const meetStopRef = useRef(false);

  // Reclassify tab state
  const [suspiciousItems, setSuspiciousItems] = useState<Array<{
    id: string;
    agentName: string;
    customerName: string;
    storedCallType: string;
    suggestedCallType: string;
  }>>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [bulkFixing, setBulkFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState<{ done: number; total: number } | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);

  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem("estenove-theme");
    const dark = savedTheme !== "light";
    document.documentElement.classList.toggle("light", !dark);

    const storedLang = localStorage.getItem("estenove-lang");
    if (storedLang === "en") setLang("en");

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

  const fetchKrikoStatus = async () => {
    const res = await fetch("/api/calls/sync");
    if (res.ok) setKrikoStatus(await res.json());
  };

  const meetDurumunuYenile = async () => {
    const res = await fetch("/api/calls/ingest-meet");
    if (res.ok) setMeetStatus(await res.json());
  };

  const fetchUnassigned = async () => {
    const res = await fetch("/api/calls/unassigned");
    if (res.ok) {
      const data = await res.json();
      setUnassignedItems(data.items || []);
    }
  };

  /* ── google meet kuyruğu (itme modeli) ──
     Naif bir for(;;) değil: platform isteği keserse gövde JSON değildir,
     ağ koparsa döngü durmalı, üst üste sonuçsuz turda çekilmeli — aynı üç
     arıza AdminPanel.tsx'teki rescore döngüsünde çözülmüştü, burada da
     aynı desen uygulanıyor. */
  async function meetKuyrugunuCevir() {
    meetStopRef.current = false;
    setMeetRunning(true);
    const ARDISIK_HATA_SINIRI = 3;
    let ardisik = 0;

    try {
      while (!meetStopRef.current) {
        let res: Response;
        try {
          res = await fetch("/api/calls/ingest-meet/next", { method: "POST" });
        } catch {
          // Ağ koptu. Döngüyü durdur; sunucu tarafında kilit 5 dakika sonra
          // kendiliğinden serbest kalıyor, düğmeye yeniden basmak devam ettirir.
          break;
        }

        // Platform kestiyse gövde JSON değildir → null döner.
        const body = await res.json().catch(() => null);

        if (!res.ok || !body) {
          ardisik++;
          if (ardisik >= ARDISIK_HATA_SINIRI) break;
          continue;
        }

        ardisik = 0;
        if (!body.processed) break;              // sunucu AÇIKÇA "kalan 0" dedi
        setMeetPending(body.remaining);
        if (body.remaining === 0) break;
      }
    } finally {
      setMeetRunning(false);
      meetStopRef.current = false;
      await meetDurumunuYenile();
    }
  }

  // Hakkı tükenmiş (PENDING + attempts >= 3) satırlar hiçbir sayaca girmiyor
  // ve kuyruğa kendiliğinden dönmüyor — bilinçli bir insan eylemi gerekiyor.
  const handleMeetRequeue = async () => {
    const tMsg = ADMIN_T[lang];
    setMeetRequeuing(true);
    setMeetRequeueMsg("");
    try {
      const res = await fetch("/api/calls/ingest-meet/requeue", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMeetRequeueMsg(tMsg.meetRequeueDone(data.requeued ?? 0));
      else setMeetRequeueMsg(data.error || tMsg.errorOccurred);
    } catch {
      setMeetRequeueMsg(tMsg.errorOccurred);
    } finally {
      setMeetRequeuing(false);
      await meetDurumunuYenile();
    }
  };

  const handleKrikoSync = async () => {
    const tMsg = ADMIN_T[lang];
    setKrikoSyncing(true);
    setKrikoMsg(tMsg.krikoSyncStarted);
    setKrikoLastResult(null);
    try {
      const body: any = {};
      if (krikoSyncDate) body.date = krikoSyncDate;
      const res = await fetch("/api/calls/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setKrikoMsg("Hata: " + (data.error || tMsg.syncFailed));
      } else {
        setKrikoLastResult(data);
        setKrikoMsg(tMsg.syncDone(data.imported, data.unassigned, data.skipped, data.failed));
        fetchKrikoStatus();
        fetchUnassigned();
      }
    } catch (e: any) {
      setKrikoMsg("Hata: " + e.message);
    } finally {
      setKrikoSyncing(false);
    }
  };

  const handleReassign = async (evalId: string, driveEmail?: string) => {
    const agentId = reassignSelections[evalId];
    if (!agentId) return;
    const res = await fetch(`/api/evaluations/${evalId}/reassign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    if (res.ok) {
      setUnassignedItems((prev) => prev.filter((i) => i.id !== evalId));
      setReassignSelections((prev) => {
        const next = { ...prev };
        delete next[evalId];
        return next;
      });
    }
    // Google Meet'ten gelen atanmamış bir çağrıda danışman atandığında
    // driveEmail'i de bağlıyoruz — hattın kendini onaran parçası. Bu adım
    // başarısız olsa bile üstteki atama GERİ ALINMAZ; danışman atanmıştır,
    // yalnızca otomatik eşleme kurulamamıştır.
    if (res.ok && driveEmail) {
      const tMsg = ADMIN_T[lang];
      const r = await fetch(`/api/users/${agentId}/drive-email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveEmail }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(e.error ?? tMsg.meetDriveEmailError);
      }
    }
  };

  const handleAddUser = async () => {
    const tMsg = ADMIN_T[lang];
    if (!newName || !newEmail || !newPassword) {
      setAddUserMsg(tMsg.fillAllFields);
      return;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        leaderId: newLeaderId || null,
        managerId: newRole === "TEAM_LEADER" ? (newManagerId || null) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setAddUserMsg(data.error || tMsg.errorOccurred); return; }
    setAddUserMsg(tMsg.userCreated);
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("AGENT"); setNewLeaderId("");
    setNewManagerId("");
    fetchUsers();
  };

  const handleUserRowClick = (u: any) => {
    if (editingUser?.id === u.id) {
      // collapse if same user clicked again
      setEditingUser(null);
      setEditManagerId("");
      setEditMsg("");
      setEditStatus("idle");
      return;
    }
    setEditingUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role || "AGENT");
    setEditTeamId(u.teamId || u.team?.id || "");
    setEditManagerId(u.managerId || "");
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
    if (editRole === "TEAM_LEADER") body.managerId = editManagerId || null;
    if (editNewPassword) body.newPassword = editNewPassword;
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setEditStatus("error");
      setEditMsg(data.error || ADMIN_T[lang].updateFailed);
      return;
    }
    setEditStatus("success");
    setEditMsg(ADMIN_T[lang].userUpdated);
    setEditNewPassword("");
    await fetchUsers();
    // Re-sync editingUser from fresh list
    const refreshRes = await fetch("/api/users");
    const refreshData = await refreshRes.json();
    const updated = (refreshData.users || []).find((u: any) => u.id === editingUser.id);
    if (updated) setEditingUser(updated);
  };

  const handleSavePrompt = async () => {
    const tMsg = ADMIN_T[lang];
    if (!promptName || !promptCallType || !promptContent || !promptVersion) {
      setPromptMsg(tMsg.fillAllFields);
      return;
    }
    if (editingPromptId) {
      const res = await fetch(`/api/prompts/${editingPromptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: promptName, content: promptContent, version: promptVersion, isActive: true }),
      });
      if (!res.ok) { setPromptMsg(tMsg.promptUpdateFailed); return; }
      setPromptMsg(tMsg.promptUpdated);
    } else {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: promptName, callType: promptCallType, content: promptContent, version: promptVersion }),
      });
      if (!res.ok) { setPromptMsg(tMsg.promptCreateFailed); return; }
      setPromptMsg(tMsg.promptCreated);
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

  const handleScanClassifications = async () => {
    setScanLoading(true);
    setScanMsg("");
    setSuspiciousItems([]);
    try {
      const res = await fetch("/api/admin/scan-classifications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || ADMIN_T[lang].errorOccurred);
      setSuspiciousItems(data.items ?? []);
      setScanMsg(ADMIN_T[lang].reclassifyScanResult(data.total, data.items?.length ?? 0));
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
        throw new Error(data.error || ADMIN_T[lang].errorOccurred);
      }
      setSuspiciousItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      setScanMsg(err.message);
    } finally {
      setFixingId(null);
    }
  };

  const handleFixAll = async () => {
    if (bulkFixing || suspiciousItems.length === 0) return;
    setBulkFixing(true);
    setFixProgress({ done: 0, total: suspiciousItems.length });
    const items = [...suspiciousItems];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const res = await fetch(`/api/evaluations/${item.id}/re-classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callType: item.suggestedCallType }),
        });
        if (res.ok) setSuspiciousItems((prev) => prev.filter((x) => x.id !== item.id));
      } catch { /* continue */ }
      setFixProgress({ done: i + 1, total: items.length });
      if (i < items.length - 1) await new Promise((r) => setTimeout(r, 1000));
    }
    setBulkFixing(false);
    setFixProgress(null);
  };

  const handleTabChange = (tab: "users" | "prompts" | "logs" | "feedbacks" | "sync" | "syncHistory" | "reclassify") => {
    setActiveTab(tab);
    setAddUserMsg("");
    setPromptMsg("");
    if (tab === "logs") fetchLogs();
    if (tab === "feedbacks") fetchFeedbacks();
    if (tab === "sync") { fetchKrikoStatus(); meetDurumunuYenile(); fetchUnassigned(); }
    if (tab === "syncHistory") { fetchKrikoStatus(); meetDurumunuYenile(); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-outline border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const filteredLogs = logs.filter(l =>
    (!logUserFilter || l.user?.id === logUserFilter) &&
    (!logActionFilter || l.action === logActionFilter)
  );

  const t = ADMIN_T[lang];
  const roleLabel = (role: string) => t.roles[role] || role;
  const feedbackCategoryLabel = (cat: string) => t.feedbackCats[cat] || cat;
  const fmtDate = (iso: string) => formatDateTime(iso, t.locale);

  const managers = users.filter((u: any) => u.role === "MANAGER");
  const managerOptions =
    user?.role === "MANAGER"
      ? managers.filter((m: any) => m.id === user.id)
      : managers;

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
            <h1 className="text-base font-bold tracking-tight">{t.pageTitle}</h1>
            <p className="text-xs text-on-surface-variant">{user.name} · {roleLabel(user.role)}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-2">
          {(["users", "prompts", "logs", "feedbacks", "sync", "syncHistory", "reclassify"] as const).map((tab) => {
            const tabMeta = {
              users: { icon: "group", label: t.tabUsers },
              prompts: { icon: "edit_note", label: t.tabPrompts },
              logs: { icon: "history", label: t.tabLogs },
              feedbacks: { icon: "inbox", label: t.tabFeedbacks },
              sync: { icon: "sync", label: t.tabSync },
              syncHistory: { icon: "event_note", label: t.tabSyncHistory },
              reclassify: { icon: "find_replace", label: t.tabReclassify },
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
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">{t.addUser}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.fullName}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setAddUserMsg(""); }}
                    placeholder={t.fullName}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.email}</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setAddUserMsg(""); }}
                    placeholder="ornek@estenove.com"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.password}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setAddUserMsg(""); }}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.role}</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      setNewRole(e.target.value);
                      if (e.target.value !== "AGENT") setNewLeaderId("");
                      if (e.target.value !== "TEAM_LEADER") setNewManagerId("");
                    }}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="AGENT">{t.roles.AGENT}</option>
                    <option value="TEAM_LEADER">{t.roles.TEAM_LEADER}</option>
                    <option value="MANAGER">{t.roles.MANAGER}</option>
                    <option value="ADMIN">{t.roles.ADMIN}</option>
                  </select>
                </div>
                {newRole === "AGENT" && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.team}</label>
                    <select
                      value={newLeaderId}
                      onChange={(e) => setNewLeaderId(e.target.value)}
                      className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    >
                      <option value="">{t.selectTeamLeader}</option>
                      {users.filter((u) => u.role === "TEAM_LEADER").map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {newRole === "TEAM_LEADER" && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-on-surface-variant font-semibold block mb-1">
                      {t.managerLabel}
                    </label>
                    <select
                      value={newManagerId}
                      onChange={(e) => setNewManagerId(e.target.value)}
                      className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    >
                      <option value="">{t.selectManager}</option>
                      {managerOptions.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
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
                  {t.addUserBtn}
                </button>
                {addUserMsg && (
                  <p className={`text-sm ${addUserMsg === t.userCreated ? "text-emerald-400" : "text-error"}`}>
                    {addUserMsg}
                  </p>
                )}
              </div>
            </div>

            {/* User list */}
            <div className="bg-surface-container rounded-3xl p-4 space-y-1">
              {users.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">{t.noUsers}</p>
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
                          <p className="text-xs text-on-surface-variant">
                            {u.email}
                            {u.team ? ` · ${u.team.name}` : ""}
                            {u.role === "TEAM_LEADER" && u.manager ? ` · ${u.manager.name}` : ""}
                          </p>
                          {u.lastLoginAt && (
                            <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
                              {t.lastLogin} {fmtDate(u.lastLoginAt)}
                            </p>
                          )}
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
                        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{t.editUser}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.fullName}</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => { setEditName(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                              className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.email}</label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => { setEditEmail(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                              className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.role}</label>
                            <select
                              value={editRole}
                              onChange={(e) => {
                                setEditRole(e.target.value);
                                if (e.target.value !== "AGENT") setEditTeamId("");
                                if (e.target.value !== "TEAM_LEADER") setEditManagerId("");
                                setEditMsg("");
                                setEditStatus("idle");
                              }}
                              className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            >
                              <option value="AGENT">{t.roles.AGENT}</option>
                              <option value="TEAM_LEADER">{t.roles.TEAM_LEADER}</option>
                              <option value="MANAGER">{t.roles.MANAGER}</option>
                              <option value="ADMIN">{t.roles.ADMIN}</option>
                            </select>
                          </div>
                          {editRole === "AGENT" && (
                            <div>
                              <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.team}</label>
                              <select
                                value={editTeamId}
                                onChange={(e) => { setEditTeamId(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                                className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                              >
                                <option value="">{t.selectTeamLeader}</option>
                                {teams.filter((t) => t.leader).map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.leader.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {editRole === "TEAM_LEADER" && (
                            <div>
                              <label className="text-xs text-on-surface-variant font-semibold block mb-1">
                                {t.managerLabel}
                              </label>
                              <select
                                value={editManagerId}
                                onChange={(e) => { setEditManagerId(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                                className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                              >
                                <option value="">{t.noManager}</option>
                                {managerOptions.map((m: any) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className={editRole === "AGENT" ? "" : "md:col-span-2"}>
                            <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.newPassword}</label>
                            <input
                              type="password"
                              value={editNewPassword}
                              onChange={(e) => { setEditNewPassword(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
                              placeholder={t.newPasswordPlaceholder}
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
                            {t.save}
                          </button>
                          <button
                            onClick={() => { setEditingUser(null); setEditMsg(""); setEditStatus("idle"); }}
                            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                          >
                            {t.cancel}
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
                {editingPromptId ? t.editPromptTitle : t.newPromptTitle}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.promptName}</label>
                  <input
                    type="text"
                    value={promptName}
                    onChange={(e) => { setPromptName(e.target.value); setPromptMsg(""); }}
                    placeholder={t.promptName}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.callType}</label>
                  <select
                    value={promptCallType}
                    onChange={(e) => setPromptCallType(e.target.value)}
                    disabled={!!editingPromptId}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
                  >
                    <option value="FIRST_CALL">First Call</option>
                    <option value="SECOND_CALL">Second Call</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="GENERAL">{t.general}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.version}</label>
                  <input
                    type="text"
                    value={promptVersion}
                    onChange={(e) => { setPromptVersion(e.target.value); setPromptMsg(""); }}
                    placeholder="e.g. 10.29"
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.content}</label>
                <textarea
                  value={promptContent}
                  onChange={(e) => { setPromptContent(e.target.value); setPromptMsg(""); }}
                  placeholder={t.promptContentPlaceholder}
                  rows={10}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none font-mono"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSavePrompt}
                  className="bg-primary hover:opacity-90 text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm transition-all"
                >
                  {editingPromptId ? t.update : t.create}
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
                    {t.cancel}
                  </button>
                )}
                {promptMsg && (
                  <p className={`text-sm ${promptMsg === t.promptCreated || promptMsg === t.promptUpdated ? "text-emerald-400" : "text-error"}`}>
                    {promptMsg}
                  </p>
                )}
              </div>
            </div>

            {/* Prompt list */}
            <div className="bg-surface-container rounded-3xl p-4 space-y-1">
              {prompts.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">{t.noPrompts}</p>
              ) : (
                prompts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl border border-outline-variant/50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4 hover:bg-surface-container-high transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
                          <MIcon name="edit_note" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{p.name}</p>
                          <p className="text-xs text-on-surface-variant">v{p.version} · {p.content?.length ?? 0} {t.chars} · {p.callType?.replace("_", " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandedPromptId(expandedPromptId === p.id ? null : p.id)}
                          className="text-xs text-primary hover:opacity-75 transition-opacity font-medium"
                        >
                          {expandedPromptId === p.id ? t.hideContent : t.viewContent}
                        </button>
                        <button
                          onClick={() => handleTogglePrompt(p)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            p.isActive
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border-outline-variant bg-surface-container-highest text-on-surface-variant"
                          }`}
                        >
                          {p.isActive ? t.active : t.passive}
                        </button>
                        <button
                          onClick={() => handleEditPrompt(p)}
                          className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                          {t.edit}
                        </button>
                      </div>
                    </div>
                    {expandedPromptId === p.id && (
                      <div className="border-t border-outline-variant/50 bg-surface-container-lowest px-4 py-3">
                        <pre className="text-xs text-on-surface-variant font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                          {p.content}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── LOGS TAB ── */}
        {activeTab === "logs" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Filtreler */}
            <div className="bg-surface-container rounded-3xl p-4 flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                <MIcon name="person_search" className="text-base text-on-surface-variant" />
                <select
                  value={logUserFilter}
                  onChange={(e) => setLogUserFilter(e.target.value)}
                  className="flex-1 bg-surface-container-high text-on-surface text-xs rounded-xl px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary"
                >
                  <option value="">{t.allUsers}</option>
                  {Array.from(new Map(logs.map(l => [l.user?.id, l.user])).values()).filter(Boolean).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <MIcon name="filter_list" className="text-base text-on-surface-variant" />
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="flex-1 bg-surface-container-high text-on-surface text-xs rounded-xl px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary"
                >
                  <option value="">{t.allActions}</option>
                  <option value="PAGE_VIEW">{ACTION_LABELS[lang].PAGE_VIEW}</option>
                  <option value="LOGIN">{ACTION_LABELS[lang].LOGIN}</option>
                  <option value="LOGOUT">{ACTION_LABELS[lang].LOGOUT}</option>
                </select>
              </div>
              <button onClick={fetchLogs} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                <MIcon name="refresh" className="text-sm" />{t.refresh}
              </button>
              {(logUserFilter || logActionFilter) && (
                <button onClick={() => { setLogUserFilter(""); setLogActionFilter(""); }} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-error/10 text-error text-xs font-medium hover:bg-error/20 transition-colors">
                  <MIcon name="close" className="text-sm" />{t.clearFilter}
                </button>
              )}
            </div>

            <div className="bg-surface-container rounded-3xl p-4 space-y-1">
              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-outline border-t-primary rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">{t.noLogs}</p>
              ) : filteredLogs.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">{t.noFilteredLogs}</p>
              ) : (
                filteredLogs.map((log, i) => (
                  <motion.div
                    key={log.id ?? i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-surface-container-high transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant flex-shrink-0">
                        <MIcon name={log.action === "LOGIN" ? "login" : log.action === "LOGOUT" ? "logout" : (log.section ? (SECTION_ICONS[log.section] || "pageview") : "pageview")} className="text-base" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{log.user?.name ?? log.userName ?? "—"}</p>
                        <p className="text-xs text-on-surface-variant">{fmtDate(log.createdAt ?? log.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${roleColor(log.user?.role ?? log.role ?? "")}`}>
                        {roleLabel(log.user?.role ?? log.role ?? "")}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                          log.action === "LOGIN"
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : log.action === "LOGOUT"
                            ? "text-slate-400 bg-slate-500/10 border-slate-500/20"
                            : "text-primary bg-primary/10 border-primary/20"
                        }`}
                      >
                        {ACTION_LABELS[lang][log.action] ?? log.action}
                      </span>
                      {log.section && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-outline-variant bg-surface-container-high text-on-surface">
                          <MIcon name={SECTION_ICONS[log.section] || "web"} className="text-[11px]" />
                          {SECTION_LABELS[lang][log.section] ?? log.section}
                        </span>
                      )}
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
                <p className="text-on-surface-variant text-sm text-center py-8">{t.noFeedbacks}</p>
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
                            <p className="text-[10px] text-primary mt-1">{t.readMore}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-xs text-on-surface-variant">
                          {fmtDate(fb.createdAt ?? fb.timestamp)}
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

        {/* ── KRIKO SYNC TAB ── */}
        {activeTab === "sync" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* ── KRIKO ── */}
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <MIcon name="phone_in_talk" className="text-sm" /> Kriko
            </p>
            {/* Yapılandırma durumu */}
            <div className={`rounded-2xl p-4 border ${
              krikoStatus?.configured === false
                ? "bg-error/10 border-error/30 text-error"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}>
              <div className="flex items-center gap-3">
                <MIcon name={krikoStatus?.configured === false ? "error" : "check_circle"} className="text-xl" />
                <div className="flex-1">
                  <p className="text-sm font-bold">
                    {krikoStatus?.configured === false ? t.krikoNotConfigured : t.krikoActive}
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {krikoStatus?.configured === false ? t.krikoNotConfiguredDesc : t.krikoActiveDesc}
                  </p>
                </div>
              </div>
            </div>

            {/* Manuel Senkron Kartı */}
            <div className="bg-surface-container rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                {t.manualSync}
              </h2>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.datePlaceholder}</label>
                  <input
                    type="date"
                    value={krikoSyncDate}
                    onChange={(e) => setKrikoSyncDate(e.target.value)}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <button
                  onClick={handleKrikoSync}
                  disabled={krikoSyncing || krikoStatus?.configured === false}
                  className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <MIcon name={krikoSyncing ? "sync" : "cloud_download"} className={`text-base ${krikoSyncing ? "animate-spin" : ""}`} />
                  {krikoSyncing ? t.syncing : t.syncNow}
                </button>
              </div>
              {krikoMsg && (
                <p className={`text-sm ${krikoMsg.startsWith("Hata") ? "text-error" : krikoMsg.startsWith("✅") ? "text-emerald-400" : "text-on-surface-variant"}`}>
                  {krikoMsg}
                </p>
              )}
              {krikoLastResult && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
                  {[
                    { label: t.totalFetched, value: krikoLastResult.totalFetched, color: "text-on-surface" },
                    { label: t.analyzable, value: krikoLastResult.analyzable, color: "text-primary" },
                    { label: t.importedLabel, value: krikoLastResult.imported, color: "text-emerald-400" },
                    { label: t.unassignedLabel, value: krikoLastResult.unassigned, color: "text-amber-400" },
                    { label: t.failedLabel, value: krikoLastResult.failed, color: "text-error" },
                  ].map((s) => (
                    <div key={s.label} className="bg-surface-container-lowest rounded-xl p-3 text-center">
                      <p className="text-[10px] text-on-surface-variant uppercase">{s.label}</p>
                      <p className={`text-2xl font-black ${s.color}`}>{s.value ?? 0}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Atanmamış Çağrılar */}
            <div className="bg-surface-container rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                  {t.unassignedCalls}
                  {unassignedItems.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                      {unassignedItems.length}
                    </span>
                  )}
                </h2>
                <button onClick={fetchUnassigned} className="text-xs text-on-surface-variant hover:text-primary flex items-center gap-1">
                  <MIcon name="refresh" className="text-sm" /> {t.refresh}
                </button>
              </div>
              {unassignedItems.filter(i => !i.source || i.source === "KRIKO").length === 0 ? (
                <div className="py-8 text-center">
                  <MIcon name="check_circle" className="text-4xl text-emerald-400/40 block mx-auto mb-2" />
                  <p className="text-sm text-on-surface-variant">{t.allAssigned}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unassignedItems.filter(i => !i.source || i.source === "KRIKO").map((item) => {
                    const isExpanded = expandedUnassignedId === item.id;
                    return (
                      <div key={item.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                        {/* Tıklanabilir başlık satırı */}
                        <button
                          onClick={() => setExpandedUnassignedId(isExpanded ? null : item.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container-high transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <p className="text-sm font-semibold text-on-surface">{item.customerName}</p>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400">
                              Kriko: {item.externalAgentName || "—"}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] border border-outline-variant text-on-surface-variant">
                              {item.callType?.replace("_", " ")}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {formatDateTime(item.callDate)} · {item.callDuration} · %{item.score}
                            </span>
                          </div>
                          <MIcon name={isExpanded ? "expand_less" : "expand_more"} className="text-xl text-on-surface-variant shrink-0" />
                        </button>

                        {/* Genişletilmiş içerik */}
                        {isExpanded && (
                          <div className="border-t border-outline-variant/50 px-4 pb-4 space-y-3">
                            {item.transcript && (
                              <div className="mt-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t.transcript}</p>
                                <div className="bg-surface-container rounded-xl p-3 max-h-56 overflow-y-auto">
                                  <pre className="text-xs text-on-surface-variant whitespace-pre-wrap font-sans leading-relaxed">{item.transcript}</pre>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              <select
                                value={reassignSelections[item.id] || ""}
                                onChange={(e) => setReassignSelections({ ...reassignSelections, [item.id]: e.target.value })}
                                className="flex-1 min-w-[200px] bg-surface-container rounded-xl px-3 py-2 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">{t.selectAgent}</option>
                                {users.filter((u) => u.role === "AGENT" && u.email !== "unassigned@estenove.local").map((u) => (
                                  <option key={u.id} value={u.id}>{u.name}{u.team?.name ? ` · ${u.team.name}` : ""}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleReassign(item.id)}
                                disabled={!reassignSelections[item.id]}
                                className="bg-primary text-on-primary font-bold px-4 py-2 rounded-xl text-xs hover:opacity-90 transition-all disabled:opacity-30 flex items-center gap-1"
                              >
                                <MIcon name="check" className="text-sm" /> {t.assign}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── GOOGLE MEET ── itme modeli: Apps Script POST'lar, admin kuyruğu çevirir */}
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2 pt-4 border-t border-outline-variant">
              <MIcon name="mic" className="text-sm" /> Google Meet
            </p>

            {/* Yapılandırma durumu */}
            <div className={`rounded-2xl p-4 border ${
              meetStatus?.configured === false
                ? "bg-error/10 border-error/30 text-error"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}>
              <div className="flex items-center gap-3">
                <MIcon name={meetStatus?.configured === false ? "error" : "check_circle"} className="text-xl" />
                <div className="flex-1">
                  <p className="text-sm font-bold">
                    {meetStatus?.configured === false ? t.meetNotConfigured : t.meetActive}
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {meetStatus?.configured === false
                      ? t.meetNotConfiguredDesc
                      : t.meetActiveDesc(meetStatus?.unassignedCount ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Kuyruk Kartı — Keşfet düğmesi YOK, itme modelinde keşfedilecek bir şey yok */}
            <div className="bg-surface-container rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                {t.meetQueueTitle}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {(meetRunning ? meetPending : (meetStatus?.pending ?? 0)) > 0
                  ? t.meetPendingCount(meetRunning ? meetPending : (meetStatus?.pending ?? 0))
                  : t.meetQueueEmpty}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={meetKuyrugunuCevir}
                  disabled={meetRunning || !meetStatus?.pending}
                  className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <MIcon name={meetRunning ? "sync" : "cloud_download"} className={`text-base ${meetRunning ? "animate-spin" : ""}`} />
                  {meetRunning ? t.syncing : t.meetDrain}
                </button>
                {meetRunning && (
                  <button
                    onClick={() => { meetStopRef.current = true; }}
                    className="text-xs text-on-surface-variant hover:text-primary border border-outline-variant rounded-xl px-4 py-2"
                  >
                    {t.meetStop}
                  </button>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">
                {meetStatus?.sonKayit ? t.meetLastRecord(formatDateTime(meetStatus.sonKayit, t.locale)) : t.meetNoRecordYet}
              </p>
              {/* Sıkışmış (hakkı tükenmiş) satırlar — pending/skipped/imported'ın
                  hiçbirine girmiyor, bu yüzden görsel olarak ayrık: bu bir
                  "çalışıyor" durumu değil, bir "takıldı" durumu. */}
              {!!meetStatus?.exhausted && (
                <div className="rounded-2xl p-3 border border-error/30 bg-error/10">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs font-bold text-error">{t.meetExhaustedCount(meetStatus.exhausted)}</span>
                    <button
                      onClick={handleMeetRequeue}
                      disabled={meetRequeuing}
                      className="text-xs border border-outline-variant rounded-xl px-4 py-2 flex items-center gap-2 disabled:opacity-60"
                    >
                      <MIcon name="sync" className={`text-sm ${meetRequeuing ? "animate-spin" : ""}`} />
                      {meetRequeuing ? t.meetRequeuing : t.meetRequeue}
                    </button>
                  </div>
                  {meetRequeueMsg && <p className="text-xs text-on-surface-variant mt-2">{meetRequeueMsg}</p>}
                </div>
              )}
              {meetStatus && meetStatus.elenenSebepler.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t.meetSkipReasons}</p>
                  <div className="space-y-1">
                    {meetStatus.elenenSebepler.map((s) => (
                      <div key={s.skipReason ?? "unknown"} className="flex items-center justify-between text-xs text-on-surface-variant">
                        <span>{s.skipReason ?? "—"}</span><span>{s._count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Google Meet Atanmamış Çağrılar */}
            <div className="bg-surface-container rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                  {t.unassignedCalls}
                  {unassignedItems.filter(i => i.source === "GOOGLE_MEET").length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                      {unassignedItems.filter(i => i.source === "GOOGLE_MEET").length}
                    </span>
                  )}
                </h2>
                <button onClick={fetchUnassigned} className="text-xs text-on-surface-variant hover:text-primary flex items-center gap-1">
                  <MIcon name="refresh" className="text-sm" /> {t.refresh}
                </button>
              </div>
              {unassignedItems.filter(i => i.source === "GOOGLE_MEET").length === 0 ? (
                <div className="py-8 text-center">
                  <MIcon name="check_circle" className="text-4xl text-emerald-400/40 block mx-auto mb-2" />
                  <p className="text-sm text-on-surface-variant">{t.allMeetAssigned}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unassignedItems.filter(i => i.source === "GOOGLE_MEET").map((item) => {
                    const isExpanded = expandedUnassignedId === item.id;
                    return (
                      <div key={item.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                        <button
                          onClick={() => setExpandedUnassignedId(isExpanded ? null : item.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container-high transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <p className="text-sm font-semibold text-on-surface">{item.customerName}</p>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-blue-500/30 bg-blue-500/10 text-blue-400">
                              Drive: {item.externalAgentName || "—"}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] border border-outline-variant text-on-surface-variant">
                              {item.callType?.replace("_", " ")}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {formatDateTime(item.callDate)} · {item.callDuration} · %{item.score}
                            </span>
                          </div>
                          <MIcon name={isExpanded ? "expand_less" : "expand_more"} className="text-xl text-on-surface-variant shrink-0" />
                        </button>

                        {isExpanded && (
                          <div className="border-t border-outline-variant/50 px-4 pb-4 space-y-3">
                            {item.transcript && (
                              <div className="mt-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t.transcript}</p>
                                <div className="bg-surface-container rounded-xl p-3 max-h-56 overflow-y-auto">
                                  <pre className="text-xs text-on-surface-variant whitespace-pre-wrap font-sans leading-relaxed">{item.transcript}</pre>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              <select
                                value={reassignSelections[item.id] || ""}
                                onChange={(e) => setReassignSelections({ ...reassignSelections, [item.id]: e.target.value })}
                                className="flex-1 min-w-[200px] bg-surface-container rounded-xl px-3 py-2 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">{t.selectAgent}</option>
                                {users.filter((u) => u.role === "AGENT" && u.email !== "unassigned@estenove.local").map((u) => (
                                  <option key={u.id} value={u.id}>{u.name}{u.team?.name ? ` · ${u.team.name}` : ""}</option>
                                ))}
                              </select>
                              {/* Drive e-postası bu çağrının externalAgentName'i — danışman */}
                              {/* atandığında aynı hareketle bağlanır (Adım 4). */}
                              <button
                                onClick={() => handleReassign(item.id, item.externalAgentName)}
                                disabled={!reassignSelections[item.id]}
                                className="bg-primary text-on-primary font-bold px-4 py-2 rounded-xl text-xs hover:opacity-90 transition-all disabled:opacity-30 flex items-center gap-1"
                              >
                                <MIcon name="check" className="text-sm" /> {t.assign}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </motion.div>
        )}

        {/* ── SENKRON GEÇMİŞİ TAB ── */}
        {activeTab === "syncHistory" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-surface-container rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                  {t.syncHistoryTitle}
                </h2>
                <button
                  onClick={() => { fetchKrikoStatus(); }}
                  className="text-xs text-on-surface-variant hover:text-primary flex items-center gap-1"
                >
                  <MIcon name="refresh" className="text-sm" /> {t.refresh}
                </button>
              </div>

              {/* Filtre chips */}
              {(() => {
                const krikoLogs = (krikoStatus?.logs ?? []).map((l: any) => ({ ...l, source: "KRIKO" }));
                // Google Meet için SyncLog yazılmıyor (itme modeli, keşif
                // yok) — bu liste yalnızca Kriko'yu besler. Fireflies rozeti
                // aşağıda KALIYOR: geçmiş Fireflies SyncLog kayıtları var
                // olmaya devam ediyor, yalnızca artık yeni satır eklenmiyor.
                const allLogs = [...krikoLogs].sort(
                  (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
                );

                if (allLogs.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <MIcon name="event_note" className="text-4xl text-on-surface-variant/20 block mx-auto mb-2" />
                      <p className="text-sm text-on-surface-variant">{t.noSyncHistory}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {allLogs.map((log: any) => (
                      <div key={`${log.source}-${log.id}`} className="bg-surface-container-lowest rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            log.source === "KRIKO"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          }`}>
                            {log.source === "KRIKO" ? "Kriko" : "Fireflies"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            log.trigger === "CRON"
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-surface-container border-outline-variant text-on-surface-variant"
                          }`}>
                            {log.trigger}
                          </span>
                          <p className="text-xs text-on-surface-variant truncate">
                            {fmtDate(log.startedAt)} · <span className="text-on-surface font-semibold">{log.date}</span>
                          </p>
                          {log.error && (
                            <p className="text-[10px] text-error truncate max-w-[180px]">{log.error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] shrink-0">
                          <span className="text-on-surface-variant">📥 <b className="text-emerald-400">{log.imported ?? 0}</b></span>
                          <span className="text-on-surface-variant">⚠️ <b className="text-amber-400">{log.unassigned ?? 0}</b></span>
                          <span className="text-on-surface-variant">⏭ <b>{log.skipped ?? 0}</b></span>
                          {log.failed > 0 && <span className="text-on-surface-variant">❌ <b className="text-error">{log.failed}</b></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}

        {activeTab === "reclassify" && (
          <div className="space-y-6">
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-6">
              <h2 className="text-base font-bold mb-1">{t.tabReclassify}</h2>
              <p className="text-xs text-on-surface-variant mb-4">{t.reclassifyScanDesc}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleScanClassifications}
                  disabled={scanLoading || bulkFixing}
                  className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {scanLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      {t.reclassifyScanning}
                    </>
                  ) : (
                    <><MIcon name="search" className="text-base" /> {t.reclassifyScan}</>
                  )}
                </button>
                {suspiciousItems.length > 0 && !bulkFixing && (
                  <button
                    onClick={handleFixAll}
                    className="flex items-center gap-2 bg-error/10 border border-error/30 text-error px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-error/20 transition-all"
                  >
                    <MIcon name="auto_fix_high" className="text-base" />
                    {t.reclassifyFixAll(suspiciousItems.length)}
                  </button>
                )}
                {bulkFixing && fixProgress && (
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${(fixProgress.done / fixProgress.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-on-surface-variant whitespace-nowrap">
                      {t.reclassifyProgress(fixProgress.done, fixProgress.total)}
                    </span>
                  </div>
                )}
              </div>
              {scanMsg && (
                <p className="mt-3 text-xs text-on-surface-variant">{scanMsg}</p>
              )}
            </div>

            {suspiciousItems.length > 0 && (
              <div className="bg-surface-container border border-outline-variant rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-high">
                      {t.reclassifyHeader.map((h: string) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suspiciousItems.map((item) => (
                      <tr key={item.id} className="border-b border-outline-variant/50 hover:bg-surface-container-high/50 transition-colors">
                        <td className="px-4 py-3 text-on-surface">{item.agentName}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{item.customerName}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full bg-error/10 border border-error/20 text-error font-bold">
                            {item.storedCallType} ❌
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">
                            {item.suggestedCallType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleFixOne(item)}
                            disabled={fixingId === item.id || bulkFixing}
                            className="text-xs px-3 py-1.5 bg-surface-container-high border border-outline-variant hover:border-primary/50 hover:text-primary rounded-lg transition-all disabled:opacity-40"
                          >
                            {fixingId === item.id ? (
                              <span className="w-3 h-3 border border-on-surface-variant/30 border-t-primary rounded-full animate-spin inline-block" />
                            ) : t.reclassifyFix}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!scanLoading && suspiciousItems.length === 0 && scanMsg && (
              <div className="text-center text-on-surface-variant text-sm py-8">
                {t.reclassifyNoSuspicious}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={null}>
      <AdminSettingsPageInner />
    </Suspense>
  );
}
