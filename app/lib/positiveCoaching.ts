// Positive Coaching taksonomisi (≥%90 değerlendirmelerde kullanılır).
// İçerik statik ve iki dillidir; item label'ı "EN — TR" biçiminde, text iki dilli.
// Coach başlık seçer; composePositiveFeedback seçilenleri taksonomi sırasında
// "<label>: <text>" satırlarıyla birleştirip coachingNotes'a besteler.

export interface PositiveCoachingItem {
  key: string;
  label: { tr: string; en: string };
  text: { tr: string; en: string };
}
export interface PositiveCoachingCategory {
  key: string;
  label: { tr: string; en: string };
  items: PositiveCoachingItem[];
}

export const POSITIVE_COACHING: PositiveCoachingCategory[] = [
  {
    key: "resolution",
    label: { tr: "Sonuçlandırma", en: "Resolution" },
    items: [
      {
        key: "timeToResolve",
        label: { tr: "Time to Resolve — Sonuçlandırma Süresi", en: "Time to Resolve" },
        text: {
          tr: "Danışanın sorularını gereksiz uzatmadan, ilk görüşmede netleştirdin ve karar aşamasına hızlıca taşıdın. Süreci iyi yöneterek danışanı oyalamadan yönlendirdin.",
          en: "You clarified the client's questions in the first consultation without unnecessary delays and moved them quickly toward a decision. You managed the process well and guided the client without keeping them waiting.",
        },
      },
      {
        key: "solutionGiven",
        label: { tr: "Solution Given — Sunulan Çözüm", en: "Solution Given" },
        text: {
          tr: "Danışanın saç kaybı durumunu doğru analiz edip ihtiyacına en uygun tekniği (FUE/DHI vb.) ve paketi önerdin. Genel geçer değil, kişiye özel bir çözüm sundun.",
          en: "You correctly analyzed the client's hair loss condition and recommended the most suitable technique (FUE/DHI, etc.) and package for their needs. You offered a personalized solution rather than a one-size-fits-all one.",
        },
      },
      {
        key: "referral",
        label: { tr: "Referral — Yönlendirme", en: "Referral" },
        text: {
          tr: "Danışanın durumu (ör. medikal uygunluk, ek uzman görüşü) senin yetkin dışındayken doğru kişiye/doktora, gerekli bilgiyle yönlendirdin. Aktarım öncesi danışanı bilgilendirmen çok profesyoneldi.",
          en: "When the client's situation (e.g., medical eligibility, additional specialist opinion) was beyond your scope, you referred them to the right person/doctor with the necessary information. Informing the client before the transfer was very professional.",
        },
      },
      {
        key: "process",
        label: { tr: "Process — Düzeltme/Revizyon", en: "Process" },
        text: {
          tr: "Önceki bir operasyondan memnun kalmamış danışana revizyon sürecini net adımlarla anlattın ve beklentisini gerçekçi biçimde yönettin.",
          en: "You explained the revision process in clear steps to a client dissatisfied with a previous operation and managed their expectations realistically.",
        },
      },
      {
        key: "other",
        label: { tr: "Other — Diğer", en: "Other" },
        text: {
          tr: "Standart dışı bir talebi inisiyatif alarak çözdün; danışan odaklı yaklaşımın satışı güvenle sonuçlandırdı.",
          en: "You took initiative to resolve a non-standard request; your client-focused approach closed the sale with confidence.",
        },
      },
    ],
  },
  {
    key: "advisor",
    label: { tr: "Satış Danışmanı", en: "Advisor" },
    items: [
      {
        key: "knowledge",
        label: { tr: "Knowledge — Bilgi", en: "Knowledge" },
        text: {
          tr: "Teknikler, greft sayısı, iyileşme süreci ve fiyatlandırmaya tam hâkimdin; danışanın sorularını tereddütsüz, doğru bilgiyle yanıtladın.",
          en: "You had full command of the techniques, graft counts, recovery process, and pricing; you answered the client's questions confidently and accurately.",
        },
      },
      {
        key: "communicating",
        label: { tr: "Communicating — İletişim", en: "Communicating" },
        text: {
          tr: "Kendini net ve akıcı ifade ettin; medikal terimleri danışanın anlayacağı sade bir dile çevirmen güven oluşturdu.",
          en: "You expressed yourself clearly and fluently; translating medical terms into simple language the client could understand built trust.",
        },
      },
      {
        key: "listening",
        label: { tr: "Listening — Dinleme", en: "Listening" },
        text: {
          tr: "Danışanı sözünü kesmeden dinledin. Beklentilerini ve kaygılarını anlamak için sorduğun sorular ihtiyacı hızla netleştirdi.",
          en: "You listened to the client without interrupting. The questions you asked to understand their expectations and concerns quickly clarified their needs.",
        },
      },
      {
        key: "professionalism",
        label: { tr: "Professionalism — Profesyonellik", en: "Professionalism" },
        text: {
          tr: "Görüşme boyunca saygılı, güven veren ve profesyonel bir tutum sergiledin. Kararsız danışanda bile baskı yapmadan, sabırlı kaldın.",
          en: "You maintained a respectful, reassuring, and professional attitude throughout the conversation. Even with a hesitant client, you stayed patient without applying pressure.",
        },
      },
      {
        key: "holds",
        label: { tr: "Holds — Bekletme", en: "Holds" },
        text: {
          tr: "Danışanı bekletmeden önce izin istedin, sebebini açıkladın ve süreyi kısa tuttun; döndüğünde teşekkür etmen naziktin.",
          en: "Before placing the client on hold you asked permission, explained the reason, and kept it brief; thanking them when you returned was courteous.",
        },
      },
      {
        key: "commitments",
        label: { tr: "Commitments — Verilen Sözler/Taahhütler", en: "Commitments" },
        text: {
          tr: "Danışana verdiğin sözü (fiyat, randevu, sonrası takip) net belirttin ve takibini eksiksiz yaptın. Taahhütlerinin arkasında durman güven verdi.",
          en: "You clearly stated your commitments to the client (price, appointment, follow-up) and followed through completely. Standing behind your commitments built trust.",
        },
      },
      {
        key: "informationShared",
        label: { tr: "Information Shared — Paylaşılan Bilgi", en: "Information Shared" },
        text: {
          tr: "İşlem öncesi/sonrası talimatlar, riskler ve fiyat detaylarını eksiksiz ve doğru paylaştın; önemli hiçbir noktayı atlamadın.",
          en: "You shared pre-/post-procedure instructions, risks, and pricing details fully and accurately; you didn't skip any important point.",
        },
      },
      {
        key: "other",
        label: { tr: "Other — Diğer", en: "Other" },
        text: {
          tr: "Görüşmede beklenenin üzerinde çaba gösterdin; danışan deneyimini iyileştiren küçük ama etkili dokunuşlar (öncesi-sonrası örnekleri, samimi takip) yaptın.",
          en: "You went above and beyond in the conversation; you added small but effective touches that improved the client experience (before/after examples, warm follow-up).",
        },
      },
    ],
  },
  {
    key: "product",
    label: { tr: "Hizmet (Saç Ekimi Paketi)", en: "Product" },
    items: [
      {
        key: "quality",
        label: { tr: "Quality — Kalite", en: "Quality" },
        text: {
          tr: "Klinik kalitesi, doktor deneyimi ve hijyen standartlarına dair danışanın endişesini doğru ele aldın ve güven verici, doğru bilgiyle yanıtladın.",
          en: "You addressed the client's concerns about clinic quality, doctor experience, and hygiene standards correctly, responding with reassuring and accurate information.",
        },
      },
      {
        key: "cost",
        label: { tr: "Cost — Maliyet/Fiyat", en: "Cost" },
        text: {
          tr: "Fiyatlandırmayı şeffaf ve anlaşılır açıkladın; pakete neyin dahil olduğunu (greft, konaklama, transfer, ilaçlar) netleştirerek olası itirazların önüne geçtin.",
          en: "You explained the pricing transparently and clearly; by clarifying what the package includes (grafts, accommodation, transfer, medications) you preempted potential objections.",
        },
      },
      {
        key: "features",
        label: { tr: "Features — Özellikler/Kapsam", en: "Features" },
        text: {
          tr: "Paket içeriğini ve teknik özellikleri danışanın ihtiyacına göre doğru eşleştirdin; faydayı somut sonuç örnekleriyle anlattın.",
          en: "You matched the package contents and technical features to the client's needs and explained the benefits with concrete result examples.",
        },
      },
    ],
  },
  {
    key: "process",
    label: { tr: "Süreç", en: "Process" },
    items: [
      {
        key: "process",
        label: { tr: "Process — İşlem Süreci", en: "Process" },
        text: {
          tr: "Operasyon sürecinin adımlarını (konsültasyon, çizim, ekim, iyileşme) sistematik ve doğru anlattın; danışanı her aşamada bilgilendirdin.",
          en: "You explained the steps of the operation process (consultation, hairline design, implantation, recovery) systematically and accurately, keeping the client informed at every stage.",
        },
      },
      {
        key: "eligibility",
        label: { tr: "Eligibility — Uygunluk", en: "Eligibility" },
        text: {
          tr: "Danışanın işleme uygunluğunu doğru kriterlerle (donör alanı, sağlık durumu, beklenti) değerlendirdin ve sonucu dürüstçe aktardın.",
          en: "You assessed the client's eligibility for the procedure using the right criteria (donor area, health status, expectations) and communicated the outcome honestly.",
        },
      },
      {
        key: "appeasements",
        label: { tr: "Appeasements — Telafi/İyi Niyet", en: "Appeasements" },
        text: {
          tr: "Memnuniyetini kazanmak için uygun bir teşviği (indirim, ek hizmet, esnek randevu) doğru zamanda ve yetki sınırların içinde sundun.",
          en: "To win over their satisfaction, you offered an appropriate incentive (discount, added service, flexible scheduling) at the right time and within your authority limits.",
        },
      },
      {
        key: "other",
        label: { tr: "Other — Diğer", en: "Other" },
        text: {
          tr: "Süreçteki bir aksaklığı fark edip proaktif ele aldın; danışanın karar akışını bozmadan çözüme kavuşturdun.",
          en: "You noticed a hitch in the process and handled it proactively, resolving it without disrupting the client's decision flow.",
        },
      },
    ],
  },
  {
    key: "referral",
    label: { tr: "Yönlendirme", en: "Referral" },
    items: [
      {
        key: "experience",
        label: { tr: "Experience — Deneyim", en: "Experience" },
        text: {
          tr: "Doktora/klinik ekibine yönlendirme sürecini danışan için sorunsuz hale getirdin; aktarım kesintisiz ve nazikti.",
          en: "You made the referral process to the doctor/clinic team seamless for the client; the handover was smooth and courteous.",
        },
      },
    ],
  },
  {
    key: "tools",
    label: { tr: "Araçlar", en: "Tools" },
    items: [
      {
        key: "connection",
        label: { tr: "Connection — Bağlantı", en: "Connection" },
        text: {
          tr: "Görüşme araçlarını (telefon, WhatsApp, video call) etkin kullanarak iletişimi kesintisiz sürdürdün; teknik sorun yaşatmadan yönettin.",
          en: "You used the communication tools (phone, WhatsApp, video call) effectively to keep the conversation uninterrupted and managed it without any technical issues.",
        },
      },
      {
        key: "ivrCasQueue",
        label: { tr: "IVR, CAS, Queue — Sistem/CRM/Kuyruk", en: "IVR, CAS, Queue" },
        text: {
          tr: "CRM ve sistem araçlarını doğru ve hızlı kullanarak danışanı doğru akışa yönlendirdin; lead yönetimini verimli yaptın.",
          en: "You used the CRM and system tools accurately and quickly to route the client into the right flow and managed the lead efficiently.",
        },
      },
      {
        key: "screenSharing",
        label: { tr: "Screen Sharing — Ekran/Görsel Paylaşımı", en: "Screen Sharing" },
        text: {
          tr: "Ekran veya öncesi-sonrası görsel paylaşımını danışanı rahatlatarak, adım adım kullandın; görsel destek kararı hızlandırdı.",
          en: "You used screen or before/after visual sharing step by step in a way that put the client at ease; the visual support sped up their decision.",
        },
      },
    ],
  },
];

export function composePositiveFeedback(selectedKeys: string[], lang: "tr" | "en"): string {
  const set = new Set(selectedKeys);
  const lines: string[] = [];
  for (const cat of POSITIVE_COACHING) {
    for (const item of cat.items) {
      if (set.has(`${cat.key}.${item.key}`)) {
        lines.push(`${item.label[lang]}: ${item.text[lang]}`);
      }
    }
  }
  return lines.join("\n\n");
}
