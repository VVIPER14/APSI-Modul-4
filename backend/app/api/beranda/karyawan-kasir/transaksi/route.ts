import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentSession } from "@/app/lib/auth";
import { getAvailableStock } from "@/app/lib/inventory";
import { prisma } from "@/app/lib/prisma";

type TransactionItemInput = {
  id_barang: string;
  jumlah_jual: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseItems(body: unknown): TransactionItemInput[] | null {
  if (
    !isRecord(body) ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 100
  ) {
    return null;
  }

  const parsed: TransactionItemInput[] = [];
  const seenIds = new Set<string>();

  for (const value of body.items) {
    if (
      !isRecord(value) ||
      typeof value.id_barang !== "string" ||
      !value.id_barang.trim() ||
      value.id_barang.length > 255 ||
      typeof value.jumlah_jual !== "number" ||
      !Number.isSafeInteger(value.jumlah_jual) ||
      value.jumlah_jual < 1 ||
      value.jumlah_jual > 2147483647 ||
      seenIds.has(value.id_barang)
    ) {
      return null;
    }

    seenIds.add(value.id_barang);
    parsed.push({
      id_barang: value.id_barang,
      jumlah_jual: value.jumlah_jual,
    });
  }

  return parsed;
}

function getJakartaDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") =>
    parts.find((value) => value.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;

  return {
    date,
    databaseDate: new Date(`${date}T00:00:00.000Z`),
  };
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  if (session.role !== "Karyawan Kasir") {
    return Response.json(
      { error: "Hanya karyawan kasir yang dapat mencatat transaksi." },
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
      { error: "Pilih minimal satu barang dan masukkan jumlah yang valid." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`LOCK TABLE "transaksi" IN EXCLUSIVE MODE`;

      const products = await transaction.barang.findMany({
        where: { id_barang: { in: items.map((item) => item.id_barang) } },
        select: {
          id_barang: true,
          nama_barang: true,
          kategori: true,
          satuan: true,
          harga_jual: true,
        },
      });

      if (products.length !== items.length) {
        return {
          error:
            "Daftar barang berubah. Muat ulang halaman sebelum mencatat transaksi.",
          status: 409,
        };
      }

      const availableStock = await getAvailableStock(
        transaction,
        items.map((item) => item.id_barang),
      );
      const productById = new Map(
        products.map((product) => [product.id_barang, product]),
      );
      const insufficient = items.flatMap((item) => {
        const stock = availableStock.get(item.id_barang) ?? 0;
        const product = productById.get(item.id_barang);

        return stock < item.jumlah_jual && product
          ? [
              {
                id_barang: item.id_barang,
                nama_barang: product.nama_barang,
                tersedia: stock,
                diminta: item.jumlah_jual,
              },
            ]
          : [];
      });

      if (insufficient.length > 0) {
        return {
          error: "Stok tidak mencukupi untuk beberapa barang.",
          insufficient,
          status: 409,
        };
      }

      const lines = items.map((item) => {
        const product = productById.get(item.id_barang);

        if (!product) {
          throw new Error("Product disappeared during transaction validation.");
        }

        const price = new Prisma.Decimal(product.harga_jual);
        const subtotal = price.mul(item.jumlah_jual);

        return {
          ...item,
          product,
          price,
          subtotal,
        };
      });
      const total = lines.reduce(
        (sum, line) => sum.plus(line.subtotal),
        new Prisma.Decimal(0),
      );

      if (total.greaterThanOrEqualTo("10000000000000000000")) {
        return {
          error: "Total transaksi melebihi batas nilai yang dapat disimpan.",
          status: 400,
        };
      }

      const [nextTransaction] = await transaction.$queryRaw<
        { id_transaksi: string }[]
      >`
        SELECT
          'TRX' || LPAD(
            (COALESCE(MAX(SUBSTRING("id_transaksi" FROM 4)::BIGINT), 0) + 1)::TEXT,
            3,
            '0'
          ) AS id_transaksi
        FROM "transaksi"
        WHERE "id_transaksi" ~ '^TRX[0-9]+$'
      `;
      const id_transaksi = nextTransaction?.id_transaksi;

      if (!id_transaksi) {
        return {
          error: "ID transaksi tidak dapat dibuat.",
          status: 500,
        };
      }

      const { date, databaseDate } = getJakartaDate();

      await transaction.transaksi.create({
        data: {
          id_transaksi,
          tanggal_transaksi: databaseDate,
          id_kasir: session.userId,
          total_harga: total,
          status_transaksi: "Selesai",
        },
      });
      await transaction.detail_transaksi.createMany({
        data: lines.map((line) => ({
          id_transaksi,
          id_barang: line.id_barang,
          jumlah_jual: line.jumlah_jual,
          harga_satuan_jual: line.price,
        })),
      });

      return {
        transaction: {
          id_transaksi,
          tanggal_transaksi: date,
          total_harga: total.toFixed(0),
          items: lines.map((line) => ({
            id_barang: line.id_barang,
            nama_barang: line.product.nama_barang,
            kategori: line.product.kategori,
            satuan: line.product.satuan,
            jumlah_jual: line.jumlah_jual,
            harga_satuan_jual: line.price.toFixed(0),
            subtotal: line.subtotal.toFixed(0),
          })),
        },
      };
    });

    if ("error" in result) {
      return Response.json(
        {
          error: result.error,
          ...("insufficient" in result
            ? { insufficient: result.insufficient }
            : {}),
        },
        { status: result.status },
      );
    }

    return Response.json(result.transaction, { status: 201 });
  } catch (error) {
    console.error("Failed to record cashier transaction.", error);
    return Response.json(
      { error: "Transaksi gagal dicatat. Silakan coba kembali." },
      { status: 500 },
    );
  }
}
