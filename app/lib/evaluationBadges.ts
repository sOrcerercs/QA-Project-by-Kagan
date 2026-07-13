// Değerlendirme listesindeki satır rozetlerinin rol bazlı görünürlüğü.
// Okuma durumu ("Okundu"/"Okunmadı") tüm rollere gösterilir.
// Coaching durumu yalnızca lider/manager/admin'e gösterilir — danışman (AGENT) görmez.
const COACH_ROLES = ["TEAM_LEADER", "MANAGER", "ADMIN"];

export interface BadgeVisibility {
  showRead: boolean;
  showCoaching: boolean;
}

export function evaluationBadgeVisibility(role: string | null | undefined): BadgeVisibility {
  const showCoaching = !!role && COACH_ROLES.includes(role);
  return { showRead: true, showCoaching };
}
