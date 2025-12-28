import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Bell, 
  Settings, 
  LogOut,
  GraduationCap,
  ClipboardList,
  CalendarOff,
  RefreshCw,
  FileSpreadsheet,
  ScanFace,
  Camera,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  const baseLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/timetable", label: "Timetable", icon: Calendar },
    { href: "/timetable-management", label: "Timetable Setup", icon: FileSpreadsheet },
    { href: "/attendance", label: "Attendance", icon: ClipboardList },
    { href: "/students", label: "Students", icon: GraduationCap },
    { href: "/staff", label: "Staff", icon: Users },
    { href: "/cameras", label: "Cameras", icon: Camera },
    { href: "/face-registration", label: "Face Registration", icon: ScanFace },
    { href: "/alerts", label: "AI Insights", icon: Bell },
    { href: "/leave", label: "Leave Requests", icon: CalendarOff },
    { href: "/substitutions", label: "Substitutions", icon: RefreshCw },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  // Add school onboarding for SUPER_ADMIN only
  const adminLinks = user?.role === "SUPER_ADMIN" 
    ? [{ href: "/school-onboarding", label: "School Onboarding", icon: Building2 }]
    : [];

  const links = [...baseLinks, ...adminLinks];

  const filteredLinks = user?.role === "PARENT" 
    ? links.filter(l => ["/", "/attendance", "/timetable"].includes(l.href))
    : user?.role === "TEACHER"
    ? links.filter(l => ["/", "/timetable", "/attendance", "/leave", "/substitutions"].includes(l.href))
    : links;

  return (
    <div className="w-64 h-screen bg-sidebar flex flex-col fixed left-0 top-0 z-20 shadow-xl hidden md:flex border-r border-sidebar-border">
      {/* Logo Section */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="relative">
          <img 
            src="/logo.png" 
            alt="Parikshan.AI" 
            className="w-12 h-12 rounded-xl object-cover shadow-lg ring-2 ring-white/20"
          />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-sidebar animate-pulse" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-none text-white tracking-tight">
            Parikshan<span className="text-orange-400">.AI</span>
          </h1>
          <p className="text-[10px] text-sidebar-muted mt-0.5 uppercase tracking-wider">Smart Vision Platform</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar" data-testid="sidebar-nav">
        {filteredLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          
          return (
            <Link key={link.href} href={link.href}>
              <div 
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                  isActive 
                    ? "bg-primary text-white" 
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                data-testid={`nav-link-${link.href.replace('/', '') || 'home'}`}
              >
                <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
                {link.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="bg-sidebar-accent rounded-xl p-4 flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
            {user?.fullName?.charAt(0) || "U"}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-semibold truncate text-sidebar-foreground">{user?.fullName}</p>
            <p className="text-xs text-sidebar-muted truncate capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
