import type { Metadata } from "next";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <head>
        {/* เพิ่มบรรทัดนี้ลงไปเพื่อบังคับให้เบราว์เซอร์อ่าน Tailwind ทันที */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-[#0d1017]">
        {children}
      </body>
    </html>
  )
}