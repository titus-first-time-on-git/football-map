import { readOfficials } from "@/lib/data-store";
import { renderOfficialPdf } from "@/lib/pdf-reports";

export const maxDuration = 60;
export const runtime = "nodejs";

function filename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "ID invalid" }, { status: 400 });
  const [officials, profileResponse] = await Promise.all([
    readOfficials(),
    fetch(new URL(`/api/referee/${id}`, request.url), { cache: "no-store" }),
  ]);
  if (!profileResponse.ok) return Response.json({ error: "Raportul nu poate fi generat momentan" }, { status: 502 });
  const profile = await profileResponse.json() as { name?: string; city?: string; county?: string } & Record<string, unknown>;
  const official = officials.find((item) => item.profileId === id);
  if (!official) return Response.json({ error: "Oficialul nu a fost găsit" }, { status: 404 });
  const buffer = await renderOfficialPdf({ official, profile: profile as never });
  const reportName = `raport-${official.role.toLowerCase()}-${filename(official.name)}.pdf`;
  return new Response(new Uint8Array(buffer), { headers: {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${reportName}"`,
    "cache-control": "private, no-store",
  } });
}
