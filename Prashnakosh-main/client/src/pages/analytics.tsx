import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, TrendingUp, Users, BookOpen, FileQuestion,
  BarChart2, Download, Filter, Info
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

interface AnalyticsData {
  totalStudents: number;
  totalQuestions: number;
  totalTests: number;
  averageScore: number;
  subjectPerformance: Array<{ subject: string; avgScore: number; attempts: number }>;
  recentActivity: Array<{ date: string; tests: number; avgScore: number }>;
}

const COLORS = ['#708238', '#5B9BD5', '#FF6B6B', '#FFD93D', '#6BCB77', '#845EC2'];

export default function AnalyticsPage() {
  const [, navigate] = useLocation();
  const [timeRange, setTimeRange] = useState("7d");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", timeRange],
  });

  const handleExportCSV = async () => {
    try {
      const response = await fetch("/api/export/analytics-csv");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "analytics_report.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleExportClassResults = async () => {
    try {
      const response = await fetch("/api/export/class-results-csv");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "class_results.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <PageContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const stats = analytics || {
    totalStudents: 0,
    totalQuestions: 0,
    totalTests: 0,
    averageScore: 0,
    subjectPerformance: [],
    recentActivity: [],
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Performance insights and statistics
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[120px]" data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExportCSV} variant="outline" data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-2" />
              Student Results
            </Button>
            <Button onClick={handleExportClassResults} variant="outline" data-testid="button-export-class-csv">
              <Download className="w-4 h-4 mr-2" />
              Class Summary
            </Button>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold" data-testid="text-total-students">{stats.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tests</p>
                  <p className="text-2xl font-bold" data-testid="text-total-tests">{stats.totalTests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-950">
                  <FileQuestion className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Questions</p>
                  <p className="text-2xl font-bold" data-testid="text-total-questions">{stats.totalQuestions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-950">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                  <p className="text-2xl font-bold" data-testid="text-average-score">{stats.averageScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-5 h-5" />
                Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {stats.subjectPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.subjectPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="avgScore" fill="#708238" name="Average Score" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No subject performance data yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Recent Activity (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {stats.recentActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.recentActivity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="avgScore"
                        stroke="#708238"
                        strokeWidth={2}
                        dot={{ fill: "#708238" }}
                        name="Avg Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No recent activity data
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Test Distribution by Subject</CardTitle>
                <CardDescription>Number of attempts per subject</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {stats.subjectPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.subjectPerformance}
                        dataKey="attempts"
                        nameKey="subject"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ subject, percent }) => `${subject}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {stats.subjectPerformance.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <ContentCard>
            <h3 className="text-lg font-semibold mb-4">Subject Breakdown</h3>
            {stats.subjectPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Subject</th>
                      <th className="text-right py-3 px-4">Average Score</th>
                      <th className="text-right py-3 px-4">Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.subjectPerformance.map((subject, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-3 px-4 font-medium">{subject.subject}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={subject.avgScore >= 70 ? "text-green-600" : subject.avgScore >= 50 ? "text-amber-600" : "text-red-600"}>
                            {subject.avgScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">{subject.attempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Complete some tests to see subject performance data
              </div>
            )}
          </ContentCard>
        </div>
      </PageContent>
    </PageLayout>
  );
}
