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
  id_pemesanan?: string;
  items: ApprovalItem[];
};

type ApprovalSupplier = {
  id_supplier: string;
  nama_supplier: string;
};

type SortKey =
  | "id_pengajuan"
  | "tanggal_pengajuan"
  | "nama_pengaju"
  | "id_barang"
  | "nama_barang"
  | "kategori"
  | "satuan"
  | "harga_satuan"
  | "jumlah_pesan"
  | "subtotal"
  | "harga_total"
  | "nama_supplier";

const tableHeaders: { label: string; key: SortKey }[] = [
  { label: "ID Pengajuan", key: "id_pengajuan" },
  { label: "Tanggal Pengajuan", key: "tanggal_pengajuan" },
  { label: "Nama Pengaju", key: "nama_pengaju" },
  { label: "ID Barang", key: "id_barang" },
  { label: "Nama Barang", key: "nama_barang" },
  { label: "Kategori", key: "kategori" },
  { label: "Satuan", key: "satuan" },
  { label: "Harga Satuan", key: "harga_satuan" },
  { label: "Jumlah Pesan", key: "jumlah_pesan" },
  { label: "Sub Total Harga", key: "subtotal" },
  { label: "Harga Total", key: "harga_total" },
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
  key: SortKey,
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

  if (
    key === "id_pengajuan" ||
    key === "tanggal_pengajuan" ||
    key === "nama_pengaju" ||
    key === "harga_total"
  ) {
    return 0;
  }

  return (left[key] ?? "").toString().localeCompare((right[key] ?? "").toString());
}

