import { BRAND } from "@/lib/brand";

interface AppFooterProps {
  className?: string;
}

export function AppFooter({ className = "" }: AppFooterProps) {
  return (
    <footer className={`py-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm ${className}`}>
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-1 text-sm text-slate-500 dark:text-slate-400 text-center">
        <p>© 2025 {BRAND.footer.left}</p>
        <p>{BRAND.footer.right}</p>
      </div>
    </footer>
  );
}
