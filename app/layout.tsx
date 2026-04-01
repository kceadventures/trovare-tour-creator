import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const telegraf = localFont({
  src: [
    { path: "../public/fonts/PPTelegraf-Regular.woff2", weight: "400" },
    { path: "../public/fonts/PPTelegraf-Bold.woff2", weight: "700" },
  ],
  variable: "--font-telegraf",
  display: "swap",
});

const radioGrotesk = localFont({
  src: [
    { path: "../public/fonts/PPRadioGrotesk-Regular.woff2", weight: "400" },
    { path: "../public/fonts/PPRadioGrotesk-Bold.woff2", weight: "700" },
  ],
  variable: "--font-radio-grotesk",
  display: "swap",
});

const airMono = localFont({
  src: [
    { path: "../public/fonts/PPAir-MediumMono.woff2", weight: "500" },
  ],
  variable: "--font-air-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trovare Tour Creator",
  description: "Create self-guided tours for Go Trovare",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${telegraf.variable} ${radioGrotesk.variable} ${airMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
