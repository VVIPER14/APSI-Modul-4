
-- 1.1 Data Pengguna
CREATE TABLE Pengguna (
    id_pengguna VARCHAR(255) PRIMARY KEY,
    nama_pengguna VARCHAR(255),
    username VARCHAR(255),
    password VARCHAR(255),
    role VARCHAR(255)
);
INSERT INTO Pengguna (id_pengguna, nama_pengguna, username, password, role) VALUES
('USR001', 'Ardan', 'ardan123', 'hash_01', 'Owner'),
('USR002', 'Loid', 'anak_admin123', 'hash_02', 'Admin'),
('USR003', 'Forger', 'gudang_pride', 'hash_03', 'Karyawan Gudang'),
('USR004', 'Monika', 'monikaaaaa12', 'hash_04', 'Karyawan Kasir');

-- 1.2 Data Supplier
CREATE TABLE Supplier (
    id_suplier VARCHAR(255) PRIMARY KEY,
    nama_supplier VARCHAR(255),
    alamat TEXT,
    no_telepon VARCHAR(20),
    email VARCHAR(255)
);
INSERT INTO Supplier (id_suplier, nama_supplier, alamat, no_telepon, email) VALUES
('SUP001', 'PT. Merapi Utama Pharma', 'Jl. Raya By Pass KM 6, Lubeg (Lubuk Begalung), Kota Padang, Sumatera Barat', '(0751) 777678', 'muppdg@merapi.net');

-- 1.3 Data Barang
CREATE TABLE Barang (
    id_barang VARCHAR(255) PRIMARY KEY,
    nama_barang VARCHAR(255),
    kategori VARCHAR(255),
    satuan VARCHAR(100),
    stok_minimum INT,
    harga_jual DECIMAL(10, 2)
);
INSERT INTO Barang (id_barang, nama_barang, kategori, satuan, stok_minimum, harga_jual) VALUES
('BRG001', 'Paracetamol 500 mg', 'Obat Bebas', 'Strip', 30, 2500),
('BRG002', 'Vitamin C 500 mg', 'Suplemen', 'Botol', 15, 18000),
('BRG003', 'Amoxicillin 500 mg', 'Obat Keras', 'Strip', 18, 7000),
('BRG004', 'Ciprofloxacin 500 mg', 'Obat Keras', 'Strip', 18, 9000),
('BRG005', 'OBH Sirup 100 ml', 'Obat Bebas Terbatas', 'Botol', 15, 16000),
('BRG006', 'CTM 4 mg', 'Obat Bebas Terbatas', 'Strip', 20, 2000),
('BRG007', 'Povidone Iodine 10% 30 ml', 'Antiseptik', 'Botol', 10, 12000),
('BRG008', 'Kasa Steril 16x16 cm', 'Alat Kesehatan', 'Pack', 40, 6000),
('BRG009', 'Antasida DOEN', 'Obat Bebas Terbatas', 'Strip', 15, 3000);

-- 2.1 Data Pengajuan
CREATE TABLE Pengajuan (
    id_pengajuan VARCHAR(255) PRIMARY KEY,
    tanggal_pengajuan DATE,
    id_pengaju VARCHAR(255),
    id_penyetuju VARCHAR(255),
    status_penyetujuan INT,
    harga_total DECIMAL(10, 2),
    FOREIGN KEY (id_pengaju) REFERENCES Pengguna(id_pengguna),
    FOREIGN KEY (id_penyetuju) REFERENCES Pengguna(id_pengguna)
);
INSERT INTO Pengajuan (id_pengajuan, tanggal_pengajuan, id_pengaju, id_penyetuju, status_penyetujuan, harga_total) VALUES
('PGJ001', '2026-09-01', 'USR003', 'USR001', 1, 750000),
('PGJ002', '2026-09-15', 'USR003', 'USR001', 1, 345000),
('PGJ003', '2026-09-25', 'USR003', 'USR001', 1, 650000),
('PGJ004', '2026-10-05', 'USR003', 'USR001', 1, 510000),
('PGJ005', '2026-10-13', 'USR003', 'USR001', 1, 204000);

