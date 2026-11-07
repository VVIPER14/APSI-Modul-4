import type { Metadata } from "next";
import {
  Aboreto,
  Headland_One,
  Huninn,
  Inter,
  Instrument_Serif,
  Poppins,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const huninn = Huninn({
  variable: "--font-huninn",
  subsets: ["latin"],
  weight: "400",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const aboreto = Aboreto({
  variable: "--font-aboreto",
  subsets: ["latin"],
  weight: "400",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const headlandOne = Headland_One({
  variable: "--font-headland-one",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Login | Apotek Media Medika",
  description: "Masuk ke aplikasi Apotek Media Medika.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${huninn.variable} ${instrumentSerif.variable} ${aboreto.variable} ${poppins.variable} ${headlandOne.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
