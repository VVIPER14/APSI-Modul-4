import { getCurrentSession } from "@/app/lib/auth";
import { getJakartaDatabaseDate } from "@/app/lib/procurement";
import { prisma } from "@/app/lib/prisma";

type ReceiptItemInput = {
  id_barang: string;
  jumlah_diterima: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseItems(value: unknown): ReceiptItemInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    return null;
  }

  const seen = new Set<string>();
  const items: ReceiptItemInput[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id_barang !== "string" ||
      !item.id_barang.trim() ||
      item.id_barang.length > 255 ||
      typeof item.jumlah_diterima !== "number" ||
      !Number.isSafeInteger(item.jumlah_diterima) ||
      item.jumlah_diterima < 1 ||
      item.jumlah_diterima > 2147483647 ||
      seen.has(item.id_barang)
    ) {
      return null;
    }

    seen.add(item.id_barang);
    items.push({
      id_barang: item.id_barang,
      jumlah_diterima: item.jumlah_diterima,
    });
  }

  return items;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  if (session.role !== "Karyawan Gudang") {
    return Response.json(
      { error: "Hanya karyawan gudang yang dapat mencatat penerimaan." },
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
    typeof body.id_pemesanan !== "string" ||
    !body.id_pemesanan.trim() ||
    body.id_pemesanan.length > 255 ||
    (body.no_faktur !== undefined &&
      body.no_faktur !== null &&
      (typeof body.no_faktur !== "string" || body.no_faktur.length > 255))
  ) {
    return Response.json({ error: "Data penerimaan tidak valid." }, { status: 400 });
  }

  const items = parseItems(body.items);

  if (!items) {
    return Response.json(
      { error: "Masukkan jumlah diterima yang valid untuk minimal satu barang." },
      { status: 400 },
    );
  }

  const idPemesanan = body.id_pemesanan;
  const invoice = typeof body.no_faktur === "string" ? body.no_faktur.trim() : null;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`LOCK TABLE "pemesanan", "penerimaan" IN EXCLUSIVE MODE`;

      const order = await transaction.pemesanan.findUnique({
        where: { id_pemesanan: idPemesanan },
        select: {
          status_pemesanan: true,
          detail_pemesanan: {
            select: {
              id_barang: true,
              jumlah_pesan: true,
            },
          },
        },
      });

      if (!order) {
        return { error: "Pemesanan tidak ditemukan.", status: 404 };
      }

      if (
        order.status_pemesanan !== "Menunggu Penerimaan" &&
        order.status_pemesanan !== "Sebagian Diterima"
      ) {
        return {
          error: "Pemesanan ini sudah selesai diterima atau tidak dapat diproses.",
          status: 409,
        };
      }

      const productIds = new Set(
        order.detail_pemesanan.map((item) => item.id_barang),
      );
      if (items.some((item) => !productIds.has(item.id_barang))) {
        return {
          error: "Barang penerimaan tidak sesuai dengan detail pemesanan.",
          status: 400,
        };
      }

      const previousReceipts = await transaction.penerimaan.findMany({
        where: { id_pemesanan: idPemesanan },
        select: {
          detail_penerimaan: {
            select: {
              id_barang: true,
              jumlah_diterima: true,
            },
          },
        },
      });
      const receivedByProduct = new Map<string, number>();

      for (const receipt of previousReceipts) {
        for (const detail of receipt.detail_penerimaan) {
          receivedByProduct.set(
            detail.id_barang,
            (receivedByProduct.get(detail.id_barang) ?? 0) +
              detail.jumlah_diterima,
          );
        }
      }

      const orderLineByProduct = new Map(
        order.detail_pemesanan.map((item) => [item.id_barang, item]),
      );
      const overReceived = items.find((item) => {
        const orderLine = orderLineByProduct.get(item.id_barang);
        const alreadyReceived = receivedByProduct.get(item.id_barang) ?? 0;
        return (
          !orderLine ||
          alreadyReceived + item.jumlah_diterima > orderLine.jumlah_pesan
        );
      });

      if (overReceived) {
        return {
          error: `Jumlah ${overReceived.id_barang} melebihi sisa yang belum diterima.`,
          status: 409,
        };
      }

      const [nextReceipt] = await transaction.$queryRaw<
        { id_penerimaan: string }[]
      >`
        SELECT
          'RCV' || LPAD(
            (COALESCE(MAX(SUBSTRING("id_penerimaan" FROM 4)::BIGINT), 0) + 1)::TEXT,
            3,
            '0'
          ) AS id_penerimaan
        FROM "penerimaan"
        WHERE "id_penerimaan" ~ '^RCV[0-9]+$'
      `;
      const nextReceiptNumber = Number(nextReceipt?.id_penerimaan.slice(3));

      if (!Number.isSafeInteger(nextReceiptNumber) || nextReceiptNumber < 1) {
        return { error: "ID penerimaan tidak dapat dibuat.", status: 500 };
      }

      const id_penerimaan = `RCV${String(nextReceiptNumber).padStart(3, "0")}`;
      const { databaseDate } = getJakartaDatabaseDate();
      await transaction.penerimaan.create({
        data: {
          id_penerimaan,
          tanggal_penerimaan: databaseDate,
          id_pemesanan: idPemesanan,
          no_faktur: invoice || null,
          id_penerima: session.userId,
        },
      });
      await transaction.detail_penerimaan.createMany({
        data: items.map((item) => ({
          id_penerimaan,
          id_barang: item.id_barang,
          jumlah_diterima: item.jumlah_diterima,
        })),
      });

      const fullyReceived = order.detail_pemesanan.every((orderLine) => {
        const received =
          (receivedByProduct.get(orderLine.id_barang) ?? 0) +
          (items.find((item) => item.id_barang === orderLine.id_barang)
            ?.jumlah_diterima ?? 0);
        return received >= orderLine.jumlah_pesan;
      });
      const status_pemesanan = fullyReceived
        ? "Diterima"
        : "Sebagian Diterima";

      await transaction.pemesanan.update({
        where: { id_pemesanan: idPemesanan },
        data: { status_pemesanan },
      });

      return {
        id_penerimaan,
        id_pemesanan: idPemesanan,
        status_pemesanan,
        items,
      };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to record warehouse receipt.", error);
    return Response.json(
      { error: "Penerimaan barang gagal dicatat. Silakan coba kembali." },
      { status: 500 },
    );
  }
}
