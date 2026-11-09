import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardPathForRole, getCurrentSession } from "@/app/lib/auth";
import DatabaseManager from "./database-manager";

export const instant = false;

export const metadata: Metadata = {
  title: "Kelola Database | Apotek Media Medika",
};

export default async function ManageDatabasePage() {
  await connection();
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "Admin") {
    redirect(dashboardPathForRole(session.role) ?? "/");
  }

  return (
    <main className="role-dashboard procurement-screen database-screen">
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
          <Link href="/beranda/admin/">Kembali</Link>
        </div>
      </header>

      <section aria-label="Kelola database" className="role-dashboard-hero">
        <div className="role-dashboard-hero-copy">
          <span className="role-dashboard-role">Admin</span>
          <h1>Kelola Database</h1>
          <p>
            Tambahkan, ubah, dan hapus data pada seluruh tabel aplikasi.
            Penghapusan ditolak jika data masih memiliki relasi.
          </p>
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

      <DatabaseManager />
    </main>
  );
}
