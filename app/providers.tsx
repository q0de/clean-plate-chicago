"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { DisplayModeProvider } from "@/lib/display-mode-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <DisplayModeProvider>
        {children}
      </DisplayModeProvider>
    </HeroUIProvider>
  );
}
