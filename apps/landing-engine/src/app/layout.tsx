import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BAX-OS",
    template: "%s · BAX-OS",
  },
  description:
    "Meta-fábrica horizontal para convertir señal de negocio en infraestructura digital operable: Spec → Preview → Deploy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen bg-zinc-950 text-zinc-100"
      >
        {children}
      </body>
    </html>
  );
}
