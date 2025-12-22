"use client";

import { useEffect, useRef } from 'react';

interface NoiseTextureProps {
  opacity?: number;
  contrast?: number;
  brightness?: number;
  speed?: number;
  className?: string;
}

export const NoiseTexture = ({ 
  opacity = 0.5, 
  contrast = 2.5, 
  brightness = 1.5,
  speed = 50,
  className = '' 
}: NoiseTextureProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = 0;
    const frameInterval = 1000 / speed; // Control animation speed

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    const generateNoise = (timestamp: number) => {
      if (timestamp - lastTime < frameInterval) {
        animationId = requestAnimationFrame(generateNoise);
        return;
      }
      lastTime = timestamp;

      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 255;
        // Apply contrast and brightness
        let adjusted = ((noise - 128) * contrast + 128) * brightness;
        adjusted = Math.max(0, Math.min(255, adjusted));
        
        data[i] = adjusted;     // R
        data[i + 1] = adjusted; // G
        data[i + 2] = adjusted; // B
        data[i + 3] = 255;      // A
      }

      ctx.putImageData(imageData, 0, 0);
      animationId = requestAnimationFrame(generateNoise);
    };

    resize();
    window.addEventListener('resize', resize);
    animationId = requestAnimationFrame(generateNoise);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [contrast, brightness, speed]);

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full mix-blend-overlay"
        style={{ opacity }}
      />
    </div>
  );
};

