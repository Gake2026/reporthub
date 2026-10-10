import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReportHub",
  description: "White-label client reporting dashboard for marketing agencies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
