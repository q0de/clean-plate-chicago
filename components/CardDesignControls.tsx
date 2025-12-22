"use client";

import { useCardDesign } from "@/lib/card-design-context";
import { useState } from "react";
import { Settings, X, Save, Check } from "lucide-react";

export function CardDesignControls() {
  const { config, updateConfig, resetConfig, saveConfig } = useCardDesign();
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-50 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Card Design Controls"
      >
        <Settings className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl w-96 max-h-[80vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-lg text-gray-900">Card Design Controls</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Card Dimensions */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Card Dimensions</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Card Width: {config.cardWidth}px
              </label>
              <input
                type="range"
                min="200"
                max="800"
                step="1"
                value={config.cardWidth}
                onChange={(e) => updateConfig({ cardWidth: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Icon Sizes */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Icon Sizes</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Status Icon: {config.statusIconSize}px
              </label>
              <input
                type="range"
                min="10"
                max="32"
                step="0.1"
                value={config.statusIconSize}
                onChange={(e) => updateConfig({ statusIconSize: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Violation Icon: {config.violationIconSize}px
              </label>
              <input
                type="range"
                min="10"
                max="32"
                step="1"
                value={config.violationIconSize}
                onChange={(e) => updateConfig({ violationIconSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Location Icon: {config.locationIconSize}px
              </label>
              <input
                type="range"
                min="10"
                max="32"
                step="1"
                value={config.locationIconSize}
                onChange={(e) => updateConfig({ locationIconSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Score Icon: {config.scoreIconSize}px
              </label>
              <input
                type="range"
                min="24"
                max="96"
                step="1"
                value={config.scoreIconSize}
                onChange={(e) => updateConfig({ scoreIconSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Typography Sizes */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Typography Sizes</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Status Text: {config.statusTextSize}px
              </label>
              <input
                type="range"
                min="10"
                max="20"
                step="1"
                value={config.statusTextSize}
                onChange={(e) => updateConfig({ statusTextSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Restaurant Name: {config.restaurantNameSize}px
              </label>
              <input
                type="range"
                min="14"
                max="32"
                step="1"
                value={config.restaurantNameSize}
                onChange={(e) => updateConfig({ restaurantNameSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Address Text: {config.addressTextSize}px
              </label>
              <input
                type="range"
                min="10"
                max="18"
                step="1"
                value={config.addressTextSize}
                onChange={(e) => updateConfig({ addressTextSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Violation Text: {config.violationTextSize}px
              </label>
              <input
                type="range"
                min="10"
                max="16"
                step="1"
                value={config.violationTextSize}
                onChange={(e) => updateConfig({ violationTextSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Date Text: {config.dateTextSize}px
              </label>
              <input
                type="range"
                min="10"
                max="16"
                step="1"
                value={config.dateTextSize}
                onChange={(e) => updateConfig({ dateTextSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Score Text: {config.scoreTextSize}px
              </label>
              <input
                type="range"
                min="10"
                max="20"
                step="1"
                value={config.scoreTextSize}
                onChange={(e) => updateConfig({ scoreTextSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Section Heights */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Section Heights</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Status Banner: {config.statusBannerHeight}px
              </label>
              <input
                type="range"
                min="30"
                max="80"
                step="1"
                value={config.statusBannerHeight}
                onChange={(e) => updateConfig({ statusBannerHeight: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Image Section: {config.imageSectionHeight}px
              </label>
              <input
                type="range"
                min="100"
                max="400"
                step="1"
                value={config.imageSectionHeight}
                onChange={(e) => updateConfig({ imageSectionHeight: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Content Padding: {config.contentPadding}px
              </label>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={config.contentPadding}
                onChange={(e) => updateConfig({ contentPadding: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Badge Styling */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Badge Styling</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Badge Border Thickness: {config.badgeBorderThickness}px
              </label>
              <input
                type="range"
                min="0"
                max="4"
                step="0.5"
                value={config.badgeBorderThickness}
                onChange={(e) => updateConfig({ badgeBorderThickness: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Badge Border Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.badgeBorderColor}
                  onChange={(e) => updateConfig({ badgeBorderColor: e.target.value })}
                  className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={config.badgeBorderColor}
                  onChange={(e) => updateConfig({ badgeBorderColor: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="#15803D"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logo Font */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Logo Font</h4>
          <div className="space-y-2">
            {[
              { value: "default", label: "Default (System)" },
              { value: "Guttery", label: "Guttery (Handwritten)" },
              { value: "Parslay", label: "Parslay" },
              { value: "Violetta", label: "Violetta (Script)" },
              { value: "Welly", label: "Welly (Food)" },
            ].map((font) => (
              <button
                key={font.value}
                onClick={() => updateConfig({ logoFont: font.value })}
                className={`w-full px-3 py-2 text-left rounded-lg border transition-colors ${
                  config.logoFont === font.value
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{ fontFamily: font.value === "default" ? "inherit" : font.value }}
              >
                <span className="text-sm">{font.label}</span>
              </button>
            ))}
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">
                Logo Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.logoColor}
                  onChange={(e) => updateConfig({ logoColor: e.target.value })}
                  className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={config.logoColor}
                  onChange={(e) => updateConfig({ logoColor: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="#047857"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">
                Text Size: {config.logoSize}px
              </label>
              <input
                type="range"
                min="16"
                max="48"
                step="1"
                value={config.logoSize}
                onChange={(e) => updateConfig({ logoSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">
                Logo Size: {config.logoIconSize}px
              </label>
              <input
                type="range"
                min="24"
                max="120"
                step="2"
                value={config.logoIconSize}
                onChange={(e) => updateConfig({ logoIconSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Header Padding: {config.headerPadding}px
              </label>
              <input
                type="range"
                min="4"
                max="32"
                step="1"
                value={config.headerPadding}
                onChange={(e) => updateConfig({ headerPadding: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Hero Noise Effect */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Hero Noise Effect</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600">
                Enable Noise
              </label>
              <button
                onClick={() => updateConfig({ heroNoiseEnabled: !config.heroNoiseEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  config.heroNoiseEnabled ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    config.heroNoiseEnabled ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            {config.heroNoiseEnabled && (
              <>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Noise Opacity: {config.heroNoiseOpacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={config.heroNoiseOpacity}
                    onChange={(e) => updateConfig({ heroNoiseOpacity: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Animation Speed: {config.heroNoiseSpeed}s (lower = faster)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={config.heroNoiseSpeed}
                    onChange={(e) => updateConfig({ heroNoiseSpeed: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Watermark Opacity: {Math.round((config.heroWatermarkOpacity || 0.12) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.02"
                value={config.heroWatermarkOpacity || 0.12}
                onChange={(e) => updateConfig({ heroWatermarkOpacity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Watermark Size: {config.heroWatermarkSize || 400}px
              </label>
              <input
                type="range"
                min="200"
                max="800"
                step="20"
                value={config.heroWatermarkSize || 400}
                onChange={(e) => updateConfig({ heroWatermarkSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Chips Section */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Category Chips</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Chip Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.chipsBgColor}
                  onChange={(e) => updateConfig({ chipsBgColor: e.target.value })}
                  className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={config.chipsBgColor}
                  onChange={(e) => updateConfig({ chipsBgColor: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="#F6F8F6"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Section Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.chipsSectionBgColor === "transparent" ? "#F6F8F6" : config.chipsSectionBgColor}
                  onChange={(e) => updateConfig({ chipsSectionBgColor: e.target.value })}
                  className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={config.chipsSectionBgColor}
                  onChange={(e) => updateConfig({ chipsSectionBgColor: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  placeholder="transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => {
              try {
                saveConfig();
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              } catch (error) {
                console.error("Failed to save:", error);
              }
            }}
            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
          <button
            onClick={resetConfig}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

