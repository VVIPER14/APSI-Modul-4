import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "apotek_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type UserRole =
  | "Owner"
  | "Admin"
  | "Karyawan Gudang"
  | "Karyawan Kasir";

export type Session = {
  userId: string;
  name: string;
  username: string;
  role: UserRole;
  expiresAt: number;
};

export const dashboardByRole: Record<UserRole, string> = {
  Owner: "/beranda/owner",
  Admin: "/beranda/admin",
  "Karyawan Gudang": "/beranda/karyawan-gudang",
  "Karyawan Kasir": "/beranda/karyawan-kasir",
};

export function isUserRole(role: string): role is UserRole {
  return Object.hasOwn(dashboardByRole, role);
}

export function dashboardPathForRole(role: string) {
  return isUserRole(role) ? dashboardByRole[role] : null;
}

function getSigningSecret() {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : process.env.DATABASE_URL);

  if (!secret) {
    throw new Error("AUTH_SECRET must be configured before signing sessions.");
  }

  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }

  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(
  user: Omit<Session, "expiresAt">,
  now = Date.now(),
) {
  const session: Session = {
    ...user,
    expiresAt: Math.floor(now / 1000) + SESSION_DURATION_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string, now = Date.now()) {
  const [payload, signature, extra] = token.split(".");

  if (!payload || !signature || extra) {
    return null;
  }

  const expectedSignature = sign(payload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Session;

    if (
      typeof session.userId !== "string" ||
      typeof session.name !== "string" ||
      typeof session.username !== "string" ||
      !dashboardPathForRole(session.role) ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Math.floor(now / 1000)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return token ? verifySessionToken(token) : null;
}
