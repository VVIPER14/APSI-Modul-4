export const proposalStatuses = {
  draft: 0,
  processing: 1,
  approved: 2,
  rejected: 3,
} as const;

export type ProposalStatus =
  (typeof proposalStatuses)[keyof typeof proposalStatuses];

export function proposalStatusLabel(status: number | null) {
  switch (status) {
    case proposalStatuses.draft:
      return "Belum Diajukan";
    case proposalStatuses.processing:
      return "Sedang Diproses";
    case proposalStatuses.approved:
      return "Disetujui";
    case proposalStatuses.rejected:
      return "Ditolak";
    default:
      return "Status belum ditentukan";
  }
}

export function getJakartaDatabaseDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") =>
    parts.find((value) => value.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;

  return {
    date,
    databaseDate: new Date(`${date}T00:00:00.000Z`),
  };
}
