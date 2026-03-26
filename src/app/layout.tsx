import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.opticanuevaimagen.com";

export const metadata: Metadata = {
  title: {
    default: "Óptica Nueva Imagen",
    template: "%s | Óptica Nueva Imagen",
  },
  description: "Sistema de gestión integral para clínicas ópticas — pacientes, exámenes, laboratorio y ventas.",
  metadataBase: new URL(APP_URL),
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    type: "website",
    locale: "es_SV",
    siteName: "Óptica Nueva Imagen",
    title: "Óptica Nueva Imagen",
    description: "Sistema de gestión integral para clínicas ópticas",
  },
  twitter: {
    card: "summary",
    title: "Óptica Nueva Imagen",
    description: "Sistema de gestión integral para clínicas ópticas",
  },
  icons: {
    icon: "/favicon.ico",
  },
  other: {
    "theme-color": "#2563eb",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
