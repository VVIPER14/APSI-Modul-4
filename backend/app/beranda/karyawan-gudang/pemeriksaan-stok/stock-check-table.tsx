"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

const noteChoices = ["Sesuai", "Tidak sesuai"] as const;
type NoteChoice = (typeof noteChoices)[number] | "";

type StockItem = {
  id_barang: string;
  nama_barang: string;
  satuan: string;
  stok_minimum: number;
  stok: number;
  catatan: string;
};

type DraftStockItem = StockItem & {
  pilihanCatatan: NoteChoice;
  catatanLainnya: string;
};

type SortKey =
  | "id_barang"
  | "nama_barang"
  | "satuan"
  | "stok_minimum"
  | "stok"
  | "catatan"
  | "status";

type SortState = {
  key: SortKey;
  direction: "ascending" | "descending";
};

function getNoteParts(catatan: string): Pick<
  DraftStockItem,
  "pilihanCatatan" | "catatanLainnya"
> {
  if (catatan === "Stok sesuai" || catatan === "Sesuai") {
    return {
      pilihanCatatan: "Sesuai",
      catatanLainnya: "",
    };
  }

  if (catatan) {
    const detail = catatan.startsWith("Lainnya:")
      ? catatan.slice("Lainnya:".length).trim()
      : catatan;

    return {
      pilihanCatatan: "Tidak sesuai",
      catatanLainnya: detail,
    };
  }

  return { pilihanCatatan: "", catatanLainnya: "" };
}

function getStoredNote(item: DraftStockItem) {
  if (item.pilihanCatatan === "Sesuai") {
    return "Stok sesuai";
  }

  if (item.pilihanCatatan === "Tidak sesuai") {
    return item.catatanLainnya.trim() || null;
  }

  return null;
}

function toDraft(item: StockItem): DraftStockItem {
  return { ...item, ...getNoteParts(item.catatan) };
}

function getStatus(item: StockItem) {
  return item.stok >= item.stok_minimum ? "Aman" : "Kurang";
}

function compareItems(
  first: DraftStockItem,
  second: DraftStockItem,
  key: SortKey,
) {
  const firstValue =
    key === "catatan"
      ? getStoredNote(first) ?? ""
      : key === "status"
        ? getStatus(first)
        : first[key];
  const secondValue =
    key === "catatan"
      ? getStoredNote(second) ?? ""
      : key === "status"
        ? getStatus(second)
        : second[key];

  if (typeof firstValue === "number" && typeof secondValue === "number") {
    return firstValue - secondValue;
  }

  return String(firstValue).localeCompare(String(secondValue), "id", {
    numeric: true,
    sensitivity: "base",
  });
}

