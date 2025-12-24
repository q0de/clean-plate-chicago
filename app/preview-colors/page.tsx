import { ColorThemePreview } from "@/components/ColorThemePreview";

export default function PreviewColorsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold text-center mb-8">
          Choose Your Color Theme
        </h1>
        <ColorThemePreview />
        <p className="text-center text-gray-500 mt-6 text-sm">
          Pick a theme you like and let me know which one to apply!
        </p>
      </div>
    </div>
  );
}

