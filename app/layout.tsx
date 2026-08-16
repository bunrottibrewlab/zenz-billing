import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZenZ — QR Ordering & Loyalty for Cafes",
  description:
    "Multi-tenant QR ordering, loyalty stamps, and analytics for cafes and restaurants.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply system dark/light class before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.matches) document.documentElement.classList.add('dark');
  mq.addEventListener('change', function(e){ document.documentElement.classList.toggle('dark', e.matches); });
})();
        ` }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
