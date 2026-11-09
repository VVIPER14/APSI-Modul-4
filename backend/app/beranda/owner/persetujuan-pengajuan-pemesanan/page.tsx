import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentSession, dashboardPathForRole } from "@/app/lib/auth";
import { proposalStatuses } from "@/app/lib/procurement";
import { prisma } from "@/app/lib/prisma";
import ApprovalTable, { type ApprovalProposal } from "./approval-table";

export const instant = false;

export const metadata: Metadata = {
  title: "Persetujuan Pengajuan | Apotek Media Medika",
};

export default async function ApprovalPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Owner") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  const [proposals, suppliers] = await Promise.all([
    prisma.pengajuan.findMany({
      where: {
        status_penyetujuan: {
          in: [
            proposalStatuses.processing,
            proposalStatuses.approved,
            proposalStatuses.rejected,
          ],
        },
      },
      orderBy: [{ tanggal_pengajuan: "desc" }, { id_pengajuan: "desc" }],
      include: {
        pengguna_pengajuan_id_pengajuTopengguna: {
          select: { nama_pengguna: true },
        },
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
        pemesanan: {
          select: { id_pemesanan: true },
          orderBy: { id_pemesanan: "asc" },
        },
      },
    }),
    prisma.supplier.findMany({
      orderBy: { nama_supplier: "asc" },
      select: {
        id_suplier: true,
        nama_supplier: true,
      },
    }),
  ]);

  const initialProposals: ApprovalProposal[] = proposals.map((proposal) => ({
    id_pengajuan: proposal.id_pengajuan,
    tanggal_pengajuan: proposal.tanggal_pengajuan.toISOString(),
    nama_pengaju:
      proposal.pengguna_pengajuan_id_pengajuTopengguna?.nama_pengguna ?? "—",
    status_penyetujuan: proposal.status_penyetujuan,
    harga_total: proposal.harga_total?.toFixed(0) ?? "0",
    id_pemesanan: proposal.pemesanan[0]?.id_pemesanan,
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
    <main className="role-dashboard procurement-screen approval-screen">
      <div aria-hidden="true" className="approval-cloud approval-cloud-left" />
      <div aria-hidden="true" className="approval-cloud approval-cloud-right" />
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

      <section aria-label="Persetujuan pengajuan" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <h1>Persetujuan Pengajuan</h1>
          <p>
            Tinjau detail pengajuan, rincian barang, dan status pengajuan
            sebelum melakukan keputusan.
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

      <ApprovalTable
        initialProposals={initialProposals}
        suppliers={suppliers.map((supplier) => ({
          id_supplier: supplier.id_suplier,
          nama_supplier: supplier.nama_supplier,
        }))}
      />
    </main>
  );
}
