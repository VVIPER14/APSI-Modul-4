import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import { getAvailableStock } from "@/app/lib/inventory";
import { prisma } from "@/app/lib/prisma";
import StockInformationTable, {
  type StockInformationItem,
} from "./stock-information-table";

const descriptions: Record<"Owner" | "Karyawan Kasir", string> = {
  "Karyawan Kasir":
    "Lihat ketersediaan stok barang, stok minimum, harga satuan, dan status untuk membantu proses transaksi di kasir.",
  Owner:
    "Pantau ketersediaan stok barang, stok minimum, harga satuan, dan status untuk memantau persediaan dan mengambil keputusan pengadaan.",
};

export default async function StockInformationContent({
  role,
}: {
  role: "Owner" | "Karyawan Kasir";
}) {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== role) {
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
      harga_jual: true,
    },
  });
  const currentStock = await getAvailableStock(prisma);

  const items: StockInformationItem[] = products.map((product) => ({
    id_barang: product.id_barang,
    nama_barang: product.nama_barang,
    kategori: product.kategori,
    satuan: product.satuan,
    stok_minimum: product.stok_minimum ?? 0,
    stok: currentStock.get(product.id_barang) ?? 0,
    harga_jual: product.harga_jual.toString(),
  }));

  return (
    <main className="role-dashboard stock-check-screen stock-info-screen">
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
          <Link href={dashboardPathForRole(role) ?? "/"}>Kembali</Link>
        </div>
      </header>

      <section aria-label="Informasi stok" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">{role}</span>
          <h1>Informasi Stok</h1>
          <p>{descriptions[role]}</p>
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

      <StockInformationTable items={items} />
    </main>
  );
}
