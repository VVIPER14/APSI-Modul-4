import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import ReceiptForm, { type ReceiptOrder } from "./receipt-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Penerimaan Barang | Apotek Media Medika",
};

export default async function ReceiptPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Karyawan Gudang") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const orders = await prisma.pemesanan.findMany({
    where: {
      status_pemesanan: {
        in: ["Menunggu Penerimaan", "Sebagian Diterima"],
      },
    },
    orderBy: [{ tanggal_pemesanan: "asc" }, { id_pemesanan: "asc" }],
    include: {
      supplier: { select: { nama_supplier: true } },
      detail_pemesanan: {
        include: {
          barang: {
            select: { nama_barang: true, satuan: true },
          },
        },
        orderBy: { id_barang: "asc" },
      },
      penerimaan: {
        include: {
          detail_penerimaan: {
            select: { id_barang: true, jumlah_diterima: true },
          },
        },
      },
    },
  });

  const initialOrders: ReceiptOrder[] = orders.map((order) => {
    const receivedByItem = new Map<string, number>();
    for (const receipt of order.penerimaan) {
      for (const item of receipt.detail_penerimaan) {
        receivedByItem.set(
          item.id_barang,
          (receivedByItem.get(item.id_barang) ?? 0) + item.jumlah_diterima,
        );
      }
    }

    return {
      id_pemesanan: order.id_pemesanan,
      tanggal_pemesanan: order.tanggal_pemesanan.toISOString(),
      status_pemesanan: order.status_pemesanan,
      nama_supplier: order.supplier?.nama_supplier ?? "—",
      items: order.detail_pemesanan.map((item) => {
        const jumlah_diterima = receivedByItem.get(item.id_barang) ?? 0;
        return {
          id_barang: item.id_barang,
          nama_barang: item.barang.nama_barang,
          satuan: item.barang.satuan,
          jumlah_pesan: item.jumlah_pesan,
          jumlah_diterima,
          sisa: Math.max(item.jumlah_pesan - jumlah_diterima, 0),
        };
      }),
    };
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
          <Link href="/beranda/karyawan-gudang/">Kembali</Link>
        </div>
      </header>

      <section aria-label="Penerimaan barang" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">Karyawan Gudang</span>
          <h1>Penerimaan Barang</h1>
          <p>
            Catat barang yang diterima dari supplier untuk pesanan yang telah
            disetujui owner.
          </p>
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

      <ReceiptForm initialOrders={initialOrders} />
    </main>
  );
}
