import type { Metadata } from "next";
import StockInformationContent from "@/app/beranda/informasi-stok/page-content";

export const instant = false;

export const metadata: Metadata = {
  title: "Laporan Stok Barang | Apotek Media Medika",
};

export default function StockInformationPage() {
  return <StockInformationContent role="Owner" />;
}
