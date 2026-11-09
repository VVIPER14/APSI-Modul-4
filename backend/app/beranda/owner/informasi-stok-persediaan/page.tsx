import type { Metadata } from "next";
import StockInformationContent from "@/app/beranda/informasi-stok/page-content";

export const instant = false;

export const metadata: Metadata = {
  title: "Laporan Stok Barang | Apotek Media Medika",
};

export default async function StockInformationPage({
  searchParams,
}: PageProps<"/beranda/owner/informasi-stok-persediaan">) {
  const { tanggal } = await searchParams;

  return (
    <StockInformationContent
      reportDate={Array.isArray(tanggal) ? tanggal[0] : tanggal}
      role="Owner"
    />
  );
}
