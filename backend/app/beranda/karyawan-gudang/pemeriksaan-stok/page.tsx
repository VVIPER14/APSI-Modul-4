import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { getInventorySummary } from "@/app/lib/inventory";
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
      kategori: true,
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
  const inventory = await getInventorySummary(prisma);
  const inventoryByProduct = new Map(
    inventory.map((item) => [item.id_barang, item]),
  );

  const initialItems = products.map((product) => {
    const latestCheck = product.detail_pemeriksaan[0];
    const stockSummary = inventoryByProduct.get(product.id_barang);

    return {
      id_barang: product.id_barang,
      nama_barang: product.nama_barang,
      kategori: product.kategori,
      satuan: product.satuan,
      stok_minimum: product.stok_minimum ?? 0,
      stok: stockSummary?.stok ?? 0,
      stok_masuk: stockSummary?.stok_masuk ?? 0,
      stok_keluar: stockSummary?.stok_keluar ?? 0,
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
            Periksa stok masuk, stok keluar, dan stok tersedia; catat kesesuaian
            stok serta perbarui jumlah setelah pemeriksaan.
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
