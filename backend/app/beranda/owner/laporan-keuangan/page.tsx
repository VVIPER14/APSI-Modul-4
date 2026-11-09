import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import {
  getDailyFinancialHistory,
  getDailyFinancialReport,
  getPreviousJakartaDate,
  isValidReportDate,
} from "@/app/lib/reports";
import FinancialReportChart from "./financial-report-chart";

export const instant = false;

export const metadata: Metadata = {
  title: "Laporan Keuangan | Apotek Media Medika",
};

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Owner") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const { tanggal } = await searchParams;
  const previousDate = getPreviousJakartaDate();
  const requestedDate = Array.isArray(tanggal) ? tanggal[0] : tanggal;
  const selectedDate =
    requestedDate &&
    isValidReportDate(requestedDate) &&
    requestedDate <= previousDate
      ? requestedDate
      : previousDate;
  const data = await getDailyFinancialHistory();
  const selectedReport = await getDailyFinancialReport(selectedDate);

  return (
    <main className="role-dashboard stock-check-screen owner-stock-report">
      <header className="role-dashboard-header">
        <div className="role-dashboard-brand">
          <Image
            alt=""
            aria-hidden="true"
            height={31}
            src="/images/owner-home-brand.png"
            width={31}
          />
          <div>
            <p>APOTEK</p>
            <span>Media Medika</span>
          </div>
        </div>
        <div className="dashboard-logout">
          <Link href="/beranda/owner/">Kembali</Link>
        </div>
      </header>

      <section aria-label="Laporan keuangan" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">Owner</span>
          <h1>Laporan Keuangan</h1>
          <p>
            Pantau pemasukan transaksi selesai dan perubahan pemasukan dari
            waktu ke waktu.
          </p>
        </div>
        <div aria-hidden="true" className="role-dashboard-avatar">
          <Image
            alt=""
            height={72}
            src="/images/owner-home-avatar.png"
            width={72}
          />
        </div>
      </section>

      <form className="daily-report-toolbar" method="get">
        <label htmlFor="financial-report-date">
          Pilih tanggal riwayat laporan
        </label>
        <input
          defaultValue={selectedDate}
          id="financial-report-date"
          max={previousDate}
          name="tanggal"
          type="date"
        />
        <button type="submit">Lihat Riwayat</button>
        <p>Rekap pemasukan disajikan per hari, minggu, dan bulan.</p>
      </form>

      <FinancialReportChart
        data={data}
        selectedDate={selectedDate}
        selectedTotal={selectedReport.total_pemasukan}
        selectedTransactions={selectedReport.jumlah_transaksi}
      />
    </main>
  );
}
