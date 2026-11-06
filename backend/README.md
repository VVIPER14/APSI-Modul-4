This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Login and role dashboards

The login screen checks `Pengguna.username` and `Pengguna.password` in
PostgreSQL, then routes the account to a dashboard based on `Pengguna.role`.
Dashboard access is restricted by an HTTP-only session cookie.

Configure `DATABASE_URL` and `AUTH_SECRET` in `.env` before running the app.
`AUTH_SECRET` must be a random value of at least 32 characters; production
requires it explicitly. In development only, `DATABASE_URL` is used as a
fallback signing key when `AUTH_SECRET` is not set.

`database.sql` seeds example accounts with literal sample passwords (for
example, username `anak_admin123` has password `hash_02`). A matching legacy
plain-text password is accepted once and immediately replaced in the database
with a scrypt hash in the format `scrypt$<salt>$<64-byte-hex-hash>`. Change
these sample credentials before using the app with real users.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
