"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  proposalStatusLabel,
  proposalStatuses,
} from "@/app/lib/procurement";

type ApprovalItem = {
  id_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  harga_satuan: string;
  jumlah_pesan: number;
  id_supplier: string | null;
  nama_supplier: string | null;
};

export type ApprovalProposal = {
  id_pengajuan: string;
  tanggal_pengajuan: string;
  nama_pengaju: string;
  status_penyetujuan: number | null;
  harga_total: string;
  items: ApprovalItem[];
};

type SortKey =
  | "id_pengajuan"
  | "id_barang"
  | "nama_barang"
  | "kategori"
  | "satuan"
  | "harga_satuan"
  | "jumlah_pesan"
  | "subtotal"
  | "nama_supplier";

const tableHeaders: { label: string; key: SortKey }[] = [
  { label: "ID Pengajuan", key: "id_pengajuan" },
  { label: "ID Barang", key: "id_barang" },
  { label: "Nama Barang", key: "nama_barang" },
  { label: "Kategori", key: "kategori" },
  { label: "Satuan", key: "satuan" },
  { label: "Harga Satuan", key: "harga_satuan" },
  { label: "Jumlah Pesan", key: "jumlah_pesan" },
  { label: "Sub Total Harga", key: "subtotal" },
  { label: "Supplier", key: "nama_supplier" },
];

function formatCurrency(value: string) {
  return `Rp${new Intl.NumberFormat("id-ID").format(BigInt(value || "0"))}`;
}

function subtotal(item: ApprovalItem) {
  return (
    BigInt(item.harga_satuan || "0") * BigInt(item.jumlah_pesan)
  ).toString();
}

function compareItems(
  left: ApprovalItem,
  right: ApprovalItem,
  key: Exclude<SortKey, "id_pengajuan">,
) {
  if (key === "harga_satuan" || key === "subtotal") {
    const leftValue =
      key === "subtotal" ? BigInt(subtotal(left)) : BigInt(left.harga_satuan);
    const rightValue =
      key === "subtotal" ? BigInt(subtotal(right)) : BigInt(right.harga_satuan);

    return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
  }

  if (key === "jumlah_pesan") {
    return left.jumlah_pesan - right.jumlah_pesan;
  }

  return (left[key] ?? "").toString().localeCompare((right[key] ?? "").toString());
}

