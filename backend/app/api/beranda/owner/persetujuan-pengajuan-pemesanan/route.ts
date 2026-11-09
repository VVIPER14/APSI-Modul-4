import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentSession } from "@/app/lib/auth";
import { getJakartaDatabaseDate, proposalStatuses } from "@/app/lib/procurement";
import { prisma } from "@/app/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  if (session.role !== "Owner") {
    return Response.json(
      { error: "Hanya owner yang dapat memutuskan pengajuan." },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    (body.action !== "approve" && body.action !== "reject") ||
    typeof body.id_pengajuan !== "string" ||
    !body.id_pengajuan.trim() ||
    body.id_pengajuan.length > 255 ||
    (body.id_supplier !== undefined &&
      body.id_supplier !== null &&
      (typeof body.id_supplier !== "string" ||
        !body.id_supplier.trim() ||
        body.id_supplier.length > 255)) ||
    (body.action === "approve" &&
      (typeof body.id_supplier !== "string" || !body.id_supplier.trim()))
  ) {
    return Response.json({ error: "Keputusan pengajuan tidak valid." }, { status: 400 });
  }

  const idPengajuan = body.id_pengajuan;
  const action = body.action;
  const supplierId =
    typeof body.id_supplier === "string" ? body.id_supplier : null;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`LOCK TABLE "pengajuan", "pemesanan" IN EXCLUSIVE MODE`;

      const proposal = await transaction.pengajuan.findUnique({
        where: { id_pengajuan: idPengajuan },
        select: {
          status_penyetujuan: true,
          detail_pengajuan: {
            select: {
              id_barang: true,
              harga_satuan: true,
              jumlah_pesan: true,
            },
          },
        },
      });

      if (!proposal) {
        return { error: "Pengajuan tidak ditemukan.", status: 404 };
      }

      if (proposal.status_penyetujuan !== proposalStatuses.processing) {
        return {
          error: "Pengajuan ini sudah memiliki keputusan atau belum dikirim.",
          status: 409,
        };
      }

      if (proposal.detail_pengajuan.length === 0) {
        return {
          error: "Pengajuan tidak memiliki rincian barang.",
          status: 409,
        };
      }

      const supplier = supplierId
        ? await transaction.supplier.findUnique({
            where: { id_suplier: supplierId },
            select: { nama_supplier: true },
          })
        : null;

      if (supplierId && !supplier) {
        return { error: "Supplier tidak ditemukan.", status: 404 };
      }

      if (supplierId) {
        await transaction.detail_pengajuan.updateMany({
          where: { id_pengajuan: idPengajuan },
          data: { id_supplier: supplierId },
        });
      }

      if (action === "reject") {
        await transaction.pengajuan.update({
          where: { id_pengajuan: idPengajuan },
          data: {
            id_penyetuju: session.userId,
            status_penyetujuan: proposalStatuses.rejected,
          },
        });

        return {
          id_pengajuan: idPengajuan,
          status: proposalStatuses.rejected,
          id_supplier: supplierId,
          nama_supplier: supplier?.nama_supplier ?? null,
        };
      }

      if (!supplier || !supplierId) {
        return { error: "Supplier tidak ditemukan.", status: 404 };
      }

      const [nextOrder] = await transaction.$queryRaw<
        { id_pemesanan: string }[]
      >`
        SELECT
          'PMS' || LPAD(
            (COALESCE(MAX(SUBSTRING("id_pemesanan" FROM 4)::BIGINT), 0) + 1)::TEXT,
            3,
            '0'
          ) AS id_pemesanan
        FROM "pemesanan"
        WHERE "id_pemesanan" ~ '^PMS[0-9]+$'
      `;
      const nextOrderNumber = Number(nextOrder?.id_pemesanan.slice(3));

      if (!Number.isSafeInteger(nextOrderNumber) || nextOrderNumber < 1) {
        return { error: "ID pemesanan tidak dapat dibuat.", status: 500 };
      }

      const { databaseDate } = getJakartaDatabaseDate();
      const id_pemesanan = `PMS${String(nextOrderNumber).padStart(3, "0")}`;
      const orderTotal = proposal.detail_pengajuan.reduce(
        (sum, item) =>
          sum.plus(new Prisma.Decimal(item.harga_satuan).mul(item.jumlah_pesan)),
        new Prisma.Decimal(0),
      );

      await transaction.pemesanan.create({
        data: {
          id_pemesanan,
          tanggal_pemesanan: databaseDate,
          status_pemesanan: "Menunggu Penerimaan",
          tanggal_persetujuan: databaseDate,
          id_supplier: supplierId,
          id_pengajuan: idPengajuan,
          harga_total: orderTotal,
        },
      });
      await transaction.detail_pemesanan.createMany({
        data: proposal.detail_pengajuan.map((item) => ({
          id_pemesanan,
          id_barang: item.id_barang,
          harga_satuan: item.harga_satuan,
          jumlah_pesan: item.jumlah_pesan,
        })),
      });

      await transaction.pengajuan.update({
        where: { id_pengajuan: idPengajuan },
        data: {
          id_penyetuju: session.userId,
          status_penyetujuan: proposalStatuses.approved,
        },
      });

      return {
        id_pengajuan: idPengajuan,
        status: proposalStatuses.approved,
        id_pemesanan,
        id_supplier: supplierId,
        nama_supplier: supplier.nama_supplier,
      };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Failed to decide owner proposal.", error);
    return Response.json(
      { error: "Keputusan pengajuan gagal disimpan. Silakan coba kembali." },
      { status: 500 },
    );
  }
}
