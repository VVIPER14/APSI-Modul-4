import { NextResponse } from "next/server";
import {
  createSessionToken,
  dashboardPathForRole,
  isUserRole,
  SESSION_COOKIE_NAME,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { hashPassword, verifyPassword } from "@/app/lib/password";

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

  let authStep = "database lookup";

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

    if (!user) {
      return NextResponse.json(
        { error: "Username atau password salah. Silakan coba lagi." },
        { status: 401 },
      );
    }

    authStep = "password verification";
    const verification = await verifyPassword(
      credentials.password,
      user.password,
    );

    if (!verification.valid) {
      return NextResponse.json(
        { error: "Username atau password salah. Silakan coba lagi." },
        { status: 401 },
      );
    }

    if (verification.needsRehash) {
      authStep = "legacy password migration";
      const migration = await prisma.pengguna.updateMany({
        where: {
          id_pengguna: user.id_pengguna,
          password: user.password,
        },
        data: { password: await hashPassword(credentials.password) },
      });

      if (migration.count === 0) {
        const latestUser = await prisma.pengguna.findUnique({
          where: { id_pengguna: user.id_pengguna },
          select: { password: true },
        });

        if (
          !latestUser ||
          !(await verifyPassword(credentials.password, latestUser.password))
            .valid
        ) {
          return NextResponse.json(
            { error: "Username atau password salah. Silakan coba lagi." },
            { status: 401 },
          );
        }
      }
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

    authStep = "session creation";
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
    console.error(`Login failed during ${authStep}.`, error);

    if (error instanceof Error && error.message.startsWith("AUTH_SECRET")) {
      return NextResponse.json(
        {
          error:
            "Konfigurasi login Vercel belum lengkap. Pastikan AUTH_SECRET diatur dengan nilai minimal 32 karakter.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Layanan login sedang bermasalah. Coba lagi nanti." },
      { status: 503 },
    );
  }
}
