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

const dashboardCards: Record<string, [string, string, string]> = {
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

const roleDescriptions: Record<string, string> = {
  "karyawan-kasir":
    "Beranda operasional kasir untuk pencarian obat, pembuatan pesanan, dan pemantauan transaksi.",
  "karyawan-gudang":
    "Beranda operasional gudang untuk pemantauan stok, pengajuan, dan penerimaan barang.",
  owner:
    "Beranda operasional owner untuk pemantauan stok, pengajuan, dan laporan persediaan.",
  admin:
    "Beranda operasional admin untuk pengelolaan data master, verifikasi data, dan pelaporan persediaan.",
};

const menuIcons: [string, string, string] = [
  "/images/cashier-search.svg",
  "/images/cashier-plus-circle.svg",
  "/images/cashier-package.svg",
];

function RoleDashboard({
  role,
  name,
  description,
  menus,
}: {
  role: string;
  name: string;
  description: string;
  menus: string[];
}) {
  return (
    <main className="role-dashboard">
      <Image
        alt=""
        aria-hidden="true"
        className="role-dashboard-background"
        fill
        priority
        sizes="100vw"
        src="/images/cashier-background.png"
      />
      <div aria-hidden="true" className="role-dashboard-overlay" />

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
        <LogoutButton />
      </header>

      <section aria-label="Profil pengguna" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">{roleLabels[role]}</span>
          <h1>Selamat datang, {name}</h1>
          <p>{description}</p>
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

      <nav aria-label={`Menu ${roleLabels[role]}`} className="role-dashboard-menu">
        <h2>MENU</h2>
        {menus.map((item, index) => (
          <article className="role-dashboard-menu-item" key={item}>
            <span aria-hidden="true" className="role-dashboard-menu-icon">
              <Image alt="" height={20} src={menuIcons[index]} width={20} />
            </span>
            <p>{item}</p>
            <Image
              alt=""
              aria-hidden="true"
              className="role-dashboard-menu-chevron"
              height={18}
              src="/images/cashier-chevron-right.svg"
              width={18}
            />
          </article>
        ))}
      </nav>
    </main>
  );
}

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
    <RoleDashboard
      description={roleDescriptions[role]}
      menus={cards}
      name={session.name}
      role={role}
    />
  );
}
