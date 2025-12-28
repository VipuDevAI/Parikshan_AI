import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionTileProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "success" | "danger" | "warning" | "info" | "secondary" | "purple" | "cyan" | "orange" | "pink" | "teal";
  size?: "default" | "lg";
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

const variantStyles = {
  primary: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700",
  success: "bg-green-500 hover:bg-green-600 text-white border-green-600",
  danger: "bg-red-500 hover:bg-red-600 text-white border-red-600",
  warning: "bg-amber-500 hover:bg-amber-600 text-white border-amber-600",
  info: "bg-blue-500 hover:bg-blue-600 text-white border-blue-600",
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 dark:border-gray-600",
  purple: "bg-purple-500 hover:bg-purple-600 text-white border-purple-600",
  cyan: "bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-600",
  orange: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600",
  pink: "bg-pink-500 hover:bg-pink-600 text-white border-pink-600",
  teal: "bg-teal-500 hover:bg-teal-600 text-white border-teal-600",
};

export function ActionTile({
  icon: Icon,
  label,
  onClick,
  variant = "primary",
  size = "default",
  disabled = false,
  className,
  "data-testid": testId,
}: ActionTileProps) {
  const sizeStyles = size === "lg" 
    ? "min-w-[140px] min-h-[100px] px-6 py-4" 
    : "min-w-[120px] min-h-[80px] px-4 py-3";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 font-semibold transition-all duration-200",
        "shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        sizeStyles,
        variantStyles[variant],
        className
      )}
    >
      <Icon className={cn("shrink-0", size === "lg" ? "w-8 h-8" : "w-6 h-6")} />
      <span className={cn("text-center leading-tight", size === "lg" ? "text-sm" : "text-xs")}>
        {label}
      </span>
    </button>
  );
}

export function ActionTileGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {children}
    </div>
  );
}
