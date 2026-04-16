import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Claw Dashboard",
  description: "Trading bot analytics and risk management",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/trades", label: "Trades" },
  { href: "/analytics", label: "Analytics" },
  { href: "/risk", label: "Risk" },
  { href: "/signals", label: "Signals" },
  { href: "/ml", label: "ML" },
  { href: "/shadow", label: "Shadow" },
  { href: "/security", label: "Security" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
            <span className="text-lg font-bold text-emerald-400">Open Claw</span>
            {NAV.map((n) => (
              <a key={n.href} href={n.href}
                 className="text-sm text-gray-400 hover:text-white transition-colors">
                {n.label}
              </a>
            ))}
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