export default function StockCheckTable({
  initialItems,
}: {
  initialItems: StockItem[];
}) {
  const [items, setItems] = useState(() => initialItems.map(toDraft));
  const [originalItems, setOriginalItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({
    key: "nama_barang",
    direction: "ascending",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "neutral">(
    "neutral",
  );

  const changedItems = useMemo(() => {
    const originalById = new Map(
      originalItems.map((item) => [item.id_barang, item]),
    );

    return items
      .filter((item) => {
        const original = originalById.get(item.id_barang);
        return (
          !original ||
          original.stok !== item.stok ||
          (original.catatan || null) !== getStoredNote(item)
        );
      })
      .map(({ id_barang, stok, ...item }) => ({
        id_barang,
        stok,
        catatan: getStoredNote({ id_barang, stok, ...item }),
      }));
  }, [items, originalItems]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id");
    const filtered = query
      ? items.filter(
          (item) =>
            item.id_barang.toLocaleLowerCase("id").includes(query) ||
            item.nama_barang.toLocaleLowerCase("id").includes(query),
        )
      : items;

    return [...filtered].sort((first, second) => {
      const compared = compareItems(first, second, sort.key);
      return sort.direction === "ascending" ? compared : -compared;
    });
  }, [items, search, sort]);

  function updateItem(id: string, change: Partial<DraftStockItem>) {
    setItems((current) =>
      current.map((item) =>
        item.id_barang === id ? { ...item, ...change } : item,
      ),
    );
    setError("");
    setFeedback("");
  }

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  async function saveInspection() {
    setError("");
    setFeedback("");

    const emptyOtherNote = items.find(
      (item) =>
        item.pilihanCatatan === "Tidak sesuai" && !item.catatanLainnya.trim(),
    );

    if (emptyOtherNote) {
      setError(`Jelaskan ketidaksesuaian stok untuk ${emptyOtherNote.nama_barang}.`);
      return;
    }

    if (changedItems.length === 0) {
      setFeedback("Tidak ada perubahan. Pemeriksaan tidak dicatat.");
      setFeedbackType("neutral");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/beranda/karyawan-gudang/pemeriksaan-stok",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: changedItems }),
        },
      );
      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Pemeriksaan stok tidak dapat disimpan.";
        setError(message);
        return;
      }

      if (typeof result !== "object" || result === null) {
        setError("Respons penyimpanan pemeriksaan tidak valid.");
        return;
      }

      setOriginalItems(
        items.map(({ pilihanCatatan, catatanLainnya, ...item }) => ({
          ...item,
          catatan: getStoredNote({ ...item, pilihanCatatan, catatanLainnya }) ?? "",
        })),
      );
      setEditingId(null);

      if ("id_pemeriksaan" in result && typeof result.id_pemeriksaan === "string") {
        setFeedback(`Pemeriksaan ${result.id_pemeriksaan} berhasil disimpan.`);
        setFeedbackType("success");
      } else {
        setFeedback("Tidak ada perubahan baru. Pemeriksaan tidak dicatat.");
        setFeedbackType("neutral");
      }
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  function renderHeader(key: SortKey, label: string) {
    const isActive = sort.key === key;

    return (
      <span
        aria-sort={isActive ? sort.direction : "none"}
        className="stock-check-column-header"
        key={key}
        role="columnheader"
      >
        <button
          aria-label={`Urutkan berdasarkan ${label}${
            isActive
              ? sort.direction === "ascending"
                ? ", menaik"
                : ", menurun"
              : ""
          }`}
          className="stock-check-sort-button"
          onClick={() => toggleSort(key)}
          type="button"
        >
          {label}
          <span
            aria-hidden="true"
            className={`stock-check-sort-indicator${isActive ? " is-active" : ""}${
              isActive && sort.direction === "descending" ? " is-descending" : ""
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
      </span>
    );
  }

  return (
    <section aria-label="Daftar barang" className="stock-check-panel">
      <div className="stock-check-toolbar">
        <label className="stock-check-search">
          <Image
            alt=""
            aria-hidden="true"
            height={20}
            src="/images/stock-check-search.svg"
            width={20}
          />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau ID barang"
            type="search"
            value={search}
          />
        </label>
      </div>

      <div className="stock-check-table-viewport">
        <div
          aria-label="Stok barang"
          className="stock-check-table"
          role="table"
        >
          <div className="stock-check-table-header" role="row">
            {renderHeader("id_barang", "ID Barang")}
            {renderHeader("nama_barang", "Nama Barang")}
            {renderHeader("satuan", "Satuan")}
            {renderHeader("stok_minimum", "Stok Minimum")}
            {renderHeader("stok", "Stok Tersedia")}
            {renderHeader("catatan", "Catatan")}
            {renderHeader("status", "Status")}
          </div>

          {visibleItems.length > 0 ? (
            visibleItems.map((item) => {
              const isEditing = editingId === item.id_barang;
              const isSufficient = item.stok >= item.stok_minimum;

              return (
                <div
                  className="stock-check-table-row"
                  key={item.id_barang}
                  role="row"
                >
                  <span className="stock-check-product-id" role="cell">
                    {item.id_barang}
                  </span>
                  <span className="stock-check-product-name" role="cell">
                    {item.nama_barang}
                  </span>
                  <span role="cell">{item.satuan}</span>
                  <span className="stock-check-number" role="cell">
                    {item.stok_minimum}
                  </span>
                  <span className="stock-check-available" role="cell">
                    {isEditing ? (
                      <input
                        aria-label={`Stok tersedia ${item.nama_barang}`}
                        max={2147483647}
                        min={0}
                        onChange={(event) =>
                          updateItem(item.id_barang, {
                            stok: Number(event.target.value),
                          })
                        }
                        type="number"
                        value={item.stok}
                      />
                    ) : (
                      <strong>{item.stok}</strong>
                    )}
                    <button
                      aria-label={
                        isEditing
                          ? `Simpan stok ${item.nama_barang}`
                          : `Edit stok ${item.nama_barang}`
                      }
                      className="stock-check-edit-button"
                      disabled={isSaving}
                      onClick={() =>
                        setEditingId(isEditing ? null : item.id_barang)
                      }
                      type="button"
                    >
                      {isEditing ? (
                        "Simpan"
                      ) : (
                        <>
                          <Image
                            alt=""
                            aria-hidden="true"
                            height={16}
                            src="/images/stock-check-edit.svg"
                            width={16}
                          />
                          Edit
                        </>
                      )}
                    </button>
                  </span>
                  <div className="stock-check-note" role="cell">
                    <label className="sr-only" htmlFor={`note-${item.id_barang}`}>
                      Catatan untuk {item.nama_barang}
                    </label>
                    <select
                      id={`note-${item.id_barang}`}
                      onChange={(event) =>
                        updateItem(item.id_barang, {
                          pilihanCatatan: event.target.value as NoteChoice,
                        })
                      }
                      value={item.pilihanCatatan}
                    >
                      <option value="">Pilih catatan...</option>
                      {noteChoices.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                    {item.pilihanCatatan === "Tidak sesuai" && (
                      <input
                        aria-label={`Rincian ketidaksesuaian ${item.nama_barang}`}
                        maxLength={255}
                        onChange={(event) =>
                          updateItem(item.id_barang, {
                            catatanLainnya: event.target.value,
                          })
                        }
                        placeholder="Jelaskan ketidaksesuaian..."
                        value={item.catatanLainnya}
                      />
                    )}
                  </div>
                  <span className="stock-check-status" role="cell">
                    <span
                      className={
                        isSufficient
                          ? "stock-check-status-pill is-sufficient"
                          : "stock-check-status-pill is-low"
                      }
                    >
                      {isSufficient ? "Aman" : "Kurang"}
                    </span>
                  </span>
                </div>
              );
            })
          ) : (
            <p className="stock-check-empty" role="row">
              Barang tidak ditemukan.
            </p>
          )}
        </div>
      </div>

      <div className="stock-check-footer">
        <div aria-live="polite" className="stock-check-feedback">
          {error ? (
            <p className="stock-check-error" role="alert">
              {error}
            </p>
          ) : feedback ? (
            <p
              className={
                feedbackType === "success"
                  ? "stock-check-success"
                  : "stock-check-neutral"
              }
              role="status"
            >
              {feedback}
            </p>
          ) : (
            <p>Klik Selesai setelah pemeriksaan seluruh barang selesai.</p>
          )}
        </div>
        <button
          className="stock-check-finish"
          disabled={isSaving || items.length === 0}
          onClick={saveInspection}
          type="button"
        >
          {isSaving ? "Menyimpan..." : "Selesai"}
        </button>
      </div>
    </section>
  );
}
