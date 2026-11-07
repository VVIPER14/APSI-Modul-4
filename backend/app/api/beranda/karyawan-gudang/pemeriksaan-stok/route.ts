import { getCurrentSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type InspectionItemInput = {
  id_barang: string;
  stok: number;
  catatan: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseItems(body: unknown): InspectionItemInput[] | null {
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0) {
    return null;
  }

  const parsed: InspectionItemInput[] = [];
  const seenIds = new Set<string>();

  for (const value of body.items) {
    if (
      !isRecord(value) ||
      typeof value.id_barang !== "string" ||
      value.id_barang.length === 0 ||
      typeof value.stok !== "number" ||
      !Number.isSafeInteger(value.stok) ||
      value.stok < 0 ||
      value.stok > 2147483647 ||
      (value.catatan !== null && typeof value.catatan !== "string")
    ) {
      return null;
    }

    const catatan =
      typeof value.catatan === "string" ? value.catatan.trim() : null;

    if (catatan !== null && catatan.length > 255) {
      return null;
    }

    if (seenIds.has(value.id_barang)) {
      return null;
    }

    seenIds.add(value.id_barang);
    parsed.push({
      id_barang: value.id_barang,
      stok: value.stok,
      catatan: catatan || null,
    });
  }

  return parsed;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  if (session.role !== "Karyawan Gudang") {
    return Response.json(
      { error: "Hanya karyawan gudang yang dapat menyimpan pemeriksaan stok." },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const items = parseItems(body);

  if (!items) {
    return Response.json(
      { error: "Data barang atau jumlah stok tidak valid." },
      { status: 400 },
    );
  }

  const inspectionId = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`LOCK TABLE "pemeriksaan_stok" IN EXCLUSIVE MODE`;

    const products = await transaction.barang.findMany({
      select: { id_barang: true },
    });

    if (
      products.length !== items.length ||
      products.some((product) => !items.some((item) => item.id_barang === product.id_barang))
    ) {
      throw new Error("Daftar barang berubah. Muat ulang halaman sebelum menyimpan.");
    }

    const [nextInspection] = await transaction.$queryRaw<
      { id_pemeriksaan: string }[]
    >`
      SELECT
        'PMK' || LPAD(
          (COALESCE(MAX(SUBSTRING("id_pemeriksaan" FROM 4)::BIGINT), 0) + 1)::TEXT,
          3,
          '0'
        ) AS id_pemeriksaan
      FROM "pemeriksaan_stok"
      WHERE "id_pemeriksaan" ~ '^PMK[0-9]+$'
    `;
    const id_pemeriksaan = nextInspection?.id_pemeriksaan;

    if (!id_pemeriksaan) {
      throw new Error("ID pemeriksaan stok tidak dapat dibuat.");
    }

    const tanggal_pemeriksaan = new Date();

    await transaction.pemeriksaan_stok.create({
      data: {
        id_pemeriksaan,
        tanggal_pemeriksaan,
        id_pemeriksa: session.userId,
      },
    });

    await transaction.detail_pemeriksaan.createMany({
      data: items.map((item) => ({
        id_pemeriksaan,
        id_barang: item.id_barang,
        stok: item.stok,
        catatan: item.catatan,
      })),
    });

    return id_pemeriksaan;
  });

  return Response.json({ id_pemeriksaan: inspectionId }, { status: 201 });
}
