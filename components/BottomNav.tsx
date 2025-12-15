"use client";

import { usePathname, useRouter } from "next/navigation";
import { Search, Map, Bookmark, Info, Home } from "lucide-react";

const navItems = [
  { key: "home", label: "Home", icon: Home, href: "/" },
  { key: "search", label: "Search", icon: Search, href: "/search" },
  { key: "map", label: "Map", icon: Map, href: "/map" },
  { key: "saved", label: "Saved", icon: Bookmark, href: "/saved" },
  { key: "about", label: "About", icon: Info, href: "/about" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const getActiveKey = () => {
    if (pathname === "/") return "home";
    const item = navItems.find((item) => item.href !== "/" && pathname.startsWith(item.href));
    return item?.key || "home";
  };

  const activeKey = getActiveKey();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="max-w-lg mx-auto grid grid-cols-5 text-center py-2 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors ${
                isActive 
                  ? "bg-emerald-50" 
                  : "hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
              <span className={`text-xs font-medium ${isActive ? "text-emerald-600" : "text-gray-500"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
