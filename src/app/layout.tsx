import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EyesWide - Connect Creators & Brands for PR Packages",
  description:
    "EyesWide connects creators with brands for PR package collaborations. Brands discover creators, send offers, and manage campaigns — all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
