import { timingSafeEqual } from "node:crypto";
import {
  getDailyFinancialReport,
  getDailyStockReport,
  getPreviousJakartaDate,
} from "@/app/lib/reports";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return Response.json(
      { error: "Konfigurasi CRON_SECRET belum tersedia." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expectedAuthorization = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expectedAuthorization);

  if (
    authorizationBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(authorizationBuffer, expectedBuffer)
  ) {
    return Response.json({ error: "Tidak memiliki akses." }, { status: 401 });
  }

  const reportDate = getPreviousJakartaDate();

  try {
    const [stock, finance] = await Promise.all([
      getDailyStockReport(reportDate),
      getDailyFinancialReport(reportDate),
    ]);

    return Response.json({
      tanggal_laporan: reportDate,
      jumlah_barang: stock.length,
      jumlah_transaksi: finance.jumlah_transaksi,
    });
  } catch (error) {
    console.error("Failed to generate daily reports.", error);
    return Response.json(
      { error: "Rekap laporan harian gagal dibuat." },
      { status: 500 },
    );
  }
}
