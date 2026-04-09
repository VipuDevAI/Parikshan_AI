import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLogo } from "@/components/app-logo";
import { AppFooter } from "@/components/app-footer";
import { Building2, Settings, HardDrive, LogOut, Shield, Users, Sparkles, Library, FileUp } from "lucide-react";

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!user || user.role !== "super_admin") {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-300">
      {/* Premium Header with Gradient */}
      <header className="relative border-b border-white/20 dark:border-slate-800/50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900 text-white shadow-xl shadow-indigo-500/20 dark:shadow-indigo-900/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo size="lg" showText={false} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Prashnakosh</h1>
              <p className="text-sm text-white/80">Super Admin Control Center</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-white/90 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              Welcome, <strong>{user.name}</strong>
            </span>
            <ThemeToggle />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => { 
                logout(); 
                window.location.href = "/";
              }}
              className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white"
              data-testid="btn-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        {/* Welcome Section with Gradient Text */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white mb-6 shadow-2xl shadow-purple-500/30">
            <Sparkles className="w-10 h-10" />
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-4">
            Super Admin Dashboard
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Manage schools, configure exam structures, allocate resources, and oversee the entire platform from here.
          </p>
        </div>

        {/* Six Primary Cards with Premium Gradients */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Add School */}
          <Card 
            className="group cursor-pointer transition-all duration-500 border-0 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 dark:from-emerald-600 dark:via-emerald-700 dark:to-teal-800 text-white shadow-xl shadow-emerald-500/30 dark:shadow-emerald-900/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-105 hover:-translate-y-1"
            onClick={() => navigate("/superadmin/schools")}
            data-testid="card-add-school"
          >
            <CardContent className="p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <Building2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold mb-1">Add School</h3>
                <p className="text-xs text-white/80 mb-3">Onboard new schools</p>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Create • Edit • Delete
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Management */}
          <Card 
            className="group cursor-pointer transition-all duration-500 border-0 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 dark:from-orange-600 dark:via-orange-700 dark:to-red-700 text-white shadow-xl shadow-orange-500/30 dark:shadow-orange-900/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-105 hover:-translate-y-1"
            onClick={() => navigate("/superadmin/users")}
            data-testid="card-users"
          >
            <CardContent className="p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold mb-1">Users</h3>
                <p className="text-xs text-white/80 mb-3">Add users per school</p>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Teachers • Students • HOD
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Settings */}
          <Card 
            className="group cursor-pointer transition-all duration-500 border-0 bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 dark:from-blue-600 dark:via-blue-700 dark:to-indigo-800 text-white shadow-xl shadow-blue-500/30 dark:shadow-blue-900/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 hover:-translate-y-1"
            onClick={() => navigate("/superadmin/settings")}
            data-testid="card-admin-settings"
          >
            <CardContent className="p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <Settings className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold mb-1">Admin Settings</h3>
                <p className="text-xs text-white/80 mb-3">Configure wings & exams</p>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Wings • Exams • Structure
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Question Parser - NEW */}
          <Card 
            className="group cursor-pointer transition-all duration-500 border-0 bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-600 dark:from-violet-600 dark:via-purple-700 dark:to-fuchsia-800 text-white shadow-xl shadow-purple-500/30 dark:shadow-purple-900/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-105 hover:-translate-y-1"
            onClick={() => navigate("/superadmin/question-parser")}
            data-testid="card-question-parser"
          >
            <CardContent className="p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <FileUp className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold mb-1">AI Paper Parser</h3>
                <p className="text-xs text-white/80 mb-3">Extract questions from PDF</p>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  PDF • Image • Scanned
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reference Materials Library */}
          <Card 
            className="group cursor-pointer transition-all duration-500 border-0 bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-600 dark:from-cyan-600 dark:via-teal-700 dark:to-emerald-800 text-white shadow-xl shadow-teal-500/30 dark:shadow-teal-900/30 hover:shadow-2xl hover:shadow-teal-500/40 hover:scale-105 hover:-translate-y-1"
            onClick={() => navigate("/superadmin/reference-materials")}
            data-testid="card-reference-materials"
          >
            <CardContent className="p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <Library className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold mb-1">Reference Library</h3>
                <p className="text-xs text-white/80 mb-3">Global study materials</p>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Class 10 • Class 12 • Papers
                </div>
              </div>
            </CardContent>
          </Card>

          {/* S3 Storage */}
          <Card 
            className="group cursor-pointer transition-all duration-500 border-0 bg-gradient-to-br from-slate-400 via-slate-500 to-zinc-600 dark:from-slate-600 dark:via-slate-700 dark:to-zinc-800 text-white shadow-xl shadow-slate-500/30 dark:shadow-slate-900/30 hover:shadow-2xl hover:shadow-slate-500/40 hover:scale-105 hover:-translate-y-1"
            onClick={() => navigate("/superadmin/storage")}
            data-testid="card-s3-storage"
          >
            <CardContent className="p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <HardDrive className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold mb-1">S3 Storage</h3>
                <p className="text-xs text-white/80 mb-3">Allocate storage buckets</p>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Buckets • Folders • Mapping
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
