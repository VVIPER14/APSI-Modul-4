import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const instant = false;

export const metadata: Metadata = {
  title: "Riwayat Transaksi | Apotek Media Medika",
};

function formatDate(date: Date) {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

function formatTime(time: Date) {
  return `${time.toISOString().slice(11, 16)} WIB`;
}

function formatRupiah(value: string) {
  return `Rp${new Intl.NumberFormat("id-ID").format(BigInt(value))}`;
}

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
          <table className="report-table transaction-history-table">
            <caption className="sr-only">
              ID, tanggal dan waktu transaksi, detail barang terjual, dan total
              harga
            </caption>
            <thead>
              <tr>
                <th scope="col">ID Transaksi</th>
                <th scope="col">Tanggal Transaksi</th>
                <th scope="col">Waktu</th>
                <th scope="col">Barang Terjual</th>
                <th scope="col">Kategori</th>
                <th scope="col">Satuan</th>
                <th scope="col">Harga Satuan</th>
                <th scope="col">Jumlah Barang</th>
                <th scope="col">Harga Subtotal</th>
                <th scope="col">Harga Total</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length ? (
                transactions.flatMap((transaction) =>
                  transaction.detail_transaksi.map((item, index) => (
                    <tr key={`${transaction.id_transaksi}-${item.id_barang}`}>
                      {index === 0 ? (
                        <>
                          <td rowSpan={transaction.detail_transaksi.length}>
                            {transaction.id_transaksi}
                          </td>
                          <td rowSpan={transaction.detail_transaksi.length}>
                            {formatDate(transaction.tanggal_transaksi)}
                          </td>
                          <td rowSpan={transaction.detail_transaksi.length}>
                            {formatTime(transaction.waktu_transaksi)}
                          </td>
                        </>
                      ) : null}
                      <td>{item.barang.nama_barang}</td>
                      <td>{item.barang.kategori}</td>
                      <td>{item.barang.satuan}</td>
                      <td>
                        {formatRupiah(item.harga_satuan_jual?.toFixed(0) ?? "0")}
                      </td>
                      <td>{item.jumlah_jual}</td>
                      <td>
                        {formatRupiah(
                          item.harga_satuan_jual
                            ?.mul(item.jumlah_jual)
                            .toFixed(0) ?? "0",
                        )}
                      </td>
                      {index === 0 ? (
                        <td rowSpan={transaction.detail_transaksi.length}>
                          {formatRupiah(
                            transaction.total_harga?.toFixed(0) ?? "0",
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )),
                )
              ) : (
                <tr>
                  <td className="report-empty" colSpan={10}>
                    Belum ada transaksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
