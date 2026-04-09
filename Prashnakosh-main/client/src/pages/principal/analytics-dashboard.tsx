import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, BookOpen, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import logoImg from "@/assets/logo.png";
interface SchoolSnapshot {
  totalStudents: number;
  testsThisMonth: number;
  averageScore: number;
  atRiskCount: number;
}

interface GradePerformance {
  grade: string;
  averageScore: number;
  passPercentage: number;
  totalAttempts: number;
  trend: 'up' | 'down' | 'stable';
}

interface SubjectHealth {
  subject: string;
  grade: string;
  averagePercentage: number;
  totalAttempts: number;
  isWeak: boolean;
}

interface AtRiskStudent {
  studentId: string;
  studentName: string;
  grade: string;
  lowScoreCount: number;
  averagePercentage: number;
  trend: 'declining' | 'stable' | 'improving';
}

interface RiskAlert {
  type: 'tab_switch' | 'absence' | 'sudden_drop';
  studentId: string;
  studentName: string;
  grade: string;
  details: string;
  count: number;
  createdAt: string | null;
}

export default function PrincipalAnalyticsDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedGrade, setSelectedGrade] = useState<string>("all");

  const { data: snapshot, isLoading: snapshotLoading } = useQuery<SchoolSnapshot>({
    queryKey: ['/api/principal/snapshot'],
  });

  const { data: gradePerformance = [], isLoading: gradeLoading } = useQuery<GradePerformance[]>({
    queryKey: ['/api/principal/grade-performance'],
  });

  const subjectHealthUrl = selectedGrade !== 'all' 
    ? `/api/principal/subject-health?grade=${encodeURIComponent(selectedGrade)}`
    : '/api/principal/subject-health';
  const { data: subjectHealth = [], isLoading: subjectLoading } = useQuery<SubjectHealth[]>({
    queryKey: [subjectHealthUrl],
  });

  const { data: atRiskStudents = [], isLoading: atRiskLoading } = useQuery<AtRiskStudent[]>({
    queryKey: ['/api/principal/at-risk-students'],
  });

  const { data: riskAlerts = [], isLoading: alertsLoading } = useQuery<RiskAlert[]>({
    queryKey: ['/api/principal/risk-alerts'],
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (!["principal", "super_admin"].includes(user.role)) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">Only principals can access this dashboard.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4" data-testid="button-return-dashboard">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const uniqueGrades = Array.from(new Set(gradePerformance.map(g => g.grade))).sort();

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | 'declining' | 'improving') => {
    switch (trend) {
      case 'up':
      case 'improving':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'down':
      case 'declining':
        return <ArrowDownRight className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAlertTypeColor = (type: RiskAlert['type']) => {
    switch (type) {
      case 'tab_switch':
        return "bg-coin-orange text-white";
      case 'absence':
        return "bg-coin-red text-white";
      case 'sudden_drop':
        return "bg-red-900 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getAlertTypeName = (type: RiskAlert['type']) => {
    switch (type) {
      case 'tab_switch':
        return "Tab Switching";
      case 'absence':
        return "Absences";
      case 'sudden_drop':
        return "Sudden Drop";
      default:
        return type;
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="School SAFAL" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">School Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">Read-only overview of school performance</p>
          </div>
        </div>
      </PageHeader>
      <PageContent>
        <Tabs defaultValue="snapshot" className="w-full">
          <TabsList className="mb-4" data-testid="tabs-analytics">
            <TabsTrigger value="snapshot" data-testid="tab-snapshot">Snapshot</TabsTrigger>
            <TabsTrigger value="grades" data-testid="tab-grades">By Grade</TabsTrigger>
            <TabsTrigger value="subjects" data-testid="tab-subjects">Subjects</TabsTrigger>
            <TabsTrigger value="at-risk" data-testid="tab-at-risk">At-Risk</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="snapshot">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="snapshot-cards">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-students">
                    {snapshotLoading ? "..." : snapshot?.totalStudents || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Enrolled in your school</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Tests This Month</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-tests-this-month">
                    {snapshotLoading ? "..." : snapshot?.testsThisMonth || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Based on completed attempts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-avg-score">
                    {snapshotLoading ? "..." : `${snapshot?.averageScore || 0}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">School-wide this month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">At-Risk Students</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-coin-red" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-coin-red" data-testid="text-at-risk-count">
                    {snapshotLoading ? "..." : snapshot?.atRiskCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">2+ scores below 40%</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="grades">
            <Card>
              <CardHeader>
                <CardTitle>Grade-wise Performance</CardTitle>
                <CardDescription>Average scores and pass rates by grade level</CardDescription>
              </CardHeader>
              <CardContent>
                {gradeLoading ? (
                  <p className="text-muted-foreground">Loading grade data...</p>
                ) : gradePerformance.length === 0 ? (
                  <p className="text-muted-foreground">No grade performance data available.</p>
                ) : (
                  <div className="space-y-4" data-testid="grade-performance-list">
                    {gradePerformance.map((grade) => (
                      <div key={grade.grade} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`grade-row-${grade.grade}`}>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{grade.grade}</Badge>
                          <div>
                            <p className="font-medium">Avg: {grade.averageScore}%</p>
                            <p className="text-sm text-muted-foreground">{grade.totalAttempts} attempts</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium text-green-600">{grade.passPercentage}% pass</p>
                          </div>
                          {getTrendIcon(grade.trend)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects">
            <Card>
              <CardHeader>
                <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle>Subject Health</CardTitle>
                    <CardDescription>Average performance by subject (weak subjects flagged)</CardDescription>
                  </div>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger className="w-32" data-testid="select-grade-filter">
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {uniqueGrades.map((grade) => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {subjectLoading ? (
                  <p className="text-muted-foreground">Loading subject data...</p>
                ) : subjectHealth.length === 0 ? (
                  <p className="text-muted-foreground">No subject data available.</p>
                ) : (
                  <div className="space-y-3" data-testid="subject-health-list">
                    {subjectHealth.map((subject, idx) => (
                      <div key={`${subject.subject}-${subject.grade}-${idx}`} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`subject-row-${idx}`}>
                        <div className="flex items-center gap-3">
                          <Badge variant={subject.isWeak ? "destructive" : "outline"}>
                            {subject.subject}
                          </Badge>
                          <Badge variant="secondary">{subject.grade}</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-medium ${subject.isWeak ? 'text-red-600' : 'text-green-600'}`}>
                            {subject.averagePercentage}%
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {subject.totalAttempts} attempts
                          </span>
                          {subject.isWeak && (
                            <AlertTriangle className="h-4 w-4 text-coin-red" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="at-risk">
            <Card>
              <CardHeader>
                <CardTitle>At-Risk Students</CardTitle>
                <CardDescription>Students with 2 or more attempts below 40%</CardDescription>
              </CardHeader>
              <CardContent>
                {atRiskLoading ? (
                  <p className="text-muted-foreground">Loading at-risk data...</p>
                ) : atRiskStudents.length === 0 ? (
                  <p className="text-muted-foreground text-green-600">No at-risk students identified.</p>
                ) : (
                  <div className="space-y-3" data-testid="at-risk-list">
                    {atRiskStudents.map((student) => (
                      <div key={student.studentId} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`at-risk-row-${student.studentId}`}>
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{student.studentName}</p>
                            <Badge variant="secondary">{student.grade}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-sm text-coin-red font-medium">{student.lowScoreCount} low scores</p>
                            <p className="text-sm text-muted-foreground">Avg: {student.averagePercentage}%</p>
                          </div>
                          {getTrendIcon(student.trend)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Risk Alerts</CardTitle>
                <CardDescription>Flagged behaviors: tab switches (3+), absences (2+), sudden drops</CardDescription>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <p className="text-muted-foreground">Loading alerts...</p>
                ) : riskAlerts.length === 0 ? (
                  <p className="text-muted-foreground text-green-600">No active risk alerts.</p>
                ) : (
                  <div className="space-y-3" data-testid="alerts-list">
                    {riskAlerts.map((alert, idx) => (
                      <div key={`${alert.type}-${alert.studentId}-${idx}`} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`alert-row-${idx}`}>
                        <div className="flex items-center gap-3">
                          <Badge className={getAlertTypeColor(alert.type)}>
                            {getAlertTypeName(alert.type)}
                          </Badge>
                          <div>
                            <p className="font-medium">{alert.studentName}</p>
                            <p className="text-sm text-muted-foreground">{alert.grade}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{alert.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContent>
      <PageFooter />
    </PageLayout>
  );
}
