import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

// Pages
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import AlertsPage from "@/pages/Alerts";
import TimetablePage from "@/pages/Timetable";
import AttendancePage from "@/pages/Attendance";
import SettingsPage from "@/pages/Settings";
import LeavePage from "@/pages/Leave";
import SubstitutionsPage from "@/pages/Substitutions";
import TimetableManagementPage from "@/pages/TimetableManagement";
import FaceRegistrationPage from "@/pages/FaceRegistration";
import CameraSimulatorPage from "@/pages/CameraSimulator";
import CamerasPage from "@/pages/Cameras";
import StudentsPage from "@/pages/Students";
import StaffPage from "@/pages/Staff";
import SchoolOnboardingPage from "@/pages/SchoolOnboarding";
import NotFound from "@/pages/not-found";

// Layout Wrapper for protected routes
function MainLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen gradient-bg dark:gradient-bg-dark text-foreground">
      <Sidebar />
      <div className="md:ml-64 flex flex-col min-h-screen transition-all duration-300">
        <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <main className="flex-1">
          {children}
        </main>
        <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/40">
          Powered by <span className="font-semibold text-gradient">SmartGenEduX</span> 2025 | All Rights Reserved
        </footer>
      </div>
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen gradient-bg dark:gradient-bg-dark">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Protected Routes */}
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/alerts">
        <ProtectedRoute component={AlertsPage} />
      </Route>
      <Route path="/timetable">
        <ProtectedRoute component={TimetablePage} />
      </Route>
      <Route path="/attendance">
        <ProtectedRoute component={AttendancePage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route path="/leave">
        <ProtectedRoute component={LeavePage} />
      </Route>
      <Route path="/substitutions">
        <ProtectedRoute component={SubstitutionsPage} />
      </Route>
      <Route path="/timetable-management">
        <ProtectedRoute component={TimetableManagementPage} />
      </Route>
      <Route path="/face-registration">
        <ProtectedRoute component={FaceRegistrationPage} />
      </Route>
      <Route path="/camera-simulator">
        <ProtectedRoute component={CameraSimulatorPage} />
      </Route>
      <Route path="/cameras">
        <ProtectedRoute component={CamerasPage} />
      </Route>
      <Route path="/students">
        <ProtectedRoute component={StudentsPage} />
      </Route>
      <Route path="/staff">
        <ProtectedRoute component={StaffPage} />
      </Route>
      <Route path="/school-onboarding">
        <ProtectedRoute component={SchoolOnboardingPage} />
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
