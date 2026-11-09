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
  title: "Riwayat Pemesanan | Apotek Media Medika",
};

export default async function OrderHistoryPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Owner") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const orders = await prisma.pemesanan.findMany({
    orderBy: [{ tanggal_pemesanan: "desc" }, { id_pemesanan: "desc" }],
    include: {
      supplier: { select: { id_suplier: true } },
      detail_pemesanan: {
        orderBy: { id_barang: "asc" },
        select: {
          id_barang: true,
          jumlah_pesan: true,
        },
      },
      penerimaan: {
        orderBy: [{ tanggal_penerimaan: "asc" }, { id_penerimaan: "asc" }],
        include: {
          pengguna: { select: { id_pengguna: true } },
          detail_penerimaan: {
            orderBy: { id_barang: "asc" },
            select: {
              id_barang: true,
              jumlah_diterima: true,
            },
          },
        },
      },
    },
  });
  const rows: SortableRecord[] = [];
  for (const order of orders) {
    if (order.detail_pemesanan.length === 0) {
      rows.push({
        id_pemesanan: order.id_pemesanan,
        tanggal_pemesanan: order.tanggal_pemesanan.toISOString(),
        status_pemesanan: order.status_pemesanan,
        id_supplier: order.supplier?.id_suplier ?? "—",
        id_barang: "—",
        jumlah_pesan: null,
        harga_total: order.harga_total?.toFixed(0) ?? "0",
        id_penerimaan: "—",
        tanggal_penerimaan: null,
        id_penerima: "—",
        no_faktur: "—",
        jumlah_diterima: null,
      });
      continue;
    }

    for (const item of order.detail_pemesanan) {
          const receipts = order.penerimaan.flatMap((receipt) =>
            receipt.detail_penerimaan
              .filter((received) => received.id_barang === item.id_barang)
              .map((received) => ({ receipt, received })),
          );

      if (receipts.length === 0) {
        rows.push({
          id_pemesanan: order.id_pemesanan,
          tanggal_pemesanan: order.tanggal_pemesanan.toISOString(),
          status_pemesanan: order.status_pemesanan,
          id_supplier: order.supplier?.id_suplier ?? "—",
          id_barang: item.id_barang,
          jumlah_pesan: item.jumlah_pesan,
          harga_total: order.harga_total?.toFixed(0) ?? "0",
          id_penerimaan: "—",
          tanggal_penerimaan: null,
          id_penerima: "—",
          no_faktur: "—",
          jumlah_diterima: null,
        });
        continue;
      }

      for (const { receipt, received } of receipts) {
        rows.push({
          id_pemesanan: order.id_pemesanan,
          tanggal_pemesanan: order.tanggal_pemesanan.toISOString(),
          status_pemesanan: order.status_pemesanan,
          id_supplier: order.supplier?.id_suplier ?? "—",
          id_barang: item.id_barang,
          jumlah_pesan: item.jumlah_pesan,
          harga_total: order.harga_total?.toFixed(0) ?? "0",
          id_penerimaan: receipt.id_penerimaan,
          tanggal_penerimaan: receipt.tanggal_penerimaan.toISOString(),
          id_penerima: receipt.pengguna?.id_pengguna ?? "—",
          no_faktur: receipt.no_faktur ?? "—",
          jumlah_diterima: received.jumlah_diterima,
        });
      }
    }
  }

  return (
    <main className="role-dashboard procurement-screen order-history-screen">
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

      <section aria-label="Riwayat pemesanan" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">Owner</span>
          <h1>Riwayat Pemesanan</h1>
          <p>
            Daftar pemesanan yang tercatat setelah pengajuan barang disetujui,
            termasuk supplier, jumlah barang yang dipesan, dan setiap
            penerimaan barang.
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

      <section
        aria-label="Daftar riwayat pemesanan"
        className="approval-panel order-history-panel"
      >
        <header className="procurement-section-heading">
          <div>
            <h2>Semua Pemesanan</h2>
            <p>Urut dari pemesanan terbaru.</p>
          </div>
          <span>{orders.length} pemesanan</span>
        </header>
        <div className="approval-table-viewport">
          <SortableRecordTable
            caption="Riwayat pemesanan beserta laporan penerimaan"
            className="approval-table order-history-table"
            columns={[
              { key: "id_pemesanan", label: "ID Pemesanan" },
              { key: "tanggal_pemesanan", label: "Tanggal Pemesanan", format: "date" },
              { key: "status_pemesanan", label: "Status Pemesanan" },
              { key: "id_supplier", label: "ID Supplier" },
              { key: "id_barang", label: "ID Barang" },
              { key: "jumlah_pesan", label: "Jumlah Pesan" },
              { key: "harga_total", label: "Harga Total", format: "currency" },
              { key: "id_penerimaan", label: "ID Penerimaan" },
              { key: "tanggal_penerimaan", label: "Tanggal Penerimaan", format: "date" },
              { key: "id_penerima", label: "ID Penerima" },
              { key: "no_faktur", label: "Nomor Faktur" },
              { key: "jumlah_diterima", label: "Jumlah Diterima" },
            ]}
            emptyMessage="Belum ada riwayat pemesanan."
            initialDirection="desc"
            initialSortKey="tanggal_pemesanan"
            rows={rows}
          />
        </div>
      </section>
    </main>
  );
}
