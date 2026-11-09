"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type SortableRecord = Record<string, string | number | null>;

export type SortableRecordColumn = {
  key: string;
  label: string;
  format?: "date" | "time" | "currency";
  numeric?: boolean;
};

function compare(first: string | number | null, second: string | number | null) {
  if (first === null || first === undefined) {
    return second === null || second === undefined ? 0 : -1;
  }
  if (second === null || second === undefined) {
    return 1;
  }

  if (
    typeof first === "number" &&
    typeof second === "number"
  ) {
    return first - second;
  }

  const firstText = String(first);
  const secondText = String(second);
  if (/^-?\d+$/.test(firstText) && /^-?\d+$/.test(secondText)) {
    const firstInteger = BigInt(firstText);
    const secondInteger = BigInt(secondText);
    return firstInteger < secondInteger ? -1 : firstInteger > secondInteger ? 1 : 0;
  }

  return firstText.localeCompare(secondText, "id", {
    numeric: true,
    sensitivity: "base",
  });
}

function formatValue(value: string | number | null, format?: SortableRecordColumn["format"]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const text = String(value);
  if (format === "currency") {
    return `Rp${new Intl.NumberFormat("id-ID").format(BigInt(text))}`;
  }
  if (format === "date") {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(text));
  }
  if (format === "time") {
    return `${text.slice(0, 5)} WIB`;
  }

  return text;
}

export default function SortableRecordTable({
  columns,
  rows,
  emptyMessage,
  className = "report-table",
  caption,
  initialSortKey,
  initialDirection = "asc",
  printTitle,
}: {
  columns: SortableRecordColumn[];
  rows: SortableRecord[];
  emptyMessage: string;
  className?: string;
  caption?: string;
  initialSortKey?: string;
  initialDirection?: "asc" | "desc";
  printTitle?: string;
}) {
  const [sortKey, setSortKey] = useState(initialSortKey ?? columns[0]?.key ?? "");
  const [direction, setDirection] = useState<"asc" | "desc">(initialDirection);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [printRows, setPrintRows] = useState<SortableRecord[] | null>(null);
  const sortedRows = useMemo(() => {
    const sign = direction === "asc" ? 1 : -1;
    return [...rows].sort(
      (first, second) =>
        sign * compare(first[sortKey] ?? null, second[sortKey] ?? null),
    );
  }, [direction, rows, sortKey]);
  const selectable = Boolean(printTitle);
  const rowKey = (row: SortableRecord) =>
    columns.map((column) => String(row[column.key] ?? "")).join("\u0000");
  const visibleRows = printRows ?? sortedRows;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setDirection("asc");
  }

  function printRecords(records: SortableRecord[]) {
    setPrintRows(records);
    window.addEventListener(
      "afterprint",
      () => setPrintRows(null),
      { once: true },
    );
    window.requestAnimationFrame(() => window.print());
  }

  function toggleAllRows(checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const row of sortedRows) {
        const key = rowKey(row);
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }

  return (
    <div className={selectable ? "printable-document" : undefined}>
      {selectable ? (
        <>
          <h2 className="print-document-title">{printTitle}</h2>
          <div className="print-selection-toolbar">
            <label>
              <input
                checked={sortedRows.length > 0 && sortedRows.every((row) => selectedKeys.has(rowKey(row)))}
                onChange={(event) => toggleAllRows(event.target.checked)}
                type="checkbox"
              />
              Pilih semua ({sortedRows.length})
            </label>
            <button
              disabled={selectedKeys.size === 0}
              onClick={() =>
                printRecords(
                  sortedRows.filter((row) => selectedKeys.has(rowKey(row))),
                )
              }
              type="button"
            >
              Cetak / Simpan PDF ({selectedKeys.size})
            </button>
            <button onClick={() => printRecords(sortedRows)} type="button">
              Cetak semua
            </button>
          </div>
        </>
      ) : null}
      <table className={className}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {selectable ? (
              <th className="print-selection-column" scope="col">
                Pilih
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                aria-sort={
                  sortKey === column.key
                    ? direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                key={column.key}
                scope="col"
              >
                <button
                  className="report-sort-button"
                  onClick={() => toggleSort(column.key)}
                  type="button"
                >
                  {column.label}
                  <span
                    aria-hidden="true"
                    className={`report-sort-icon${sortKey === column.key && direction === "desc" ? " is-descending" : ""}`}
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
          </tr>
        </thead>
        <tbody>
          {visibleRows.length ? (
            visibleRows.map((row, index) => (
              <tr key={`${index}-${rowKey(row)}`}>
                {selectable ? (
                  <td className="print-selection-column">
                    <input
                      aria-label={`Pilih baris ${index + 1}`}
                      checked={selectedKeys.has(rowKey(row))}
                      onChange={(event) =>
                        setSelectedKeys((current) => {
                          const next = new Set(current);
                          if (event.target.checked) {
                            next.add(rowKey(row));
                          } else {
                            next.delete(rowKey(row));
                          }
                          return next;
                        })
                      }
                      type="checkbox"
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.key}>
                    {formatValue(row[column.key] ?? null, column.format)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="report-empty" colSpan={columns.length + (selectable ? 1 : 0)}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
