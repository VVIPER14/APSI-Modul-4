"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import {
  proposalStatusLabel,
  proposalStatuses,
} from "@/app/lib/procurement";

export type ProposalProduct = {
  id_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
};

export type ProposalItem = {
  id_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  harga_satuan: string;
  jumlah_pesan: number;
  id_supplier: string | null;
  nama_supplier: string | null;
};

export type ProposalRecord = {
  id_pengajuan: string;
  tanggal_pengajuan: string;
  status_penyetujuan: number | null;
  harga_total: string;
  items: ProposalItem[];
};

type Props = {
  initialProposals: ProposalRecord[];
  products: ProposalProduct[];
};

type SortKey =
  | "id_barang"
  | "nama_barang"
  | "kategori"
  | "satuan"
  | "harga_satuan"
  | "jumlah_pesan"
  | "subtotal"
  | "nama_supplier"
  | "status_penyetujuan";

const tableHeaders: { label: string; key: SortKey }[] = [
  { label: "ID Barang", key: "id_barang" },
  { label: "Nama Barang", key: "nama_barang" },
  { label: "Kategori Barang", key: "kategori" },
  { label: "Satuan", key: "satuan" },
  { label: "Harga Satuan", key: "harga_satuan" },
  { label: "Jumlah Pesan", key: "jumlah_pesan" },
  { label: "Harga Total", key: "subtotal" },
  { label: "Supplier", key: "nama_supplier" },
  { label: "Status Pengajuan", key: "status_penyetujuan" },
];

function formatCurrency(value: string) {
  return `Rp${new Intl.NumberFormat("id-ID").format(BigInt(value || "0"))}`;
}

function getSubtotal(item: ProposalItem) {
  return (
    BigInt(item.harga_satuan || "0") * BigInt(item.jumlah_pesan)
  ).toString();
}

function compareRows(
  left: ProposalItem & { proposal: ProposalRecord },
  right: ProposalItem & { proposal: ProposalRecord },
  key: SortKey,
) {
  if (key === "harga_satuan") {
    return BigInt(left.harga_satuan) < BigInt(right.harga_satuan)
      ? -1
      : BigInt(left.harga_satuan) > BigInt(right.harga_satuan)
        ? 1
        : 0;
  }

  if (key === "jumlah_pesan") {
    return left.jumlah_pesan - right.jumlah_pesan;
  }

  if (key === "subtotal") {
    const leftTotal = BigInt(getSubtotal(left));
    const rightTotal = BigInt(getSubtotal(right));

    return leftTotal < rightTotal ? -1 : leftTotal > rightTotal ? 1 : 0;
  }

  if (key === "status_penyetujuan") {
    return proposalStatusLabel(left.proposal.status_penyetujuan).localeCompare(
      proposalStatusLabel(right.proposal.status_penyetujuan),
    );
  }

  return (left[key] ?? "").toString().localeCompare((right[key] ?? "").toString());
}

