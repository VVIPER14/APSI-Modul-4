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
  harga_jual: string;
};

type SortKey = keyof StockInformationItem | "status";
type SortDirection = "ascending" | "descending";

const columns: { key: SortKey; label: string }[] = [
  { key: "id_barang", label: "ID Barang" },
  { key: "nama_barang", label: "Nama Barang" },
  { key: "kategori", label: "Kategori" },
  { key: "satuan", label: "Satuan" },
  { key: "stok", label: "Stok" },
  { key: "stok_minimum", label: "Stok Minimum" },
  { key: "harga_jual", label: "Harga Satuan" },
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
}: {
  items: StockInformationItem[];
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id_barang");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("ascending");

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

  return (
    <section
      aria-label="Tabel informasi stok"
      className="stock-info-panel"
    >
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
      </div>

      <div className="stock-info-table-viewport">
        <table className="stock-info-table">
          <caption className="sr-only">
            Informasi stok, minimum, harga, dan status setiap barang
          </caption>
          <colgroup>
            <col className="stock-info-col-id" />
            <col className="stock-info-col-name" />
            <col className="stock-info-col-category" />
            <col className="stock-info-col-unit" />
            <col className="stock-info-col-stock" />
            <col className="stock-info-col-minimum" />
            <col className="stock-info-col-price" />
            <col className="stock-info-col-status" />
          </colgroup>
          <thead>
            <tr>
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
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => {
                const status = getStatus(item);

                return (
                  <tr key={item.id_barang}>
                    <td className="stock-info-id">{item.id_barang}</td>
                    <td className="stock-info-name">{item.nama_barang}</td>
                    <td>{item.kategori}</td>
                    <td>{item.satuan}</td>
                    <td className="stock-info-stock">{item.stok}</td>
                    <td className="stock-info-minimum">
                      {item.stok_minimum}
                    </td>
                    <td>{formatPrice(item.harga_jual)}</td>
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
                <td className="stock-info-empty" colSpan={columns.length}>
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
