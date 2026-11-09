"use client";

import { useMemo, useState } from "react";
import type { DailyFinancialPoint } from "@/app/lib/reports";

type Period = "hari" | "minggu" | "bulan";
type ChartPoint = {
  key: string;
  label: string;
  amount: bigint;
  transactions: number;
};

const periodLabels: Record<Period, string> = {
  hari: "Per Hari",
  minggu: "Per Minggu",
  bulan: "Per Bulan",
};

const rupiahFormatter = new Intl.NumberFormat("id-ID");

function getWeekStart(date: Date) {
  const monday = new Date(date);
  const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return monday.toISOString().slice(0, 10);
}

function getPeriodKey(date: string, period: Period) {
  if (period === "hari") {
    return date;
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return period === "minggu"
    ? getWeekStart(parsedDate)
    : date.slice(0, 7);
}

function formatLabel(key: string, period: Period) {
  const date = new Date(
    `${period === "bulan" ? `${key}-01` : key}T00:00:00.000Z`,
  );
  return new Intl.DateTimeFormat("id-ID", {
    day: period === "bulan" ? undefined : "2-digit",
    month: "short",
    weekday: period === "hari" ? "long" : undefined,
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function FinancialReportChart({
  data,
  selectedDate,
  selectedTotal,
  selectedTransactions,
}: {
  data: DailyFinancialPoint[];
  selectedDate: string;
  selectedTotal: string;
  selectedTransactions: number;
}) {
  const [period, setPeriod] = useState<Period>("hari");
  const chartData = useMemo(() => {
    const grouped = new Map<string, { amount: bigint; transactions: number }>();
    for (const item of data) {
      const key = getPeriodKey(item.tanggal_laporan, period);
      const current = grouped.get(key) ?? {
        amount: BigInt(0),
        transactions: 0,
      };
      current.amount += BigInt(item.total_pemasukan);
      current.transactions += item.jumlah_transaksi;
      grouped.set(key, current);
    }

    const limit = period === "hari" ? 14 : 12;
    return [...grouped.entries()]
      .slice(-limit)
      .map(([key, value]): ChartPoint => ({
        key,
        label: formatLabel(key, period),
        ...value,
      }));
  }, [data, period]);
  const highestAmount = chartData.reduce(
    (highest, point) => (point.amount > highest ? point.amount : highest),
    BigInt(0),
  );

  return (
    <>
      <section aria-label="Ringkasan pemasukan" className="report-summary">
        <div>
          <span>Pemasukan {selectedDate}</span>
          <strong>Rp{rupiahFormatter.format(BigInt(selectedTotal))}</strong>
          <small>{selectedTransactions} transaksi selesai</small>
        </div>
      </section>

      <section aria-labelledby="financial-chart-title" className="report-panel">
        <header className="report-panel-heading">
          <div>
            <h2 id="financial-chart-title">Grafik Pemasukan</h2>
            <p>Total penjualan transaksi selesai; bukan laba bersih.</p>
          </div>
          <div aria-label="Periode grafik" className="report-period-switch">
            {(Object.keys(periodLabels) as Period[]).map((value) => (
              <button
                aria-pressed={period === value}
                key={value}
                onClick={() => setPeriod(value)}
                type="button"
              >
                {periodLabels[value]}
              </button>
            ))}
          </div>
        </header>
        {chartData.length ? (
          <ol
            aria-label={`Grafik pemasukan ${periodLabels[period].toLowerCase()}`}
            className="financial-chart"
          >
            {chartData.map((point) => {
              const width =
                highestAmount > BigInt(0)
                  ? Math.max(
                      3,
                      Number((point.amount * BigInt(100)) / highestAmount),
                    )
                  : 0;
              return (
                <li key={point.key}>
                  <div className="financial-chart-value">
                    <span>{point.label}</span>
                    <strong>Rp{rupiahFormatter.format(point.amount)}</strong>
                  </div>
                  <span
                    aria-hidden="true"
                    className="financial-chart-bar"
                    style={{ width: `${width}%` }}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="report-empty">Belum ada data pemasukan.</p>
        )}
      </section>

      <section aria-label="Riwayat pemasukan harian" className="report-panel">
        <h2>Riwayat Pemasukan Harian</h2>
        <div className="report-table-viewport">
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Tanggal</th>
                <th scope="col">Jumlah Transaksi</th>
                <th scope="col">Total Pemasukan</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((item) => (
                <tr key={item.tanggal_laporan}>
                  <td>{formatLabel(item.tanggal_laporan, "hari")}</td>
                  <td>{item.jumlah_transaksi}</td>
                  <td>
                    Rp{rupiahFormatter.format(BigInt(item.total_pemasukan))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
