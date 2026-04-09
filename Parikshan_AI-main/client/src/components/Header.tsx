import { Bell, Search, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 text-muted-foreground hover:bg-muted rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative hidden sm:block w-64 lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-muted/40 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm placeholder:text-muted-foreground/70"
            placeholder="Search students, classes, or staff..."
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-background"></span>
        </button>
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium leading-none">Academic Year</p>
          <p className="text-xs text-muted-foreground mt-1">2024 - 2025</p>
        </div>
      </div>
    </header>
  );
}
