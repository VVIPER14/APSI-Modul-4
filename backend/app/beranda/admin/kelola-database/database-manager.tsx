"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  adminDatabaseTables,
  type AdminDatabaseField,
} from "@/app/lib/admin-database";

type DatabaseRow = Record<string, unknown>;
type SortDirection = "asc" | "desc";

type TableResponse = {
  error?: string;
  table?: { name: string; label: string };
  fields?: AdminDatabaseField[];
  rows?: DatabaseRow[];
  page?: number;
  pageSize?: number;
  total?: number;
};

function rowValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (value instanceof Date) {
    return value.toLocaleString("id-ID");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formValue(value: unknown, kind: AdminDatabaseField["kind"]) {
  if (value === null || value === undefined) {
    return "";
  }
  if (kind === "date") {
    return String(value).slice(0, 10);
  }
  if (kind === "time") {
    const text = String(value);
    return text.includes("T")
      ? text.slice(11, 19)
      : text.slice(0, 8);
  }
  return String(value);
}

function compareValues(first: unknown, second: unknown) {
  const firstText = rowValue(first);
  const secondText = rowValue(second);
  if (/^-?\d+$/.test(firstText) && /^-?\d+$/.test(secondText)) {
    const firstInteger = BigInt(firstText);
    const secondInteger = BigInt(secondText);
    return firstInteger < secondInteger ? -1 : firstInteger > secondInteger ? 1 : 0;
  }

  const firstNumber = Number(firstText);
  const secondNumber = Number(secondText);

  if (
    firstText !== "—" &&
    secondText !== "—" &&
    Number.isFinite(firstNumber) &&
    Number.isFinite(secondNumber)
  ) {
    return firstNumber - secondNumber;
  }

  return firstText.localeCompare(secondText, "id", {
    numeric: true,
    sensitivity: "base",
  });
}

export default function DatabaseManager() {
  const [selectedTable, setSelectedTable] = useState(adminDatabaseTables[0].name);
  const [fields, setFields] = useState<AdminDatabaseField[]>([]);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");
  const [editingRow, setEditingRow] = useState<DatabaseRow | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentTable =
    adminDatabaseTables.find((table) => table.name === selectedTable) ??
    adminDatabaseTables[0];
  const visibleFields = fields.filter((field) => field.kind !== "password");
  const primaryFields = fields.filter((field) => field.primary);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        table: selectedTable,
        page: String(page),
        sort: sortField,
        direction: sortDirection,
      });
      const response = await fetch(`/api/beranda/admin/kelola-database/?${query}`);
      const result = (await response.json()) as TableResponse;

      if (!response.ok || !result.fields || !result.rows) {
        setError(result.error ?? "Data tabel gagal dimuat.");
        return;
      }

      setFields(result.fields);
      setRows(result.rows);
      setPageSize(result.pageSize ?? 100);
      setTotal(result.total ?? 0);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Data tabel gagal dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedTable, sortDirection, sortField]);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      table: selectedTable,
      page: String(page),
      sort: sortField,
      direction: sortDirection,
    });

    void fetch(`/api/beranda/admin/kelola-database/?${query}`)
      .then(async (response) => ({
        ok: response.ok,
        result: (await response.json()) as TableResponse,
      }))
      .then(({ ok, result }) => {
        if (!active) {
          return;
        }
        if (!ok || !result.fields || !result.rows) {
          setError(result.error ?? "Data tabel gagal dimuat.");
          setIsLoading(false);
          return;
        }
        setFields(result.fields);
        setRows(result.rows);
        setPageSize(result.pageSize ?? 100);
        setTotal(result.total ?? 0);
        setIsLoading(false);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Data tabel gagal dimuat.",
          );
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, selectedTable, sortDirection, sortField]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id");
    const filtered = query
      ? rows.filter((row) =>
          visibleFields.some((field) =>
            rowValue(row[field.name]).toLocaleLowerCase("id").includes(query),
          ),
        )
      : rows;

    if (!sortField) {
      return filtered;
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort(
      (left, right) =>
        direction * compareValues(left[sortField], right[sortField]),
    );
  }, [rows, search, sortDirection, sortField, visibleFields]);

  function changeTable(tableName: string) {
    setIsLoading(true);
    setSelectedTable(tableName);
    setPage(0);
    setSearch("");
    setSortField("");
    setSortDirection("asc");
    setEditingRow(null);
    setNotice("");
  }

  function toggleSort(fieldName: string) {
    setIsLoading(true);
    setPage(0);
    if (sortField === fieldName) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(fieldName);
      setSortDirection("asc");
    }
  }

  function changePage(nextPage: number) {
    setIsLoading(true);
    setPage(nextPage);
  }

  function changeSearch(value: string) {
    setSearch(value);
    if (page !== 0) {
      changePage(0);
    }
  }

  function openCreateForm() {
    setEditingRow(null);
    setFormData(Object.fromEntries(fields.map((field) => [field.name, ""])));
    setError("");
    setNotice("");
  }

  function openEditForm(row: DatabaseRow) {
    setEditingRow(row);
    setFormData(
      Object.fromEntries(
        fields.map((field) => [
          field.name,
          field.kind === "password" ? "" : formValue(row[field.name], field.kind),
        ]),
      ),
    );
    setError("");
    setNotice("");
  }

  function rowKey(row: DatabaseRow) {
    return Object.fromEntries(
      primaryFields.map((field) => [field.name, formValue(row[field.name], field.kind)]),
    );
  }

  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/beranda/admin/kelola-database/", {
        method: editingRow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: selectedTable,
          data: Object.fromEntries(
            fields
              .filter((field) => !editingRow || !field.primary)
              .map((field) => [field.name, formData[field.name] ?? ""]),
          ),
          ...(editingRow ? { key: rowKey(editingRow) } : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Perubahan data gagal disimpan.");
        return;
      }

      setEditingRow(null);
      setFormData({});
      setNotice(editingRow ? "Data berhasil diperbarui." : "Data berhasil ditambahkan.");
      await loadRows();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Perubahan data gagal disimpan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRow(row: DatabaseRow) {
    const identifier = primaryFields
      .map((field) => `${field.label}: ${rowValue(row[field.name])}`)
      .join(", ");
    if (!window.confirm(`Hapus data ${identifier}? Penghapusan hanya bisa dilakukan jika tidak ada data terkait.`)) {
      return;
    }

    setError("");
    setNotice("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/beranda/admin/kelola-database/", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: selectedTable, key: rowKey(row) }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Data gagal dihapus.");
        return;
      }
      setNotice("Data berhasil dihapus.");
      await loadRows();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Data gagal dihapus.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-label="Pengelolaan tabel database" className="database-panel">
      <div className="database-toolbar">
        <label className="database-table-select">
          Pilih tabel
          <select
            onChange={(event) => changeTable(event.target.value)}
            value={selectedTable}
          >
            {adminDatabaseTables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.label}
              </option>
            ))}
          </select>
        </label>
        <label className="database-search">
          <Image
            alt=""
            aria-hidden="true"
            height={18}
            src="/images/approval-search.svg"
            width={18}
          />
          <input
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Cari di halaman ini"
            type="search"
            value={search}
          />
        </label>
        <button
          className="database-add-button"
          disabled={isLoading || isSaving}
          onClick={openCreateForm}
          type="button"
        >
          + Tambah Data
        </button>
      </div>

      <p className="database-table-description">
        Tabel <strong>{currentTable.label}</strong> · {total.toLocaleString("id-ID")} data
        · Maksimal 100 data per halaman. Kolom password tidak pernah ditampilkan.
      </p>
      {error ? (
        <p className="proposal-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="database-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="database-table-viewport">
        <table className="database-table">
          <thead>
            <tr>
              {visibleFields.map((field) => (
                <th
                  aria-sort={
                    sortField === field.name
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  key={field.name}
                  scope="col"
                >
                  <button
                    onClick={() => toggleSort(field.name)}
                    type="button"
                  >
                    {field.label}
                    <span
                      aria-hidden="true"
                      className={
                        sortField === field.name && sortDirection === "desc"
                          ? "database-sort-icon is-descending"
                          : "database-sort-icon"
                      }
                    >
                      <Image
                        alt=""
                        height={8}
                        src="/images/approval-sort.svg"
                        width={8}
                      />
                    </span>
                  </button>
                </th>
              ))}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="proposal-empty-cell" colSpan={visibleFields.length + 1}>
                  Memuat data...
                </td>
              </tr>
            ) : filteredRows.length ? (
              filteredRows.map((row) => (
                <tr
                  key={primaryFields
                    .map((field) => rowValue(row[field.name]))
                    .join(":")}
                >
                  {visibleFields.map((field) => (
                    <td key={field.name}>{rowValue(row[field.name])}</td>
                  ))}
                  <td className="database-row-actions">
                    <button
                      disabled={isSaving}
                      onClick={() => openEditForm(row)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="database-delete-button"
                      disabled={isSaving}
                      onClick={() => void deleteRow(row)}
                      type="button"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="proposal-empty-cell" colSpan={visibleFields.length + 1}>
                  {search ? "Data tidak ditemukan pada halaman ini." : "Tabel ini belum memiliki data."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="database-pagination">
        <span>
          Halaman {page + 1} dari {pageCount}
          {search ? ` · ${filteredRows.length} hasil pada halaman ini` : ""}
        </span>
        <div>
          <button
            disabled={page === 0 || isLoading}
            onClick={() => changePage(Math.max(0, page - 1))}
            type="button"
          >
            Sebelumnya
          </button>
          <button
            disabled={page + 1 >= pageCount || isLoading}
            onClick={() => changePage(page + 1)}
            type="button"
          >
            Berikutnya
          </button>
        </div>
      </footer>

      {formData && Object.keys(formData).length > 0 ? (
        <div
          className="database-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              setFormData({});
              setEditingRow(null);
            }
          }}
        >
          <form
            aria-labelledby="database-dialog-title"
            className="database-dialog"
            onSubmit={(event) => void saveRow(event)}
            role="dialog"
          >
            <header>
              <div>
                <span>{currentTable.label}</span>
                <h2 id="database-dialog-title">
                  {editingRow ? "Edit Data" : "Tambah Data"}
                </h2>
              </div>
              <button
                aria-label="Tutup form"
                disabled={isSaving}
                onClick={() => {
                  setFormData({});
                  setEditingRow(null);
                }}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="database-form-fields">
              {fields.map((field) => (
                <label key={field.name}>
                  <span>{field.label}{!field.nullable && !field.primary ? " *" : ""}</span>
                  {field.options ? (
                    <select
                      disabled={isSaving || (Boolean(editingRow) && Boolean(field.primary))}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                      required={!field.nullable && !(field.primary && Boolean(editingRow))}
                      value={formData[field.name] ?? ""}
                    >
                      <option value="">Pilih {field.label.toLocaleLowerCase("id")}</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      autoComplete={field.kind === "password" ? "new-password" : "off"}
                      disabled={isSaving || (Boolean(editingRow) && Boolean(field.primary))}
                      maxLength={255}
                      minLength={field.kind === "password" ? 8 : undefined}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                      required={
                        !field.nullable &&
                        !(field.primary && Boolean(editingRow)) &&
                        !(field.kind === "password" && Boolean(editingRow))
                      }
                      step={field.kind === "decimal" ? "any" : undefined}
                      type={
                        field.kind === "date" || field.kind === "time"
                          ? field.kind
                          : field.kind === "integer" || field.kind === "decimal"
                            ? "number"
                            : field.kind === "password"
                              ? "password"
                              : "text"
                      }
                      value={formData[field.name] ?? ""}
                    />
                  )}
                </label>
              ))}
            </div>
            {error ? (
              <p className="proposal-error" role="alert">
                {error}
              </p>
            ) : null}
            <footer>
              <button
                className="database-cancel-button"
                disabled={isSaving}
                onClick={() => {
                  setFormData({});
                  setEditingRow(null);
                }}
                type="button"
              >
                Batal
              </button>
              <button className="database-save-button" disabled={isSaving} type="submit">
                {isSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}
