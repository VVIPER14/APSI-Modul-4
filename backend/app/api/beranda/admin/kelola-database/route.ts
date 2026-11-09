import { getCurrentSession } from "@/app/lib/auth";
import {
  getAdminDatabaseTable,
  sqlTypeForField,
  type AdminDatabaseField,
  type AdminDatabaseTable,
} from "@/app/lib/admin-database";
import { hashPassword } from "@/app/lib/password";
import { prisma } from "@/app/lib/prisma";

const pageSize = 100;

class AdminInputError extends Error {}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function castForField(field: AdminDatabaseField, placeholder: string) {
  return `${placeholder}::${sqlTypeForField(field)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldInputValue(
  field: AdminDatabaseField,
  value: unknown,
): string | number | null {
  if (value === null || value === "") {
    return field.nullable ? null : null;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new AdminInputError(`Nilai ${field.label} tidak valid.`);
  }

  const text = String(value).trim();

  if (!text) {
    return field.nullable ? null : null;
  }

  if (field.options && !field.options.includes(text)) {
    throw new AdminInputError(`${field.label} tidak valid.`);
  }

  if (field.kind === "integer") {
    const number = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number > 2147483647) {
      throw new AdminInputError(`${field.label} harus berupa bilangan bulat nonnegatif yang valid.`);
    }
    return number;
  }

  if (field.kind === "decimal") {
    if (!/^\d{1,19}$/.test(text)) {
      throw new AdminInputError(`${field.label} harus berupa angka nonnegatif yang valid.`);
    }
    return text;
  }

  if (field.kind === "date") {
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
      throw new AdminInputError(`${field.label} harus berupa tanggal yang valid.`);
    }
    return text;
  }

  if (field.kind === "time") {
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?$/.test(text)) {
      throw new AdminInputError(`${field.label} harus berupa waktu yang valid.`);
    }
    return text;
  }

  if (text.length > 255) {
    throw new AdminInputError(`${field.label} maksimal 255 karakter.`);
  }

  return text;
}

async function getAdminSession() {
  const session = await getCurrentSession();

  if (!session) {
    return {
      response: Response.json({ error: "Sesi login tidak valid." }, { status: 401 }),
      session: null,
    };
  }

  if (session.role !== "Admin") {
    return {
      response: Response.json({ error: "Hanya admin yang dapat mengelola database." }, { status: 403 }),
      session: null,
    };
  }

  return { response: null, session };
}

function parseData(
  table: AdminDatabaseTable,
  input: unknown,
  mode: "create" | "update",
) {
  if (!isRecord(input)) {
    throw new AdminInputError("Format data tidak valid.");
  }

  const allowedFields = new Set(
    table.fields
      .filter((field) => !field.primary || mode === "create")
      .map((field) => field.name),
  );
  if (Object.keys(input).some((key) => !table.fields.some((field) => allowedFields.has(field.name) && field.name === key))) {
    throw new AdminInputError("Data memuat kolom yang tidak diizinkan.");
  }

  const values: { field: AdminDatabaseField; value: string | number | null }[] = [];

  for (const field of table.fields) {
    if (mode === "update" && field.primary) {
      continue;
    }

    if (!Object.hasOwn(input, field.name)) {
      if (mode === "create" && !field.nullable) {
        throw new AdminInputError(`${field.label} wajib diisi.`);
      }
      continue;
    }

    if (field.kind === "password") {
      const password = input[field.name];
      if (typeof password !== "string") {
        throw new AdminInputError("Password tidak valid.");
      }
      if (!password && mode === "update") {
        continue;
      }
      if (password.length < 8 || password.length > 255) {
        throw new AdminInputError("Password harus berisi 8 sampai 255 karakter.");
      }
      values.push({ field, value: password });
      continue;
    }

    const value = fieldInputValue(field, input[field.name]);
    if (value === null && !field.nullable) {
      throw new AdminInputError(`${field.label} wajib diisi.`);
    }
    values.push({ field, value });
  }

  if (mode === "update" && values.length === 0) {
    throw new AdminInputError("Tidak ada perubahan untuk disimpan.");
  }

  return values;
}

function parseKey(table: AdminDatabaseTable, input: unknown) {
  if (!isRecord(input)) {
    throw new AdminInputError("Kunci data tidak valid.");
  }

  const primaryFields = table.fields.filter((field) => field.primary);
  if (
    Object.keys(input).length !== primaryFields.length ||
    primaryFields.some((field) => !Object.hasOwn(input, field.name))
  ) {
    throw new AdminInputError("Kunci utama data tidak lengkap.");
  }

  return primaryFields.map((field) => ({
    field,
    value: (() => {
      const value = fieldInputValue(field, input[field.name]);
      if (value === null) {
        throw new AdminInputError(`${field.label} wajib diisi.`);
      }
      return value;
    })(),
  }));
}

function getTableFromRequest(request: Request) {
  const url = new URL(request.url);
  const table = getAdminDatabaseTable(url.searchParams.get("table"));

  return { table, url };
}

export async function GET(request: Request) {
  const authorization = await getAdminSession();
  if (authorization.response) {
    return authorization.response;
  }

  const { table, url } = getTableFromRequest(request);
  if (!table) {
    return Response.json({ error: "Tabel tidak ditemukan." }, { status: 404 });
  }

  const visibleFields = table.fields.filter((field) => field.kind !== "password");
  const sortName = url.searchParams.get("sort");
  const sortField =
    table.fields.find((field) => field.name === sortName && field.kind !== "password") ??
    table.fields.find((field) => field.primary);
  const direction = url.searchParams.get("direction") === "desc" ? "DESC" : "ASC";
  const requestedPage = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isSafeInteger(requestedPage)
    ? Math.max(0, Math.min(requestedPage, 100000))
    : 0;
  const columns = visibleFields.map((field) => quoteIdentifier(field.name)).join(", ");
  const orderFields = [
    `${quoteIdentifier(sortField?.name ?? visibleFields[0].name)} ${direction}`,
    ...table.fields
      .filter((field) => field.primary && field.name !== sortField?.name)
      .map((field) => `${quoteIdentifier(field.name)} ASC`),
  ].join(", ");

  try {
    const [rows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT ${columns} FROM "public".${quoteIdentifier(table.name)} ORDER BY ${orderFields} LIMIT $1 OFFSET $2`,
        pageSize,
        page * pageSize,
      ),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) AS count FROM "public".${quoteIdentifier(table.name)}`,
      ),
    ]);

    return Response.json({
      table: { name: table.name, label: table.label },
      fields: table.fields,
      rows,
      page,
      pageSize,
      total: Number(countResult[0]?.count ?? 0),
    });
  } catch (error) {
    console.error(`Failed to load admin table ${table.name}.`, error);
    return Response.json({ error: "Data tabel gagal dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await getAdminSession();
  if (authorization.response) {
    return authorization.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const table = isRecord(body) ? getAdminDatabaseTable(String(body.table ?? "")) : null;
  if (!table) {
    return Response.json({ error: "Tabel tidak ditemukan." }, { status: 404 });
  }

  try {
    const values = parseData(table, isRecord(body) ? body.data : null, "create");
    const preparedValues = await Promise.all(
      values.map(async ({ field, value }) => ({
        field,
        value:
          field.kind === "password" && typeof value === "string"
            ? await hashPassword(value)
            : value,
      })),
    );
    const columns = preparedValues.map(({ field }) => quoteIdentifier(field.name)).join(", ");
    const placeholders = preparedValues
      .map(({ field }, index) => castForField(field, `$${index + 1}`))
      .join(", ");
    const result = await prisma.$executeRawUnsafe(
      `INSERT INTO "public".${quoteIdentifier(table.name)} (${columns}) VALUES (${placeholders})`,
      ...preparedValues.map(({ value }) => value),
    );

    return Response.json({ created: result === 1 }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error(`Failed to create row in ${table.name}.`, error);
    return Response.json({ error: "Data gagal ditambahkan. Periksa ID dan relasi data." }, { status: 409 });
  }
}

export async function PUT(request: Request) {
  const authorization = await getAdminSession();
  if (authorization.response) {
    return authorization.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const table = isRecord(body) ? getAdminDatabaseTable(String(body.table ?? "")) : null;
  if (!table) {
    return Response.json({ error: "Tabel tidak ditemukan." }, { status: 404 });
  }

  try {
    const key = parseKey(table, isRecord(body) ? body.key : null);
    const values = parseData(table, isRecord(body) ? body.data : null, "update");
    const updatedRole = values.find(({ field }) => field.name === "role");
    if (
      table.name === "pengguna" &&
      key.some(
        ({ field, value }) =>
          field.name === "id_pengguna" &&
          value === authorization.session?.userId,
      ) &&
      updatedRole?.value !== undefined &&
      updatedRole.value !== "Admin"
    ) {
      return Response.json(
        { error: "Admin tidak dapat mengubah role akun yang sedang digunakan." },
        { status: 409 },
      );
    }

    const preparedValues = await Promise.all(
      values.map(async ({ field, value }) => ({
        field,
        value:
          field.kind === "password" && typeof value === "string"
            ? await hashPassword(value)
            : value,
      })),
    );
    const sets = preparedValues
      .map(({ field }, index) =>
        `${quoteIdentifier(field.name)} = ${castForField(field, `$${index + 1}`)}`,
      )
      .join(", ");
    const where = key
      .map(
        ({ field }, index) =>
          `${quoteIdentifier(field.name)} = ${castForField(field, `$${preparedValues.length + index + 1}`)}`,
      )
      .join(" AND ");
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "public".${quoteIdentifier(table.name)} SET ${sets} WHERE ${where}`,
      ...preparedValues.map(({ value }) => value),
      ...key.map(({ value }) => value),
    );

    if (updated === 0) {
      return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
    }

    return Response.json({ updated: true });
  } catch (error) {
    if (error instanceof AdminInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error(`Failed to update row in ${table.name}.`, error);
    return Response.json({ error: "Data gagal diperbarui. Periksa nilai dan relasi data." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const authorization = await getAdminSession();
  if (authorization.response) {
    return authorization.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const table = isRecord(body) ? getAdminDatabaseTable(String(body.table ?? "")) : null;
  if (!table) {
    return Response.json({ error: "Tabel tidak ditemukan." }, { status: 404 });
  }

  try {
    const key = parseKey(table, isRecord(body) ? body.key : null);

    if (
      table.name === "pengguna" &&
      key.some(
        ({ field, value }) =>
          field.name === "id_pengguna" &&
          value === authorization.session?.userId,
      )
    ) {
      return Response.json(
        { error: "Admin tidak dapat menghapus akun yang sedang digunakan." },
        { status: 409 },
      );
    }

    const deleted = await prisma.$transaction(async (transaction) => {
      const where = key
        .map(
          ({ field }, index) =>
            `${quoteIdentifier(field.name)} = ${castForField(field, `$${index + 1}`)}`,
        )
        .join(" AND ");
      const locked = await transaction.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT ${key.map(({ field }) => quoteIdentifier(field.name)).join(", ")} FROM "public".${quoteIdentifier(table.name)} WHERE ${where} FOR UPDATE`,
        ...key.map(({ value }) => value),
      );
      if (locked.length === 0) {
        return { missing: true };
      }

      for (const reference of table.references ?? []) {
        const childTable = getAdminDatabaseTable(reference.childTable);
        const parentKey = key.find(
          ({ field }) => field.name === reference.parentField,
        );
        const childField = childTable?.fields.find(
          (field) => field.name === reference.childField,
        );
        if (!childTable || !parentKey || !childField) {
          continue;
        }

        const [referenceResult] = await transaction.$queryRawUnsafe<
          { exists: boolean }[]
        >(
          `SELECT EXISTS (SELECT 1 FROM "public".${quoteIdentifier(childTable.name)} WHERE ${quoteIdentifier(childField.name)} = $1::${sqlTypeForField(childField)}) AS exists`,
          parentKey.value,
        );
        if (referenceResult?.exists) {
          return { restricted: true };
        }
      }

      const removed = await transaction.$executeRawUnsafe(
        `DELETE FROM "public".${quoteIdentifier(table.name)} WHERE ${where}`,
        ...key.map(({ value }) => value),
      );
      return { removed };
    });

    if ("missing" in deleted) {
      return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
    }
    if ("restricted" in deleted) {
      return Response.json(
        { error: "Data tidak dapat dihapus karena masih digunakan oleh data terkait." },
        { status: 409 },
      );
    }

    if (deleted.removed === 0) {
      return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
    }

    return Response.json({ deleted: true });
  } catch (error) {
    console.error(`Failed to delete row from ${table.name}.`, error);
    return Response.json(
      { error: "Data gagal dihapus. Pastikan data tidak memiliki relasi yang masih digunakan." },
      { status: 409 },
    );
  }
}
