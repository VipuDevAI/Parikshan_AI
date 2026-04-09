import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SchoolProvider } from "@/lib/school-context";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import QuestionsPage from "@/pages/questions";
import ChaptersPage from "@/pages/chapters";
import PracticePage from "@/pages/practice";
import MockPage from "@/pages/mock";
import ReportsPage from "@/pages/reports";
import AnalyticsPage from "@/pages/analytics";
import TenantsPage from "@/pages/admin/tenants";
import UsersPage from "@/pages/admin/users";
import ActivityLogsPage from "@/pages/activity-logs";
import HODPaperGeneratorPage from "@/pages/hod/paper-generator";
import HODQuestionsPage from "@/pages/hod/questions";
import HODChaptersPage from "@/pages/hod/chapters";
import HODBlueprintsPage from "@/pages/hod/blueprints";
import PrincipalApprovalPage from "@/pages/principal/approval";
import CommitteePanelPage from "@/pages/committee/panel";
import RiskAlertsPage from "@/pages/principal/risk-alerts";
import PrincipalAnalyticsDashboard from "@/pages/principal/analytics-dashboard";
import TestCreatePage from "@/pages/tests/create";
import TestRevealPage from "@/pages/tests/reveal";
import PortionsPage from "@/pages/portions";
import MakeupTestsPage from "@/pages/makeup";
import ManualMarkingPage from "@/pages/manual-marking";
import ViewResultsPage from "@/pages/view-results";
import ParentDashboard from "@/pages/parent/dashboard";
import BlueprintsPage from "@/pages/blueprints";
import BulkUploadPage from "@/pages/bulk-upload";
import QuestionsUploadPage from "@/pages/questions-upload";
import TeacherUploadPage from "@/pages/teacher/upload";
import TeacherWordUploadPage from "@/pages/teacher/word-upload";
import TeacherManualEntryPage from "@/pages/teacher/manual-entry";
import TeacherQuestionsPage from "@/pages/teacher/questions";
import ChangePasswordPage from "@/pages/change-password";
import AcademicYearsPage from "@/pages/admin/academic-years";
import GradeConfigsPage from "@/pages/admin/grade-configs";
import ExamFrameworksPage from "@/pages/admin/exam-frameworks";
import ExamConfigsPage from "@/pages/admin/exam-configs";
import BlueprintGovernancePage from "@/pages/admin/blueprint-governance";
import BlueprintPoliciesPage from "@/pages/admin/blueprint-policies";
import UserBulkUploadPage from "@/pages/admin/user-bulk-upload";
import ReferenceLibraryPage from "@/pages/admin/reference-library";
import StorageGovernancePage from "@/pages/admin/storage-governance";
import StudentReferenceMaterialsPage from "@/pages/student/reference-materials";