export default function ProposalForm({
  initialProposals,
  products,
}: Props) {
  const [proposals, setProposals] = useState(initialProposals);
  const [activeDraftId, setActiveDraftId] = useState(
    initialProposals.find(
      (proposal) =>
        proposal.status_penyetujuan === proposalStatuses.draft,
    )?.id_pengajuan ?? null,
  );
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nama_barang");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDraft =
    proposals.find(
      (proposal) => proposal.id_pengajuan === activeDraftId,
    ) ?? null;
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id_barang, product])),
    [products],
  );
  const rows = useMemo(
    () =>
      proposals.flatMap((proposal) =>
        proposal.items.map((item) => ({ ...item, proposal })),
      ),
    [proposals],
  );
  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filteredRows = rows.filter(
      (row) =>
        !query ||
        row.id_barang.toLocaleLowerCase().includes(query) ||
        row.nama_barang.toLocaleLowerCase().includes(query) ||
        row.proposal.id_pengajuan.toLocaleLowerCase().includes(query),
    );
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filteredRows].sort(
      (left, right) => direction * compareRows(left, right, sortKey),
    );
  }, [rows, search, sortDirection, sortKey]);
  const draftRows = visibleRows.filter(
    (row) => row.proposal.status_penyetujuan === proposalStatuses.draft,
  );
  const submittedRows = visibleRows.filter(
    (row) => row.proposal.status_penyetujuan === proposalStatuses.processing,
  );
  const historyRows = visibleRows.filter(
    (row) =>
      row.proposal.status_penyetujuan === proposalStatuses.approved ||
      row.proposal.status_penyetujuan === proposalStatuses.rejected,
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  async function saveDraft(items: ProposalItem[], idPengajuan: string | null) {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/beranda/karyawan-gudang/pengajuan-pemesanan/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-draft",
            id_pengajuan: idPengajuan,
            items: items.map((item) => ({
              id_barang: item.id_barang,
              harga_satuan: item.harga_satuan,
              jumlah_pesan: item.jumlah_pesan,
            })),
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        id_pengajuan?: string;
        harga_total?: string;
      };

      if (!response.ok || !result.id_pengajuan || !result.harga_total) {
        setError(result.error ?? "Draft pengajuan gagal disimpan.");
        return null;
      }

      const updatedProposal: ProposalRecord = {
        id_pengajuan: result.id_pengajuan,
        tanggal_pengajuan:
          proposals.find(
            (proposal) => proposal.id_pengajuan === result.id_pengajuan,
          )?.tanggal_pengajuan ?? new Date().toISOString(),
        status_penyetujuan: proposalStatuses.draft,
        harga_total: result.harga_total,
        items: items.map((item) => ({
          ...item,
          id_supplier: null,
          nama_supplier: null,
        })),
      };
      setProposals((current) =>
        [
          ...current.filter(
            (proposal) => proposal.id_pengajuan !== result.id_pengajuan,
          ),
          updatedProposal,
        ].sort((left, right) =>
          right.tanggal_pengajuan.localeCompare(left.tanggal_pengajuan),
        ),
      );
      setActiveDraftId(result.id_pengajuan);
      return result.id_pengajuan;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Draft pengajuan gagal disimpan.",
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const product = productById.get(selectedProductId);
    const quantity = Number(quantityInput);

    if (
      !product ||
      !/^\d{1,19}$/.test(priceInput) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 2147483647
    ) {
      setError("Lengkapi barang, harga, dan jumlah dengan benar.");
      return;
    }

    const currentItems = activeDraft?.items ?? [];

    if (currentItems.some((item) => item.id_barang === product.id_barang)) {
      setError("Barang tersebut sudah ada di draft ini.");
      return;
    }

    const nextItems = [
      ...currentItems,
      {
        ...product,
        harga_satuan: priceInput,
        jumlah_pesan: quantity,
        id_supplier: null,
        nama_supplier: null,
      },
    ];
    const savedId = await saveDraft(nextItems, activeDraftId);

    if (savedId) {
      setDialogOpen(false);
      setSelectedProductId("");
      setPriceInput("");
      setQuantityInput("1");
    }
  }

  async function removeItem(row: ProposalItem & { proposal: ProposalRecord }) {
    if (
      row.proposal.id_pengajuan !== activeDraftId ||
      row.proposal.status_penyetujuan !== proposalStatuses.draft
    ) {
      return;
    }

    const nextItems = row.proposal.items.filter(
      (item) => item.id_barang !== row.id_barang,
    );
    await saveDraft(nextItems, row.proposal.id_pengajuan);
  }

  async function submitDraft() {
    if (!activeDraft || activeDraft.items.length === 0) {
      setError("Tambahkan minimal satu barang sebelum mengirim pengajuan.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/beranda/karyawan-gudang/pengajuan-pemesanan/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            id_pengajuan: activeDraft.id_pengajuan,
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        status?: number;
        proposals?: {
          id_pengajuan: string;
          id_barang: string;
          harga_total: string;
        }[];
      };

      if (
        !response.ok ||
        result.status !== proposalStatuses.processing ||
        !Array.isArray(result.proposals) ||
        result.proposals.length !== activeDraft.items.length
      ) {
        setError(result.error ?? "Pengajuan gagal dikirim.");
        return;
      }

      const itemById = new Map(
        activeDraft.items.map((item) => [item.id_barang, item]),
      );
      const submittedProposals: ProposalRecord[] = result.proposals.map(
        (proposal) => {
          const item = itemById.get(proposal.id_barang);
          if (!item) {
            throw new Error("Barang pengajuan tidak cocok dengan draft.");
          }

          return {
            id_pengajuan: proposal.id_pengajuan,
            tanggal_pengajuan: activeDraft.tanggal_pengajuan,
            status_penyetujuan: proposalStatuses.processing,
            harga_total: proposal.harga_total,
            items: [
              {
                ...item,
                id_supplier: null,
                nama_supplier: null,
              },
            ],
          };
        },
      );
      setProposals((current) =>
        [
          ...current.filter(
            (proposal) => proposal.id_pengajuan !== activeDraft.id_pengajuan,
          ),
          ...submittedProposals,
        ].sort((left, right) =>
          right.tanggal_pengajuan.localeCompare(left.tanggal_pengajuan),
        ),
      );
      setActiveDraftId(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Pengajuan gagal dikirim.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderProposalTable(
    tableRows: (ProposalItem & { proposal: ProposalRecord })[],
    emptyMessage: string,
    showDraftActions = false,
  ) {
    return (
      <div className="proposal-table-viewport">
        <table className="proposal-table">
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
                      src="/images/proposal-sort.svg"
                      width={8}
                    />
                  </button>
                </th>
              ))}
              <th aria-label="Aksi" className="proposal-actions-heading" />
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const isActiveDraft =
                row.proposal.id_pengajuan === activeDraftId &&
                row.proposal.status_penyetujuan === proposalStatuses.draft;
              const canResumeDraft =
                row.proposal.status_penyetujuan === proposalStatuses.draft &&
                !isActiveDraft;

              return (
                <tr key={`${row.proposal.id_pengajuan}-${row.id_barang}`}>
                  <td>{row.id_barang}</td>
                  <td>{row.nama_barang}</td>
                  <td>{row.kategori}</td>
                  <td>{row.satuan}</td>
                  <td>{formatCurrency(row.harga_satuan)}</td>
                  <td>{row.jumlah_pesan}</td>
                  <td>{formatCurrency(getSubtotal(row))}</td>
                  <td>{row.nama_supplier ?? "Menunggu keputusan owner"}</td>
                  <td>
                    <span
                      className={`proposal-status proposal-status-${row.proposal.status_penyetujuan ?? "unknown"}`}
                    >
                      {proposalStatusLabel(row.proposal.status_penyetujuan)}
                    </span>
                    <small className="proposal-id-label">
                      {row.proposal.id_pengajuan}
                    </small>
                  </td>
                  <td className="proposal-row-action">
                    {showDraftActions && isActiveDraft ? (
                      <button
                        aria-label={`Hapus ${row.nama_barang} dari draft`}
                        className="proposal-remove-button"
                        disabled={isSaving}
                        onClick={() => void removeItem(row)}
                        title="Hapus barang"
                        type="button"
                      >
                        <Image
                          alt=""
                          aria-hidden="true"
                          height={12}
                          src="/images/proposal-trash.svg"
                          width={12}
                        />
                      </button>
                    ) : showDraftActions && canResumeDraft ? (
                      <button
                        className="proposal-resume-button"
                        disabled={isSaving}
                        onClick={() => {
                          setError(null);
                          setActiveDraftId(row.proposal.id_pengajuan);
                        }}
                        type="button"
                      >
                        Lanjutkan
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {tableRows.length === 0 ? (
              <tr>
                <td className="proposal-empty-cell" colSpan={10}>
                  {search ? "Barang tidak ditemukan." : emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section aria-label="Daftar pengajuan pemesanan" className="proposal-panel">
      <label className="proposal-search">
        <Image
          alt=""
          aria-hidden="true"
          height={20}
          src="/images/approval-search.svg"
          width={20}
        />
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari ID pengajuan atau barang"
          type="search"
          value={search}
        />
      </label>

      {error ? (
        <p className="proposal-error" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="proposal-history-title" className="procurement-section">
        <header className="procurement-section-heading">
          <div>
            <h2 id="proposal-history-title">Riwayat Pengajuan</h2>
            <p>Pengajuan yang sudah disetujui atau ditolak owner.</p>
          </div>
          <span>{historyRows.length} barang</span>
        </header>
        {renderProposalTable(historyRows, "Belum ada riwayat pengajuan.")}
      </section>

      <section aria-labelledby="proposal-submitted-title" className="procurement-section">
        <header className="procurement-section-heading">
          <div>
            <h2 id="proposal-submitted-title">Pengajuan Sudah Diajukan</h2>
            <p>Menunggu keputusan owner untuk setiap barang.</p>
          </div>
          <span>{submittedRows.length} barang</span>
        </header>
        {renderProposalTable(submittedRows, "Belum ada pengajuan yang dikirim.")}
      </section>

      <section aria-labelledby="proposal-create-title" className="procurement-section">
        <header className="procurement-section-heading">
          <div>
            <h2 id="proposal-create-title">Buat Pengajuan</h2>
            <p>
              Susun draft barang, lalu kirim agar setiap barang mendapat ID
              pengajuan masing-masing.
            </p>
          </div>
          <button
            className="proposal-add-button"
            disabled={isSaving || products.length === 0}
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
            type="button"
          >
            + Tambah Barang
          </button>
        </header>
        {activeDraft ? (
          <p className="proposal-draft-label">
            Draft aktif: <strong>{activeDraft.id_pengajuan}</strong>
          </p>
        ) : null}
        {renderProposalTable(
          draftRows,
          "Tambahkan barang untuk memulai pengajuan baru.",
          true,
        )}
        <div className="proposal-submit-row">
          <p>
            Total draft{" "}
            <strong>{formatCurrency(activeDraft?.harga_total ?? "0")}</strong>
          </p>
          <button
            className="proposal-submit-button"
            disabled={
              isSaving || !activeDraft || activeDraft.items.length === 0
            }
            onClick={() => void submitDraft()}
            type="button"
          >
            {isSaving ? "Menyimpan..." : "Kirim Pengajuan"}
          </button>
        </div>
      </section>

      {dialogOpen && (
        <div
          className="proposal-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              setDialogOpen(false);
            }
          }}
        >
          <form
            aria-labelledby="proposal-dialog-title"
            className="proposal-dialog"
            onSubmit={(event) => void addItem(event)}
            role="dialog"
          >
            <div className="proposal-dialog-heading">
              <div>
                <span>Pengajuan Pemesanan</span>
                <h2 id="proposal-dialog-title">Tambah Barang</h2>
              </div>
              <button
                aria-label="Tutup form"
                disabled={isSaving}
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <label>
              Barang
              <select
                onChange={(event) => setSelectedProductId(event.target.value)}
                required
                value={selectedProductId}
              >
                <option value="">Pilih barang</option>
                {products.map((product) => (
                  <option key={product.id_barang} value={product.id_barang}>
                    {product.id_barang} — {product.nama_barang}
                  </option>
                ))}
              </select>
            </label>

            {selectedProductId && (
              <div className="proposal-product-details">
                <span>
                  Kategori:{" "}
                  {productById.get(selectedProductId)?.kategori ?? "—"}
                </span>
                <span>
                  Satuan: {productById.get(selectedProductId)?.satuan ?? "—"}
                </span>
              </div>
            )}

            <div className="proposal-dialog-fields">
              <label>
                Harga Satuan (Rp)
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setPriceInput(event.target.value.replace(/\D/g, ""))
                  }
                  pattern="[0-9]{1,19}"
                  required
                  value={priceInput}
                />
              </label>
              <label>
                Jumlah Pesan
                <input
                  min="1"
                  onChange={(event) => setQuantityInput(event.target.value)}
                  required
                  type="number"
                  value={quantityInput}
                />
              </label>
            </div>

            {error && (
              <p className="proposal-error" role="alert">
                {error}
              </p>
            )}

            <div className="proposal-dialog-actions">
              <button
                className="proposal-cancel-button"
                disabled={isSaving}
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="proposal-add-confirm-button"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Menyimpan..." : "Tambah Barang"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
