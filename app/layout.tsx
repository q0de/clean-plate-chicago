import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });
const manrope = Manrope({ 
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "700", "800"]
});

export const metadata: Metadata = {
  title: "CleanPlate Chicago - Restaurant Health Inspection Scores",
  description: "Find restaurant health inspection scores and violation history for Chicago restaurants. Search by neighborhood, view on map, and make informed dining decisions.",
  openGraph: {
    title: "CleanPlate Chicago - Restaurant Health Inspection Scores",
    description: "Find restaurant health inspection scores and violation history for Chicago restaurants.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.className} ${manrope.variable} bg-background text-foreground`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

