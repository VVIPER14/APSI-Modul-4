import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import StockCheckTable from "./stock-check-table";

export const metadata: Metadata = {
  title: "Pemeriksaan Stok | Apotek Media Medika",
};

export default function StockCheckPage() {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="role-dashboard stock-check-screen"
        >
          <header className="role-dashboard-header">
            <div className="role-dashboard-brand">
              <Image
                alt=""
                aria-hidden="true"
                height={31}
                src="/images/stock-check-brand-mark.png"
                width={31}
              />
              <div>
                <p>APOTEK</p>
                <span>Media Medika</span>
              </div>
            </div>
          </header>
          <p className="stock-check-loading">Memuat pemeriksaan stok...</p>
        </main>
      }
    >
      <StockCheckContent />
    </Suspense>
  );
}

async function StockCheckContent() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Karyawan Gudang") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const products = await prisma.barang.findMany({
    orderBy: { nama_barang: "asc" },
    select: {
      id_barang: true,
      nama_barang: true,
      satuan: true,
      stok_minimum: true,
      detail_pemeriksaan: {
        orderBy: [
          { pemeriksaan_stok: { tanggal_pemeriksaan: "desc" } },
          { id_pemeriksaan: "desc" },
        ],
        take: 1,
        select: { stok: true, catatan: true },
      },
    },
  });

  const initialItems = products.map((product) => {
    const latestCheck = product.detail_pemeriksaan[0];

    return {
      id_barang: product.id_barang,
      nama_barang: product.nama_barang,
      satuan: product.satuan,
      stok_minimum: product.stok_minimum ?? 0,
      stok: latestCheck?.stok ?? 0,
      catatan:
        latestCheck?.catatan && latestCheck.catatan !== "-"
          ? latestCheck.catatan
          : "",
    };
  });

  return (
    <main className="role-dashboard stock-check-screen">
      <header className="role-dashboard-header">
        <div className="role-dashboard-brand">
          <Image
            alt=""
            aria-hidden="true"
            height={31}
            src="/images/stock-check-brand-mark.png"
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

      <section aria-label="Pemeriksaan stok" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">Karyawan Gudang</span>
          <h1>Pemeriksaan Stok</h1>
          <p>
            Pantau persediaan, catat selisih stok fisik, dan perbarui jumlah
            stok setelah pemeriksaan.
          </p>
        </div>
        <div aria-hidden="true" className="role-dashboard-avatar">
          <Image
            alt=""
            height={72}
            src="/images/stock-check-avatar.png"
            width={72}
          />
        </div>
      </section>

      <StockCheckTable initialItems={initialItems} />
    </main>
  );
}
