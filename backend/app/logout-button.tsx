"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);

  async function handleLogout() {
    setHasError(false);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        setHasError(true);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setHasError(true);
    }
  }

  return (
    <div className="dashboard-logout">
      <button onClick={handleLogout} type="button">
        Keluar
      </button>
      {hasError && (
        <p role="alert">Tidak dapat keluar. Silakan coba lagi.</p>
      )}
    </div>
  );
}
