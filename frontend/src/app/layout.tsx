import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { AstryxProvider } from "@/components/providers/AstryxProvider";
import { Toaster } from "@/components/ui/Toaster";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "AgriTech Portal — Smart Farm Management",
  description: "Precision agriculture with real-time climate, sensor, and crop intelligence",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* app/layout.tsx is the global App Router root layout; eslint-disable-next-line targets Pages Router _document */}
        {/* eslint-disable @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..700,50,0;1,9..144,400..600,50,0&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Plus+Jakarta+Sans:ital,wght@0,400..700;1,400..700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600&family=Noto+Serif+Gurmukhi:wght@400;500;600&family=Noto+Sans+Gurmukhi:wght@400;500;600&family=Noto+Serif+Telugu:wght@400;500;600&family=Noto+Sans+Telugu:wght@400;500;600&family=Noto+Serif+Tamil:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;500;600&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Kannada:wght@400;500;600&family=Noto+Sans+Kannada:wght@400;500;600&family=Noto+Serif+Bengali:wght@400;500;600&family=Noto+Sans+Bengali:wght@400;500;600&family=Noto+Serif+Gujarati:wght@400;500;600&family=Noto+Sans+Gujarati:wght@400;500;600&family=Noto+Serif+Odia:wght@400;500;600&family=Noto+Sans+Odia:wght@400;500;600&family=Noto+Serif+Malayalam:wght@400;500;600&family=Noto+Sans+Malayalam:wght@400;500;600&display=swap"
        />
        {/* eslint-enable @next/next/no-page-custom-font */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("agritech-theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.dataset.theme="dark";}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <QueryProvider>
          <AuthProvider>
            <LanguageProvider>
              <ThemeProvider>
                <MotionProvider>
                  <AstryxProvider>
                    {children}
                    <Toaster />
                    <ServiceWorkerRegistrar />
                  </AstryxProvider>
                </MotionProvider>
              </ThemeProvider>
            </LanguageProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