function compareProposalItems(
  left: ApprovalItem,
  right: ApprovalItem,
  key: SortKey,
) {
  return key === "id_pengajuan" ? 0 : compareItems(left, right, key);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function ApprovalTable({
  initialProposals,
}: {
  initialProposals: ApprovalProposal[];
}) {
  const [proposals, setProposals] = useState(initialProposals);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id_pengajuan");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleProposals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = proposals.filter(
      (proposal) =>
        !query ||
        proposal.id_pengajuan.toLocaleLowerCase().includes(query) ||
        proposal.nama_pengaju.toLocaleLowerCase().includes(query) ||
        proposal.items.some(
          (item) =>
            item.id_barang.toLocaleLowerCase().includes(query) ||
            item.nama_barang.toLocaleLowerCase().includes(query),
        ),
    );
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filtered]
      .map((proposal) => ({
        ...proposal,
        items:
          sortKey === "id_pengajuan"
            ? proposal.items
            : [...proposal.items].sort((left, right) =>
                direction * compareProposalItems(left, right, sortKey),
              ),
      }))
      .sort((left, right) => {
        if (sortKey === "id_pengajuan") {
          return direction * left.id_pengajuan.localeCompare(right.id_pengajuan);
        }

        const leftItem = left.items[0];
        const rightItem = right.items[0];

        return leftItem && rightItem
          ? direction * compareProposalItems(leftItem, rightItem, sortKey)
          : direction * left.id_pengajuan.localeCompare(right.id_pengajuan);
      });
  }, [proposals, search, sortDirection, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  async function decide(proposal: ApprovalProposal, action: "approve" | "reject") {
    setError(null);
    setBusyProposalId(proposal.id_pengajuan);

    try {
      const response = await fetch(
        "/api/beranda/owner/persetujuan-pengajuan-pemesanan/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            id_pengajuan: proposal.id_pengajuan,
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        id_pengajuan?: string;
        status?: number;
      };

      if (!response.ok || typeof result.status !== "number") {
        setError(result.error ?? "Keputusan pengajuan gagal disimpan.");
        return;
      }

      setProposals((current) =>
        current.map((item) =>
          item.id_pengajuan === result.id_pengajuan
            ? { ...item, status_penyetujuan: result.status ?? item.status_penyetujuan }
            : item,
        ),
      );
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "Keputusan pengajuan gagal disimpan.",
      );
    } finally {
      setBusyProposalId(null);
    }
  }

  return (
    <section aria-label="Daftar persetujuan pengajuan" className="approval-panel">
      <label className="proposal-search approval-search">
        <Image
          alt=""
          aria-hidden="true"
          height={20}
          src="/images/approval-search.svg"
          width={20}
        />
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari ID pengajuan"
          type="search"
          value={search}
        />
      </label>

      {error && (
        <p className="proposal-error" role="alert">
          {error}
        </p>
      )}

      <div className="approval-table-viewport">
        <table className="approval-table">
          <thead>
            <tr>
              {tableHeaders.map((header) => (
                <th
                  aria-sort={
                    sortKey === header.key
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  key={header.key}
                >
                  <button
                    onClick={() => toggleSort(header.key)}
                    type="button"
                  >
                    {header.label}
                    <Image
                      alt=""
                      aria-hidden="true"
                      className={
                        sortKey === header.key && sortDirection === "desc"
                          ? "proposal-sort-icon is-descending"
                          : "proposal-sort-icon"
                      }
                      height={8}
                      src="/images/approval-sort.svg"
                      width={8}
                    />
                  </button>
                </th>
              ))}
              <th className="approval-status-heading">Status / Keputusan</th>
            </tr>
          </thead>
          {visibleProposals.map((proposal) => {
            const items = proposal.items.length > 0 ? proposal.items : [null];
            const isProcessing =
              proposal.status_penyetujuan === proposalStatuses.processing;
            const isBusy = busyProposalId === proposal.id_pengajuan;

            return (
              <tbody key={proposal.id_pengajuan}>
                {items.map((item, index) => (
                  <tr key={`${proposal.id_pengajuan}-${item?.id_barang ?? "empty"}`}>
                    {index === 0 && (
                      <td className="approval-proposal-id" rowSpan={items.length}>
                        <strong>{proposal.id_pengajuan}</strong>
                        <small>{formatDate(proposal.tanggal_pengajuan)}</small>
                        <small>Pengaju: {proposal.nama_pengaju}</small>
                      </td>
                    )}
                    <td>{item?.id_barang ?? "—"}</td>
                    <td>{item?.nama_barang ?? "Tidak ada rincian barang"}</td>
                    <td>{item?.kategori ?? "—"}</td>
                    <td>{item?.satuan ?? "—"}</td>
                    <td>{item ? formatCurrency(item.harga_satuan) : "—"}</td>
                    <td>{item?.jumlah_pesan ?? "—"}</td>
                    <td>{item ? formatCurrency(subtotal(item)) : "—"}</td>
                    <td>{item?.nama_supplier ?? "—"}</td>
                    {index === 0 && (
                      <td
                        className="approval-decision-cell"
                        rowSpan={items.length}
                      >
                        <span
                          className={`proposal-status proposal-status-${proposal.status_penyetujuan ?? "unknown"}`}
                        >
                          {proposalStatusLabel(proposal.status_penyetujuan)}
                        </span>
                        {isProcessing && (
                          <div className="approval-decision-buttons">
                            <button
                              className="approval-reject-button"
                              disabled={isBusy}
                              onClick={() => void decide(proposal, "reject")}
                              type="button"
                            >
                              Tolak
                            </button>
                            <button
                              className="approval-approve-button"
                              disabled={isBusy}
                              onClick={() => void decide(proposal, "approve")}
                              type="button"
                            >
                              {isBusy ? "..." : "Setuju"}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="approval-total-row">
                  <td colSpan={7}>Total Pengajuan</td>
                  <td>{formatCurrency(proposal.harga_total)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            );
          })}
          {visibleProposals.length === 0 && (
            <tbody>
              <tr>
                <td className="proposal-empty-cell" colSpan={10}>
                  {search
                    ? "Pengajuan tidak ditemukan."
                    : "Belum ada pengajuan yang perlu ditinjau."}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </section>
  );
}
