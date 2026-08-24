import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЛесоУчёт OCR — Мобильное приложение распиловки и расчёта зарплаты",
  description: "Распознавание ведомостей пиломатериалов, кубатура ГОСТ 2708-75, расчёт выхода леса и зарплаты бригады без токенов.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ЛесоУчёт"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f59e0b"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full antialiased dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950 touch-manipulation">
        {children}
      </body>
    </html>
  );
}