-- 2.2 Data Pemesanan
CREATE TABLE Pemesanan (
    id_pemesanan VARCHAR(255) PRIMARY KEY,
    tanggal_pemesanan DATE,
    status_pemesanan VARCHAR(50),
    tanggal_persetujuan DATE,
    id_supplier VARCHAR(255),
    id_pengajuan VARCHAR(255),
    harga_total DECIMAL(10, 2),
    FOREIGN KEY (id_supplier) REFERENCES Supplier(id_suplier),
    FOREIGN KEY (id_pengajuan) REFERENCES Pengajuan(id_pengajuan)
);
INSERT INTO Pemesanan (id_pemesanan, tanggal_pemesanan, status_pemesanan, tanggal_persetujuan, id_supplier, id_pengajuan, harga_total) VALUES
('PMS001', '2026-09-01', 'Diterima', '2026-09-01', 'SUP001', 'PGJ001', 750000),
('PMS002', '2026-09-15', 'Diterima', '2026-09-15', 'SUP001', 'PGJ002', 345000),
('PMS003', '2026-09-25', 'Diterima', '2026-09-26', 'SUP001', 'PGJ003', 650000),
('PMS004', '2026-10-05', 'Diterima', '2026-10-05', 'SUP001', 'PGJ004', 510000),
('PMS005', '2026-10-13', 'Diterima', '2026-10-13', 'SUP001', 'PGJ005', 204000);

-- 2.3 Data Penerimaan
CREATE TABLE Penerimaan (
    id_penerimaan VARCHAR(255) PRIMARY KEY,
    tanggal_penerimaan DATE,
    id_pemesanan VARCHAR(255),
    no_faktur VARCHAR(255),
    id_penerima VARCHAR(255),
    FOREIGN KEY (id_pemesanan) REFERENCES Pemesanan(id_pemesanan),
    FOREIGN KEY (id_penerima) REFERENCES Pengguna(id_pengguna)
);
INSERT INTO Penerimaan (id_penerimaan, tanggal_penerimaan, id_pemesanan, no_faktur, id_penerima) VALUES
('RCV001', '2026-09-01', 'PMS001', 'FK-RMF-0187', 'USR003'),
('RCV002', '2026-09-15', 'PMS002', 'FK-AND-0561', 'USR003'),
('RCV003', '2026-09-25', 'PMS003', 'FK-MSD-1042', 'USR003'),
('RCV004', '2026-10-05', 'PMS004', 'FK-PAM-0094', 'USR003'),
('RCV005', '2026-10-13', 'PMS005', 'FK-RMF-0215', 'USR003');

-- 2.4 Data Pemeriksaan Stok
CREATE TABLE Pemeriksaan_Stok (
    id_pemeriksaan VARCHAR(255) PRIMARY KEY,
    tanggal_pemeriksaan DATE,
    id_pemeriksa VARCHAR(255),
    FOREIGN KEY (id_pemeriksa) REFERENCES Pengguna(id_pengguna)
);
INSERT INTO Pemeriksaan_Stok (id_pemeriksaan, tanggal_pemeriksaan, id_pemeriksa) VALUES
('PMK001', '2026-09-01', 'USR003'),
('PMK002', '2026-09-15', 'USR003'),
('PMK003', '2026-09-25', 'USR003'),
('PMK004', '2026-10-05', 'USR003'),
('PMK005', '2026-10-13', 'USR003');

-- 2.5 Data Transaksi (Penjualan)
CREATE TABLE Transaksi (
    id_transaksi VARCHAR(255) PRIMARY KEY,
    tanggal_transaksi DATETIME,
    id_kasir VARCHAR(255),
    total_harga DECIMAL(10, 2),
    status_transaksi VARCHAR(50),
    FOREIGN KEY (id_kasir) REFERENCES Pengguna(id_pengguna)
);
INSERT INTO Transaksi (id_transaksi, tanggal_transaksi, id_kasir, total_harga, status_transaksi) VALUES
('TRX001', '2026-09-04 10:20:00', 'USR004', 61000, 'Selesai'),
('TRX002', '2026-09-19 14:05:00', 'USR004', 124000, 'Selesai'),
('TRX003', '2026-09-30 16:40:00', 'USR004', 88000, 'Selesai'),
('TRX004', '2026-10-09 09:30:00', 'USR004', 78000, 'Selesai'),
('TRX005', '2026-10-15 17:30:00', 'USR004', 83500, 'Selesai');

-- 3.1 Detail Pengajuan
CREATE TABLE Detail_Pengajuan (
    id_pengajuan VARCHAR(255),
    id_barang VARCHAR(255),
    harga_satuan DECIMAL(10, 2),
    jumlah_pesan INT,
    PRIMARY KEY (id_pengajuan, id_barang),
    FOREIGN KEY (id_pengajuan) REFERENCES Pengajuan(id_pengajuan),
    FOREIGN KEY (id_barang) REFERENCES Barang(id_barang)
);
INSERT INTO Detail_Pengajuan (id_pengajuan, id_barang, harga_satuan, jumlah_pesan) VALUES
('PGJ001', 'BRG001', 1000, 100),
('PGJ001', 'BRG002', 13000, 50),
('PGJ002', 'BRG003', 4500, 50),
('PGJ002', 'BRG004', 6000, 20),
('PGJ003', 'BRG005', 12000, 50),
('PGJ003', 'BRG006', 1000, 50),
('PGJ004', 'BRG007', 8000, 20),
('PGJ004', 'BRG008', 3500, 100),
('PGJ005', 'BRG001', 1500, 100),
('PGJ005', 'BRG009', 1800, 30);

