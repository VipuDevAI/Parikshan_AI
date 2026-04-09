import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type CoinColor = "gold" | "blue" | "green" | "red" | "orange" | "indigo" | "teal" | "pink" | "purple" | "slate" | "gradient";
type CoinShape = "pill" | "rounded" | "square" | "circle";
type CoinSize = "sm" | "md" | "lg";

interface CoinButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: CoinColor;
  shape?: CoinShape;
  size?: CoinSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  variant?: "solid" | "outline" | "ghost";
}

const colorClasses: Record<CoinColor, { solid: string; outline: string; ghost: string }> = {
  gold: {
    solid: "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40",
    outline: "border-2 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30",
    ghost: "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30",
  },
  blue: {
    solid: "bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40",
    outline: "border-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30",
    ghost: "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30",
  },
  green: {
    solid: "bg-gradient-to-br from-emerald-500 via-green-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40",
    outline: "border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
    ghost: "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
  },
  red: {
    solid: "bg-gradient-to-br from-red-500 via-rose-600 to-red-700 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40",
    outline: "border-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
    ghost: "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
  },
  orange: {
    solid: "bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40",
    outline: "border-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30",
    ghost: "text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30",
  },
  indigo: {
    solid: "bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
    outline: "border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
    ghost: "text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
  },
  teal: {
    solid: "bg-gradient-to-br from-teal-400 via-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40",
    outline: "border-2 border-teal-500 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30",
    ghost: "text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30",
  },
  pink: {
    solid: "bg-gradient-to-br from-pink-400 via-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40",
    outline: "border-2 border-pink-500 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30",
    ghost: "text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30",
  },
  purple: {
    solid: "bg-gradient-to-br from-purple-500 via-violet-600 to-purple-700 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40",
    outline: "border-2 border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30",
    ghost: "text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30",
  },
  slate: {
    solid: "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/25 hover:shadow-slate-500/40",
    outline: "border-2 border-slate-400 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/30",
    ghost: "text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/30",
  },
  gradient: {
    solid: "bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40",
    outline: "border-2 border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30",
    ghost: "text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30",
  },
};

const shapeClasses: Record<CoinShape, string> = {
  pill: "rounded-full",
  rounded: "rounded-xl",
  square: "rounded-lg",
  circle: "rounded-full aspect-square",
};

const sizeClasses: Record<CoinSize, { base: string; icon: string; circle: string }> = {
  sm: { base: "px-4 py-2 text-sm gap-1.5", icon: "w-4 h-4", circle: "w-9 h-9" },
  md: { base: "px-5 py-2.5 text-sm gap-2", icon: "w-5 h-5", circle: "w-11 h-11" },
  lg: { base: "px-6 py-3 text-base gap-2.5", icon: "w-5 h-5", circle: "w-12 h-12" },
};

export const CoinButton = forwardRef<HTMLButtonElement, CoinButtonProps>(
  ({ 
    className, 
    color = "blue", 
    shape = "rounded", 
    size = "md",
    variant = "solid",
    isLoading, 
    icon, 
    children, 
    disabled, 
    ...props 
  }, ref) => {
    const isCircle = shape === "circle";
    
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-200",
          "transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:translate-y-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary",
          colorClasses[color][variant],
          shapeClasses[shape],
          isCircle ? sizeClasses[size].circle : sizeClasses[size].base,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={cn("animate-spin", sizeClasses[size].icon)} />
        ) : icon ? (
          <span className={cn("flex items-center justify-center", sizeClasses[size].icon)}>{icon}</span>
        ) : null}
        {!isCircle && children}
      </button>
    );
  }
);

CoinButton.displayName = "CoinButton";

export const IconButton = forwardRef<HTMLButtonElement, Omit<CoinButtonProps, "shape" | "children">>(
  ({ className, size = "md", ...props }, ref) => {
    return (
      <CoinButton
        ref={ref}
        shape="circle"
        size={size}
        className={className}
        {...props}
      />
    );
  }
);

IconButton.displayName = "IconButton";
