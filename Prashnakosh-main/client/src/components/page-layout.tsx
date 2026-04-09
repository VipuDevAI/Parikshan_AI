import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "./logo";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className={cn("min-h-screen corporate-gradient flex flex-col", className)}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
  showLogo?: boolean;
}

export function PageHeader({ children, className, showLogo = false }: PageHeaderProps) {
  return (
    <header className={cn(
      "bg-white/90 dark:bg-slate-900/95 backdrop-blur-md",
      "text-slate-800 dark:text-slate-100",
      "border-b border-slate-200/60 dark:border-slate-700/60",
      "shadow-[0_2px_16px_rgba(0,0,0,0.04),0_4px_24px_rgba(0,0,0,0.02)]",
      "dark:shadow-[0_2px_16px_rgba(0,0,0,0.2)]",
      className
    )}>
      {showLogo && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <LogoMark size="sm" />
        </div>
      )}
      {children}
    </header>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <main className={cn("p-4 sm:p-6 lg:p-8 flex-1 overflow-x-hidden", className)}>
      {children}
    </main>
  );
}

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  variant?: "default" | "elevated" | "glass";
}

export function ContentCard({ 
  children, 
  className, 
  title, 
  description, 
  actions,
  variant = "default" 
}: ContentCardProps) {
  const variantClasses = {
    default: cn(
      "bg-white dark:bg-slate-800/90",
      "rounded-2xl p-5 sm:p-6",
      "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08),0_8px_32px_-8px_rgba(0,0,0,0.04)]",
      "dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]",
      "border border-slate-100 dark:border-slate-700/50",
    ),
    elevated: cn(
      "bg-white dark:bg-slate-800",
      "rounded-2xl p-5 sm:p-6",
      "shadow-[0_8px_30px_-4px_rgba(0,0,0,0.12),0_16px_48px_-8px_rgba(0,0,0,0.06)]",
      "dark:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.4)]",
      "border border-slate-100/80 dark:border-slate-700/60",
    ),
    glass: cn(
      "bg-white/80 dark:bg-slate-800/60 backdrop-blur-lg",
      "rounded-2xl p-5 sm:p-6",
      "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]",
      "dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.2)]",
      "border border-white/40 dark:border-slate-700/40",
    ),
  };

  return (
    <div className={cn(
      variantClasses[variant],
      "text-slate-700 dark:text-slate-200",
      "overflow-x-auto transition-shadow duration-300",
      "hover:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.4)]",
      className
    )}>
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

interface GridContainerProps {
  children: ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
}

export function GridContainer({ children, className, cols = 3 }: GridContainerProps) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-5 sm:gap-6", colClasses[cols], className)}>
      {children}
    </div>
  );
}

export function PageFooter() {
  return (
    <footer className={cn(
      "py-4 px-4 sm:px-6 text-sm",
      "text-slate-500 dark:text-slate-400",
      "border-t border-slate-200/60 dark:border-slate-700/60",
      "bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm mt-auto"
    )}>
      <div className="flex flex-col items-center gap-1 max-w-7xl mx-auto text-center">
        <span>© 2025 All rights reserved</span>
        <span>
          Powered by{" "}
          <span className="font-semibold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
            SmartGenEduX
          </span>
          {" "}@2025
        </span>
      </div>
    </footer>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  color?: "blue" | "green" | "purple" | "orange" | "pink" | "teal";
}

export function StatCard({ title, value, icon, trend, color = "blue" }: StatCardProps) {
  const colorClasses = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200/60 dark:border-blue-800/40",
    green: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 dark:border-emerald-800/40",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-200/60 dark:border-purple-800/40",
    orange: "from-orange-500/10 to-orange-600/5 border-orange-200/60 dark:border-orange-800/40",
    pink: "from-pink-500/10 to-pink-600/5 border-pink-200/60 dark:border-pink-800/40",
    teal: "from-teal-500/10 to-teal-600/5 border-teal-200/60 dark:border-teal-800/40",
  };

  const iconColorClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-emerald-600 dark:text-emerald-400",
    purple: "text-purple-600 dark:text-purple-400",
    orange: "text-orange-600 dark:text-orange-400",
    pink: "text-pink-600 dark:text-pink-400",
    teal: "text-teal-600 dark:text-teal-400",
  };

  return (
    <div className={cn(
      "bg-gradient-to-br",
      colorClasses[color],
      "rounded-2xl p-5 border",
      "shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)]",
      "transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs mt-2 font-medium",
              trend.value >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            "p-3 rounded-xl bg-white/60 dark:bg-slate-800/60",
            "shadow-sm",
            iconColorClasses[color]
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
