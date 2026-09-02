import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

export const metadata: Metadata = {
  title: "Constellation — Chart Your Career in the Stars",
  description:
    "An AI-powered career guide that turns your skills and interests into an interactive night sky of career paths.",
};

export const viewport: Viewport = {
  themeColor: "#070514",
};

// Applies the saved theme before first paint to avoid a flash of the default theme.
const themeInitScript = `
try {
  var t = localStorage.getItem("constellation:theme");
  if (t === "nebula" || t === "solar" || t === "aurora") {
    document.documentElement.dataset.theme = t;
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="nebula" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${grotesk.variable} font-sans antialiased`}
      >
        {children}
        <footer className="fixed bottom-2 right-4 text-xs text-white/40 z-50 pointer-events-none select-none">
          Made by Hassan Sultan
        </footer>
      </body>
    </html>
  );
}
