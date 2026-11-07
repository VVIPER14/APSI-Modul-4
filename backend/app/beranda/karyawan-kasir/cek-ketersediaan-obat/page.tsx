import type { Metadata } from "next";
import StockInformationContent from "@/app/beranda/informasi-stok/page-content";

export const instant = false;

export const metadata: Metadata = {
  title: "Cek Ketersediaan Obat | Apotek Media Medika",
};

export default function MedicineAvailabilityPage() {
  return <StockInformationContent role="Karyawan Kasir" />;
}
