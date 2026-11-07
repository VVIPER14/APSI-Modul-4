import Image from "next/image";
import LoginForm from "./login-form";

export default function Home() {
  return (
    <main className="login-screen">
      <Image
        alt=""
        className="login-background login-background-new"
        fill
        priority
        sizes="100vw"
        src="/images/login-background-new.png"
      />

      <Image
        alt="Logo Apotek Media Medika"
        className="pharmacy-mark pharmacy-mark-new"
        height={215}
        priority
        src="/images/login-logo-new.png"
        width={218}
      />

      <header className="brand brand-new">
        <h1>APOTEK</h1>
        <p>Media Medika</p>
      </header>

      <LoginForm />
    </main>
  );
}
