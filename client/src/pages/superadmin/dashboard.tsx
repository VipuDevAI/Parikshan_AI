import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";
import { 
  Building2, Users, GraduationCap, FileText, Settings, LogOut, 
  Bell, ChevronDown, TrendingUp, TrendingDown, LayoutDashboard,
  Library, BarChart3, HardDrive, BookOpen, Calendar, AlertCircle,
  CheckCircle2, Clock, School
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Sidebar Navigation Items
const sidebarItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, active: true },
  { id: "schools", label: "Schools", icon: Building2, href: "/superadmin/schools" },
  { id: "users", label: "Users", icon: Users, href: "/superadmin/users" },
  { id: "wings", label: "Wings & Exams", icon: GraduationCap },
  { id: "library", label: "Reference Library", icon: Library },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "settings", label: "Settings", icon: Settings },
];

// Stat Card Component
function StatCard({ title, value, icon: Icon, trend, trendValue, color }: {
  title: string;
  value: string | number;
  icon: any;
  trend?: "up" | "down";
  trendValue?: string;
  color: "cyan" | "purple" | "orange" | "blue";
}) {
  const colorClasses = {
    cyan: "stat-card-cyan",
    purple: "stat-card-purple",
    orange: "stat-card-orange",
    blue: "stat-card-blue",
  };

  const iconClasses = {
    cyan: "icon-cyan",
    purple: "icon-purple",
    orange: "icon-orange",
    blue: "icon-blue",
  };

  return (
    <div className={`stat-card-cosmic ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
              {trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className={iconClasses[color]}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// Management Card Component
function ManagementCard({ title, description, icon: Icon, onClick, color }: {
  title: string;
  description: string;
  icon: any;
  onClick: () => void;
  color: "cyan" | "purple" | "orange" | "blue";
}) {
  const iconClasses = {
    cyan: "icon-cyan",
    purple: "icon-purple",
    orange: "icon-orange",
    blue: "icon-blue",
  };

  return (
    <div className="management-card" onClick={onClick}>
      <div className={`${iconClasses[color]} w-fit mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

// Simple Donut Chart Component
function DonutChart({ percentage, label }: { percentage: number; label: string }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="10"
            fill="none"
            className="dark:stroke-white/10 stroke-gray-200"
          />
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke="url(#gradient)"
            strokeWidth="10"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00D4FF" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{percentage}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

// Notification Item Component
function NotificationItem({ icon: Icon, title, time, color }: {
  icon: any;
  title: string;
  time: string;
  color: "cyan" | "purple" | "orange" | "green";
}) {
  const iconClasses = {
    cyan: "icon-cyan",
    purple: "icon-purple",
    orange: "icon-orange",
    green: "icon-green",
  };

  return (
    <div className="notification-item">
      <div className={`${iconClasses[color]} p-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-white truncate">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{time}</p>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/superadmin/stats'],
    enabled: !!user,
  });

  if (!user || user.role !== "super_admin") {
    navigate("/");
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <div className="cosmic-dashboard-bg dark:cosmic-dashboard-bg light-dashboard-bg min-h-screen">
      {/* Header */}
      <header className="cosmic-header sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img 
              src={BRAND.loginLogo} 
              alt={BRAND.name}
              className="h-10 w-10 object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">PRASHNAKOSH</h1>
              <p className="text-xs text-gray-500 dark:text-cyan-400 tracking-wider">JIGNYASA</p>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300">
              <Bell className="w-5 h-5" />
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-200">{user.name}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="cosmic-sidebar w-64 min-h-[calc(100vh-57px)] p-4 hidden lg:block">
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <div
                key={item.id}
                className={`sidebar-item ${item.active ? 'active' : ''}`}
                onClick={() => item.href && navigate(item.href)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Page Title */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
            <p className="text-gray-500 dark:text-gray-400">Overview of your platform performance</p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Schools"
              value={stats?.schools || 2}
              icon={Building2}
              trend="up"
              trendValue="+12%"
              color="cyan"
            />
            <StatCard
              title="Total Teachers"
              value={stats?.teachers || 45}
              icon={Users}
              trend="up"
              trendValue="+8%"
              color="purple"
            />
            <StatCard
              title="Total Students"
              value={stats?.students || 1250}
              icon={GraduationCap}
              trend="up"
              trendValue="+15%"
              color="orange"
            />
            <StatCard
              title="Total Exams"
              value={stats?.exams || 89}
              icon={FileText}
              trend="up"
              trendValue="+5%"
              color="blue"
            />
          </div>

          {/* Management Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <ManagementCard
              title="Manage Schools"
              description="Add, edit, or remove schools from the platform"
              icon={Building2}
              onClick={() => navigate("/superadmin/schools")}
              color="cyan"
            />
            <ManagementCard
              title="Manage Users"
              description="Manage principals, teachers, and students"
              icon={Users}
              onClick={() => navigate("/superadmin/users")}
              color="purple"
            />
            <ManagementCard
              title="Manage Exams"
              description="Configure exam types and schedules"
              icon={Calendar}
              onClick={() => navigate("/superadmin/schools")}
              color="orange"
            />
            <ManagementCard
              title="Reference Materials"
              description="Upload and manage study resources"
              icon={BookOpen}
              onClick={() => navigate("/superadmin/schools")}
              color="blue"
            />
          </div>

          {/* Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* School Performance Chart */}
            <div className="analytics-card lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">School Performance</h3>
                <select className="bg-transparent text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1">
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                  <option>This year</option>
                </select>
              </div>
              
              {/* Simple Bar Chart Visualization */}
              <div className="space-y-4">
                {[
                  { name: "Maharishi Vidya Mandir", score: 92, color: "#00D4FF" },
                  { name: "Delhi Public School", score: 88, color: "#8B5CF6" },
                  { name: "Kendriya Vidyalaya", score: 85, color: "#F97316" },
                  { name: "DAV School", score: 78, color: "#0099FF" },
                ].map((school, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{school.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">{school.score}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${school.score}%`, background: school.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exam Completion Progress */}
            <div className="analytics-card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Exam Progress</h3>
              <div className="flex flex-col items-center">
                <DonutChart percentage={90} label="Completion Rate" />
                <div className="mt-6 space-y-3 w-full">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                      <span className="text-gray-600 dark:text-gray-400">Completed</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">304</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-gray-600 dark:text-gray-400">In Progress</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">75</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                      <span className="text-gray-600 dark:text-gray-400">Scheduled</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">220</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: At-Risk & Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* At-Risk Students */}
            <div className="analytics-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">At-Risk Students</h3>
                <Button variant="ghost" size="sm" className="text-cyan-500 hover:text-cyan-400">
                  View All
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { name: "John Doe", school: "MVM Chennai", issue: "Low attendance", risk: "high" },
                  { name: "Jane Smith", school: "DPS Delhi", issue: "Failing exams", risk: "medium" },
                  { name: "Mike Johnson", school: "KV Chennai", issue: "Missing assignments", risk: "low" },
                ].map((student, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 dark:bg-white/5 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{student.school} • {student.issue}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      student.risk === "high" ? "bg-red-500/20 text-red-400" :
                      student.risk === "medium" ? "bg-orange-500/20 text-orange-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>
                      {student.risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="notification-panel">
              <div className="flex items-center justify-between p-4 border-b border-white/5 dark:border-white/5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
                <Button variant="ghost" size="sm" className="text-cyan-500 hover:text-cyan-400">
                  View All
                </Button>
              </div>
              <NotificationItem
                icon={Building2}
                title="New school registered: MVM Chennai"
                time="15 mins ago"
                color="cyan"
              />
              <NotificationItem
                icon={Calendar}
                title="Exam scheduled for Class 12"
                time="1 hour ago"
                color="purple"
              />
              <NotificationItem
                icon={CheckCircle2}
                title="System backup completed"
                time="3 hours ago"
                color="green"
              />
              <NotificationItem
                icon={AlertCircle}
                title="Storage reaching 80% capacity"
                time="1 day ago"
                color="orange"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
