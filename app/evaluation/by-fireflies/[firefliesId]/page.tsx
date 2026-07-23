import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/app/lib/prisma";
import { firefliesExternalCallId } from "@/app/lib/firefliesLink";

export const dynamic = "force-dynamic";

export default async function ByFirefliesPage({
  params,
}: {
  params: Promise<{ firefliesId: string }>;
}) {
  const { firefliesId } = await params;
  const externalCallId = firefliesExternalCallId(decodeURIComponent(firefliesId));

  if (externalCallId) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { externalCallId },
      select: { id: true },
    });
    if (evaluation) {
      redirect(`/evaluation/${evaluation.id}`);
    }
  }

  // Bulunamadı → dostça "henüz değerlendirilmedi" sayfası
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="max-w-md w-full text-center bg-surface-container border border-outline-variant rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-on-surface mb-2">
          Bu görüşme henüz değerlendirilmedi
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Aradığınız görüşme için henüz bir kalite değerlendirmesi oluşturulmamış.
          Görüşme senkronize edildikten ve değerlendirildikten sonra bu bağlantı
          otomatik olarak değerlendirme detayına yönlenecektir.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-on-primary text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:opacity-90"
        >
          Panele dön
        </Link>
      </div>
    </div>
  );
}
