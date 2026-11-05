import { scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  dashboardPathForRole,
  isUserRole,
  SESSION_COOKIE_NAME,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

async function verifyPassword(
  providedPassword: string,
  storedPassword: string,
) {
  const [algorithm, salt, hash] = storedPassword.split("$");

  if (algorithm === "scrypt" && salt && hash && /^[\da-f]{128}$/i.test(hash)) {
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      scrypt(providedPassword, salt, 64, (error, key) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(key);
      });
    });
    const expectedHash = Buffer.from(hash, "hex");

    return (
      derivedKey.length === expectedHash.length &&
      timingSafeEqual(derivedKey, expectedHash)
    );
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const provided = Buffer.from(providedPassword);
  const stored = Buffer.from(storedPassword);

  return (
    provided.length === stored.length && timingSafeEqual(provided, stored)
  );
}

export async function POST(request: Request) {
  let credentials: unknown;

  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Permintaan login tidak valid." },
      { status: 400 },
    );
  }

  if (
    typeof credentials !== "object" ||
    credentials === null ||
    !("username" in credentials) ||
    !("password" in credentials) ||
    typeof credentials.username !== "string" ||
    typeof credentials.password !== "string" ||
    !credentials.username.trim() ||
    !credentials.password
  ) {
    return NextResponse.json(
      { error: "Username dan password wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.pengguna.findFirst({
      where: { username: credentials.username.trim() },
      select: {
        id_pengguna: true,
        nama_pengguna: true,
        username: true,
        password: true,
        role: true,
      },
    });

    if (!user || !(await verifyPassword(credentials.password, user.password))) {
      return NextResponse.json(
        { error: "Username atau password salah. Silakan coba lagi." },
        { status: 401 },
      );
    }

    if (!isUserRole(user.role)) {
      return NextResponse.json(
        { error: "Role akun belum memiliki halaman beranda." },
        { status: 403 },
      );
    }

    const redirectTo = dashboardPathForRole(user.role);

    if (!redirectTo) {
      return NextResponse.json(
        { error: "Role akun belum memiliki halaman beranda." },
        { status: 403 },
      );
    }

    const token = createSessionToken({
      userId: user.id_pengguna,
      name: user.nama_pengguna,
      username: user.username,
      role: user.role,
    });
    const response = NextResponse.json({ redirectTo });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 60 * 60 * 8,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Unable to authenticate against the user database.", error);

    return NextResponse.json(
      { error: "Layanan login sedang bermasalah. Coba lagi nanti." },
      { status: 503 },
    );
  }
}
