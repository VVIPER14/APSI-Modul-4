import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";

export type DailyStockReportItem = {
  id_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  stok_minimum: number;
  stok_masuk: number;
  stok_keluar: number;
  stok_akhir: number;
};

export type DailyFinancialPoint = {
  tanggal_laporan: string;
  total_pemasukan: string;
  jumlah_transaksi: number;
};

export function getJakartaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((value) => value.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isValidReportDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getPreviousJakartaDate() {
  const today = getJakartaDateString();
  const previous = new Date(`${today}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export async function getDailyStockReport(date: string) {
  await prisma.$executeRaw(Prisma.sql`
    WITH requested_day AS (
      SELECT ${date}::date AS report_date
    ),
    latest_check AS (
      SELECT DISTINCT ON (detail.id_barang)
        detail.id_barang,
        detail.stok,
        inspection.tanggal_pemeriksaan
      FROM "detail_pemeriksaan" AS detail
      INNER JOIN "pemeriksaan_stok" AS inspection
        ON inspection.id_pemeriksaan = detail.id_pemeriksaan
      CROSS JOIN requested_day
      WHERE inspection.tanggal_pemeriksaan <= requested_day.report_date
      ORDER BY
        detail.id_barang,
        inspection.tanggal_pemeriksaan DESC,
        inspection.id_pemeriksaan DESC
    ),
    daily_receipts AS (
      SELECT detail.id_barang, SUM(detail.jumlah_diterima)::INTEGER AS jumlah
      FROM "detail_penerimaan" AS detail
      INNER JOIN "penerimaan" AS receipt
        ON receipt.id_penerimaan = detail.id_penerimaan
      CROSS JOIN requested_day
      WHERE receipt.tanggal_penerimaan = requested_day.report_date
      GROUP BY detail.id_barang
    ),
    daily_sales AS (
      SELECT detail.id_barang, SUM(detail.jumlah_jual)::INTEGER AS jumlah
      FROM "detail_transaksi" AS detail
      INNER JOIN "transaksi" AS transaction
        ON transaction.id_transaksi = detail.id_transaksi
      CROSS JOIN requested_day
      WHERE transaction.status_transaksi = 'Selesai'
        AND transaction.tanggal_transaksi = requested_day.report_date
      GROUP BY detail.id_barang
    ),
    receipts_to_date AS (
      SELECT detail.id_barang, SUM(detail.jumlah_diterima)::BIGINT AS jumlah
      FROM "detail_penerimaan" AS detail
      INNER JOIN "penerimaan" AS receipt
        ON receipt.id_penerimaan = detail.id_penerimaan
      LEFT JOIN latest_check
        ON latest_check.id_barang = detail.id_barang
      CROSS JOIN requested_day
      WHERE receipt.tanggal_penerimaan >= COALESCE(
          latest_check.tanggal_pemeriksaan,
          '-infinity'::date
        )
        AND receipt.tanggal_penerimaan <= requested_day.report_date
      GROUP BY detail.id_barang
    ),
    sales_to_date AS (
      SELECT detail.id_barang, SUM(detail.jumlah_jual)::BIGINT AS jumlah
      FROM "detail_transaksi" AS detail
      INNER JOIN "transaksi" AS transaction
        ON transaction.id_transaksi = detail.id_transaksi
      LEFT JOIN latest_check
        ON latest_check.id_barang = detail.id_barang
      CROSS JOIN requested_day
      WHERE transaction.status_transaksi = 'Selesai'
        AND transaction.tanggal_transaksi >= COALESCE(
          latest_check.tanggal_pemeriksaan,
          '-infinity'::date
        )
        AND transaction.tanggal_transaksi <= requested_day.report_date
      GROUP BY detail.id_barang
    )
    INSERT INTO "laporan_stok_harian" (
      "tanggal_laporan",
      "id_barang",
      "nama_barang",
      "kategori",
      "satuan",
      "stok_minimum",
      "stok_masuk",
      "stok_keluar",
      "stok_akhir"
    )
    SELECT
      requested_day.report_date,
      product.id_barang,
      product.nama_barang,
      product.kategori,
      product.satuan,
      COALESCE(product.stok_minimum, 0),
      COALESCE(daily_receipts.jumlah, 0),
      COALESCE(daily_sales.jumlah, 0),
      GREATEST(
        COALESCE(latest_check.stok, 0)::BIGINT
          + COALESCE(receipts_to_date.jumlah, 0)
          - COALESCE(sales_to_date.jumlah, 0),
        0
      )::INTEGER
    FROM "barang" AS product
    CROSS JOIN requested_day
    LEFT JOIN latest_check ON latest_check.id_barang = product.id_barang
    LEFT JOIN daily_receipts ON daily_receipts.id_barang = product.id_barang
    LEFT JOIN daily_sales ON daily_sales.id_barang = product.id_barang
    LEFT JOIN receipts_to_date ON receipts_to_date.id_barang = product.id_barang
    LEFT JOIN sales_to_date ON sales_to_date.id_barang = product.id_barang
    ON CONFLICT ("tanggal_laporan", "id_barang") DO UPDATE SET
      "nama_barang" = EXCLUDED."nama_barang",
      "kategori" = EXCLUDED."kategori",
      "satuan" = EXCLUDED."satuan",
      "stok_minimum" = EXCLUDED."stok_minimum",
      "stok_masuk" = EXCLUDED."stok_masuk",
      "stok_keluar" = EXCLUDED."stok_keluar",
      "stok_akhir" = EXCLUDED."stok_akhir"
  `);

  return prisma.laporan_stok_harian.findMany({
    where: { tanggal_laporan: new Date(`${date}T00:00:00.000Z`) },
    orderBy: { nama_barang: "asc" },
    select: {
      id_barang: true,
      nama_barang: true,
      kategori: true,
      satuan: true,
      stok_minimum: true,
      stok_masuk: true,
      stok_keluar: true,
      stok_akhir: true,
    },
  });
}

export async function getDailyFinancialHistory() {
  const endDate = getJakartaDateString();
  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 364);
  const startDate = start.toISOString().slice(0, 10);

  await prisma.$executeRaw(Prisma.sql`
    WITH report_days AS (
      SELECT generate_series(
        ${startDate}::date,
        ${endDate}::date,
        INTERVAL '1 day'
      )::date AS report_date
    ),
    sales AS (
      SELECT
        "tanggal_transaksi" AS report_date,
        COALESCE(SUM("total_harga"), 0)::DECIMAL(19, 0) AS total_pemasukan,
        COUNT(*)::INTEGER AS jumlah_transaksi
      FROM "transaksi"
      WHERE "status_transaksi" = 'Selesai'
        AND "tanggal_transaksi" BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY "tanggal_transaksi"
    )
    INSERT INTO "laporan_keuangan_harian" (
      "tanggal_laporan",
      "total_pemasukan",
      "jumlah_transaksi"
    )
    SELECT
      report_days.report_date,
      COALESCE(sales.total_pemasukan, 0),
      COALESCE(sales.jumlah_transaksi, 0)
    FROM report_days
    LEFT JOIN sales ON sales.report_date = report_days.report_date
    ON CONFLICT ("tanggal_laporan") DO UPDATE SET
      "total_pemasukan" = EXCLUDED."total_pemasukan",
      "jumlah_transaksi" = EXCLUDED."jumlah_transaksi"
  `);

  const rows = await prisma.laporan_keuangan_harian.findMany({
    where: {
      tanggal_laporan: {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T00:00:00.000Z`),
      },
    },
    orderBy: { tanggal_laporan: "asc" },
    select: {
      tanggal_laporan: true,
      total_pemasukan: true,
      jumlah_transaksi: true,
    },
  });

  return rows.map((row): DailyFinancialPoint => ({
    tanggal_laporan: row.tanggal_laporan.toISOString().slice(0, 10),
    total_pemasukan: row.total_pemasukan.toFixed(0),
    jumlah_transaksi: row.jumlah_transaksi,
  }));
}

export async function getDailyFinancialReport(date: string) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "laporan_keuangan_harian" (
      "tanggal_laporan",
      "total_pemasukan",
      "jumlah_transaksi"
    )
    SELECT
      ${date}::date,
      COALESCE(SUM("total_harga"), 0)::DECIMAL(19, 0),
      COUNT(*)::INTEGER
    FROM "transaksi"
    WHERE "tanggal_transaksi" = ${date}::date
      AND "status_transaksi" = 'Selesai'
    ON CONFLICT ("tanggal_laporan") DO UPDATE SET
      "total_pemasukan" = EXCLUDED."total_pemasukan",
      "jumlah_transaksi" = EXCLUDED."jumlah_transaksi"
  `);

  const row = await prisma.laporan_keuangan_harian.findUnique({
    where: { tanggal_laporan: new Date(`${date}T00:00:00.000Z`) },
    select: {
      total_pemasukan: true,
      jumlah_transaksi: true,
    },
  });

  return row
    ? {
        total_pemasukan: row.total_pemasukan.toFixed(0),
        jumlah_transaksi: row.jumlah_transaksi,
      }
    : { total_pemasukan: "0", jumlah_transaksi: 0 };
}
