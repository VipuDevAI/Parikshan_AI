import { cn } from "@/lib/utils";
import logoImage from "../assets/logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
};

export function Logo({ size = "md", className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden",
          "shadow-[0_4px_14px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.08)]",
          "ring-2 ring-white/50 dark:ring-white/20",
          "transition-transform hover:scale-105",
          sizeClasses[size]
        )}
      >
        <img
          src={logoImage}
          alt="Prashnakosh Logo"
          className="w-full h-full object-cover"
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              "font-bold bg-gradient-to-r from-primary via-emerald-500 to-teal-500 bg-clip-text text-transparent",
              textSizeClasses[size]
            )}
          >
            Prashnakosh
          </span>
          <span className="text-xs text-muted-foreground">Question Bank</span>
        </div>
      )}
    </div>
  );
}

export function LogoMark({ size = "md", className }: Omit<LogoProps, "showText">) {
  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden",
        "shadow-[0_4px_14px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.08)]",
        "ring-2 ring-white/50 dark:ring-white/20",
        "transition-transform hover:scale-105",
        sizeClasses[size],
        className
      )}
    >
      <img
        src={logoImage}
        alt="Prashnakosh Logo"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
