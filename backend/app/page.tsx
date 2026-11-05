import Image from "next/image";
import LoginForm from "./login-form";

export default function Home() {
  return (
    <main className="login-screen">
      <Image
        alt=""
        className="login-background"
        fill
        priority
        sizes="100vw"
        src="/images/role-background.png"
      />

      <Image
        alt=""
        aria-hidden="true"
        className="cloud cloud-bottom"
        height={1187}
        priority
        src="/images/cloud.png"
        width={1187}
      />
      <Image
        alt=""
        aria-hidden="true"
        className="cloud cloud-top"
        height={1078}
        priority
        src="/images/cloud.png"
        width={1078}
      />

      <div aria-hidden="true" className="top-lines">
        <Image alt="" height={4} src="/images/top-line.svg" width={704} />
        <Image alt="" height={4} src="/images/top-line.svg" width={704} />
      </div>

      <Image
        alt="Logo Apotek Media Medika"
        className="pharmacy-mark"
        height={215}
        priority
        src="/images/pharmacy-mark.png"
        width={218}
      />

      <header className="brand">
        <h1>APOTEK</h1>
        <p>Media Medika</p>
      </header>

      <LoginForm />
    </main>
  );
}
