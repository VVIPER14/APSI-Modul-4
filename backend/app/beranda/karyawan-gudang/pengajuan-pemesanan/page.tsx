import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentSession, dashboardPathForRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import ProposalForm, {
  type ProposalRecord,
  type ProposalSupplier,
  type ProposalProduct,
} from "./proposal-form";

export const metadata: Metadata = {
  title: "Pengajuan Pemesanan | Apotek Media Medika",
};

export default async function ProposalPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Karyawan Gudang") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const [products, suppliers, proposals] = await Promise.all([
    prisma.barang.findMany({
      orderBy: { nama_barang: "asc" },
      select: {
        id_barang: true,
        nama_barang: true,
        kategori: true,
        satuan: true,
      },
    }),
    prisma.supplier.findMany({
      orderBy: { nama_supplier: "asc" },
      select: { id_suplier: true, nama_supplier: true },
    }),
    prisma.pengajuan.findMany({
      where: { id_pengaju: session.userId },
      orderBy: [{ tanggal_pengajuan: "desc" }, { id_pengajuan: "desc" }],
      include: {
        detail_pengajuan: {
          include: {
            barang: {
              select: {
                nama_barang: true,
                kategori: true,
                satuan: true,
              },
            },
            supplier: { select: { nama_supplier: true } },
          },
        },
      },
    }),
  ]);

  const catalog: ProposalProduct[] = products.map((product) => ({
    id_barang: product.id_barang,
    nama_barang: product.nama_barang,
    kategori: product.kategori,
    satuan: product.satuan,
  }));
  const supplierOptions: ProposalSupplier[] = suppliers.map((supplier) => ({
    id_supplier: supplier.id_suplier,
    nama_supplier: supplier.nama_supplier,
  }));
  const initialProposals: ProposalRecord[] = proposals.map((proposal) => ({
    id_pengajuan: proposal.id_pengajuan,
    tanggal_pengajuan: proposal.tanggal_pengajuan.toISOString(),
    status_penyetujuan: proposal.status_penyetujuan,
    harga_total: proposal.harga_total?.toFixed(0) ?? "0",
    items: proposal.detail_pengajuan
      .map((item) => ({
        id_barang: item.id_barang,
        nama_barang: item.barang.nama_barang,
        kategori: item.barang.kategori,
        satuan: item.barang.satuan,
        harga_satuan: item.harga_satuan.toFixed(0),
        jumlah_pesan: item.jumlah_pesan,
        id_supplier: item.id_supplier,
        nama_supplier: item.supplier?.nama_supplier ?? null,
      }))
      .sort((left, right) => left.nama_barang.localeCompare(right.nama_barang)),
  }));

  return (
    <main className="role-dashboard procurement-screen proposal-screen">
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
          <Link href="/beranda/karyawan-gudang/">Kembali</Link>
        </div>
      </header>

      <section aria-label="Pengajuan pemesanan" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">Karyawan Gudang</span>
          <h1>Pengajuan Pemesanan</h1>
          <p>
            Daftar barang yang akan diajukan, lengkapi supplier, jumlah
            diajukan, dan harga satuan sebelum dikirim.
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

      <ProposalForm
        initialProposals={initialProposals}
        products={catalog}
        suppliers={supplierOptions}
      />
    </main>
  );
}
