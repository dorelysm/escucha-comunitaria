import type { Metadata } from "next"
import { Libre_Franklin } from "next/font/google"
import Link from "next/link"
import "./globals.css"

const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-libre-franklin",
})

export const metadata: Metadata = {
  title: "Escucha Comunitaria — Cartagena",
  description: "Herramienta de escucha comunitaria para la validación de propuestas ciudadanas",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${libreFranklin.variable} h-full`}>
      <body className="min-h-full flex flex-col" style={{ background: "var(--dc-bg)", color: "var(--dc-ink)", fontFamily: "'Libre Franklin', sans-serif" }}>
        <header style={{ borderBottom: "1px solid var(--dc-border)", padding: "12px 32px", display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: 15, color: "var(--dc-ink)", textDecoration: "none" }}>
            Escucha Comunitaria
          </Link>
          <nav style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/validar" style={{ fontSize: 15, color: "var(--dc-muted)", textDecoration: "none" }}>Validar propuesta</Link>
            <Link href="/explorar" style={{ fontSize: 15, color: "var(--dc-muted)", textDecoration: "none" }}>Explorar temas</Link>
            <Link href="/corpus" style={{ fontSize: 15, color: "var(--dc-muted)", textDecoration: "none" }}>Ver corpus</Link>
            <Link href="/chat" style={{ fontSize: 15, color: "var(--dc-muted)", textDecoration: "none" }}>Consultar</Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer style={{ borderTop: "1px solid var(--dc-border)", padding: "10px 32px", fontSize: 13, color: "var(--dc-muted)" }}>
          CTW Hackathon Cartagena 2026 — Los testimonios se muestran solo con consentimiento explícito
        </footer>
      </body>
    </html>
  )
}
