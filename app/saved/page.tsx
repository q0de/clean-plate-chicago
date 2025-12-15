import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { Bookmark } from "lucide-react";

export default function SavedPage() {
  return (
    <div className="min-h-screen pb-20">
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Saved Restaurants</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <EmptyState
          type="no-results"
          onAction={() => {}}
        />
        <p className="text-center text-default-500 mt-4">
          This feature is coming soon. You&apos;ll be able to save your favorite restaurants for quick access.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}

