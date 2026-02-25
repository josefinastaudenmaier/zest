import type { Metadata, Viewport } from "next";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ToastProvider } from "@/components/ToastContext";
import { Header } from "@/components/Header";
import { LockScrollOnHome } from "@/components/LockScrollOnHome";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "zest club - encontrá tu próximo spot",
  description: "Asistente de recomendaciones de restaurantes en Buenos Aires",
  icons: {
    icon: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${lora.variable} ${manrope.variable}`}>
      <body className="min-h-screen antialiased bg-[var(--background)] font-manrope text-[var(--foreground)]">
        <LockScrollOnHome />
        <Providers>
          <ToastProvider>
            <Header />
            <main className="px-4 pb-12">{children}</main>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
