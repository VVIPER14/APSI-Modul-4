import type { Metadata } from "next";
import StockInformationContent from "@/app/beranda/informasi-stok/page-content";

export const metadata: Metadata = {
  title: "Informasi Stok Persediaan | Apotek Media Medika",
};

export default function StockInformationPage() {
  return <StockInformationContent role="Owner" />;
}
