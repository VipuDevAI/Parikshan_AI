import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100 dark:from-slate-800 dark:to-slate-700 border-amber-200 dark:border-slate-600 hover:from-amber-200 hover:to-orange-200 dark:hover:from-slate-700 dark:hover:to-slate-600"
          data-testid="theme-toggle"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-600" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className={`flex items-center gap-2 cursor-pointer ${theme === "light" ? "bg-amber-50 dark:bg-slate-800" : ""}`}
        >
          <Sun className="h-4 w-4 text-amber-500" />
          <span>Light</span>
          {theme === "light" && <span className="ml-auto text-amber-500">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-2 cursor-pointer ${theme === "dark" ? "bg-slate-100 dark:bg-slate-800" : ""}`}
        >
          <Moon className="h-4 w-4 text-blue-500" />
          <span>Dark</span>
          {theme === "dark" && <span className="ml-auto text-blue-500">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className={`flex items-center gap-2 cursor-pointer ${theme === "system" ? "bg-slate-100 dark:bg-slate-800" : ""}`}
        >
          <Monitor className="h-4 w-4 text-slate-500" />
          <span>System</span>
          {theme === "system" && <span className="ml-auto text-slate-500">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
