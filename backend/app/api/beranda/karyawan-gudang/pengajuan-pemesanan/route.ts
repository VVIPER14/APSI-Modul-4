import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentSession } from "@/app/lib/auth";
import { getJakartaDatabaseDate, proposalStatuses } from "@/app/lib/procurement";
import { prisma } from "@/app/lib/prisma";

type ProposalItemInput = {
  id_barang: string;
  id_supplier: string;
  harga_satuan: string;
  jumlah_pesan: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseItems(body: Record<string, unknown>): ProposalItemInput[] | null {
  if (!Array.isArray(body.items) || body.items.length > 100) {
    return null;
  }

  const items: ProposalItemInput[] = [];
  const seenProductIds = new Set<string>();

  for (const value of body.items) {
    if (
      !isRecord(value) ||
      typeof value.id_barang !== "string" ||
      !value.id_barang.trim() ||
      value.id_barang.length > 255 ||
      typeof value.id_supplier !== "string" ||
      !value.id_supplier.trim() ||
      value.id_supplier.length > 255 ||
      typeof value.harga_satuan !== "string" ||
      !/^\d{1,19}$/.test(value.harga_satuan) ||
      typeof value.jumlah_pesan !== "number" ||
      !Number.isSafeInteger(value.jumlah_pesan) ||
      value.jumlah_pesan < 1 ||
      value.jumlah_pesan > 2147483647 ||
      seenProductIds.has(value.id_barang)
    ) {
      return null;
    }

    seenProductIds.add(value.id_barang);
    items.push({
      id_barang: value.id_barang,
      id_supplier: value.id_supplier,
      harga_satuan: value.harga_satuan,
      jumlah_pesan: value.jumlah_pesan,
    });
  }

  return items;
}

function calculateTotal(items: ProposalItemInput[]) {
  const total = items.reduce(
    (sum, item) =>
      sum.plus(new Prisma.Decimal(item.harga_satuan).mul(item.jumlah_pesan)),
    new Prisma.Decimal(0),
  );

  return total.lessThan("10000000000000000000") ? total : null;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  if (session.role !== "Karyawan Gudang") {
    return Response.json(
      { error: "Hanya karyawan gudang yang dapat mengelola pengajuan." },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.action !== "string") {
    return Response.json({ error: "Aksi pengajuan tidak valid." }, { status: 400 });
  }

  if (body.action === "save-draft") {
    if (
      body.id_pengajuan !== null &&
      body.id_pengajuan !== undefined &&
      typeof body.id_pengajuan !== "string"
    ) {
      return Response.json({ error: "ID pengajuan tidak valid." }, { status: 400 });
    }

    const requestedId =
      typeof body.id_pengajuan === "string" ? body.id_pengajuan : null;
    const items = parseItems(body);

    if (!items || (!items.length && !requestedId)) {
      return Response.json(
        { error: "Pilih barang, supplier, harga, dan jumlah yang valid." },
        { status: 400 },
      );
    }

    const total = calculateTotal(items);

    if (!total) {
      return Response.json(
        { error: "Total pengajuan melebihi batas nilai yang dapat disimpan." },
        { status: 400 },
      );
    }

    try {
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`LOCK TABLE "pengajuan" IN EXCLUSIVE MODE`;

        const [products, suppliers] = await Promise.all([
          transaction.barang.findMany({
            where: { id_barang: { in: items.map((item) => item.id_barang) } },
            select: { id_barang: true },
          }),
          transaction.supplier.findMany({
            where: {
              id_suplier: { in: items.map((item) => item.id_supplier) },
            },
            select: { id_suplier: true },
          }),
        ]);

        if (
          products.length !== new Set(items.map((item) => item.id_barang)).size ||
          suppliers.length !== new Set(items.map((item) => item.id_supplier)).size
        ) {
          return {
            error: "Barang atau supplier berubah. Muat ulang halaman sebelum menyimpan.",
            status: 409,
          };
        }

        let id_pengajuan: string;
        const isNew = requestedId === null;

        if (isNew) {
          if (items.length === 0) {
            return {
              error: "Tambahkan minimal satu barang sebelum menyimpan draft.",
              status: 400,
            };
          }

          const [nextProposal] = await transaction.$queryRaw<
            { id_pengajuan: string }[]
          >`
            SELECT
              'PGJ' || LPAD(
                (COALESCE(MAX(SUBSTRING("id_pengajuan" FROM 4)::BIGINT), 0) + 1)::TEXT,
                3,
                '0'
              ) AS id_pengajuan
            FROM "pengajuan"
            WHERE "id_pengajuan" ~ '^PGJ[0-9]+$'
          `;
          id_pengajuan = nextProposal?.id_pengajuan ?? "";

          if (!id_pengajuan) {
            return {
              error: "ID pengajuan tidak dapat dibuat.",
              status: 500,
            };
          }

          const { databaseDate } = getJakartaDatabaseDate();
          await transaction.pengajuan.create({
            data: {
              id_pengajuan,
              tanggal_pengajuan: databaseDate,
              id_pengaju: session.userId,
              status_penyetujuan: proposalStatuses.draft,
              harga_total: total,
            },
          });
        } else {
          id_pengajuan = requestedId;
          const existingProposal = await transaction.pengajuan.findUnique({
            where: { id_pengajuan },
            select: {
              id_pengaju: true,
              status_penyetujuan: true,
            },
          });

          if (!existingProposal || existingProposal.id_pengaju !== session.userId) {
            return { error: "Draft pengajuan tidak ditemukan.", status: 404 };
          }

          if (existingProposal.status_penyetujuan !== proposalStatuses.draft) {
            return {
              error: "Pengajuan yang sudah dikirim tidak dapat diubah.",
              status: 409,
            };
          }

          await transaction.pengajuan.update({
            where: { id_pengajuan },
            data: { harga_total: total },
          });
          await transaction.detail_pengajuan.deleteMany({
            where: { id_pengajuan },
          });
        }

        if (items.length > 0) {
          await transaction.detail_pengajuan.createMany({
            data: items.map((item) => ({
              id_pengajuan,
              id_barang: item.id_barang,
              id_supplier: item.id_supplier,
              harga_satuan: new Prisma.Decimal(item.harga_satuan),
              jumlah_pesan: item.jumlah_pesan,
            })),
          });
        }

        return {
          id_pengajuan,
          harga_total: total.toFixed(0),
          status: proposalStatuses.draft,
          created: isNew,
        };
      });

      if ("error" in result) {
        return Response.json(
          { error: result.error },
          { status: result.status },
        );
      }

      return Response.json(result, { status: result.created ? 201 : 200 });
    } catch (error) {
      console.error("Failed to save warehouse proposal draft.", error);
      return Response.json(
        { error: "Draft pengajuan gagal disimpan. Silakan coba kembali." },
        { status: 500 },
      );
    }
  }

  if (body.action === "submit") {
    const idPengajuan = body.id_pengajuan;

    if (
      typeof idPengajuan !== "string" ||
      !idPengajuan.trim() ||
      idPengajuan.length > 255
    ) {
      return Response.json({ error: "ID pengajuan tidak valid." }, { status: 400 });
    }

    try {
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`LOCK TABLE "pengajuan" IN EXCLUSIVE MODE`;

        const proposal = await transaction.pengajuan.findUnique({
          where: { id_pengajuan: idPengajuan },
          select: {
            id_pengaju: true,
            status_penyetujuan: true,
            detail_pengajuan: {
              select: { id_supplier: true },
            },
          },
        });

        if (!proposal || proposal.id_pengaju !== session.userId) {
          return { error: "Draft pengajuan tidak ditemukan.", status: 404 };
        }

        if (proposal.status_penyetujuan !== proposalStatuses.draft) {
          return { error: "Pengajuan ini sudah dikirim.", status: 409 };
        }

        if (
          proposal.detail_pengajuan.length === 0 ||
          proposal.detail_pengajuan.some((item) => !item.id_supplier)
        ) {
          return {
            error: "Lengkapi barang dan supplier sebelum mengirim pengajuan.",
            status: 400,
          };
        }

        await transaction.pengajuan.update({
          where: { id_pengajuan: idPengajuan },
          data: { status_penyetujuan: proposalStatuses.processing },
        });

        return {
          id_pengajuan: idPengajuan,
          status: proposalStatuses.processing,
        };
      });

      if ("error" in result) {
        return Response.json(
          { error: result.error },
          { status: result.status },
        );
      }

      return Response.json(result);
    } catch (error) {
      console.error("Failed to submit warehouse proposal.", error);
      return Response.json(
        { error: "Pengajuan gagal dikirim. Silakan coba kembali." },
        { status: 500 },
      );
    }
  }

  return Response.json({ error: "Aksi pengajuan tidak dikenal." }, { status: 400 });
}
