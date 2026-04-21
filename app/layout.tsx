import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/src/trpc/client";
import { Toaster } from "sonner";
import { AdaptiveHeader } from "./_components/adaptive-header";
import { Footer } from "./_components/footer";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cl-headline",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cl-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Civilization Lab",
  description: "Stakeholder policy consultation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${newsreader.variable} ${inter.variable} h-full antialiased`}
      >
        <head>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          />
        </head>
        <body className="min-h-full flex flex-col">
          <TRPCReactProvider>
            <AdaptiveHeader />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            <Footer />
            <Toaster />
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
