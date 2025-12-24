"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { DisplayModeProvider } from "@/lib/display-mode-context";
import { StatusBadgeProvider } from "@/lib/status-badge-context";
import { CardDesignProvider } from "@/lib/card-design-context";
import { ColorThemeProvider } from "@/lib/color-theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <ColorThemeProvider>
        <DisplayModeProvider>
          <StatusBadgeProvider>
            <CardDesignProvider>
              {children}
            </CardDesignProvider>
          </StatusBadgeProvider>
        </DisplayModeProvider>
      </ColorThemeProvider>
    </HeroUIProvider>
  );
}
