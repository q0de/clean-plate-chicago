"use client";

interface ScoreDisplayProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { width: 48, fontSize: 16, strokeWidth: 4 },
  md: { width: 80, fontSize: 28, strokeWidth: 6 },
  lg: { width: 160, fontSize: 48, strokeWidth: 10 },
};

function getScoreColor(score: number): string {
  if (score >= 90) return "#14b8a6"; // teal-500 (exceptional green-blue)
  if (score >= 80) return "#10b981"; // emerald-500
  if (score >= 60) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

export function ScoreDisplay({ score, size = "md" }: ScoreDisplayProps) {
  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);
  
  return (
    <div className="flex flex-col items-center cursor-help" title="CleanPlate Score">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg
          width={config.width}
          height={config.width}
          viewBox={`0 0 ${config.width} ${config.width}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        
        {/* Score number */}
        <div 
          className="absolute inset-0 flex items-center justify-center font-bold"
          style={{ 
            fontSize: config.fontSize,
            color,
          }}
        >
          {score}
        </div>
      </div>
    </div>
  );
}