function compareProposalItems(
  left: ApprovalItem,
  right: ApprovalItem,
  key: SortKey,
) {
  return compareItems(left, right, key);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function ApprovalTable({
  initialProposals,
  suppliers,
}: {
  initialProposals: ApprovalProposal[];
  suppliers: ApprovalSupplier[];
}) {
  const [proposals, setProposals] = useState(initialProposals);
  const [supplierByProposal, setSupplierByProposal] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialProposals.map((proposal) => [
        proposal.id_pengajuan,
        proposal.status_penyetujuan === proposalStatuses.processing
          ? ""
          : proposal.items[0]?.id_supplier ?? "",
      ]),
    ),
  );
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

        if (sortKey === "tanggal_pengajuan") {
          return (
            direction *
            left.tanggal_pengajuan.localeCompare(right.tanggal_pengajuan)
          );
        }

        if (sortKey === "nama_pengaju") {
          return direction * left.nama_pengaju.localeCompare(right.nama_pengaju);
        }

        if (sortKey === "harga_total") {
          const leftTotal = BigInt(left.harga_total);
          const rightTotal = BigInt(right.harga_total);
          return direction * (leftTotal < rightTotal ? -1 : leftTotal > rightTotal ? 1 : 0);
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

  async function decide(
    proposal: ApprovalProposal,
    action: "approve" | "reject",
  ) {
    setError(null);
    setBusyProposalId(proposal.id_pengajuan);
    const selectedSupplierId = supplierByProposal[proposal.id_pengajuan] ?? "";

    if (action === "approve" && !selectedSupplierId) {
      setError("Pilih supplier yang sudah dihubungi sebelum memutuskan.");
      setBusyProposalId(null);
      return;
    }

    try {
      const response = await fetch(
        "/api/beranda/owner/persetujuan-pengajuan-pemesanan/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            id_pengajuan: proposal.id_pengajuan,
            id_supplier: selectedSupplierId || null,
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        id_pengajuan?: string;
        status?: number;
        id_pemesanan?: string;
        id_supplier?: string;
        nama_supplier?: string;
      };

      if (!response.ok || typeof result.status !== "number") {
        setError(result.error ?? "Keputusan pengajuan gagal disimpan.");
        return;
      }

      setProposals((current) =>
        current.map((item) =>
          item.id_pengajuan === result.id_pengajuan
            ? {
                ...item,
                status_penyetujuan:
                  result.status ?? item.status_penyetujuan,
                id_pemesanan: result.id_pemesanan ?? item.id_pemesanan,
                items:
                  result.id_supplier && result.nama_supplier
                    ? item.items.map((proposalItem) => ({
                        ...proposalItem,
                        id_supplier: result.id_supplier ?? null,
                        nama_supplier: result.nama_supplier ?? null,
                      }))
                    : item.items,
              }
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

  const pendingProposals = visibleProposals.filter(
    (proposal) =>
      proposal.status_penyetujuan === proposalStatuses.processing,
  );
  const historyProposals = visibleProposals.filter(
    (proposal) =>
      proposal.status_penyetujuan === proposalStatuses.approved ||
      proposal.status_penyetujuan === proposalStatuses.rejected,
  );

  function renderTable(
    tableProposals: ApprovalProposal[],
    allowDecision: boolean,
    emptyMessage: string,
  ) {
    return (
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
          <tbody>
            {tableProposals.flatMap((proposal) => {
              const items = proposal.items.length ? proposal.items : [null];
              const isBusy = busyProposalId === proposal.id_pengajuan;

              return items.map((item, index) => (
                <tr
                  key={`${proposal.id_pengajuan}-${item?.id_barang ?? `empty-${index}`}`}
                >
                  <td>{proposal.id_pengajuan}</td>
                  <td>{formatDate(proposal.tanggal_pengajuan)}</td>
                  <td>{proposal.nama_pengaju}</td>
                  <td>{item?.id_barang ?? "—"}</td>
                  <td>{item?.nama_barang ?? "Tidak ada rincian barang"}</td>
                  <td>{item?.kategori ?? "—"}</td>
                  <td>{item?.satuan ?? "—"}</td>
                  <td>{item ? formatCurrency(item.harga_satuan) : "—"}</td>
                  <td>{item?.jumlah_pesan ?? "—"}</td>
                  <td>{item ? formatCurrency(subtotal(item)) : "—"}</td>
                  <td>{formatCurrency(proposal.harga_total)}</td>
                  <td>
                    {allowDecision ? (
                      <label className="approval-supplier-field">
                        <span className="sr-only">Supplier yang dihubungi</span>
                        <select
                          aria-label={`Supplier untuk ${proposal.id_pengajuan}`}
                          disabled={isBusy}
                          onChange={(event) =>
                            setSupplierByProposal((current) => ({
                              ...current,
                              [proposal.id_pengajuan]: event.target.value,
                            }))
                          }
                          value={
                            supplierByProposal[proposal.id_pengajuan] ?? ""
                          }
                        >
                          <option value="">Pilih supplier</option>
                          {suppliers.map((supplier) => (
                            <option
                              key={supplier.id_supplier}
                              value={supplier.id_supplier}
                            >
                              {supplier.nama_supplier}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      item?.nama_supplier ?? "—"
                    )}
                  </td>
                  <td className="approval-decision-cell">
                    <span
                      className={`proposal-status proposal-status-${proposal.status_penyetujuan ?? "unknown"}`}
                    >
                      {proposalStatusLabel(proposal.status_penyetujuan)}
                    </span>
                    {proposal.id_pemesanan ? (
                      <small>ID Pemesanan: {proposal.id_pemesanan}</small>
                    ) : null}
                    {allowDecision ? (
                      <div className="approval-decision-buttons">
                        <button
                          className="approval-reject-button"
                          disabled={isBusy}
                          onClick={() => void decide(proposal, "reject")}
                          type="button"
                        >
                          {isBusy ? "..." : "Supplier tidak tersedia"}
                        </button>
                        <button
                          className="approval-approve-button"
                          disabled={isBusy}
                          onClick={() => void decide(proposal, "approve")}
                          type="button"
                        >
                          {isBusy ? "..." : "Konfirmasi & Setujui"}
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ));
            })}
            {tableProposals.length === 0 ? (
              <tr>
                <td className="proposal-empty-cell" colSpan={13}>
                  {search ? "Pengajuan tidak ditemukan." : emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
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
          placeholder="Cari ID, pengaju, atau barang"
          type="search"
          value={search}
        />
      </label>

      {error ? (
        <p className="proposal-error" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="owner-pending-proposals" className="procurement-section">
        <header className="procurement-section-heading">
          <div>
            <h2 id="owner-pending-proposals">Pengajuan Perlu Ditinjau</h2>
            <p>Tentukan supplier setelah dikonfirmasi, lalu setujui atau tolak.</p>
          </div>
          <span>{pendingProposals.length} pengajuan</span>
        </header>
        {renderTable(
          pendingProposals,
          true,
          "Belum ada pengajuan yang menunggu keputusan.",
        )}
      </section>

      <section aria-labelledby="owner-proposal-history" className="procurement-section">
        <header className="procurement-section-heading">
          <div>
            <h2 id="owner-proposal-history">Riwayat Persetujuan</h2>
            <p>Pengajuan yang sudah disetujui atau ditolak.</p>
          </div>
          <span>{historyProposals.length} pengajuan</span>
        </header>
        {renderTable(
          historyProposals,
          false,
          "Belum ada riwayat keputusan pengajuan.",
        )}
      </section>
    </section>
  );
}
