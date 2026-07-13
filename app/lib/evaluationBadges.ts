// Değerlendirme listesindeki satır rozetlerinin rol bazlı görünürlüğü.
// Rozetler yalnızca çağıran bir rol geçtiğinde gösterilir; EvaluationList birden çok
// görünümde paylaşılır (Değerlendirmeler, Takım, Takım Raporu, Skorlarım) ve yalnızca
// Değerlendirmeler sayfası (EvaluationsView) userRole geçer. Rol yoksa hiç rozet çıkmaz.
// Rol geçilince: okuma durumu tüm rollere; coaching durumu yalnızca lider/manager/admin'e
// gösterilir — danışman (AGENT) coaching rozetini görmez.
const COACH_ROLES = ["TEAM_LEADER", "MANAGER", "ADMIN"];

export interface BadgeVisibility {
  showRead: boolean;
  showCoaching: boolean;
}

export function evaluationBadgeVisibility(role: string | null | undefined): BadgeVisibility {
  if (!role) return { showRead: false, showCoaching: false };
  const showCoaching = COACH_ROLES.includes(role);
  return { showRead: true, showCoaching };
}
