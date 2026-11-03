import { renderMatchPdf } from "@/lib/pdf-reports";

export const maxDuration = 60;
export const runtime = "nodejs";

function filename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detailResponse = await fetch(new URL(`/api/match/${encodeURIComponent(id)}`, request.url), { cache: "no-store" });
  if (!detailResponse.ok) return Response.json({ error: "Meciul nu a fost găsit" }, { status: detailResponse.status });
  const detail = await detailResponse.json() as { match: { home: string; away: string } } & Record<string, unknown>;
  const buffer = await renderMatchPdf(detail as never);
  const reportName = `raport-meci-${filename(detail.match.home)}-${filename(detail.match.away)}.pdf`;
  return new Response(new Uint8Array(buffer), { headers: {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${reportName}"`,
    "cache-control": "private, no-store",
  } });
}
