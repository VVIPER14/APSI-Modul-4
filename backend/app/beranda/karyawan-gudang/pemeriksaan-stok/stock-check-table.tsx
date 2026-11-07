"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type StockItem = {
  id_barang: string;
  nama_barang: string;
  satuan: string;
  stok_minimum: number;
  stok: number;
  catatan: string;
};

export default function StockCheckTable({
  initialItems,
}: {
  initialItems: StockItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id");

    if (!query) {
      return items;
    }

    return items.filter(
      (item) =>
        item.id_barang.toLocaleLowerCase("id").includes(query) ||
        item.nama_barang.toLocaleLowerCase("id").includes(query),
    );
  }, [items, search]);

  function updateItem(id: string, change: Partial<StockItem>) {
    setItems((current) =>
      current.map((item) =>
        item.id_barang === id ? { ...item, ...change } : item,
      ),
    );
  }

  async function saveInspection() {
    setError("");
    setSavedId("");
    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/beranda/karyawan-gudang/pemeriksaan-stok",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map(({ id_barang, stok, catatan }) => ({
              id_barang,
              stok,
              catatan,
            })),
          }),
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

      if (
        typeof result !== "object" ||
        result === null ||
        !("id_pemeriksaan" in result) ||
        typeof result.id_pemeriksaan !== "string"
      ) {
        setError("Respons penyimpanan pemeriksaan tidak valid.");
        return;
      }

      setSavedId(result.id_pemeriksaan);
      setEditingId(null);
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
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
        <div className="stock-check-table" role="table" aria-label="Stok barang">
          <div className="stock-check-table-header" role="row">
            <span role="columnheader">ID Barang</span>
            <span role="columnheader">Nama Barang</span>
            <span role="columnheader">Satuan</span>
            <span role="columnheader">Stok Minimum</span>
            <span role="columnheader">Stok Tersedia</span>
            <span role="columnheader">Catatan</span>
            <span role="columnheader">Status</span>
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
                  <label className="stock-check-note" role="cell">
                    <span className="sr-only">
                      Catatan untuk {item.nama_barang}
                    </span>
                    <input
                      maxLength={255}
                      onChange={(event) =>
                        updateItem(item.id_barang, {
                          catatan: event.target.value,
                        })
                      }
                      placeholder="Catat selisih fisik..."
                      value={item.catatan}
                    />
                  </label>
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
          ) : savedId ? (
            <p className="stock-check-success" role="status">
              Pemeriksaan {savedId} berhasil disimpan.
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
