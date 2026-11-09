export type AdminFieldKind =
  | "string"
  | "integer"
  | "decimal"
  | "date"
  | "time"
  | "password";

export type AdminDatabaseField = {
  name: string;
  label: string;
  kind: AdminFieldKind;
  nullable?: boolean;
  primary?: boolean;
  options?: string[];
};

type AdminReference = {
  childTable: string;
  childField: string;
  parentField: string;
};

export type AdminDatabaseTable = {
  name: string;
  label: string;
  fields: AdminDatabaseField[];
  references?: AdminReference[];
};

const userReferences = [
  { childTable: "pemeriksaan_stok", childField: "id_pemeriksa", parentField: "id_pengguna" },
  { childTable: "penerimaan", childField: "id_penerima", parentField: "id_pengguna" },
  { childTable: "pengajuan", childField: "id_pengaju", parentField: "id_pengguna" },
  { childTable: "pengajuan", childField: "id_penyetuju", parentField: "id_pengguna" },
  { childTable: "transaksi", childField: "id_kasir", parentField: "id_pengguna" },
];

export const adminDatabaseTables: AdminDatabaseTable[] = [
  {
    name: "barang",
    label: "Barang",
    fields: [
      { name: "id_barang", label: "ID Barang", kind: "string", primary: true },
      { name: "nama_barang", label: "Nama Barang", kind: "string" },
      { name: "kategori", label: "Kategori", kind: "string" },
      { name: "satuan", label: "Satuan", kind: "string" },
      { name: "stok_minimum", label: "Stok Minimum", kind: "integer", nullable: true },
      { name: "harga_jual", label: "Harga Jual", kind: "decimal" },
    ],
    references: [
      { childTable: "detail_pemeriksaan", childField: "id_barang", parentField: "id_barang" },
      { childTable: "detail_pemesanan", childField: "id_barang", parentField: "id_barang" },
      { childTable: "detail_penerimaan", childField: "id_barang", parentField: "id_barang" },
      { childTable: "detail_pengajuan", childField: "id_barang", parentField: "id_barang" },
      { childTable: "detail_transaksi", childField: "id_barang", parentField: "id_barang" },
      { childTable: "laporan_stok_harian", childField: "id_barang", parentField: "id_barang" },
    ],
  },
  {
    name: "detail_pemeriksaan",
    label: "Rincian Pemeriksaan Stok",
    fields: [
      { name: "id_pemeriksaan", label: "ID Pemeriksaan", kind: "string", primary: true },
      { name: "id_barang", label: "ID Barang", kind: "string", primary: true },
      { name: "stok", label: "Stok", kind: "integer" },
      { name: "catatan", label: "Catatan", kind: "string", nullable: true },
    ],
  },
  {
    name: "detail_pemesanan",
    label: "Rincian Pemesanan",
    fields: [
      { name: "id_pemesanan", label: "ID Pemesanan", kind: "string", primary: true },
      { name: "id_barang", label: "ID Barang", kind: "string", primary: true },
      { name: "harga_satuan", label: "Harga Satuan", kind: "decimal" },
      { name: "jumlah_pesan", label: "Jumlah Pesan", kind: "integer" },
    ],
  },
  {
    name: "detail_penerimaan",
    label: "Rincian Penerimaan",
    fields: [
      { name: "id_penerimaan", label: "ID Penerimaan", kind: "string", primary: true },
      { name: "id_barang", label: "ID Barang", kind: "string", primary: true },
      { name: "jumlah_diterima", label: "Jumlah Diterima", kind: "integer" },
    ],
  },
  {
    name: "detail_pengajuan",
    label: "Rincian Pengajuan",
    fields: [
      { name: "id_pengajuan", label: "ID Pengajuan", kind: "string", primary: true },
      { name: "id_barang", label: "ID Barang", kind: "string", primary: true },
      { name: "id_supplier", label: "ID Supplier", kind: "string", nullable: true },
      { name: "harga_satuan", label: "Harga Satuan", kind: "decimal" },
      { name: "jumlah_pesan", label: "Jumlah Pesan", kind: "integer" },
    ],
  },
  {
    name: "detail_transaksi",
    label: "Rincian Transaksi",
    fields: [
      { name: "id_transaksi", label: "ID Transaksi", kind: "string", primary: true },
      { name: "id_barang", label: "ID Barang", kind: "string", primary: true },
      { name: "jumlah_jual", label: "Jumlah Jual", kind: "integer" },
      { name: "harga_satuan_jual", label: "Harga Satuan Jual", kind: "decimal", nullable: true },
    ],
  },
  {
    name: "laporan_stok_harian",
    label: "Laporan Stok Harian",
    fields: [
      { name: "tanggal_laporan", label: "Tanggal Laporan", kind: "date", primary: true },
      { name: "id_barang", label: "ID Barang", kind: "string", primary: true },
      { name: "nama_barang", label: "Nama Barang", kind: "string" },
      { name: "kategori", label: "Kategori", kind: "string" },
      { name: "satuan", label: "Satuan", kind: "string" },
      { name: "stok_minimum", label: "Stok Minimum", kind: "integer" },
      { name: "stok_masuk", label: "Stok Masuk", kind: "integer" },
      { name: "stok_keluar", label: "Stok Keluar", kind: "integer" },
      { name: "stok_akhir", label: "Stok Akhir", kind: "integer" },
    ],
  },
  {
    name: "laporan_keuangan_harian",
    label: "Laporan Keuangan Harian",
    fields: [
      { name: "tanggal_laporan", label: "Tanggal Laporan", kind: "date", primary: true },
      { name: "total_pemasukan", label: "Total Pemasukan", kind: "decimal" },
      { name: "jumlah_transaksi", label: "Jumlah Transaksi", kind: "integer" },
    ],
  },
  {
    name: "pemeriksaan_stok",
    label: "Pemeriksaan Stok",
    fields: [
      { name: "id_pemeriksaan", label: "ID Pemeriksaan", kind: "string", primary: true },
      { name: "tanggal_pemeriksaan", label: "Tanggal Pemeriksaan", kind: "date" },
      { name: "id_pemeriksa", label: "ID Pemeriksa", kind: "string", nullable: true },
    ],
    references: [
      { childTable: "detail_pemeriksaan", childField: "id_pemeriksaan", parentField: "id_pemeriksaan" },
    ],
  },
  {
    name: "pemesanan",
    label: "Pemesanan",
    fields: [
      { name: "id_pemesanan", label: "ID Pemesanan", kind: "string", primary: true },
      { name: "tanggal_pemesanan", label: "Tanggal Pemesanan", kind: "date" },
      { name: "status_pemesanan", label: "Status Pemesanan", kind: "string" },
      { name: "tanggal_persetujuan", label: "Tanggal Persetujuan", kind: "date", nullable: true },
      { name: "id_supplier", label: "ID Supplier", kind: "string", nullable: true },
      { name: "id_pengajuan", label: "ID Pengajuan", kind: "string", nullable: true },
      { name: "harga_total", label: "Harga Total", kind: "decimal", nullable: true },
    ],
    references: [
      { childTable: "detail_pemesanan", childField: "id_pemesanan", parentField: "id_pemesanan" },
      { childTable: "penerimaan", childField: "id_pemesanan", parentField: "id_pemesanan" },
    ],
  },
  {
    name: "penerimaan",
    label: "Penerimaan",
    fields: [
      { name: "id_penerimaan", label: "ID Penerimaan", kind: "string", primary: true },
      { name: "tanggal_penerimaan", label: "Tanggal Penerimaan", kind: "date" },
      { name: "id_pemesanan", label: "ID Pemesanan", kind: "string", nullable: true },
      { name: "no_faktur", label: "Nomor Faktur", kind: "string", nullable: true },
      { name: "id_penerima", label: "ID Penerima", kind: "string", nullable: true },
    ],
    references: [
      { childTable: "detail_penerimaan", childField: "id_penerimaan", parentField: "id_penerimaan" },
    ],
  },
  {
    name: "pengajuan",
    label: "Pengajuan",
    fields: [
      { name: "id_pengajuan", label: "ID Pengajuan", kind: "string", primary: true },
      { name: "tanggal_pengajuan", label: "Tanggal Pengajuan", kind: "date" },
      { name: "id_pengaju", label: "ID Pengaju", kind: "string", nullable: true },
      { name: "id_penyetuju", label: "ID Penyetuju", kind: "string", nullable: true },
      { name: "status_penyetujuan", label: "Status Persetujuan", kind: "integer", nullable: true },
      { name: "harga_total", label: "Harga Total", kind: "decimal", nullable: true },
    ],
    references: [
      { childTable: "detail_pengajuan", childField: "id_pengajuan", parentField: "id_pengajuan" },
      { childTable: "pemesanan", childField: "id_pengajuan", parentField: "id_pengajuan" },
    ],
  },
  {
    name: "pengguna",
    label: "Pengguna",
    fields: [
      { name: "id_pengguna", label: "ID Pengguna", kind: "string", primary: true },
      { name: "nama_pengguna", label: "Nama Pengguna", kind: "string" },
      { name: "username", label: "Username", kind: "string" },
      { name: "password", label: "Password baru (opsional saat edit)", kind: "password" },
      {
        name: "role",
        label: "Role",
        kind: "string",
        options: ["Owner", "Admin", "Karyawan Gudang", "Karyawan Kasir"],
      },
    ],
    references: userReferences,
  },
  {
    name: "supplier",
    label: "Supplier",
    fields: [
      { name: "id_suplier", label: "ID Supplier", kind: "string", primary: true },
      { name: "nama_supplier", label: "Nama Supplier", kind: "string" },
      { name: "alamat", label: "Alamat", kind: "string", nullable: true },
      { name: "no_telepon", label: "Nomor Telepon", kind: "string", nullable: true },
      { name: "email", label: "Email", kind: "string", nullable: true },
    ],
    references: [
      { childTable: "detail_pengajuan", childField: "id_supplier", parentField: "id_suplier" },
      { childTable: "pemesanan", childField: "id_supplier", parentField: "id_suplier" },
    ],
  },
  {
    name: "transaksi",
    label: "Transaksi",
    fields: [
      { name: "id_transaksi", label: "ID Transaksi", kind: "string", primary: true },
      { name: "tanggal_transaksi", label: "Tanggal Transaksi", kind: "date" },
      { name: "waktu_transaksi", label: "Waktu Transaksi", kind: "time" },
      { name: "id_kasir", label: "ID Kasir", kind: "string", nullable: true },
      { name: "total_harga", label: "Total Harga", kind: "decimal", nullable: true },
      { name: "status_transaksi", label: "Status Transaksi", kind: "string" },
    ],
    references: [
      { childTable: "detail_transaksi", childField: "id_transaksi", parentField: "id_transaksi" },
    ],
  },
];

export function getAdminDatabaseTable(name: string | null) {
  return adminDatabaseTables.find((table) => table.name === name) ?? null;
}

export function sqlTypeForField(field: AdminDatabaseField) {
  switch (field.kind) {
    case "integer":
      return "integer";
    case "decimal":
      return "numeric";
    case "date":
      return "date";
    case "time":
      return "time";
    case "string":
    case "password":
      return "varchar";
  }
}