// Super Admin Pages
import SuperAdminDashboard from "@/pages/superadmin/dashboard";
import SuperAdminSchools from "@/pages/superadmin/schools";
import SuperAdminSettings from "@/pages/superadmin/settings";
import SuperAdminStorage from "@/pages/superadmin/storage";
import SuperAdminUsers from "@/pages/superadmin/users";
import SuperAdminReferenceMaterials from "@/pages/superadmin/reference-materials";
import SuperAdminQuestionParser from "@/pages/superadmin/question-parser";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/questions">
        <ProtectedRoute component={QuestionsPage} />
      </Route>
      <Route path="/questions/upload">
        <ProtectedRoute component={QuestionsUploadPage} />
      </Route>
      <Route path="/teacher/upload">
        <ProtectedRoute component={TeacherUploadPage} />
      </Route>
      <Route path="/teacher/upload/word">
        <ProtectedRoute component={TeacherWordUploadPage} />
      </Route>
      <Route path="/teacher/questions/new">
        <ProtectedRoute component={TeacherManualEntryPage} />
      </Route>
      <Route path="/teacher/questions">
        <ProtectedRoute component={TeacherQuestionsPage} />
      </Route>
      <Route path="/chapters">
        <ProtectedRoute component={ChaptersPage} />
      </Route>
      <Route path="/practice">
        <ProtectedRoute component={PracticePage} />
      </Route>
      <Route path="/mock">
        <ProtectedRoute component={MockPage} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={ReportsPage} />
      </Route>
      <Route path="/results">
        <ProtectedRoute component={ReportsPage} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={AnalyticsPage} />
      </Route>
      <Route path="/admin/tenants">
        <ProtectedRoute component={TenantsPage} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={UsersPage} />
      </Route>
      <Route path="/admin/academic-years">
        <ProtectedRoute component={AcademicYearsPage} />
      </Route>
      <Route path="/admin/grade-configs">
        <ProtectedRoute component={GradeConfigsPage} />
      </Route>
      <Route path="/admin/exam-frameworks">
        <ProtectedRoute component={ExamFrameworksPage} />
      </Route>
      <Route path="/admin/exams">
        <ProtectedRoute component={ExamConfigsPage} />
      </Route>
      <Route path="/admin/blueprint-governance">
        <ProtectedRoute component={BlueprintGovernancePage} />
      </Route>
      <Route path="/admin/blueprint-policies">
        <ProtectedRoute component={BlueprintPoliciesPage} />
      </Route>
      <Route path="/admin/user-bulk-upload">
        <ProtectedRoute component={UserBulkUploadPage} />
      </Route>
      <Route path="/admin/reference-library">
        <ProtectedRoute component={ReferenceLibraryPage} />
      </Route>
      <Route path="/admin/storage-governance">
        <ProtectedRoute component={StorageGovernancePage} />
      </Route>
      <Route path="/admin/storage">
        <ProtectedRoute component={StorageGovernancePage} />
      </Route>
      <Route path="/student/reference-materials">
        <ProtectedRoute component={StudentReferenceMaterialsPage} />
      </Route>
      <Route path="/change-password">
        <ProtectedRoute component={ChangePasswordPage} />
      </Route>
      <Route path="/activity-logs">
        <ProtectedRoute component={ActivityLogsPage} />
      </Route>
      <Route path="/hod/generate-paper">
        <ProtectedRoute component={HODPaperGeneratorPage} />
      </Route>
      <Route path="/hod/questions">
        <ProtectedRoute component={HODQuestionsPage} />
      </Route>
      <Route path="/hod/approve">
        <ProtectedRoute component={HODPaperGeneratorPage} />
      </Route>
      <Route path="/hod/chapters">
        <ProtectedRoute component={HODChaptersPage} />
      </Route>
      <Route path="/hod/blueprints">
        <ProtectedRoute component={HODBlueprintsPage} />
      </Route>
      <Route path="/hod/answer-key">
        <ProtectedRoute component={HODPaperGeneratorPage} />
      </Route>
      <Route path="/hod/submit-principal">
        <ProtectedRoute component={HODPaperGeneratorPage} />
      </Route>
      <Route path="/principal/pending">
        <ProtectedRoute component={PrincipalApprovalPage} />
      </Route>
      <Route path="/principal/approve">
        <ProtectedRoute component={PrincipalApprovalPage} />
      </Route>
      <Route path="/principal/send-committee">
        <ProtectedRoute component={PrincipalApprovalPage} />
      </Route>
      <Route path="/principal/status">
        <ProtectedRoute component={PrincipalApprovalPage} />
      </Route>
      <Route path="/principal/alerts">
        <ProtectedRoute component={RiskAlertsPage} />
      </Route>
      <Route path="/principal/risk-alerts">
        <ProtectedRoute component={RiskAlertsPage} />
      </Route>
      <Route path="/principal/analytics">
        <ProtectedRoute component={PrincipalAnalyticsDashboard} />
      </Route>
      <Route path="/committee/papers">
        <ProtectedRoute component={CommitteePanelPage} />
      </Route>
      <Route path="/committee/confidential">
        <ProtectedRoute component={CommitteePanelPage} />
      </Route>
      <Route path="/committee/lock">
        <ProtectedRoute component={CommitteePanelPage} />
      </Route>
      <Route path="/committee/printing">
        <ProtectedRoute component={CommitteePanelPage} />
      </Route>
      <Route path="/committee/download">
        <ProtectedRoute component={CommitteePanelPage} />
      </Route>
      <Route path="/tests/create">
        <ProtectedRoute component={TestCreatePage} />
      </Route>
      <Route path="/tests/reveal">
        <ProtectedRoute component={TestRevealPage} />
      </Route>
      <Route path="/portions">
        <ProtectedRoute component={PortionsPage} />
      </Route>
      <Route path="/makeup">
        <ProtectedRoute component={MakeupTestsPage} />
      </Route>
      <Route path="/manual-marking">
        <ProtectedRoute component={ManualMarkingPage} />
      </Route>
      <Route path="/view-results">
        <ProtectedRoute component={ViewResultsPage} />
      </Route>
      <Route path="/parent/dashboard">
        <ProtectedRoute component={ParentDashboard} />
      </Route>
      <Route path="/blueprints">
        <ProtectedRoute component={BlueprintsPage} />
      </Route>
      <Route path="/bulk-upload">
        <ProtectedRoute component={BulkUploadPage} />
      </Route>
      
      {/* Super Admin Routes */}
      <Route path="/superadmin">
        <ProtectedRoute component={SuperAdminDashboard} />
      </Route>
      <Route path="/superadmin/schools">
        <ProtectedRoute component={SuperAdminSchools} />
      </Route>
      <Route path="/superadmin/settings">
        <ProtectedRoute component={SuperAdminSettings} />
      </Route>
      <Route path="/superadmin/storage">
        <ProtectedRoute component={SuperAdminStorage} />
      </Route>
      <Route path="/superadmin/users">
        <ProtectedRoute component={SuperAdminUsers} />
      </Route>
      <Route path="/superadmin/reference-materials">
        <ProtectedRoute component={SuperAdminReferenceMaterials} />
      </Route>
      <Route path="/superadmin/question-parser">
        <ProtectedRoute component={SuperAdminQuestionParser} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="prashnakosh-theme">
        <TooltipProvider>
          <AuthProvider>
            <SchoolProvider>
              <Toaster />
              <Router />
            </SchoolProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
