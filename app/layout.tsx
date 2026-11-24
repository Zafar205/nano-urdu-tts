import type { Metadata } from "next";
import { Geist, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const urdu = Noto_Nastaliq_Urdu({ variable: "--font-urdu", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "Nano Urdu TTS",
  description:
    "A tiny Urdu text-to-speech model (443,402 parameters, about 500 KB) that runs entirely in your browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${urdu.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
