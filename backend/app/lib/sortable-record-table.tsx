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
}: {
  columns: SortableRecordColumn[];
  rows: SortableRecord[];
  emptyMessage: string;
  className?: string;
  caption?: string;
  initialSortKey?: string;
  initialDirection?: "asc" | "desc";
}) {
  const [sortKey, setSortKey] = useState(initialSortKey ?? columns[0]?.key ?? "");
  const [direction, setDirection] = useState<"asc" | "desc">(initialDirection);
  const sortedRows = useMemo(() => {
    const sign = direction === "asc" ? 1 : -1;
    return [...rows].sort(
      (first, second) =>
        sign * compare(first[sortKey] ?? null, second[sortKey] ?? null),
    );
  }, [direction, rows, sortKey]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setDirection("asc");
  }

  return (
    <table className={className}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <thead>
        <tr>
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
        {sortedRows.length ? (
          sortedRows.map((row, index) => (
            <tr key={`${index}-${columns.map((column) => row[column.key] ?? "").join("-")}`}>
              {columns.map((column) => (
                <td key={column.key}>
                  {formatValue(row[column.key] ?? null, column.format)}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td className="report-empty" colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