-- 3.2 Detail Pemesanan
CREATE TABLE Detail_Pemesanan (
    id_pemesanan VARCHAR(255),
    id_barang VARCHAR(255),
    harga_satuan DECIMAL(10, 2),
    jumlah_pesan INT,
    PRIMARY KEY (id_pemesanan, id_barang),
    FOREIGN KEY (id_pemesanan) REFERENCES Pemesanan(id_pemesanan),
    FOREIGN KEY (id_barang) REFERENCES Barang(id_barang)
);
INSERT INTO Detail_Pemesanan (id_pemesanan, id_barang, harga_satuan, jumlah_pesan) VALUES
('PMS001', 'BRG001', 1000, 100),
('PMS001', 'BRG002', 13000, 50),
('PMS002', 'BRG003', 4500, 50),
('PMS002', 'BRG004', 6000, 20),
('PMS003', 'BRG005', 12000, 50),
('PMS003', 'BRG006', 1000, 50),
('PMS004', 'BRG007', 8000, 20),
('PMS004', 'BRG008', 3500, 100),
('PMS005', 'BRG001', 1500, 100),
('PMS005', 'BRG009', 1800, 30);

-- 3.3 Detail Penerimaan
CREATE TABLE Detail_Penerimaan (
    id_penerimaan VARCHAR(255),
    id_barang VARCHAR(255),
    jumlah_diterima INT,
    PRIMARY KEY (id_penerimaan, id_barang),
    FOREIGN KEY (id_penerimaan) REFERENCES Penerimaan(id_penerimaan),
    FOREIGN KEY (id_barang) REFERENCES Barang(id_barang)
);
INSERT INTO Detail_Penerimaan (id_penerimaan, id_barang, jumlah_diterima) VALUES
('RCV001', 'BRG001', 100),
('RCV001', 'BRG002', 50),
('RCV002', 'BRG003', 50),
('RCV002', 'BRG004', 20),
('RCV003', 'BRG005', 50),
('RCV003', 'BRG006', 50),
('RCV004', 'BRG007', 20),
('RCV004', 'BRG008', 100),
('RCV005', 'BRG001', 100),
('RCV005', 'BRG009', 30);

-- 3.4 Detail Pemeriksaan Stok
CREATE TABLE Detail_Pemeriksaan (
    id_pemeriksaan VARCHAR(255),
    id_barang VARCHAR(255),
    stok INT,
    catatan TEXT,
    PRIMARY KEY (id_pemeriksaan, id_barang),
    FOREIGN KEY (id_pemeriksaan) REFERENCES Pemeriksaan_Stok(id_pemeriksaan),
    FOREIGN KEY (id_barang) REFERENCES Barang(id_barang)
);
INSERT INTO Detail_Pemeriksaan (id_pemeriksaan, id_barang, stok, catatan) VALUES
('PMK001', 'BRG001', 17, '-'),
('PMK001', 'BRG002', 10, '-'),
('PMK002', 'BRG003', 17, '-'),
('PMK002', 'BRG004', 15, '-'),
('PMK003', 'BRG005', 5, '-'),
('PMK003', 'BRG006', 2, '-'),
('PMK004', 'BRG007', 2, '-'),
('PMK004', 'BRG008', 32, '-'),
('PMK005', 'BRG001', 25, '-'),
('PMK005', 'BRG009', 11, '-');

-- 3.5 Detail Transaksi (Penjualan)
CREATE TABLE Detail_Transaksi (
    id_transaksi VARCHAR(255),
    id_barang VARCHAR(255),
    jumlah_jual INT,
    PRIMARY KEY (id_transaksi, id_barang),
    FOREIGN KEY (id_transaksi) REFERENCES Transaksi(id_transaksi),
    FOREIGN KEY (id_barang) REFERENCES Barang(id_barang)
);
INSERT INTO Detail_Transaksi (id_transaksi, id_barang, jumlah_jual) VALUES
('TRX001', 'BRG001', 10),
('TRX001', 'BRG002', 2),
('TRX002', 'BRG003', 10),
('TRX002', 'BRG004', 6),
('TRX003', 'BRG005', 3),
('TRX003', 'BRG006', 20),
('TRX004', 'BRG007', 4),
('TRX004', 'BRG008', 5),
('TRX005', 'BRG001', 15),
('TRX005', 'BRG009', 10),
('TRX005', 'BRG005', 1);
