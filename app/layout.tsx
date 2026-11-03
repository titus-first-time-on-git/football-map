import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harta Fotbalului Românesc",
  description: "Arbitri, delegări și informări CCA, organizate pe harta României.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body className="antialiased">{children}</body>
    </html>
  );
}
