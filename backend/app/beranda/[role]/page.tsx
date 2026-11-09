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
    "Buat Pesanan Baru",
    "Riwayat Transaksi",
  ],
  "karyawan-gudang": [
    "Pemeriksaan Stok",
    "Pengajuan Pemesanan",
    "Penerimaan Barang",
  ],
  owner: [
    "Laporan Stok Barang",
    "Pengajuan Pemesanan",
    "Laporan Keuangan",
    "Riwayat Pemesanan",
  ],
  admin: ["Kelola Database"],
};

const roleDescriptions: Record<string, string> = {
  "karyawan-kasir":
    "Beranda operasional kasir untuk pembuatan pesanan dan pemantauan riwayat transaksi.",
  "karyawan-gudang":
    "Beranda operasional gudang untuk pemantauan stok, pengajuan pemesanan, dan penerimaan barang.",
  owner:
    "Beranda operasional owner untuk pemantauan stok, pengajuan, laporan keuangan, dan riwayat pemesanan.",
  admin:
    "Kelola seluruh data aplikasi melalui satu menu database.",
};

const defaultMenuIcons: [string, string, string] = [
  "/images/cashier-search.svg",
  "/images/cashier-plus-circle.svg",
  "/images/cashier-package.svg",
];
const cashierMenuIcons = [
  "/images/cashier-plus-circle.svg",
  "/images/cashier-package.svg",
];
const ownerMenuIcons = [
  "/images/owner-menu-search.svg",
  "/images/owner-menu-plus.svg",
  "/images/owner-menu-package.svg",
  "/images/owner-menu-package.svg",
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
        src={
          role === "owner"
            ? "/images/owner-home-background.png"
            : "/images/cashier-background.png"
        }
      />
      <div aria-hidden="true" className="role-dashboard-overlay" />

      <header className="role-dashboard-header">
        <div className="role-dashboard-brand">
          <Image
            alt=""
            aria-hidden="true"
            height={31}
            src={
              role === "owner"
                ? "/images/owner-home-brand.png"
                : "/images/cashier-brand-mark.png"
            }
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
            src={
              role === "owner"
                ? "/images/owner-home-avatar.png"
                : "/images/cashier-avatar.png"
            }
            width={72}
          />
        </div>
      </section>

      <nav aria-label={`Menu ${roleLabels[role]}`} className="role-dashboard-menu">
        <h2>MENU</h2>
        {menus.map((item, index) => {
          const menuContent = (
            <>
              <span aria-hidden="true" className="role-dashboard-menu-icon">
                <Image
                  alt=""
                  height={20}
                  src={
                    role === "owner"
                      ? ownerMenuIcons[index]
                      : role === "karyawan-kasir"
                        ? cashierMenuIcons[index]
                        : defaultMenuIcons[index]
                  }
                  width={20}
                />
              </span>
              <p>{item}</p>
              <Image
                alt=""
                aria-hidden="true"
                className="role-dashboard-menu-chevron"
                height={18}
                src={
                  role === "owner"
                    ? "/images/owner-menu-chevron.svg"
                    : "/images/cashier-chevron-right.svg"
                }
                width={18}
              />
            </>
          );

          const menuHref =
            role === "admin" && index === 0
              ? "/beranda/admin/kelola-database/"
              : role === "karyawan-kasir" && index === 0
              ? "/beranda/karyawan-kasir/form-pemesanan/"
              : role === "karyawan-kasir" && index === 1
                ? "/beranda/karyawan-kasir/riwayat-transaksi/"
                : role === "karyawan-gudang" && index === 0
              ? "/beranda/karyawan-gudang/pemeriksaan-stok/"
              : role === "karyawan-gudang" && index === 1
                ? "/beranda/karyawan-gudang/pengajuan-pemesanan/"
                : role === "karyawan-gudang" && index === 2
                  ? "/beranda/karyawan-gudang/penerimaan-barang/"
                : role === "owner" && index === 0
                  ? "/beranda/owner/informasi-stok-persediaan/"
                  : role === "owner" && index === 1
                    ? "/beranda/owner/persetujuan-pengajuan-pemesanan/"
                    : role === "owner" && index === 2
                      ? "/beranda/owner/laporan-keuangan/"
                      : role === "owner" && index === 3
                        ? "/beranda/owner/riwayat-pemesanan/"
                      : null;

          return menuHref ? (
            <a
              className="role-dashboard-menu-item"
              href={menuHref}
              key={item}
            >
              {menuContent}
            </a>
          ) : (
            <article className="role-dashboard-menu-item" key={item}>
              {menuContent}
            </article>
          );
        })}
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
