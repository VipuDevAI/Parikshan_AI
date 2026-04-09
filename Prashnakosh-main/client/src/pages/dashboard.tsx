import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader, PageContent, ContentCard, GridContainer, PageFooter } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload, FileText, Unlock, Eye, Calendar, ClipboardList,
  BookOpen, Clock, BarChart3, Users, Building2, Settings, LogOut, ChevronDown,
  PlayCircle, CheckCircle, Award, TrendingUp, Bell, FileCheck, Send, Lock,
  Printer, Shield, AlertTriangle, Download, ClipboardCheck, GraduationCap,
  Plus, Image, RefreshCw, History, MessageSquare, Activity, ChevronRight, Trophy, Library
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { BRAND } from "@/lib/brand";
import { AppFooter } from "@/components/app-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!user) {
    navigate("/");
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const roleConfig: Record<string, { label: string; color: string }> = {
    teacher: { label: "Teacher", color: "bg-coin-green text-white" },
    student: { label: "Student", color: "bg-coin-blue text-white" },
    parent: { label: "Parent", color: "bg-coin-purple text-white" },
    admin: { label: "Admin", color: "bg-primary text-primary-foreground" },
    super_admin: { label: "Super Admin", color: "bg-coin-gold text-white" },
    hod: { label: "HOD", color: "bg-coin-indigo text-white" },
    principal: { label: "Principal", color: "bg-coin-teal text-white" },
    exam_committee: { label: "Exam Committee", color: "bg-coin-orange text-white" },
  };

  const config = roleConfig[user.role] || roleConfig.student;

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <img 
              src={BRAND.logo} 
              alt={BRAND.name}
              className="w-10 h-10 rounded-full object-cover shadow-md ring-2 ring-white/50 dark:ring-slate-700/50"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{BRAND.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <Button variant="ghost" size="icon" disabled title="Notifications coming soon" data-testid="button-notifications" className="hidden sm:flex">
              <Bell className="w-5 h-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="button-user-menu">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium">{user.name}</p>
                    <Badge className={config.color} size="sm">{config.label}</Badge>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Welcome, {user.name}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Here's what's happening today</p>
        </div>

        {user.role === "teacher" && <TeacherDashboard />}
        {user.role === "student" && <StudentDashboard />}
        {user.role === "parent" && <ParentDashboard />}
        {user.role === "hod" && <HODDashboard />}
        {user.role === "principal" && <PrincipalDashboard />}
        {user.role === "exam_committee" && <ExamCommitteeDashboard />}
        {(user.role === "admin" || user.role === "super_admin") && <AdminDashboard />}
      </PageContent>
      <AppFooter />
    </PageLayout>
  );
}

function TeacherDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedWing, setSelectedWing] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [uploadMode, setUploadMode] = useState<"bulk" | "single" | null>(null);

  // Fetch wings from API
  const { data: wingsData = [] } = useQuery<{id: string; name: string; displayName: string; grades: string[]; isActive: boolean}[]>({
    queryKey: ['/api/wings'],
  });
  const activeWings = wingsData.filter(w => w.isActive);

  // Get grades from selected wing
  const selectedWingObj = activeWings.find(w => w.id === selectedWing);
  const availableGrades = selectedWingObj?.grades || [];

  const teacherSubject = (user as any)?.department || "Not Assigned";
  const canProceed = selectedWing;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Questions
          </CardTitle>
          <CardDescription>Upload questions to the question bank for your subject</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Your Subject (Auto-assigned)</Label>
              <div className="p-3 bg-muted rounded-md font-medium" data-testid="text-teacher-subject">
                {teacherSubject}
              </div>
              <p className="text-xs text-muted-foreground">Subject is assigned based on your department.</p>
            </div>
            <div className="space-y-2">
              <Label>Select Wing *</Label>
              <Select value={selectedWing} onValueChange={setSelectedWing} disabled={activeWings.length === 0}>
                <SelectTrigger data-testid="select-wing">
                  <SelectValue placeholder={activeWings.length === 0 ? "No wings configured" : "Select Wing"} />
                </SelectTrigger>
                <SelectContent>
                  {activeWings.map(wing => (
                    <SelectItem key={wing.id} value={wing.id}>{wing.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select your school wing. Only questions related to this wing will be allowed.</p>
            </div>

            <div className="space-y-2">
              <Label>Select Class (Optional)</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!selectedWing || availableGrades.length === 0}>
                <SelectTrigger data-testid="select-class">
                  <SelectValue placeholder={!selectedWing ? "Select wing first" : availableGrades.length === 0 ? "No classes available" : "Select Class"} />
                </SelectTrigger>
                <SelectContent>
                  {availableGrades.map(grade => (
                    <SelectItem key={grade} value={grade}>Class {grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select the grade this question belongs to.</p>
            </div>
          </div>

          {canProceed && (
            <div className="flex gap-4 pt-4 border-t">
              <CoinButton
                color="gold"
                className="flex-1"
                icon={<Upload className="w-5 h-5" />}
                onClick={() => setUploadMode("bulk")}
                data-testid="button-bulk-upload"
              >
                Bulk Upload
              </CoinButton>
              <CoinButton
                color="blue"
                className="flex-1"
                icon={<Plus className="w-5 h-5" />}
                onClick={() => setUploadMode("single")}
                data-testid="button-single-upload"
              >
                Single Question
              </CoinButton>
            </div>
          )}

          {uploadMode === "bulk" && canProceed && (
            <Card className="border-2 border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">Bulk Upload Area</CardTitle>
                <CardDescription>Upload multiple questions at once using official templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <CoinButton
                    color="blue"
                    onClick={() => navigate("/questions/upload")}
                    icon={<FileText className="w-5 h-5" />}
                    data-testid="button-upload-word"
                  >
                    Word (.docx)
                  </CoinButton>
                  <CoinButton
                    color="green"
                    onClick={() => navigate("/questions/upload")}
                    icon={<FileText className="w-5 h-5" />}
                    data-testid="button-upload-excel"
                  >
                    Excel (.csv/.xlsx)
                  </CoinButton>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Instructions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Use official template</li>
                    <li>Allowed formats: Word (.docx) or Excel (.csv/.xlsx)</li>
                    <li>Do NOT change column names</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {uploadMode === "single" && canProceed && (
            <Card className="border-2 border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">Single Question Entry</CardTitle>
                <CardDescription>Add one question at a time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Lesson</Label>
                    <Input placeholder="Enter lesson name" data-testid="input-lesson" />
                  </div>
                  <div className="space-y-2">
                    <Label>Chapter</Label>
                    <Input placeholder="Enter chapter" data-testid="input-chapter" />
                  </div>
                  <div className="space-y-2">
                    <Label>Topic</Label>
                    <Input placeholder="Enter topic" data-testid="input-topic" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Question Heading</Label>
                    <Input placeholder="Brief heading" data-testid="input-heading" />
                  </div>
                  <div className="space-y-2">
                    <Label>Marks Allotted</Label>
                    <Input type="number" placeholder="e.g., 2" data-testid="input-marks" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea placeholder="Enter full question text" rows={3} data-testid="input-question-text" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Option 1</Label>
                    <Input placeholder="Option A" data-testid="input-option-1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Option 2</Label>
                    <Input placeholder="Option B" data-testid="input-option-2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Option 3</Label>
                    <Input placeholder="Option C" data-testid="input-option-3" />
                  </div>
                  <div className="space-y-2">
                    <Label>Option 4</Label>
                    <Input placeholder="Option D" data-testid="input-option-4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Input placeholder="Enter correct option/answer" data-testid="input-correct-answer" />
                </div>
                <div className="space-y-2">
                  <Label>Add Image/Diagram (Optional)</Label>
                  <Input type="file" accept="image/png,image/jpeg" data-testid="input-image" />
                  <p className="text-xs text-muted-foreground">Allowed formats: JPG/PNG only</p>
                </div>
                <CoinButton
                  color="green"
                  className="w-full"
                  icon={<Upload className="w-5 h-5" />}
                  onClick={() => toast({ title: "Coming Soon", description: "Single question upload will be available soon. Please use Bulk Upload for now." })}
                  data-testid="button-submit-question"
                >
                  Upload Question
                </CoinButton>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <GridContainer cols={3}>
        <ContentCard title="My Questions" description="View your uploaded questions">
          <div className="space-y-3 mt-4">
            <CoinButton
              color="blue"
              className="w-full"
              icon={<FileText className="w-5 h-5" />}
              onClick={() => navigate("/questions")}
              data-testid="button-view-questions"
            >
              View Questions
            </CoinButton>
          </div>
        </ContentCard>

        <ContentCard title="Upload Status" description="Track question approval status">
          <div className="space-y-3 mt-4">
            <CoinButton
              color="orange"
              className="w-full"
              icon={<Clock className="w-5 h-5" />}
              onClick={() => navigate("/questions?status=pending")}
              data-testid="button-pending-status"
            >
              Pending Review
            </CoinButton>
          </div>
        </ContentCard>

        <ContentCard title="Reports" description="View your upload history">
          <div className="space-y-3 mt-4">
            <CoinButton
              color="indigo"
              className="w-full"
              icon={<BarChart3 className="w-5 h-5" />}
              onClick={() => navigate("/reports")}
              data-testid="button-view-reports"
            >
              View Reports
            </CoinButton>
          </div>
        </ContentCard>
      </GridContainer>
    </div>
  );
}

type StudentTest = {
  id: string;
  title: string;
  type: string;
  subject: string;
  grade: string;
  duration: number;
  totalMarks: number;
  chapterId: string | null;
  hasCompletedAttempt: boolean;
  hasActiveAttempt: boolean;
};

type StudentResult = {
  attemptId: string;
  testId: string;
  testTitle: string;
  testType: string;
  subject: string;
  chapter: string | null;
  score: number | null;
  totalMarks: number | null;
  percentage: string | null;
  status: string;
  submittedAt: string | null;
};

type StudentNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  testId: string | null;
  isRead: boolean;
  createdAt: string | null;
};

const testTypeLabels: Record<string, string> = {
  unit_test: "Unit Test",
  review_test: "Review Test",
  quarterly: "Quarterly Exam",
  half_yearly: "Half Yearly",
  revision: "Revision Test",
  preparatory: "Preparatory Exam",
  annual: "Annual Exam",
  mock: "Mock Test",
};

function StudentDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [practiceSubject, setPracticeSubject] = useState("");
  const [practiceChapter, setPracticeChapter] = useState("");

  const { data: subjectsData = [] } = useQuery<{id: number; name: string}[]>({
    queryKey: ['/api/subjects', user?.id],
    enabled: !!user?.id,
  });
  const subjects = subjectsData.length > 0 ? subjectsData.map(s => s.name) : [];

  const { data: chaptersData = [] } = useQuery<{id: number; name: string}[]>({
    queryKey: ['/api/chapters', practiceSubject],
    enabled: !!practiceSubject,
  });
  const chapters = chaptersData.length > 0 ? chaptersData.map(c => c.name) : [];

  const { data: studentTests = [] } = useQuery<StudentTest[]>({
    queryKey: ['/api/student/tests'],
    enabled: !!user?.id,
  });

  const { data: studentResults = [] } = useQuery<StudentResult[]>({
    queryKey: ['/api/student/results'],
    enabled: !!user?.id,
  });

  const { data: studentNotifications = [] } = useQuery<StudentNotification[]>({
    queryKey: ['/api/student/notifications'],
    enabled: !!user?.id,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/student/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/student/notifications'] });
      toast({ title: "Success", description: "All notifications marked as read" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to mark notifications as read",
        variant: "destructive"
      });
    },
  });

  const unreadCount = studentNotifications.filter(n => !n.isRead).length;
  const activeExam = studentTests.find(t => t.hasActiveAttempt);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            My Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><span className="text-muted-foreground">Name:</span> <strong>{user?.name}</strong></div>
            <div><span className="text-muted-foreground">Class/Section:</span> <strong>{(user as any)?.classLevel || "-"}-{(user as any)?.section || "-"}</strong></div>
            <div><span className="text-muted-foreground">Roll No:</span> <strong>{(user as any)?.rollNumber || "-"}</strong></div>
            <div><span className="text-muted-foreground">School:</span> <strong>{(user as any)?.schoolName || "-"}</strong></div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Your exams, practice and results are shown here.</p>
        </CardContent>
      </Card>

      {(user?.grade === "10" || user?.grade === "12") && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-amber-600" />
              Reference Materials
            </CardTitle>
            <CardDescription>
              Access previous year question papers and study materials for Class {user?.grade}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoinButton
              color="gold"
              icon={<Library className="w-5 h-5" />}
              onClick={() => navigate("/student/reference-materials")}
              data-testid="button-reference-materials"
            >
              View Reference Materials
            </CoinButton>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="exams">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="exams" data-testid="tab-exams">Exams</TabsTrigger>
          <TabsTrigger value="practice" data-testid="tab-practice">Practice</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Tests</CardTitle>
              <CardDescription>Active tests and exams you can attempt</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentTests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tests available at the moment</TableCell>
                    </TableRow>
                  ) : (
                    studentTests.map((test, idx) => (
                      <TableRow key={test.id}>
                        <TableCell className="font-medium">{test.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{testTypeLabels[test.type] || test.type}</Badge>
                        </TableCell>
                        <TableCell>{test.subject}</TableCell>
                        <TableCell>{test.duration} min</TableCell>
                        <TableCell>
                          {test.hasCompletedAttempt ? (
                            <Badge variant="secondary">
                              Completed
                            </Badge>
                          ) : test.hasActiveAttempt ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate("/mock")}
                              data-testid={`button-resume-exam-${idx}`}
                            >
                              Resume
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => navigate("/mock")}
                              data-testid={`button-start-exam-${idx}`}
                            >
                              Start
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {activeExam && (
            <Card>
              <CardHeader>
                <CardTitle>Resume Exam</CardTitle>
                <CardDescription>You have an active exam in progress</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  <strong>{activeExam.title}</strong> ({testTypeLabels[activeExam.type] || activeExam.type}) - {activeExam.subject}
                </p>
                <CoinButton color="orange" icon={<RefreshCw className="w-5 h-5" />} onClick={() => navigate("/mock")} data-testid="button-resume-exam">
                  Resume Now
                </CoinButton>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="practice">
          <Card>
            <CardHeader>
              <CardTitle>Practice Zone</CardTitle>
              <CardDescription>Self-paced practice with hints and answers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No subjects available. Please contact your teacher.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Subject</Label>
                    <Select value={practiceSubject} onValueChange={setPracticeSubject}>
                      <SelectTrigger data-testid="select-practice-subject">
                        <SelectValue placeholder="Choose Subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Chapter (Optional)</Label>
                    <Select value={practiceChapter} onValueChange={setPracticeChapter} disabled={chapters.length === 0}>
                      <SelectTrigger data-testid="select-practice-chapter">
                        <SelectValue placeholder={chapters.length === 0 ? "Select subject first" : "All Chapters"} />
                      </SelectTrigger>
                      <SelectContent>
                        {chapters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <CoinButton color="green" className="w-full" icon={<PlayCircle className="w-5 h-5" />} onClick={() => navigate("/practice")} data-testid="button-start-practice">
                Start Practice
              </CoinButton>
              <p className="text-sm text-muted-foreground">Practice mode gives hints and shows correct answers.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>My Results</CardTitle>
              <CardDescription>View your test performance</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No results available yet</TableCell>
                    </TableRow>
                  ) : (
                    studentResults.map((r, idx) => {
                      const pct = parseFloat(r.percentage || "0");
                      const isPassing = pct >= 40;
                      return (
                        <TableRow key={r.attemptId}>
                          <TableCell className="font-medium">{r.testTitle}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {testTypeLabels[r.testType] || r.testType}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.subject}</TableCell>
                          <TableCell>{r.score ?? 0}/{r.totalMarks ?? 0}</TableCell>
                          <TableCell>
                            <span className={pct >= 70 ? "text-green-600 font-medium" : pct >= 50 ? "text-yellow-600" : "text-red-600"}>
                              {pct.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isPassing ? "default" : "destructive"}>
                              {isPassing ? "Pass" : "Fail"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => navigate("/results")} 
                              data-testid={`button-view-result-${idx}`}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Performance Over Time</CardTitle>
              <CardDescription>Your actual performance from submitted exams</CardDescription>
            </CardHeader>
            <CardContent>
              {studentResults.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No performance data yet</p>
                  <p className="text-sm">Complete some exams to see your performance trends.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {/* Group results by subject and show average */}
                    {Object.entries(
                      studentResults.reduce((acc: Record<string, { total: number; count: number }>, r) => {
                        if (!acc[r.subject]) acc[r.subject] = { total: 0, count: 0 };
                        const pct = parseFloat(r.percentage || "0");
                        acc[r.subject].total += pct;
                        acc[r.subject].count += 1;
                        return acc;
                      }, {})
                    ).map(([subject, data]) => {
                      const avg = Math.round(data.total / data.count);
                      return (
                        <div key={subject} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium">{subject}</span>
                            <span className={avg >= 60 ? "text-green-600" : avg >= 40 ? "text-yellow-600" : "text-red-600"}>
                              {avg}%
                            </span>
                          </div>
                          <Progress value={avg} className={avg >= 60 ? "[&>div]:bg-green-500" : avg >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">
                      Total exams completed: {studentResults.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Overall average: {Math.round(studentResults.reduce((sum, r) => sum + parseFloat(r.percentage || "0"), 0) / studentResults.length)}%
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
                )}
              </CardTitle>
              <CardDescription>Stay updated with your academic progress</CardDescription>
            </CardHeader>
            <CardContent>
              {studentNotifications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No notifications yet</p>
              ) : (
                <div className="space-y-3">
                  {studentNotifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`flex items-start gap-3 p-3 rounded-lg ${notif.isRead ? "bg-muted/50" : "bg-muted"}`}
                    >
                      {notif.type === "test_unlocked" && (
                        <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      )}
                      {notif.type === "exam_submitted" && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      )}
                      {notif.type === "result_published" && (
                        <Trophy className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${notif.isRead ? "text-muted-foreground" : ""}`}>
                            {notif.title}
                          </span>
                          {!notif.isRead && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{notif.message}</p>
                        {notif.createdAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notif.createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {studentNotifications.length > 0 && unreadCount > 0 && (
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  data-testid="button-mark-read"
                >
                  {markAllReadMutation.isPending ? "Marking..." : "Mark All as Read"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ParentDashboard() {
  const { toast } = useToast();

  return (
    <GridContainer cols={3}>
      <ContentCard
        title="Child's Performance"
        description="View academic progress"
      >
        <div className="space-y-3 mt-4">
          <CoinButton
            color="purple"
            className="w-full"
            icon={<BarChart3 className="w-5 h-5" />}
            onClick={() => toast({ title: "Coming Soon", description: "Child performance tracking will be available soon." })}
            data-testid="button-child-performance"
          >
            View Performance
          </CoinButton>
        </div>
      </ContentCard>

      <ContentCard
        title="Test Reports"
        description="Download score reports"
      >
        <div className="space-y-3 mt-4">
          <CoinButton
            color="blue"
            className="w-full"
            icon={<FileText className="w-5 h-5" />}
            onClick={() => toast({ title: "Coming Soon", description: "Report downloads will be available soon." })}
            data-testid="button-child-reports"
          >
            Download Reports
          </CoinButton>
        </div>
      </ContentCard>

      <ContentCard
        title="Attendance"
        description="Track test attendance"
      >
        <div className="space-y-3 mt-4">
          <CoinButton
            color="green"
            className="w-full"
            icon={<CheckCircle className="w-5 h-5" />}
            onClick={() => toast({ title: "Coming Soon", description: "Attendance tracking will be available soon." })}
            data-testid="button-child-attendance"
          >
            View Attendance
          </CoinButton>
        </div>
      </ContentCard>
    </GridContainer>
  );
}

// Question type for HOD view
interface HODQuestion {
  id: string;
  content: string;
  chapter: string;
  type: string;
  status: string;
  subject: string;
  marks?: number;
  options?: string[];
  correctAnswer?: string;
  difficulty?: string;
}

function HODDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const hodSubject = (user as any)?.subjects?.join(", ") || "Not Assigned";
  const hodWing = (user as any)?.wingId ? "Senior Secondary (11-12)" : "Not Assigned";

  // State for question preview dialog
  const [selectedQuestion, setSelectedQuestion] = useState<HODQuestion | null>(null);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);

  // Fetch questions pending HOD review
  const { data: pendingQuestions = [] } = useQuery<HODQuestion[]>({
    queryKey: ['/api/hod/questions/pending'],
    enabled: !!user?.id,
  });

  // Fetch ALL questions for HOD (approved ones)
  const { data: allQuestions = [] } = useQuery<HODQuestion[]>({
    queryKey: ['/api/questions'],
    enabled: !!user?.id,
  });

  // Fetch exams from Super Admin configuration (school_exams table)
  const { data: availableExams = [] } = useQuery<{
    id: string;
    examName: string;
    academicYear: string;
    totalMarks: number;
    durationMinutes: number;
    subjects: string[];
    allowMockTest: boolean;
  }[]>({
    queryKey: ['/api/exams/for-blueprint'],
    enabled: !!user?.id,
  });

  // Fetch blueprints for HOD
  const { data: hodBlueprints = [] } = useQuery<{
    id: string;
    name: string;
    subject: string;
    grade: string;
  }[]>({
    queryKey: ['/api/blueprints'],
    enabled: !!user?.id,
  });

  // Fetch tests for HOD
  const { data: hodTests = [] } = useQuery<{
    id: string;
    title: string;
    subject: string;
    grade: string;
    workflowState: string;
  }[]>({
    queryKey: ['/api/tests'],
    enabled: !!user?.id,
  });

  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");

  // Handler to open question preview
  const handleViewQuestion = (question: HODQuestion) => {
    setSelectedQuestion(question);
    setShowQuestionDialog(true);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Your Assignment</CardTitle>
          <CardDescription>You are assigned to manage questions for the following scope only</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Subject</Label>
              <div className="p-3 bg-background rounded-md font-medium border" data-testid="text-hod-subject">
                {hodSubject}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Wing</Label>
              <div className="p-3 bg-background rounded-md font-medium border" data-testid="text-hod-wing">
                {hodWing}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            As {hodWing} {hodSubject} HOD, you will only see and manage papers for grades within your wing.
            For example: Primary HOD sees grades 1-5, Middle HOD sees grades 6-8, etc.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="review">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="review" data-testid="tab-review">Review Questions</TabsTrigger>
          <TabsTrigger value="blueprint" data-testid="tab-blueprint">Blueprint Manager</TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">Generate Paper</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">Send for Approval</TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>Review & Approve Questions</CardTitle>
              <CardDescription>Check spelling, blueprint match, difficulty, marks, correctness</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Total Questions: {allQuestions.length}</p>
                <p className="text-xs text-muted-foreground">Pending: {pendingQuestions.length} | Approved: {allQuestions.filter(q => q.status === 'approved').length}</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Chapter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allQuestions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No questions available</TableCell>
                    </TableRow>
                  ) : (
                    allQuestions.slice(0, 20).map((q, idx) => (
                      <TableRow key={q.id || idx}>
                        <TableCell className="max-w-xs truncate">{q.content?.substring(0, 50)}...</TableCell>
                        <TableCell>{q.chapter}</TableCell>
                        <TableCell>{q.type}</TableCell>
                        <TableCell>{q.subject}</TableCell>
                        <TableCell><Badge variant={q.status === 'approved' ? 'default' : 'secondary'}>{q.status}</Badge></TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewQuestion(q)} data-testid={`button-view-q-${idx}`}>View</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {allQuestions.length > 20 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">Showing 20 of {allQuestions.length} questions</p>
              )}
              <p className="text-sm text-muted-foreground mt-4">Rejected questions go back to Teacher for correction. Approved questions move to Question Bank.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blueprint">
          <Card>
            <CardHeader>
              <CardTitle>Exam Blueprint</CardTitle>
              <CardDescription>Create and manage exam blueprints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <CoinButton color="green" icon={<Plus className="w-5 h-5" />} onClick={() => navigate("/blueprints")} data-testid="button-create-blueprint">
                  Create New Blueprint
                </CoinButton>
                <CoinButton color="blue" icon={<Eye className="w-5 h-5" />} onClick={() => navigate("/blueprints")} data-testid="button-view-blueprints">
                  View Saved Blueprints
                </CoinButton>
              </div>
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label>Select Exam Type</Label>
                  <Select>
                    <SelectTrigger data-testid="select-exam-type">
                      <SelectValue placeholder={availableExams.length === 0 ? "No exams configured" : "Choose exam type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableExams.length === 0 ? (
                        <SelectItem value="none" disabled>No exams available - Super Admin must configure exams</SelectItem>
                      ) : (
                        availableExams.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id}>
                            {exam.examName} ({exam.totalMarks} marks, {exam.durationMinutes}min)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Exams are configured by Super Admin under Admin Settings → Wings → Exams
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Section A (1 mark)</Label>
                    <Input type="number" placeholder="10 questions" data-testid="input-section-a" />
                  </div>
                  <div className="space-y-2">
                    <Label>Section B (2 marks)</Label>
                    <Input type="number" placeholder="8 questions" data-testid="input-section-b" />
                  </div>
                  <div className="space-y-2">
                    <Label>Section C (3 marks)</Label>
                    <Input type="number" placeholder="6 questions" data-testid="input-section-c" />
                  </div>
                  <div className="space-y-2">
                    <Label>Section D (5 marks)</Label>
                    <Input type="number" placeholder="4 questions" data-testid="input-section-d" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">System must auto-check total = 40 or 80 marks.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate Question Paper</CardTitle>
              <CardDescription>Only HOD can generate papers - NOT teachers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Blueprint</Label>
                  <Select value={selectedBlueprintId} onValueChange={setSelectedBlueprintId}>
                    <SelectTrigger data-testid="select-blueprint"><SelectValue placeholder="Choose blueprint" /></SelectTrigger>
                    <SelectContent>
                      {hodBlueprints.length === 0 ? (
                        <SelectItem value="none" disabled>No blueprints available</SelectItem>
                      ) : (
                        hodBlueprints.map((bp) => (
                          <SelectItem key={bp.id} value={bp.id}>{bp.name} - {bp.subject}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Grade</Label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger data-testid="select-paper-class"><SelectValue placeholder="Choose grade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11">Grade 11</SelectItem>
                      <SelectItem value="12">Grade 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CoinButton color="gold" className="w-full" icon={<FileText className="w-5 h-5" />} onClick={() => navigate("/hod/generate-paper")} data-testid="button-generate-paper">
                Generate Paper
              </CoinButton>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium">Paper Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Paper Size</Label>
                    <Select><SelectTrigger data-testid="select-paper-size"><SelectValue placeholder="A4" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a4">A4</SelectItem>
                        <SelectItem value="legal">Legal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Header: Auto add School name and logo. Footer: Page number + exam name.</p>
              </div>
              <div className="flex gap-4">
                <CoinButton color="blue" icon={<Download className="w-5 h-5" />} disabled title="PDF download coming soon" data-testid="button-download-pdf">Download PDF</CoinButton>
                <CoinButton color="green" icon={<Download className="w-5 h-5" />} disabled title="Word download coming soon" data-testid="button-download-docx">Download Word</CoinButton>
                <CoinButton color="teal" icon={<FileText className="w-5 h-5" />} disabled title="Answer key coming soon" data-testid="button-answer-key">Answer Key</CoinButton>
              </div>
              <p className="text-sm text-muted-foreground">Original question paper is locked. Teachers CANNOT download it.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Send Paper for Principal Approval</CardTitle>
              <CardDescription>Submit generated papers for review</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Unit Test 1</TableCell>
                    <TableCell>Maths</TableCell>
                    <TableCell><Badge>Draft</Badge></TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => toast({ title: "Coming Soon", description: "Paper preview will be available soon." })} data-testid="button-view-draft-paper">View</Button>
                      <Button size="sm" disabled title="Approval workflow coming soon" data-testid="button-send-to-principal">Send to Principal</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground mt-4">Status flow: Draft &gt; Sent to Principal &gt; Approved &gt; Examination Committee</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <GridContainer cols={3}>
        <ContentCard title="Analytics" description="View department stats">
          <CoinButton color="purple" className="w-full mt-4" icon={<BarChart3 className="w-5 h-5" />} onClick={() => navigate("/analytics")} data-testid="button-hod-analytics">
            View Analytics
          </CoinButton>
        </ContentCard>
        <ContentCard title="Activity Logs" description="Audit trail">
          <CoinButton color="indigo" className="w-full mt-4" icon={<History className="w-5 h-5" />} onClick={() => navigate("/activity-logs")} data-testid="button-activity-logs">
            View Logs
          </CoinButton>
        </ContentCard>
        <ContentCard title="Chapter Test Control" description="Unlock tests for students">
          <CoinButton color="green" className="w-full mt-4" icon={<Unlock className="w-5 h-5" />} onClick={() => navigate("/chapters")} data-testid="button-unlock-test">
            Unlock Test
          </CoinButton>
        </ContentCard>
      </GridContainer>

      {/* Question Preview Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
            <DialogDescription>
              {selectedQuestion?.chapter} | {selectedQuestion?.subject} | {selectedQuestion?.type}
            </DialogDescription>
          </DialogHeader>
          {selectedQuestion && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={selectedQuestion.status === 'approved' ? 'default' : 'secondary'}>
                  {selectedQuestion.status}
                </Badge>
                {selectedQuestion.marks && (
                  <Badge variant="outline">{selectedQuestion.marks} marks</Badge>
                )}
                {selectedQuestion.difficulty && (
                  <Badge variant="outline">{selectedQuestion.difficulty}</Badge>
                )}
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground mb-2 block">Question</Label>
                <p className="text-base whitespace-pre-wrap">{selectedQuestion.content}</p>
              </div>
              
              {selectedQuestion.options && selectedQuestion.options.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Options</Label>
                  <div className="grid gap-2">
                    {selectedQuestion.options.map((option, idx) => {
                      const optionLabel = String.fromCharCode(65 + idx);
                      const isCorrect = selectedQuestion.correctAnswer === optionLabel || 
                                       selectedQuestion.correctAnswer === option ||
                                       selectedQuestion.correctAnswer?.toLowerCase() === optionLabel.toLowerCase();
                      return (
                        <div 
                          key={idx} 
                          className={`p-2 rounded border ${isCorrect ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-border"}`}
                        >
                          <span className="font-medium mr-2">{optionLabel}.</span>
                          {option}
                          {isCorrect && (
                            <Badge className="ml-2 bg-green-500 text-white text-xs">Correct</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {selectedQuestion.correctAnswer && !selectedQuestion.options && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-500">
                  <Label className="text-xs text-muted-foreground block mb-1">Correct Answer</Label>
                  <p className="font-medium">{selectedQuestion.correctAnswer}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrincipalDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Real data from PostgreSQL via Principal Analytics APIs
  const { data: snapshot = { totalStudents: 0, testsThisMonth: 0, averageScore: 0, atRiskCount: 0 }, isLoading: snapshotLoading } = useQuery<{
    totalStudents: number;
    testsThisMonth: number;
    averageScore: number;
    atRiskCount: number;
  }>({
    queryKey: ['/api/principal/snapshot'],
    enabled: !!user?.id,
  });

  const { data: gradePerformance = [], isLoading: gradeLoading } = useQuery<{
    grade: string;
    averageScore: number;
    passPercentage: number;
    totalAttempts: number;
    trend: 'up' | 'down' | 'stable';
  }[]>({
    queryKey: ['/api/principal/grade-performance'],
    enabled: !!user?.id,
  });

  const { data: subjectHealth = [] } = useQuery<{
    subject: string;
    grade: string;
    averagePercentage: number;
    totalAttempts: number;
    isWeak: boolean;
  }[]>({
    queryKey: ['/api/principal/subject-health'],
    enabled: !!user?.id,
  });

  const { data: atRiskStudents = [], isLoading: riskLoading } = useQuery<{
    studentId: string;
    studentName: string;
    grade: string;
    lowScoreCount: number;
    averagePercentage: number;
    trend: 'declining' | 'stable' | 'improving';
  }[]>({
    queryKey: ['/api/principal/at-risk-students'],
    enabled: !!user?.id,
  });

  const { data: riskAlerts = [] } = useQuery<{
    type: 'tab_switch' | 'absence' | 'sudden_drop';
    studentId: string;
    studentName: string;
    grade: string;
    details: string;
    count: number;
    createdAt: string | null;
  }[]>({
    queryKey: ['/api/principal/risk-alerts'],
    enabled: !!user?.id,
  });

  // Derive tests data from existing tests API
  const { data: testsData = [] } = useQuery<any[]>({
    queryKey: ['/api/tests'],
    enabled: !!user?.id,
  });

  // Calculate activity stats from real data
  const activeTests = testsData.filter((t: any) => t.isActive).length;
  const totalTests = testsData.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>School Dashboard - Real-Time Analytics</CardTitle>
            <CardDescription>All data shown is from your PostgreSQL database - no demo or mock data</CardDescription>
          </div>
          <Button variant="outline" onClick={() => navigate("/principal/analytics")} data-testid="button-analytics-dashboard">
            View Full Analytics
          </Button>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="grades" data-testid="tab-grades">Grade Performance</TabsTrigger>
          <TabsTrigger value="subjects" data-testid="tab-subjects">Subject Health</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">At-Risk Students</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Risk Alerts</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB - Real snapshot data */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>School Snapshot</CardTitle>
              <CardDescription>Real-time metrics from your database (last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshotLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg text-center border border-blue-200 dark:border-blue-800">
                    <p className="text-3xl font-bold text-blue-600">{snapshot.totalStudents}</p>
                    <p className="text-sm text-muted-foreground">Total Students</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-lg text-center border border-green-200 dark:border-green-800">
                    <p className="text-3xl font-bold text-green-600">{snapshot.testsThisMonth}</p>
                    <p className="text-sm text-muted-foreground">Tests This Month</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg text-center border border-purple-200 dark:border-purple-800">
                    <p className="text-3xl font-bold text-purple-600">{snapshot.averageScore}%</p>
                    <p className="text-sm text-muted-foreground">Average Score</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-lg text-center border border-red-200 dark:border-red-800">
                    <p className="text-3xl font-bold text-red-600">{snapshot.atRiskCount}</p>
                    <p className="text-sm text-muted-foreground">At-Risk Students</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Test Activity</CardTitle>
              <CardDescription>Tests created in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{totalTests}</p>
                  <p className="text-sm text-muted-foreground">Total Tests Created</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{activeTests}</p>
                  <p className="text-sm text-muted-foreground">Active Tests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GRADE PERFORMANCE TAB - Real grade data */}
        <TabsContent value="grades">
          <Card>
            <CardHeader>
              <CardTitle>Grade-wise Performance</CardTitle>
              <CardDescription>Performance metrics by class/grade from actual exam attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : gradePerformance.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No exam data yet</p>
                  <p className="text-sm">Performance data will appear here once students complete exams.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade/Class</TableHead>
                      <TableHead>Average Score</TableHead>
                      <TableHead>Pass Rate</TableHead>
                      <TableHead>Total Attempts</TableHead>
                      <TableHead>Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradePerformance.map((grade, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">Class {grade.grade}</TableCell>
                        <TableCell>
                          <span className={grade.averageScore >= 60 ? "text-green-600" : grade.averageScore >= 40 ? "text-yellow-600" : "text-red-600"}>
                            {grade.averageScore}%
                          </span>
                        </TableCell>
                        <TableCell>{grade.passPercentage}%</TableCell>
                        <TableCell>{grade.totalAttempts}</TableCell>
                        <TableCell>
                          {grade.trend === 'up' ? (
                            <Badge className="bg-green-100 text-green-700">↑ Improving</Badge>
                          ) : grade.trend === 'down' ? (
                            <Badge className="bg-red-100 text-red-700">↓ Declining</Badge>
                          ) : (
                            <Badge variant="secondary">→ Stable</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUBJECT HEALTH TAB - Real subject data */}
        <TabsContent value="subjects">
          <Card>
            <CardHeader>
              <CardTitle>Subject Health Analysis</CardTitle>
              <CardDescription>Subject-wise performance from actual exam data. Weak subjects (below 50%) are highlighted.</CardDescription>
            </CardHeader>
            <CardContent>
              {subjectHealth.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No subject data yet</p>
                  <p className="text-sm">Subject performance will appear once exams are conducted.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Average %</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectHealth.map((subject, idx) => (
                      <TableRow key={idx} className={subject.isWeak ? "bg-red-50 dark:bg-red-900/10" : ""}>
                        <TableCell className="font-medium">{subject.subject}</TableCell>
                        <TableCell>Class {subject.grade}</TableCell>
                        <TableCell>
                          <span className={subject.averagePercentage >= 60 ? "text-green-600" : subject.averagePercentage >= 40 ? "text-yellow-600" : "text-red-600 font-bold"}>
                            {subject.averagePercentage}%
                          </span>
                        </TableCell>
                        <TableCell>{subject.totalAttempts}</TableCell>
                        <TableCell>
                          {subject.isWeak ? (
                            <Badge variant="destructive">Needs Attention</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">Healthy</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AT-RISK STUDENTS TAB - Real at-risk data */}
        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle>At-Risk Students</CardTitle>
              <CardDescription>Students with 2+ exam scores below 40% - requires intervention</CardDescription>
            </CardHeader>
            <CardContent>
              {riskLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : atRiskStudents.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="font-medium text-green-600">No at-risk students identified</p>
                  <p className="text-sm">All students are performing above the risk threshold.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Low Scores</TableHead>
                      <TableHead>Average %</TableHead>
                      <TableHead>Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {atRiskStudents.map((student, idx) => (
                      <TableRow key={idx} className="bg-red-50 dark:bg-red-900/10">
                        <TableCell className="font-medium">{student.studentName}</TableCell>
                        <TableCell>Class {student.grade}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{student.lowScoreCount} low scores</Badge>
                        </TableCell>
                        <TableCell className="text-red-600 font-bold">{student.averagePercentage}%</TableCell>
                        <TableCell>
                          {student.trend === 'declining' ? (
                            <Badge className="bg-red-100 text-red-700">↓ Declining</Badge>
                          ) : student.trend === 'improving' ? (
                            <Badge className="bg-green-100 text-green-700">↑ Improving</Badge>
                          ) : (
                            <Badge variant="secondary">→ Stable</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RISK ALERTS TAB - Real alerts data */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Risk Alerts</CardTitle>
              <CardDescription>Automatic detection of concerning patterns (tab switches, absences)</CardDescription>
            </CardHeader>
            <CardContent>
              {riskAlerts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="font-medium text-green-600">No alerts at this time</p>
                  <p className="text-sm">The system monitors for tab switches, absences, and sudden score drops.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {riskAlerts.map((alert, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-muted rounded-lg border-l-4 border-l-yellow-500">
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                        alert.type === 'tab_switch' ? 'text-orange-600' : 
                        alert.type === 'absence' ? 'text-red-600' : 
                        'text-yellow-600'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{alert.studentName}</span>
                          <Badge variant="outline" className="text-xs">Class {alert.grade}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.details}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Occurrences: {alert.count}
                          {alert.createdAt && ` • Last: ${new Date(alert.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Badge variant={alert.type === 'absence' ? 'destructive' : 'secondary'}>
                        {alert.type === 'tab_switch' ? 'Tab Switch' : 
                         alert.type === 'absence' ? 'Absence' : 
                         'Score Drop'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Exam Security Control</CardTitle>
              <CardDescription>Prevents unauthorized exam from being conducted</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <CoinButton color="red" icon={<Lock className="w-5 h-5" />} disabled title="Exam security coming soon" data-testid="button-lock-exams">Lock All Exams</CoinButton>
              <CoinButton color="green" icon={<Unlock className="w-5 h-5" />} disabled title="Exam security coming soon" data-testid="button-unlock-exams">Unlock After Approval</CoinButton>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExamCommitteeDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: papersToReview = [] } = useQuery<{exam: string; className: string; subject: string; status: string}[]>({
    queryKey: ['/api/committee/papers'],
  });

  const { data: printStatus = [] } = useQuery<{exam: string; copies: number; printed: boolean; delivered: boolean}[]>({
    queryKey: ['/api/committee/print-status'],
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="review">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="review" data-testid="tab-review">Papers to Review</TabsTrigger>
          <TabsTrigger value="print" data-testid="tab-print">Print Status</TabsTrigger>
          <TabsTrigger value="confidential" data-testid="tab-confidential">Confidential</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">Log History</TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>Question Papers to Review</CardTitle>
              <CardDescription>Committee role exists AFTER principal approval. Verify paper quality, fairness, printing readiness.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {papersToReview.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{p.exam}</TableCell>
                      <TableCell>{p.className}</TableCell>
                      <TableCell>{p.subject}</TableCell>
                      <TableCell><Badge variant={p.status === "Approved" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => toast({ title: "Coming Soon", description: "Paper review will be available soon." })} data-testid={`button-review-${idx}`}>Review</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Question Paper Review Screen</CardTitle>
              <CardDescription>View blueprint, full paper, answer key, and randomization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Blueprint used:</strong> Unit Test Blueprint (40 marks)</p>
                <p><strong>Randomization:</strong> Questions shuffled per section</p>
                <p><strong>Difficulty balance:</strong> 40% Easy, 40% Medium, 20% Hard</p>
              </div>
              <div className="flex gap-4">
                <CoinButton color="green" icon={<CheckCircle className="w-5 h-5" />} disabled title="Approval workflow coming soon" data-testid="button-approve-print">Approve for Print</CoinButton>
                <CoinButton color="red" icon={<Send className="w-5 h-5" />} disabled title="Approval workflow coming soon" data-testid="button-send-back">Send Back</CoinButton>
              </div>
              <div className="space-y-2">
                <Label>Reason (if sending back)</Label>
                <Textarea placeholder="Enter reason for rejection..." data-testid="input-rejection-reason" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="print">
          <Card>
            <CardHeader>
              <CardTitle>Print & Distribution Status Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Copies Needed</TableHead>
                    <TableHead>Printed</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printStatus.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{p.exam}</TableCell>
                      <TableCell>{p.copies}</TableCell>
                      <TableCell>{p.printed ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-yellow-600" />}</TableCell>
                      <TableCell>{p.delivered ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-yellow-600" />}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => toast({ title: "Coming Soon", description: "Status update will be available soon." })} data-testid={`button-update-status-${idx}`}>Update Status</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confidential">
          <Card>
            <CardHeader>
              <CardTitle>Confidentiality Panel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  <span>Papers should NEVER be downloaded by teachers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  <span>Only HOD + Principal + Committee see final copy</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span>Logs maintained automatically</span>
                </div>
              </div>
              <div className="mt-4 flex gap-4 flex-wrap">
                <CoinButton color="blue" icon={<Download className="w-5 h-5" />} disabled title="PDF download coming soon" data-testid="button-download-pdf">Download PDF</CoinButton>
                <CoinButton color="teal" icon={<FileText className="w-5 h-5" />} disabled title="Word download coming soon" data-testid="button-download-word">Download Word</CoinButton>
                <CoinButton color="orange" icon={<Lock className="w-5 h-5" />} disabled title="Approval workflow coming soon" data-testid="button-lock-paper">Approve & Lock Paper</CoinButton>
              </div>
              <p className="text-sm text-muted-foreground mt-4">Once LOCKED: nobody edits, nobody exports except committee.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>What Happened to Each Paper</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-lg flex items-center gap-3">
                  <ChevronRight className="w-5 h-5" />
                  <span>Teacher uploaded &gt; HOD generated &gt; Principal OK &gt; Committee reviewed &gt; Final locked</span>
                </div>
              </div>
              <CoinButton color="indigo" className="mt-4" icon={<History className="w-5 h-5" />} onClick={() => navigate("/activity-logs")} data-testid="button-view-logs">
                View Full Audit Logs
              </CoinButton>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [addLanguageOpen, setAddLanguageOpen] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState(["Tamil", "Hindi", "Sanskrit", "French"]);
  
  // School selection state - persisted in localStorage
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    return localStorage.getItem("superadmin_selected_school") || "";
  });
  
  type WingLanguagePool = {
    availableLanguages: string[];
  };
  const defaultLanguages = ["Tamil", "Hindi", "Sanskrit", "French"];
  const [wingLanguagePools, setWingLanguagePools] = useState<Record<string, WingLanguagePool>>({
    "Primary": { availableLanguages: [...defaultLanguages] },
    "Middle": { availableLanguages: [...defaultLanguages] },
    "Secondary": { availableLanguages: [...defaultLanguages] },
    "Senior Secondary": { availableLanguages: [...defaultLanguages] },
  });

  const handleAddLanguage = () => {
    if (newLanguage.trim() && !availableLanguages.includes(newLanguage.trim())) {
      setAvailableLanguages([...availableLanguages, newLanguage.trim()]);
      setNewLanguage("");
      setAddLanguageOpen(false);
    }
  };

  const toggleLanguageForWing = (wing: string, language: string) => {
    setWingLanguagePools(prev => {
      const currentPool = prev[wing]?.availableLanguages || [];
      const isEnabled = currentPool.includes(language);
      return {
        ...prev,
        [wing]: {
          availableLanguages: isEnabled
            ? currentPool.filter(l => l !== language)
            : [...currentPool, language]
        }
      };
    });
  };

  const { data: adminWingsData = [] } = useQuery<{id: number; name: string}[]>({
    queryKey: ['/api/wings'],
  });
  const adminWings = adminWingsData.length > 0 
    ? adminWingsData.map(w => w.name) 
    : ["Primary", "Middle", "Secondary", "Senior Secondary"];

  const { data: adminSubjectsData = [] } = useQuery<{id: number; name: string}[]>({
    queryKey: ['/api/subjects'],
  });
  const adminSubjects = adminSubjectsData.length > 0 
    ? adminSubjectsData.map(s => s.name) 
    : ["English", "Mathematics", "Science", "Social Studies", "Hindi", "Tamil", "Sanskrit", "French", "Physics", "Chemistry", "Biology", "Computer Science"];

  const { data: schools = [] } = useQuery<{id: string; name: string; code: string; principal: string; status: string}[]>({
    queryKey: ['/api/admin/schools'],
  });

  const { data: auditLogs = [] } = useQuery<{who: string; action: string; module: string; time: string; ip: string}[]>({
    queryKey: ['/api/admin/audit-logs'],
  });

  const rolePermissions = [
    { role: "Teacher", permissions: "Upload questions only (for assigned subject)" },
    { role: "HOD", permissions: "Generate papers, approve questions (for assigned subject)" },
    { role: "Principal", permissions: "Monitor only - no approval workflow" },
    { role: "Committee", permissions: "Final approval and print management" },
    { role: "Parent", permissions: "View child's marks only" },
    { role: "Student", permissions: "Practice + Exam" },
    { role: "Admin", permissions: "Manage system, users, schools" },
  ];

  return (
    <div className="space-y-6">
      {/* School Selection Dropdown - MANDATORY at TOP */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Label className="text-base font-semibold whitespace-nowrap">Select School:</Label>
            <Select 
              value={selectedSchoolId} 
              onValueChange={(value) => {
                setSelectedSchoolId(value);
                localStorage.setItem("superadmin_selected_school", value);
              }}
            >
              <SelectTrigger className="w-[400px]" data-testid="select-school-dropdown">
                <SelectValue placeholder="-- Select a School to Manage --" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSchoolId && (
              <Badge variant="default" className="ml-2">
                School Selected
              </Badge>
            )}
          </div>
          {!selectedSchoolId && (
            <p className="text-sm text-amber-600 mt-2">⚠️ Please select a school to manage its data</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
          <CardDescription>Admin manages schools, roles, access, storage - NOT exams. They DO NOT see question papers or student marks.</CardDescription>
        </CardHeader>
      </Card>

      {/* PROMINENT EXAM CONFIGURATION CARD */}
      <Card className="border-2 border-primary/40 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Exam Configuration (Governance)</h3>
                <p className="text-sm text-muted-foreground">
                  Create & manage wing-wise exams. Appears in HOD Blueprint & Mock Tests.
                </p>
              </div>
            </div>
            <CoinButton 
              color="gold" 
              onClick={() => navigate("/admin/exams")} 
              data-testid="btn-exam-config-main"
              className="px-6"
            >
              <FileText className="w-5 h-5 mr-2" />
              Open Exam Configuration
            </CoinButton>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="schools">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="schools" data-testid="tab-schools">Schools</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">Role Access</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="schools">
          <Card>
            <CardHeader>
              <CardTitle>Manage Schools (Tenants)</CardTitle>
            </CardHeader>
            <CardContent>
              <CoinButton color="green" icon={<Plus className="w-5 h-5" />} onClick={() => navigate("/admin/tenants")} className="mb-4" data-testid="button-add-school">
                Add New School
              </CoinButton>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No schools configured yet</TableCell>
                    </TableRow>
                  ) : (
                    schools.map((s, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.code}</TableCell>
                        <TableCell>{s.principal}</TableCell>
                        <TableCell><Badge variant="default">{s.status}</Badge></TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => toast({ title: "Coming Soon", description: "School editing will be available soon." })} data-testid={`button-edit-school-${idx}`}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => toast({ title: "Coming Soon", description: "School locking will be available soon." })} data-testid={`button-lock-school-${idx}`}>Lock</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Manage Users (Role-wise creation)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <CoinButton color="gold" icon={<Upload className="w-5 h-5" />} onClick={() => navigate("/bulk-upload")} data-testid="button-bulk-upload-users">
                  Bulk Upload Users
                </CoinButton>
                <CoinButton color="green" icon={<Plus className="w-5 h-5" />} onClick={() => navigate("/admin/users")} data-testid="button-add-single-user">
                  Add Single User
                </CoinButton>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium">Bulk Upload Instructions</h4>
                <p className="text-sm text-muted-foreground">Columns must be EXACTLY:</p>
                <p className="text-sm font-mono bg-background p-2 rounded">UserID | Name | Role | Department | Class | Section | Parent Name | Password | Status</p>
                <p className="text-xs text-muted-foreground mt-1">Note: For students, Parent Name is the father's or mother's name for linking.</p>
                <div className="flex gap-4">
                  <Button variant="outline" size="sm" disabled title="Template download coming soon" data-testid="button-download-template">Download Sample Template</Button>
                  <Button size="sm" disabled title="Upload coming soon" data-testid="button-upload-users">Upload</Button>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-4">
                <h4 className="font-medium">Single User Creation</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select>
                      <SelectTrigger data-testid="select-user-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="hod">HOD</SelectItem>
                        <SelectItem value="principal">Principal</SelectItem>
                        <SelectItem value="committee">Committee</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input placeholder="Full name" data-testid="input-user-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <Input placeholder="Unique ID" data-testid="input-user-id" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" placeholder="Password" data-testid="input-user-password" />
                  </div>
                </div>
                <CoinButton color="blue" onClick={() => toast({ title: "Coming Soon", description: "User creation will be available soon." })} data-testid="button-create-user">Create User</CoinButton>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Teacher Upload (Separate Form)</CardTitle>
              <CardDescription>Add teachers with subject and wing assignments. This ensures proper routing to the correct HOD.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium">Bulk Teacher Upload</h4>
                <p className="text-sm text-muted-foreground">CSV columns:</p>
                <p className="text-sm font-mono bg-background p-2 rounded">Name | UserID | Password | Role | Subject | Wing | Contact | Status</p>
                <div className="flex gap-4 mt-3">
                  <Button variant="outline" size="sm" disabled title="Template download coming soon" data-testid="button-download-teacher-template">Download Template</Button>
                  <CoinButton color="gold" icon={<Upload className="w-5 h-5" />} disabled title="CSV upload coming soon" data-testid="button-upload-teachers-csv">Upload CSV</CoinButton>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-4">
                <h4 className="font-medium">Add Single Teacher</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input placeholder="Full name" data-testid="input-teacher-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>User ID *</Label>
                    <Input placeholder="e.g., TCH001" data-testid="input-teacher-userid" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input type="password" placeholder="Password" data-testid="input-teacher-password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <div className="p-3 bg-background rounded-md font-medium border text-sm">Teacher</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Select>
                      <SelectTrigger data-testid="select-teacher-subject"><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {adminSubjects.map(subject => (
                          <SelectItem key={subject} value={subject.toLowerCase().replace(/\s+/g, '-')}>{subject}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Wing *</Label>
                    <Select>
                      <SelectTrigger data-testid="select-teacher-wing"><SelectValue placeholder="Select wing" /></SelectTrigger>
                      <SelectContent>
                        {adminWings.map(wing => (
                          <SelectItem key={wing} value={wing.toLowerCase().replace(/\s+/g, '-')}>{wing}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <Input placeholder="+91 9876543210" data-testid="input-teacher-contact" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="teacher@school.com" data-testid="input-teacher-email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select>
                      <SelectTrigger data-testid="select-teacher-status"><SelectValue placeholder="Active" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="onleave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CoinButton color="green" icon={<Plus className="w-5 h-5" />} onClick={() => toast({ title: "Coming Soon", description: "Teacher creation will be available soon." })} data-testid="button-create-teacher">Add Teacher</CoinButton>
              </div>

              <p className="text-xs text-muted-foreground">
                Teachers are automatically assigned to their respective HODs based on Subject + Wing combination.
                For example, a Primary English teacher will be under the Primary English HOD.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Role Permission Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolePermissions.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell><strong>{r.role}</strong></TableCell>
                      <TableCell>{r.permissions}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled title="Permission editing coming soon" data-testid={`button-edit-role-${idx}`}>Edit Permissions</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Workflow Settings</CardTitle>
              <CardDescription>Admin decides workflow mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center gap-4">
                  <input type="radio" name="workflow" id="standard" defaultChecked data-testid="radio-standard-mode" />
                  <Label htmlFor="standard" className="flex-1">
                    <strong>STANDARD MODE:</strong> Teacher &gt; HOD &gt; Exam Committee (Principal MONITORS only)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-8">This is the recommended workflow. Principal views papers but does not approve - approval flows directly from HOD to Committee.</p>
              </div>
              <CoinButton color="blue" onClick={() => toast({ title: "Coming Soon", description: "Workflow settings will be available soon." })} data-testid="button-save-workflow">Save Workflow Settings</CoinButton>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Data Governance</CardTitle>
              <CardDescription>Manage academic years, exam frameworks, and blueprint governance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <CoinButton color="blue" onClick={() => navigate("/admin/academic-years")} data-testid="button-academic-years" className="w-full justify-start">
                  <Calendar className="w-5 h-5 mr-2" />
                  Academic Years
                </CoinButton>
                <CoinButton color="gold" onClick={() => navigate("/admin/exams")} data-testid="button-exam-config" className="w-full justify-start">
                  <FileText className="w-5 h-5 mr-2" />
                  Exam Configuration
                </CoinButton>
                <CoinButton color="green" onClick={() => navigate("/admin/blueprint-governance")} data-testid="button-blueprint-governance" className="w-full justify-start">
                  <Lock className="w-5 h-5 mr-2" />
                  Blueprint Governance
                </CoinButton>
                <CoinButton color="purple" onClick={() => navigate("/admin/storage")} data-testid="button-storage-governance" className="w-full justify-start">
                  <Building2 className="w-5 h-5 mr-2" />
                  Storage Governance
                </CoinButton>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Timer Defaults</Label>
                  <Select>
                    <SelectTrigger data-testid="select-timer-default"><SelectValue placeholder="90 min" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90 min</SelectItem>
                      <SelectItem value="180">180 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Enable Mock Exams</Label>
                  <Select>
                    <SelectTrigger data-testid="select-mock-exams"><SelectValue placeholder="Yes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Allow Long Answer</Label>
                  <Select>
                    <SelectTrigger data-testid="select-long-answer"><SelectValue placeholder="Yes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Auto Save Interval</Label>
                  <Input value="30 sec (fixed)" disabled data-testid="input-auto-save" />
                </div>
              </div>
              <CoinButton color="green" onClick={() => toast({ title: "Coming Soon", description: "Settings saving will be available soon." })} data-testid="button-save-settings">Save Settings</CoinButton>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span>Wing-wise Language Settings</span>
                <Dialog open={addLanguageOpen} onOpenChange={setAddLanguageOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="button-add-language">
                      <Plus className="w-4 h-4 mr-1" /> Add Language
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Language</DialogTitle>
                      <DialogDescription>Add a custom language option for your school</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Language Name</Label>
                        <Input 
                          placeholder="e.g., Telugu, Kannada, German" 
                          value={newLanguage}
                          onChange={(e) => setNewLanguage(e.target.value)}
                          data-testid="input-new-language"
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Current languages: {availableLanguages.join(", ")}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddLanguageOpen(false)} data-testid="button-cancel-add-language">Cancel</Button>
                      <CoinButton color="green" onClick={handleAddLanguage} data-testid="button-confirm-add-language">Add Language</CoinButton>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                Configure available language options per wing. All 4 default languages can be offered as both 2nd and 3rd language. 
                Students choose their own combination (e.g., Tamil as 2nd, Sanskrit as 3rd) - they cannot pick the same language for both.
                Use Add Language to add custom languages for your school.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-accent/20 rounded-md text-sm text-muted-foreground mb-2">
                Students in grades 1-8 (expandable to 1-12) select their languages during enrollment. 
                Each language can be chosen as either 2nd or 3rd language - but students cannot pick the same language for both.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminWings.map((wing) => (
                  <div key={wing} className="p-4 bg-muted rounded-lg space-y-3">
                    <h4 className="font-medium">{wing} Wing</h4>
                    <Label className="text-sm">Available Languages (can be 2nd or 3rd)</Label>
                    <div className="flex flex-wrap gap-3">
                      {availableLanguages.map(lang => {
                        const isEnabled = wingLanguagePools[wing]?.availableLanguages?.includes(lang) ?? true;
                        return (
                          <div key={lang} className="flex items-center gap-2">
                            <Checkbox 
                              id={`${wing}-${lang}`}
                              checked={isEnabled}
                              onCheckedChange={() => toggleLanguageForWing(wing, lang)}
                              data-testid={`checkbox-${wing.toLowerCase().replace(/\s+/g, "-")}-${lang.toLowerCase()}`}
                            />
                            <label htmlFor={`${wing}-${lang}`} className="text-sm cursor-pointer">{lang}</label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(wingLanguagePools[wing]?.availableLanguages?.length || 0)} of {availableLanguages.length} languages enabled
                    </p>
                  </div>
                ))}
              </div>
              <CoinButton color="blue" onClick={() => toast({ title: "Coming Soon", description: "Language settings saving will be available soon." })} data-testid="button-save-languages">Save Language Settings</CoinButton>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Exam Schedule Upload</CardTitle>
              <CardDescription>Upload official exam schedule (PDF recommended for authenticity)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <p className="text-sm text-muted-foreground">Upload exam schedule with official signatories. PDF format is recommended as it maintains document authenticity.</p>
                <div className="flex gap-4">
                  <CoinButton color="blue" icon={<Upload className="w-5 h-5" />} disabled title="Schedule upload coming soon" data-testid="button-upload-schedule-pdf">
                    Upload PDF Schedule
                  </CoinButton>
                  <CoinButton color="teal" icon={<FileText className="w-5 h-5" />} disabled title="Schedule upload coming soon" data-testid="button-upload-schedule-word">
                    Upload Word Document
                  </CoinButton>
                </div>
                <p className="text-xs text-muted-foreground">Supported: PDF (preferred), DOCX. Maximum file size: 10MB</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Storage Configuration (S3/Cloud)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Storage Provider</Label>
                  <Select>
                    <SelectTrigger data-testid="select-storage-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">AWS S3</SelectItem>
                      <SelectItem value="do">DigitalOcean Spaces</SelectItem>
                      <SelectItem value="firebase">Firebase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bucket Name</Label>
                  <Input placeholder="bucket-name" data-testid="input-bucket-name" />
                </div>
                <div className="space-y-2">
                  <Label>Access Key</Label>
                  <Input type="password" placeholder="Access key" data-testid="input-access-key" />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input type="password" placeholder="Secret key" data-testid="input-secret-key" />
                </div>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" disabled title="Storage configuration coming soon" data-testid="button-test-connection">Test Connection</Button>
                <CoinButton color="blue" disabled title="Storage configuration coming soon" data-testid="button-save-storage">Save</CoinButton>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Security & Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Input type="date" className="w-40" data-testid="input-audit-date" />
                <Select>
                  <SelectTrigger className="w-40" data-testid="select-audit-user"><SelectValue placeholder="User Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="hod">HOD</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="w-40" data-testid="select-audit-action"><SelectValue placeholder="Action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="upload">Upload</SelectItem>
                    <SelectItem value="generate">Generate</SelectItem>
                    <SelectItem value="approve">Approve</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Who</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit logs recorded yet</TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{log.who}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.module}</TableCell>
                        <TableCell>{log.time}</TableCell>
                        <TableCell>{log.ip}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
