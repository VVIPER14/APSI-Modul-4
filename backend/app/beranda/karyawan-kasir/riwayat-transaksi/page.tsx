import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import SortableRecordTable, {
  type SortableRecord,
} from "@/app/lib/sortable-record-table";

export const instant = false;

export const metadata: Metadata = {
  title: "Riwayat Transaksi | Apotek Media Medika",
};

export default async function TransactionHistoryPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Karyawan Kasir") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const transactions = await prisma.transaksi.findMany({
    where: { status_transaksi: "Selesai" },
    orderBy: [
      { tanggal_transaksi: "desc" },
      { waktu_transaksi: "desc" },
      { id_transaksi: "desc" },
    ],
    include: {
      detail_transaksi: {
        orderBy: { id_barang: "asc" },
        include: {
          barang: {
            select: {
              nama_barang: true,
              kategori: true,
              satuan: true,
            },
          },
        },
      },
    },
  });
  const rows: SortableRecord[] = transactions.flatMap((transaction) => {
    const items = transaction.detail_transaksi.length
      ? transaction.detail_transaksi
      : [null];

    return items.map((item) => ({
      id_transaksi: transaction.id_transaksi,
      tanggal_transaksi: transaction.tanggal_transaksi.toISOString(),
      waktu_transaksi: transaction.waktu_transaksi.toISOString().slice(11, 19),
      barang_terjual: item?.barang.nama_barang ?? "—",
      kategori: item?.barang.kategori ?? "—",
      satuan: item?.barang.satuan ?? "—",
      harga_satuan: item?.harga_satuan_jual?.toFixed(0) ?? null,
      jumlah_barang: item?.jumlah_jual ?? null,
      harga_subtotal:
        item?.harga_satuan_jual
          ?.mul(item.jumlah_jual)
          .toFixed(0) ?? null,
      harga_total: transaction.total_harga?.toFixed(0) ?? "0",
    }));
  });

  return (
    <main className="role-dashboard stock-check-screen owner-stock-report">
      <header className="role-dashboard-header">
        <div className="role-dashboard-brand">
          <Image
            alt=""
            aria-hidden="true"
            height={31}
            src="/images/cashier-brand-mark.png"
            width={31}
          />
          <div>
            <p>APOTEK</p>
            <span>Media Medika</span>
          </div>
        </div>
        <div className="dashboard-logout">
          <Link href="/beranda/karyawan-kasir/">Kembali</Link>
        </div>
      </header>

      <section aria-label="Riwayat transaksi" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">Karyawan Kasir</span>
          <h1>Riwayat Transaksi</h1>
          <p>Daftar transaksi selesai beserta rincian barang yang terjual.</p>
        </div>
        <div aria-hidden="true" className="role-dashboard-avatar">
          <Image
            alt=""
            height={72}
            src="/images/cashier-avatar.png"
            width={72}
          />
        </div>
      </section>

      <section aria-label="Tabel riwayat transaksi" className="report-panel">
        <div className="report-table-viewport">
          <SortableRecordTable
            caption="ID, tanggal dan waktu transaksi, detail barang terjual, dan total harga"
            className="report-table transaction-history-table"
            columns={[
              { key: "id_transaksi", label: "ID Transaksi" },
              { key: "tanggal_transaksi", label: "Tanggal Transaksi", format: "date" },
              { key: "waktu_transaksi", label: "Waktu", format: "time" },
              { key: "barang_terjual", label: "Barang Terjual" },
              { key: "kategori", label: "Kategori" },
              { key: "satuan", label: "Satuan" },
              { key: "harga_satuan", label: "Harga Satuan", format: "currency" },
              { key: "jumlah_barang", label: "Jumlah Barang" },
              { key: "harga_subtotal", label: "Harga Subtotal", format: "currency" },
              { key: "harga_total", label: "Harga Total", format: "currency" },
            ]}
            emptyMessage="Belum ada transaksi."
            initialDirection="desc"
            initialSortKey="tanggal_transaksi"
            rows={rows}
          />
        </div>
      </section>
    </main>
  );
}
