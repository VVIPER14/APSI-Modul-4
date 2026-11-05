import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentSession, dashboardPathForRole } from "@/app/lib/auth";
import LogoutButton from "@/app/logout-button";

export const instant = false;

const roleLabels: Record<string, string> = {
  admin: "Admin",
  "karyawan-gudang": "Karyawan Gudang",
  "karyawan-kasir": "Karyawan Kasir",
  owner: "Owner",
};

export async function generateMetadata({
  params,
}: PageProps<"/beranda/[role]">): Promise<Metadata> {
  const { role } = await params;
  const label = roleLabels[role];

  return {
    title: label
      ? `Beranda ${label} | Apotek Media Medika`
      : "Beranda | Apotek Media Medika",
  };
}

const dashboardCards: Record<string, string[]> = {
  "karyawan-kasir": [
    "Cek Ketersediaan Obat",
    "Buat Pesanan Baru",
    "Cek Riwayat Transaksi",
  ],
  "karyawan-gudang": [
    "Pemeriksaan Stok",
    "Pengajuan Stok",
    "Penerimaan Barang",
  ],
  owner: [
    "Informasi Stok Persediaan",
    "Pengajuan Pemesanan",
    "Laporan Persediaan",
  ],
  admin: ["Data Master", "Verifikasi Data", "Laporan Persediaan"],
};

export default async function DashboardPage({
  params,
}: PageProps<"/beranda/[role]">) {
  await connection();
  const { role } = await params;
  const session = await getCurrentSession();
  const expectedDashboard = session
    ? dashboardPathForRole(session.role)
    : null;

  if (!session || !expectedDashboard) {
    redirect("/");
  }

  if (expectedDashboard !== `/beranda/${role}`) {
    redirect(expectedDashboard);
  }

  const cards = dashboardCards[role];

  if (!cards) {
    redirect(expectedDashboard);
  }

  return (
    <main className="dashboard-screen">
      <Image
        alt=""
        className="dashboard-background"
        fill
        priority
        sizes="100vw"
        src="/images/dashboard-background.png"
      />
      <header className="dashboard-brand">
        <Image
          alt=""
          aria-hidden="true"
          height={31}
          src="/images/pharmacy-mark.png"
          width={31}
        />
        <p>
          <span>APOTEK</span> Media Medika
        </p>
      </header>

      <section aria-label="Profil pengguna" className="dashboard-profile">
        <div className="dashboard-user">
          <Image
            alt=""
            aria-hidden="true"
            className="dashboard-avatar"
            height={124}
            src="/images/dashboard-avatar.png"
            width={124}
          />
          <h1>{session.name}</h1>
        </div>
        <hr />
        <p>Role : {session.role}</p>
      </section>

      <nav
        aria-label={`Menu ${session.role}`}
        className="dashboard-menu"
        data-role={session.role}
      >
        {cards.map((card) => (
          <article className="dashboard-card" key={card}>
            <h2>{card}</h2>
            {session.role === "Karyawan Kasir" &&
              card === "Cek Riwayat Transaksi" && (
                <p>
                  Cek riwayat transaksi untuk melihat jumlah obat yang terjual
                  hingga melihat total pendapatan.
                </p>
              )}
          </article>
        ))}
      </nav>

      <LogoutButton />
      <div aria-hidden="true" className="dashboard-indicator" />
    </main>
  );
}
