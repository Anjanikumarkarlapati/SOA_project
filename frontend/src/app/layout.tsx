import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { AstryxProvider } from "@/components/providers/AstryxProvider";
import { Toaster } from "@/components/ui/Toaster";
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
