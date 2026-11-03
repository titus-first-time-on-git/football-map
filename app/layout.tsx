import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harta Fotbalului Românesc",
  description: "Hartă și căutare unificată pentru arbitri, meciuri și delegări din România.",
  icons: {
    icon: "/favicon.svg?v=2",
    shortcut: "/favicon.svg?v=2",
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
