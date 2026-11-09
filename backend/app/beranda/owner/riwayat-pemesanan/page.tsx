import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const instant = false;

export const metadata: Metadata = {
  title: "Riwayat Pemesanan | Apotek Media Medika",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatCurrency(value: string) {
  return `Rp${new Intl.NumberFormat("id-ID").format(BigInt(value || "0"))}`;
}

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
          <table className="approval-table order-history-table">
            <thead>
              <tr>
                <th>ID Pemesanan</th>
                <th>Tanggal Pemesanan</th>
                <th>Status Pemesanan</th>
                <th>ID Supplier</th>
                <th>ID Barang</th>
                <th>Jumlah Pesan</th>
                <th>Harga Total</th>
                <th>ID Penerimaan</th>
                <th>Tanggal Penerimaan</th>
                <th>ID Penerima</th>
                <th>Nomor Faktur</th>
                <th>Jumlah Diterima</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order.id_pemesanan}>
                  {order.detail_pemesanan.map((item) => {
                    const receipts = order.penerimaan.flatMap((receipt) =>
                      receipt.detail_penerimaan
                        .filter(
                          (received) => received.id_barang === item.id_barang,
                        )
                        .map((received) => ({ receipt, received })),
                    );

                    return receipts.length ? (
                      receipts.map(({ receipt, received }) => (
                        <tr
                          key={`${order.id_pemesanan}-${item.id_barang}-${receipt.id_penerimaan}`}
                        >
                          <td>{order.id_pemesanan}</td>
                          <td>{formatDate(order.tanggal_pemesanan)}</td>
                          <td>{order.status_pemesanan}</td>
                          <td>{order.supplier?.id_suplier ?? "—"}</td>
                          <td>{item.id_barang}</td>
                          <td>{item.jumlah_pesan}</td>
                          <td>
                            {formatCurrency(order.harga_total?.toFixed(0) ?? "0")}
                          </td>
                          <td>{receipt.id_penerimaan}</td>
                          <td>{formatDate(receipt.tanggal_penerimaan)}</td>
                          <td>{receipt.pengguna?.id_pengguna ?? "—"}</td>
                          <td>{receipt.no_faktur ?? "—"}</td>
                          <td>{received.jumlah_diterima}</td>
                        </tr>
                      ))
                    ) : (
                      <tr
                        key={`${order.id_pemesanan}-${item.id_barang}-pending`}
                      >
                        <td>{order.id_pemesanan}</td>
                        <td>{formatDate(order.tanggal_pemesanan)}</td>
                        <td>{order.status_pemesanan}</td>
                        <td>{order.supplier?.id_suplier ?? "—"}</td>
                        <td>{item.id_barang}</td>
                        <td>{item.jumlah_pesan}</td>
                        <td>
                          {formatCurrency(order.harga_total?.toFixed(0) ?? "0")}
                        </td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                      </tr>
                    );
                  })}
                  {order.detail_pemesanan.length === 0 ? (
                    <tr>
                      <td>{order.id_pemesanan}</td>
                      <td>{formatDate(order.tanggal_pemesanan)}</td>
                      <td>{order.status_pemesanan}</td>
                      <td>{order.supplier?.id_suplier ?? "—"}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>
                        {formatCurrency(order.harga_total?.toFixed(0) ?? "0")}
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td className="proposal-empty-cell" colSpan={12}>
                    Belum ada riwayat pemesanan.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
