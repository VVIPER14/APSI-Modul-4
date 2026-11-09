import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { getInventorySummary } from "@/app/lib/inventory";
import { prisma } from "@/app/lib/prisma";
import {
  getDailyStockReport,
  getPreviousJakartaDate,
  isValidReportDate,
} from "@/app/lib/reports";
import StockInformationTable, {
  type StockInformationItem,
} from "./stock-information-table";

const descriptions: Record<"Owner" | "Karyawan Kasir", string> = {
  "Karyawan Kasir":
    "Lihat ketersediaan stok barang, stok minimum, harga satuan, dan status untuk membantu proses transaksi di kasir.",
  Owner:
    "Lihat laporan stok barang, stok minimum, stok tersedia, dan status persediaan sebagai dasar evaluasi dan pengambilan keputusan pengadaan.",
};

export default async function StockInformationContent({
  role,
  reportDate,
}: {
  role: "Owner" | "Karyawan Kasir";
  reportDate?: string;
}) {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== role) {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const selectedDate =
    role === "Owner" &&
    reportDate &&
    isValidReportDate(reportDate) &&
    reportDate <= getPreviousJakartaDate()
      ? reportDate
      : getPreviousJakartaDate();
  let items: StockInformationItem[];

  if (role === "Owner") {
    const report = await getDailyStockReport(selectedDate);
    items = report.map((item) => ({
      id_barang: item.id_barang,
      nama_barang: item.nama_barang,
      kategori: item.kategori,
      satuan: item.satuan,
      stok_minimum: item.stok_minimum,
      stok: item.stok_akhir,
      stok_masuk: item.stok_masuk,
      stok_keluar: item.stok_keluar,
      harga_jual: "0",
    }));
  } else {
    const products = await prisma.barang.findMany({
      orderBy: { nama_barang: "asc" },
      select: {
        id_barang: true,
        nama_barang: true,
        kategori: true,
        satuan: true,
        stok_minimum: true,
        harga_jual: true,
      },
    });
    const inventory = await getInventorySummary(prisma);
    const inventoryByProduct = new Map(
      inventory.map((item) => [item.id_barang, item]),
    );

    items = products.map((product) => ({
      id_barang: product.id_barang,
      nama_barang: product.nama_barang,
      kategori: product.kategori,
      satuan: product.satuan,
      stok_minimum: product.stok_minimum ?? 0,
      stok: inventoryByProduct.get(product.id_barang)?.stok ?? 0,
      stok_masuk: inventoryByProduct.get(product.id_barang)?.stok_masuk ?? 0,
      stok_keluar: inventoryByProduct.get(product.id_barang)?.stok_keluar ?? 0,
      harga_jual: product.harga_jual.toString(),
    }));
  }

  return (
    <main
      className={`role-dashboard stock-check-screen stock-info-screen${
        role === "Owner" ? " owner-stock-report" : ""
      }`}
    >
      <header className="role-dashboard-header">
        <div className="role-dashboard-brand">
          <Image
            alt=""
            aria-hidden="true"
            height={31}
            src={
              role === "Owner"
                ? "/images/owner-home-brand.png"
                : "/images/cashier-brand-mark.png"
            }
            width={31}
          />
          <div>
            <p>APOTEK</p>
            <span>Media Medika</span>
          </div>
        </div>
        <div className="dashboard-logout">
          <Link href={dashboardPathForRole(role) ?? "/"}>Kembali</Link>
        </div>
      </header>

      <section aria-label="Informasi stok" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">{role}</span>
          <h1>{role === "Owner" ? "Laporan Stok" : "Informasi Stok"}</h1>
          <p>{descriptions[role]}</p>
        </div>
        <div aria-hidden="true" className="role-dashboard-avatar">
          <Image
            alt=""
            height={72}
            src={
              role === "Owner"
                ? "/images/owner-home-avatar.png"
                : "/images/cashier-avatar.png"
            }
            width={72}
          />
        </div>
      </section>

      {role === "Owner" ? (
        <form className="daily-report-toolbar" method="get">
          <label htmlFor="stock-report-date">Pilih tanggal laporan stok</label>
          <input
            defaultValue={selectedDate}
            id="stock-report-date"
            max={getPreviousJakartaDate()}
            name="tanggal"
            type="date"
          />
          <button type="submit">Lihat Laporan</button>
          <p>Rekap stok masuk, stok keluar, dan stok akhir per tanggal.</p>
        </form>
      ) : null}

      <StockInformationTable
        items={items}
        reportDate={role === "Owner" ? selectedDate : undefined}
        role={role}
      />
    </main>
  );
}
