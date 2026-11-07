import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentSession, dashboardPathForRole } from "@/app/lib/auth";
import { getAvailableStock } from "@/app/lib/inventory";
import { prisma } from "@/app/lib/prisma";
import TransactionForm, { type CatalogProduct } from "./transaction-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Form Pemesanan | Apotek Media Medika",
};

export default async function TransactionPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Karyawan Kasir") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const products = await prisma.barang.findMany({
    orderBy: { nama_barang: "asc" },
    select: {
      id_barang: true,
      nama_barang: true,
      kategori: true,
      satuan: true,
      harga_jual: true,
    },
  });
  const currentStock = await getAvailableStock(prisma);
  const catalog: CatalogProduct[] = products.map((product) => ({
    id_barang: product.id_barang,
    nama_barang: product.nama_barang,
    kategori: product.kategori,
    satuan: product.satuan,
    harga_satuan_jual: product.harga_jual.toFixed(0),
    stok: currentStock.get(product.id_barang) ?? 0,
  }));

  return (
    <main className="role-dashboard stock-check-screen transaction-order-screen">
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

      <TransactionForm catalog={catalog} cashierName={session.name} />
    </main>
  );
}
