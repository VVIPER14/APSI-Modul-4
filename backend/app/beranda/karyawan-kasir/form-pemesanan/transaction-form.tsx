"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export type CatalogProduct = {
  id_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  harga_satuan_jual: string;
  stok: number;
};

type Cart = Record<string, number>;
type SortKey = keyof CatalogProduct;
type SortDirection = "ascending" | "descending";

type ReceiptItem = {
  id_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  jumlah_jual: number;
  harga_satuan_jual: string;
  subtotal: string;
};

type Receipt = {
  id_transaksi: string;
  tanggal_transaksi: string;
  total_harga: string;
  items: ReceiptItem[];
};

const columns: { key: SortKey; label: string }[] = [
  { key: "id_barang", label: "ID" },
  { key: "nama_barang", label: "Nama Barang" },
  { key: "kategori", label: "Kategori" },
  { key: "satuan", label: "Satuan" },
  { key: "stok", label: "Stok" },
  { key: "harga_satuan_jual", label: "Harga" },
];

const currencyFormatter = new Intl.NumberFormat("id-ID");

function formatCurrency(value: string | bigint) {
  return `Rp${currencyFormatter.format(
    typeof value === "bigint" ? value : BigInt(value),
  )}`;
}

function compareProducts(
  first: CatalogProduct,
  second: CatalogProduct,
  key: SortKey,
) {
  if (key === "harga_satuan_jual") {
    const firstPrice = BigInt(first.harga_satuan_jual);
    const secondPrice = BigInt(second.harga_satuan_jual);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseReceipt(value: unknown): Receipt | null {
  if (
    !isRecord(value) ||
    typeof value.id_transaksi !== "string" ||
    typeof value.tanggal_transaksi !== "string" ||
    typeof value.total_harga !== "string" ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const items: ReceiptItem[] = [];

  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.id_barang !== "string" ||
      typeof item.nama_barang !== "string" ||
      typeof item.kategori !== "string" ||
      typeof item.satuan !== "string" ||
      typeof item.jumlah_jual !== "number" ||
      typeof item.harga_satuan_jual !== "string" ||
      typeof item.subtotal !== "string"
    ) {
      return null;
    }

    items.push({
      id_barang: item.id_barang,
      nama_barang: item.nama_barang,
      kategori: item.kategori,
      satuan: item.satuan,
      jumlah_jual: item.jumlah_jual,
      harga_satuan_jual: item.harga_satuan_jual,
      subtotal: item.subtotal,
    });
  }

  return {
    id_transaksi: value.id_transaksi,
    tanggal_transaksi: value.tanggal_transaksi,
    total_harga: value.total_harga,
    items,
  };
}

export default function TransactionForm({
  catalog,
  cashierName,
}: {
  catalog: CatalogProduct[];
  cashierName: string;
}) {
  const [cart, setCart] = useState<Cart>({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id_barang");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("ascending");
  const [notice, setNotice] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [printReceiptId, setPrintReceiptId] = useState<string | null>(null);

  const productsById = useMemo(
    () => new Map(catalog.map((product) => [product.id_barang, product])),
    [catalog],
  );
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id");
    const filtered = query
      ? catalog.filter(
          (product) =>
            product.id_barang.toLocaleLowerCase("id").includes(query) ||
            product.nama_barang.toLocaleLowerCase("id").includes(query) ||
            product.kategori.toLocaleLowerCase("id").includes(query),
        )
      : catalog;

    return [...filtered].sort((first, second) => {
      const compared = compareProducts(first, second, sortKey);
      return sortDirection === "ascending" ? compared : -compared;
    });
  }, [catalog, search, sortDirection, sortKey]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const product = productsById.get(id);
          return product ? { product, quantity } : null;
        })
        .filter((item) => item !== null),
    [cart, productsById],
  );
  const total = cartItems.reduce(
    (sum, { product, quantity }) =>
      sum + BigInt(product.harga_satuan_jual) * BigInt(quantity),
    BigInt(0),
  );
  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const unavailableItems = cartItems.filter(
    ({ product, quantity }) => quantity > product.stok,
  );

  useEffect(() => {
    if (!printReceiptId || receipt?.id_transaksi !== printReceiptId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.print();
      setPrintReceiptId(null);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [printReceiptId, receipt]);

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

  function addProduct(product: CatalogProduct) {
    if (product.stok < 1) {
      setNotice(`${product.nama_barang} sedang habis.`);
      return;
    }

    const quantity = (cart[product.id_barang] ?? 0) + 1;
    setCart((current) => ({ ...current, [product.id_barang]: quantity }));
    setNotice(
      quantity > product.stok
        ? `Stok ${product.nama_barang} tidak mencukupi. Tersedia ${product.stok}.`
        : "",
    );
  }

  function setQuantity(product: CatalogProduct, quantity: number) {
    if (quantity < 1) {
      setCart((current) => {
        const next = { ...current };
        delete next[product.id_barang];
        return next;
      });
      setNotice("");
      return;
    }

    setCart((current) => ({ ...current, [product.id_barang]: quantity }));
    setNotice(
      quantity > product.stok
        ? `Stok ${product.nama_barang} tidak mencukupi. Tersedia ${product.stok}.`
        : "",
    );
  }

  function removeProduct(id: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setNotice("");
  }

  async function saveTransaction(shouldPrint: boolean) {
    setNotice("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/beranda/karyawan-kasir/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map(({ product, quantity }) => ({
            id_barang: product.id_barang,
            jumlah_jual: quantity,
          })),
        }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const errorMessage =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Transaksi gagal dicatat.";
        const shortage =
          isRecord(result) && Array.isArray(result.insufficient)
            ? result.insufficient.find(isRecord)
            : null;

        if (
          shortage &&
          typeof shortage.nama_barang === "string" &&
          typeof shortage.tersedia === "number" &&
          typeof shortage.diminta === "number"
        ) {
          setNotice(
            `${shortage.nama_barang}: diminta ${shortage.diminta}, tetapi stok tersedia ${shortage.tersedia}.`,
          );
        } else {
          setNotice(errorMessage);
        }

        return;
      }

      const savedReceipt = parseReceipt(result);

      if (!savedReceipt) {
        setNotice("Transaksi tersimpan, tetapi data struk tidak terbaca.");
        return;
      }

      setReceipt(savedReceipt);
      setCart({});
      setIsConfirming(false);
      if (shouldPrint) {
        setPrintReceiptId(savedReceipt.id_transaksi);
      } else {
        setNotice(`Transaksi ${savedReceipt.id_transaksi} berhasil dicatat.`);
      }
    } catch {
      setNotice("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="transaction-layout">
        <section
          aria-labelledby="transaction-catalog-title"
          className="transaction-catalog-panel"
        >
          <div className="transaction-catalog-heading">
            <span className="role-dashboard-role">Karyawan Kasir</span>
            <h1 id="transaction-catalog-title">Katalog Barang</h1>
            <p>
              Lihat ID, nama, kategori, satuan, dan harga barang untuk
              menambahkan ke pesanan.
            </p>
          </div>

          <label className="transaction-search">
            <Image
              alt=""
              aria-hidden="true"
              height={18}
              src="/images/transaction-search.svg"
              width={18}
            />
            <input
              aria-label="Cari nama barang, kategori, atau ID"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama barang atau ID..."
              type="search"
              value={search}
            />
          </label>

          <div className="transaction-catalog-viewport">
            <table className="transaction-catalog-table">
              <caption className="sr-only">
                Katalog barang yang dapat ditambahkan ke transaksi
              </caption>
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
                        className="transaction-sort-button"
                        onClick={() => toggleSort(key)}
                        type="button"
                      >
                        <span>{label}</span>
                        <span
                          aria-hidden="true"
                          className={`transaction-sort-indicator${
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
                            src="/images/transaction-sort.svg"
                            width={8}
                          />
                        </span>
                      </button>
                    </th>
                  ))}
                  <th aria-hidden="true" className="transaction-add-heading" />
                </tr>
              </thead>
              <tbody>
                {visibleProducts.length > 0 ? (
                  visibleProducts.map((product) => {
                    const quantity = cart[product.id_barang] ?? 0;
                    const isUnavailable = product.stok === 0;

                    return (
                      <tr
                        className={
                          quantity > 0
                            ? "is-selected"
                            : isUnavailable
                              ? "is-unavailable"
                              : ""
                        }
                        key={product.id_barang}
                      >
                        <td>{product.id_barang}</td>
                        <td className="transaction-product-name">
                          {product.nama_barang}
                        </td>
                        <td>{product.kategori}</td>
                        <td>{product.satuan}</td>
                        <td>{product.stok}</td>
                        <td>{formatCurrency(product.harga_satuan_jual)}</td>
                        <td className="transaction-add-cell">
                          <button
                            aria-label={`${
                              isUnavailable ? "Stok habis untuk" : "Tambah"
                            } ${product.nama_barang}`}
                            className="transaction-add-button"
                            disabled={isUnavailable}
                            onClick={() => addProduct(product)}
                            type="button"
                          >
                            {isUnavailable ? "Habis" : quantity ? `+${quantity}` : "Tambah"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="transaction-empty" colSpan={columns.length + 1}>
                      {catalog.length > 0
                        ? "Barang tidak ditemukan."
                        : "Belum ada data barang."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="transaction-cart-title"
          className="transaction-cart-panel"
        >
          <header className="transaction-cart-header">
            <h2 id="transaction-cart-title">Detail Pemesanan</h2>
            <p>
              {cartItems.length} barang terpilih
              {totalUnits > 0 ? ` · ${totalUnits} unit` : ""}
            </p>
          </header>

          <div aria-live="polite" className="transaction-cart-items">
            {cartItems.length > 0 ? (
              cartItems.map(({ product, quantity }) => (
                <article
                  className="transaction-cart-item"
                  key={product.id_barang}
                >
                  <div className="transaction-cart-item-heading">
                    <div>
                      <h3>{product.nama_barang}</h3>
                      <p>
                        ID: {product.id_barang} · Kategori: {product.kategori}
                      </p>
                    </div>
                    <button
                      aria-label={`Hapus ${product.nama_barang} dari pesanan`}
                      className="transaction-remove-button"
                      onClick={() => removeProduct(product.id_barang)}
                      type="button"
                    >
                      <Image
                        alt=""
                        aria-hidden="true"
                        height={12}
                        src="/images/transaction-trash.svg"
                        width={12}
                      />
                    </button>
                  </div>
                  <div className="transaction-cart-details">
                    <div className="transaction-detail-field">
                      <span>Satuan</span>
                      <strong>{product.satuan}</strong>
                    </div>
                    <div className="transaction-detail-field">
                      <span>Harga Satuan</span>
                      <strong>
                        {formatCurrency(product.harga_satuan_jual)}
                      </strong>
                    </div>
                    <div className="transaction-detail-field">
                      <span>Jumlah</span>
                      <div className="transaction-quantity-control">
                        <button
                          aria-label={`Kurangi ${product.nama_barang}`}
                          onClick={() =>
                            setQuantity(product, quantity - 1)
                          }
                          type="button"
                        >
                          −
                        </button>
                        <input
                          aria-label={`Jumlah ${product.nama_barang}`}
                          min={1}
                          onChange={(event) =>
                            event.target.value &&
                            setQuantity(product, Number(event.target.value))
                          }
                          type="number"
                          value={quantity}
                        />
                        <button
                          aria-label={`Tambah ${product.nama_barang}`}
                          onClick={() =>
                            setQuantity(product, quantity + 1)
                          }
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="transaction-detail-field">
                      <span>Subtotal</span>
                      <strong>
                        {formatCurrency(
                          BigInt(product.harga_satuan_jual) *
                            BigInt(quantity),
                        )}
                      </strong>
                    </div>
                  </div>
                  {quantity > product.stok ? (
                    <p className="transaction-stock-warning" role="alert">
                      Stok tidak mencukupi. Tersedia {product.stok}, diminta{" "}
                      {quantity}.
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="transaction-cart-empty">
                Pilih barang dari katalog untuk mulai membuat transaksi.
              </p>
            )}
          </div>

          <footer className="transaction-cart-footer">
            <div className="transaction-total-summary">
              <div>
                <span>Harga Total</span>
                <small>
                  {cartItems.length} jenis barang · {totalUnits} unit
                </small>
              </div>
              <strong>{formatCurrency(total)}</strong>
            </div>
            {notice ? (
              <p className="transaction-notice" role="status">
                {notice}
              </p>
            ) : null}
            {unavailableItems.length > 0 ? (
              <p className="transaction-stock-warning" role="alert">
                Sesuaikan jumlah barang yang melebihi stok sebelum mencatat.
              </p>
            ) : null}
            <button
              className="transaction-save-button"
              disabled={cartItems.length === 0 || unavailableItems.length > 0}
              onClick={() => setIsConfirming(true)}
              type="button"
            >
              Catat
              <Image
                alt=""
                aria-hidden="true"
                height={16}
                src="/images/transaction-arrow-right.svg"
                width={16}
              />
            </button>
          </footer>
        </section>
      </div>

      {isConfirming ? (
        <div className="transaction-dialog-backdrop">
          <section
            aria-labelledby="transaction-confirm-title"
            aria-modal="true"
            className="transaction-confirm-dialog"
            role="dialog"
          >
            <h2 id="transaction-confirm-title">Catat Transaksi</h2>
            <p>Pilih apakah struk transaksi ingin dicetak.</p>
            {notice ? (
              <p className="transaction-dialog-error" role="alert">
                {notice}
              </p>
            ) : null}
            <div className="transaction-confirm-actions">
              <button
                className="transaction-secondary-button"
                disabled={isSaving}
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="transaction-secondary-button"
                disabled={isSaving}
                onClick={() => void saveTransaction(false)}
                type="button"
              >
                {isSaving ? "Menyimpan..." : "Simpan tanpa cetak"}
              </button>
              <button
                className="transaction-save-button"
                disabled={isSaving}
                onClick={() => void saveTransaction(true)}
                type="button"
              >
                {isSaving ? "Menyimpan..." : "Simpan & cetak"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {receipt ? (
        <article className="transaction-receipt">
          <header>
            <h1>APOTEK MEDIA MEDIKA</h1>
            <p>Struk Transaksi</p>
          </header>
          <dl>
            <div>
              <dt>ID Transaksi</dt>
              <dd>{receipt.id_transaksi}</dd>
            </div>
            <div>
              <dt>Tanggal</dt>
              <dd>{receipt.tanggal_transaksi}</dd>
            </div>
            <div>
              <dt>Kasir</dt>
              <dd>{cashierName}</dd>
            </div>
          </dl>
          <table>
            <thead>
              <tr>
                <th>Barang</th>
                <th>Jumlah</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item) => (
                <tr key={item.id_barang}>
                  <td>
                    {item.nama_barang}
                    <small>
                      {formatCurrency(item.harga_satuan_jual)} ×{" "}
                      {item.jumlah_jual}
                    </small>
                  </td>
                  <td>{item.jumlah_jual}</td>
                  <td>{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="transaction-receipt-total">
            Total <strong>{formatCurrency(receipt.total_harga)}</strong>
          </p>
          <p className="transaction-receipt-thanks">Terima kasih</p>
        </article>
      ) : null}
    </>
  );
}
