import { BRAND } from "@/lib/brand";

interface AppLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

export function AppLogo({ size = "md", showText = true, className = "" }: AppLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img 
        src={BRAND.logo} 
        alt={BRAND.name}
        className={`${sizeClasses[size]} rounded-full object-cover shadow-lg ring-2 ring-white/50 dark:ring-slate-700/50`}
      />
      {showText && (
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{BRAND.name}</h1>
          {BRAND.tagline && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{BRAND.tagline}</p>
          )}
        </div>
      )}
    </div>
  );
}
