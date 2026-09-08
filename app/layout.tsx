import type { Metadata } from "next"; 
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ConfigureAmplify from "@/components/ConfigureAmplify";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "AttestGO — AI Compliance Infrastructure for Onchain Finance",
    template: "%s | AttestGO — Powered by Attestcoin",
  },
  description:
    "AI makes compliance simple — AttestGO is the AI compliance infrastructure for onchain finance: GO Pass, compliant RWA, DeFi & AI inbox via Attestcoin Protocol.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-51VBWDT3P2"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-51VBWDT3P2');
          `}
        </Script>
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} bg-canvas text-white font-body antialiased`}
      >
        <ConfigureAmplify>{children}</ConfigureAmplify>
      </body>
    </html>
  );
}
