"use client";

import { useState } from "react";

export type ReceiptOrder = {
  id_pemesanan: string;
  tanggal_pemesanan: string;
  status_pemesanan: string;
  nama_supplier: string;
  items: {
    id_barang: string;
    nama_barang: string;
    satuan: string;
    jumlah_pesan: number;
    jumlah_diterima: number;
    sisa: number;
  }[];
};

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

export default function ReceiptForm({
  initialOrders,
}: {
  initialOrders: ReceiptOrder[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [invoiceByOrder, setInvoiceByOrder] = useState<Record<string, string>>(
    {},
  );
  const [quantityByItem, setQuantityByItem] = useState<Record<string, string>>(
    {},
  );
  const [sortByOrder, setSortByOrder] = useState<
    Record<string, { key: string; direction: "asc" | "desc" }>
  >({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function recordReceipt(order: ReceiptOrder) {
    setError(null);
    setNotice(null);
    setBusyOrderId(order.id_pemesanan);
    const items = order.items.flatMap((item) => {
      const key = `${order.id_pemesanan}:${item.id_barang}`;
      const quantity = Number(quantityByItem[key] ?? item.sisa);
      return quantity > 0
        ? [{ id_barang: item.id_barang, jumlah_diterima: quantity }]
        : [];
    });

    if (items.length === 0) {
      setError("Masukkan jumlah diterima minimal satu barang.");
      setBusyOrderId(null);
      return;
    }

    try {
      const response = await fetch(
        "/api/beranda/karyawan-gudang/penerimaan/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_pemesanan: order.id_pemesanan,
            no_faktur: invoiceByOrder[order.id_pemesanan] ?? "",
            items,
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        id_penerimaan?: string;
        status_pemesanan?: string;
        items?: { id_barang: string; jumlah_diterima: number }[];
      };

      if (
        !response.ok ||
        !result.id_penerimaan ||
        !result.status_pemesanan ||
        !result.items
      ) {
        setError(result.error ?? "Penerimaan barang gagal dicatat.");
        return;
      }

      const receivedByItem = new Map(
        result.items.map((item) => [item.id_barang, item.jumlah_diterima]),
      );
      setOrders((current) =>
        current.map((currentOrder) =>
          currentOrder.id_pemesanan !== order.id_pemesanan
            ? currentOrder
            : {
                ...currentOrder,
                status_pemesanan: result.status_pemesanan ?? currentOrder.status_pemesanan,
                items: currentOrder.items.map((item) => {
                  const received = receivedByItem.get(item.id_barang) ?? 0;
                  return {
                    ...item,
                    jumlah_diterima: item.jumlah_diterima + received,
                    sisa: item.sisa - received,
                  };
                }),
              },
        ),
      );
      setQuantityByItem((current) => {
        const next = { ...current };
        for (const item of order.items) {
          delete next[`${order.id_pemesanan}:${item.id_barang}`];
        }
        return next;
      });
      setNotice(
        `Penerimaan ${result.id_penerimaan} berhasil dicatat untuk pemesanan ${order.id_pemesanan}.`,
      );
    } catch (receiptError) {
      setError(
        receiptError instanceof Error
          ? receiptError.message
          : "Penerimaan barang gagal dicatat.",
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  const pendingOrders = orders.filter((order) =>
    order.items.some((item) => item.sisa > 0),
  );
  const receiptColumns = [
    { key: "id_barang", label: "ID Barang" },
    { key: "nama_barang", label: "Nama Barang" },
    { key: "satuan", label: "Satuan" },
    { key: "jumlah_pesan", label: "Jumlah Pesan" },
    { key: "jumlah_diterima", label: "Sudah Diterima" },
    { key: "sisa", label: "Sisa" },
    { key: "jumlah_diterima_sekarang", label: "Jumlah Diterima Sekarang" },
  ] as const;

  function toggleReceiptSort(orderId: string, key: string) {
    setSortByOrder((current) => {
      const currentSort = current[orderId] ?? {
        key: "id_barang",
        direction: "asc" as const,
      };
      return {
        ...current,
        [orderId]: {
          key,
          direction:
            currentSort.key === key && currentSort.direction === "asc"
              ? "desc"
              : "asc",
        },
      };
    });
  }

  return (
    <section aria-label="Daftar barang untuk diterima" className="receipt-list">
      {error ? (
        <p className="proposal-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="receipt-notice" role="status">
          {notice}
        </p>
      ) : null}

      {pendingOrders.length ? (
        pendingOrders.map((order) => {
          const isBusy = busyOrderId === order.id_pemesanan;
          const currentSort = sortByOrder[order.id_pemesanan] ?? {
            key: "id_barang",
            direction: "asc" as const,
          };
          const sortedItems = [...order.items].sort((first, second) => {
            const firstValue =
              currentSort.key === "jumlah_diterima_sekarang"
                ? quantityByItem[`${order.id_pemesanan}:${first.id_barang}`] ??
                  first.sisa
                : first[currentSort.key as keyof typeof first];
            const secondValue =
              currentSort.key === "jumlah_diterima_sekarang"
                ? quantityByItem[`${order.id_pemesanan}:${second.id_barang}`] ??
                  second.sisa
                : second[currentSort.key as keyof typeof second];
            const result =
              typeof firstValue === "number" && typeof secondValue === "number"
                ? firstValue - secondValue
                : String(firstValue).localeCompare(String(secondValue), "id", {
                    numeric: true,
                    sensitivity: "base",
                  });
            return currentSort.direction === "asc" ? result : -result;
          });
          return (
            <article
              aria-labelledby={`receipt-${order.id_pemesanan}`}
              className="report-panel receipt-order"
              key={order.id_pemesanan}
            >
              <header className="receipt-order-heading">
                <div>
                  <h2 id={`receipt-${order.id_pemesanan}`}>
                    Pemesanan {order.id_pemesanan}
                  </h2>
                  <p>
                    Supplier: {order.nama_supplier} · Tanggal:{" "}
                    {formatDate(order.tanggal_pemesanan)} · Status:{" "}
                    {order.status_pemesanan}
                  </p>
                </div>
              </header>
              <label className="receipt-invoice-field">
                Nomor Faktur (opsional)
                <input
                  maxLength={255}
                  onChange={(event) =>
                    setInvoiceByOrder((current) => ({
                      ...current,
                      [order.id_pemesanan]: event.target.value,
                    }))
                  }
                  value={invoiceByOrder[order.id_pemesanan] ?? ""}
                />
              </label>
              <div className="report-table-viewport">
                <table className="report-table">
                  <thead>
                    <tr>
                      {receiptColumns.map(({ key, label }) => (
                        <th
                          aria-sort={
                            currentSort.key === key
                              ? currentSort.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          key={key}
                          scope="col"
                        >
                          <button
                            className="report-sort-button"
                            onClick={() =>
                              toggleReceiptSort(order.id_pemesanan, key)
                            }
                            type="button"
                          >
                            {label}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item) => {
                      const key = `${order.id_pemesanan}:${item.id_barang}`;
                      return (
                        <tr key={item.id_barang}>
                          <td>{item.id_barang}</td>
                          <td>{item.nama_barang}</td>
                          <td>{item.satuan}</td>
                          <td>{item.jumlah_pesan}</td>
                          <td>{item.jumlah_diterima}</td>
                          <td>{item.sisa}</td>
                          <td>
                            <input
                              aria-label={`Jumlah ${item.nama_barang} diterima`}
                              className="receipt-quantity-input"
                              disabled={isBusy || item.sisa === 0}
                              max={item.sisa}
                              min={0}
                              onChange={(event) =>
                                setQuantityByItem((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              type="number"
                              value={
                                quantityByItem[key] ?? String(item.sisa)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                className="receipt-submit-button"
                disabled={isBusy}
                onClick={() => void recordReceipt(order)}
                type="button"
              >
                {isBusy ? "Menyimpan..." : "Catat Penerimaan"}
              </button>
            </article>
          );
        })
      ) : (
        <p className="report-panel receipt-empty">
          Belum ada pemesanan disetujui yang menunggu penerimaan.
        </p>
      )}
    </section>
  );
}
