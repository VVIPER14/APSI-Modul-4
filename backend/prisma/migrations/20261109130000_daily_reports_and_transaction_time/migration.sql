ALTER TABLE "transaksi"
ADD COLUMN "waktu_transaksi" TIME(6) NOT NULL DEFAULT '00:00:00';

ALTER TABLE "transaksi"
ALTER COLUMN "waktu_transaksi" DROP DEFAULT;

CREATE TABLE "laporan_stok_harian" (
    "tanggal_laporan" DATE NOT NULL,
    "id_barang" VARCHAR(255) NOT NULL,
    "nama_barang" VARCHAR(255) NOT NULL,
    "kategori" VARCHAR(255) NOT NULL,
    "satuan" VARCHAR(255) NOT NULL,
    "stok_minimum" INTEGER NOT NULL,
    "stok_masuk" INTEGER NOT NULL,
    "stok_keluar" INTEGER NOT NULL,
    "stok_akhir" INTEGER NOT NULL,

    CONSTRAINT "laporan_stok_harian_pkey" PRIMARY KEY ("tanggal_laporan", "id_barang")
);

CREATE INDEX "laporan_stok_harian_id_barang_tanggal_laporan_idx"
ON "laporan_stok_harian"("id_barang", "tanggal_laporan");

CREATE TABLE "laporan_keuangan_harian" (
    "tanggal_laporan" DATE NOT NULL,
    "total_pemasukan" DECIMAL(19, 0) NOT NULL DEFAULT 0,
    "jumlah_transaksi" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "laporan_keuangan_harian_pkey" PRIMARY KEY ("tanggal_laporan")
);
