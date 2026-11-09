"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type StockInformationItem = {
  id_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  stok_minimum: number;
  stok: number;
  stok_masuk: number;
  stok_keluar: number;
  harga_jual: string;
};

type SortKey = keyof StockInformationItem | "status";
type SortDirection = "ascending" | "descending";

const cashierColumns: { key: SortKey; label: string }[] = [
  { key: "id_barang", label: "ID Barang" },
  { key: "nama_barang", label: "Nama Barang" },
  { key: "kategori", label: "Kategori" },
  { key: "satuan", label: "Satuan" },
  { key: "stok", label: "Stok" },
  { key: "stok_minimum", label: "Stok Minimum" },
  { key: "harga_jual", label: "Harga Satuan" },
  { key: "status", label: "Status" },
];

const ownerColumns: { key: SortKey; label: string }[] = [
  { key: "id_barang", label: "ID Barang" },
  { key: "nama_barang", label: "Nama Barang" },
  { key: "kategori", label: "Kategori" },
  { key: "satuan", label: "Satuan" },
  { key: "stok_minimum", label: "Stok Minimum" },
  { key: "stok_masuk", label: "Stok Masuk" },
  { key: "stok_keluar", label: "Stok Keluar" },
  { key: "stok", label: "Stok Tersedia" },
  { key: "status", label: "Status" },
];

function getStatus(item: StockInformationItem) {
  return item.stok >= item.stok_minimum ? "Aman" : "Kurang";
}

function compareItems(
  first: StockInformationItem,
  second: StockInformationItem,
  key: SortKey,
) {
  if (key === "status") {
    return getStatus(first).localeCompare(getStatus(second), "id");
  }

  if (key === "harga_jual") {
    const firstPrice = BigInt(first.harga_jual);
    const secondPrice = BigInt(second.harga_jual);
    return firstPrice < secondPrice ? -1 : firstPrice > secondPrice ? 1 : 0;
  }

  const firstValue = first[key];
  const secondValue = second[key];

  if (typeof firstValue === "number" && typeof secondValue === "number") {
    return firstValue - secondValue;
  }

  return String(firstValue).localeCompare(String(secondValue), "id", {
    numeric: true,
    sensitivity: "base",
  });
}

function formatPrice(price: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(price));
}

