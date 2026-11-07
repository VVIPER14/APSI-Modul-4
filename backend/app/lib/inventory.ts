import { Prisma, type PrismaClient } from "@/app/generated/prisma/client";

type InventoryExecutor = PrismaClient | Prisma.TransactionClient;

export async function getAvailableStock(
  database: InventoryExecutor,
  productIds?: string[],
) {
  const productFilter = productIds
    ? Prisma.sql`WHERE product.id_barang = ANY(${productIds}::varchar[])`
    : Prisma.empty;

  const rows = await database.$queryRaw<
    { id_barang: string; stok: number }[]
  >(Prisma.sql`
    WITH latest_check AS (
      SELECT DISTINCT ON (detail.id_barang)
        detail.id_barang,
        detail.stok,
        inspection.tanggal_pemeriksaan
      FROM "detail_pemeriksaan" AS detail
      INNER JOIN "pemeriksaan_stok" AS inspection
        ON inspection.id_pemeriksaan = detail.id_pemeriksaan
      ORDER BY
        detail.id_barang,
        inspection.tanggal_pemeriksaan DESC,
        inspection.id_pemeriksaan DESC
    ),
    sales_since_check AS (
      SELECT
        detail.id_barang,
        SUM(detail.jumlah_jual)::BIGINT AS jumlah_terjual
      FROM "detail_transaksi" AS detail
      INNER JOIN "transaksi" AS transaction
        ON transaction.id_transaksi = detail.id_transaksi
      LEFT JOIN latest_check
        ON latest_check.id_barang = detail.id_barang
      WHERE transaction.status_transaksi = 'Selesai'
        AND transaction.tanggal_transaksi >= COALESCE(
          latest_check.tanggal_pemeriksaan,
          '-infinity'::date
        )
      GROUP BY detail.id_barang
    )
    SELECT
      product.id_barang,
      GREATEST(
        COALESCE(latest_check.stok, 0)::BIGINT
          - COALESCE(sales_since_check.jumlah_terjual, 0),
        0
      )::INTEGER AS stok
    FROM "barang" AS product
    LEFT JOIN latest_check
      ON latest_check.id_barang = product.id_barang
    LEFT JOIN sales_since_check
      ON sales_since_check.id_barang = product.id_barang
    ${productFilter}
  `);

  return new Map(rows.map((row) => [row.id_barang, row.stok]));
}
