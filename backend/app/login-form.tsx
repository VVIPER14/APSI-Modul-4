"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result: { redirectTo?: string; error?: string } =
        await response.json();

      if (!response.ok || !result.redirectTo) {
        setErrorMessage(result.error ?? "Login gagal. Periksa kembali data Anda.");
        return;
      }

      router.replace(result.redirectTo);
      router.refresh();
    } catch {
      setErrorMessage("Tidak dapat terhubung ke server. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-labelledby="login-title"
      className="login-card"
      onSubmit={handleSubmit}
    >
      <h2 id="login-title">Login</h2>
      {errorMessage && (
        <p className="login-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="login-field login-field-user">
        <Image
          alt=""
          aria-hidden="true"
          className="field-icon user-icon"
          height={49}
          src="/images/user-icon.png"
          width={49}
        />
        <input
          aria-label="Nama pengguna"
          autoComplete="username"
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
      </div>

      <div className="login-field login-field-password">
        <Image
          alt=""
          aria-hidden="true"
          className="field-icon password-icon"
          height={36}
          src="/images/password-icon.png"
          width={36}
        />
        <input
          aria-label="Kata sandi"
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type={showPassword ? "text" : "password"}
          value={password}
        />
        <button
          aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          aria-pressed={showPassword}
          className="visibility-toggle"
          onClick={() => setShowPassword((visible) => !visible)}
          type="button"
        >
          <Image
            alt=""
            height={25}
            src="/images/password-visibility.png"
            width={32}
          />
        </button>
      </div>

      <button
        aria-label="Login"
        className="login-button"
        disabled={isSubmitting}
        type="submit"
      >
        <Image
          alt=""
          aria-hidden="true"
          className="login-button-art"
          height={45}
          src="/images/login-button.svg"
          width={254}
        />
        <span>{isSubmitting ? "Memproses..." : "Login"}</span>
      </button>
    </form>
  );
}