export default function StockInformationTable({
  items,
  role,
  reportDate,
}: {
  items: StockInformationItem[];
  role: "Owner" | "Karyawan Kasir";
  reportDate?: string;
}) {
  const isOwner = role === "Owner";
  const columns = isOwner ? ownerColumns : cashierColumns;
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id_barang");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("ascending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printItems, setPrintItems] = useState<StockInformationItem[] | null>(
    null,
  );

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id");
    const filteredItems = query
      ? items.filter(
          (item) =>
            item.id_barang.toLocaleLowerCase("id").includes(query) ||
            item.nama_barang.toLocaleLowerCase("id").includes(query),
        )
      : items;

    return [...filteredItems].sort((first, second) => {
      const compared = compareItems(first, second, sortKey);
      return sortDirection === "ascending" ? compared : -compared;
    });
  }, [items, search, sortDirection, sortKey]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending",
      );
      return;
    }

    setSortKey(key);
    setSortDirection("ascending");
  }

  function printRows(rows: StockInformationItem[]) {
    setPrintItems(rows);
    window.addEventListener(
      "afterprint",
      () => setPrintItems(null),
      { once: true },
    );
    window.requestAnimationFrame(() => window.print());
  }

  const tableItems = printItems ?? visibleItems;
  const selectedVisibleCount = visibleItems.filter((item) =>
    selectedIds.has(item.id_barang),
  ).length;

  return (
    <section
      aria-label={isOwner ? "Tabel laporan stok" : "Tabel informasi stok"}
      className={`stock-info-panel${isOwner ? " printable-document" : ""}`}
    >
      {isOwner ? (
        <h2 className="print-document-title">
          Laporan Stok{reportDate ? ` - ${reportDate}` : ""}
        </h2>
      ) : null}
      <div className="stock-info-toolbar">
        <label className="stock-check-search">
          <Image
            alt=""
            aria-hidden="true"
            height={20}
            src="/images/stock-check-search.svg"
            width={20}
          />
          <input
            aria-label="Cari nama atau ID barang"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau ID barang"
            type="search"
            value={search}
          />
        </label>
        {isOwner ? (
          <div className="print-selection-toolbar">
            <label>
              <input
                checked={
                  visibleItems.length > 0 &&
                  visibleItems.every((item) => selectedIds.has(item.id_barang))
                }
                onChange={(event) =>
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    for (const item of visibleItems) {
                      if (event.target.checked) {
                        next.add(item.id_barang);
                      } else {
                        next.delete(item.id_barang);
                      }
                    }
                    return next;
                  })
                }
                type="checkbox"
              />
              Pilih semua ({visibleItems.length})
            </label>
            <button
              disabled={selectedVisibleCount === 0}
              onClick={() =>
                printRows(
                  visibleItems.filter((item) => selectedIds.has(item.id_barang)),
                )
              }
              type="button"
            >
              Cetak / Simpan PDF ({selectedVisibleCount})
            </button>
            <button onClick={() => printRows(visibleItems)} type="button">
              Cetak semua
            </button>
          </div>
        ) : null}
      </div>

      <div className="stock-info-table-viewport">
        <table className={`stock-info-table${isOwner ? " is-owner" : ""}`}>
          <caption className="sr-only">
            {isOwner
              ? "Laporan stok masuk, stok keluar, stok tersedia, minimum, dan status setiap barang"
              : "Informasi stok, minimum, harga, dan status setiap barang"}
          </caption>
          <colgroup>
            {isOwner ? <col className="stock-info-col-select" /> : null}
            <col className="stock-info-col-id" />
            <col className="stock-info-col-name" />
            <col className="stock-info-col-category" />
            <col className="stock-info-col-unit" />
            {isOwner ? (
              <>
                <col className="stock-info-col-minimum" />
                <col className="stock-info-col-incoming" />
                <col className="stock-info-col-outgoing" />
                <col className="stock-info-col-stock" />
              </>
            ) : (
              <>
                <col className="stock-info-col-stock" />
                <col className="stock-info-col-minimum" />
                <col className="stock-info-col-price" />
              </>
            )}
            <col className="stock-info-col-status" />
          </colgroup>
          <thead>
            <tr>
              {isOwner ? (
                <th className="print-selection-column" scope="col">Pilih</th>
              ) : null}
              {columns.map(({ key, label }) => (
                <th
                  aria-sort={
                    sortKey === key
                      ? sortDirection === "ascending"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  key={key}
                  scope="col"
                >
                  <button
                    aria-label={`Urutkan berdasarkan ${label}`}
                    className="stock-info-sort-button"
                    onClick={() => toggleSort(key)}
                    type="button"
                  >
                    <span>{label}</span>
                    <span
                      aria-hidden="true"
                      className={`stock-info-sort-indicator${
                        sortKey === key ? " is-active" : ""
                      }${
                        sortKey === key && sortDirection === "descending"
                          ? " is-descending"
                          : ""
                      }`}
                    >
                      <Image
                        alt=""
                        height={8}
                        src="/images/stock-check-sort.svg"
                        width={8}
                      />
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableItems.length > 0 ? (
              tableItems.map((item) => {
                const status = getStatus(item);

                return (
                  <tr key={item.id_barang}>
                    {isOwner ? (
                      <td className="print-selection-column">
                        <input
                          aria-label={`Pilih ${item.nama_barang}`}
                          checked={selectedIds.has(item.id_barang)}
                          onChange={(event) =>
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) {
                                next.add(item.id_barang);
                              } else {
                                next.delete(item.id_barang);
                              }
                              return next;
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                    ) : null}
                    <td className="stock-info-id">{item.id_barang}</td>
                    <td className="stock-info-name">{item.nama_barang}</td>
                    <td>{item.kategori}</td>
                    <td>{item.satuan}</td>
                    {isOwner ? (
                      <>
                        <td className="stock-info-minimum">
                          {item.stok_minimum}
                        </td>
                        <td className="stock-info-movement">
                          {item.stok_masuk || "—"}
                        </td>
                        <td className="stock-info-movement">
                          {item.stok_keluar || "—"}
                        </td>
                        <td className="stock-info-stock">{item.stok}</td>
                      </>
                    ) : (
                      <>
                        <td className="stock-info-stock">{item.stok}</td>
                        <td className="stock-info-minimum">
                          {item.stok_minimum}
                        </td>
                        <td>{formatPrice(item.harga_jual)}</td>
                      </>
                    )}
                    <td>
                      <span
                        className={`stock-check-status-pill ${
                          status === "Aman" ? "is-sufficient" : "is-low"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  className="stock-info-empty"
                  colSpan={columns.length + (isOwner ? 1 : 0)}
                >
                  {items.length > 0
                    ? "Barang tidak ditemukan."
                    : "Belum ada data barang."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
