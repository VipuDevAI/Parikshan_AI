import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader, PageContent, ContentCard, GridContainer } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Download, Send, TrendingUp, TrendingDown, Minus,
  BarChart3, Award, Target, BookOpen
} from "lucide-react";
import type { Attempt } from "@shared/schema";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface ReportData {
  attempts: Attempt[];
  summary: {
    totalTests: number;
    averageScore: number;
    bestScore: number;
    trend: "up" | "down" | "stable";
  };
  topicAccuracy: {
    topic: string;
    accuracy: number;
    attempted: number;
  }[];
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const { data: students = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/users/students"],
    enabled: isTeacher,
  });

  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", selectedStudent || user?.id],
  });

  const downloadMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      const response = await fetch(`/api/reports/pdf/${attemptId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("safal_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to download");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${attemptId}.pdf`;
      a.click();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendToParentMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      return apiRequest("POST", "/api/notifications/send", {
        type: "report",
        attemptId,
      });
    },
    onSuccess: () => {
      toast({ title: "Report sent to parent" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const TrendIcon = reportData?.summary.trend === "up" ? TrendingUp :
    reportData?.summary.trend === "down" ? TrendingDown : Minus;
  const trendColor = reportData?.summary.trend === "up" ? "text-green-600" :
    reportData?.summary.trend === "down" ? "text-red-600" : "text-gray-600";

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Reports</h1>
            <p className="text-sm text-muted-foreground">
              Performance analytics and reports
            </p>
          </div>
          {isTeacher && students.length > 0 && (
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-48 bg-card" data-testid="select-student">
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </PageHeader>

      <PageContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !reportData ? (
          <ContentCard>
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No reports available</h3>
              <p className="text-muted-foreground">
                Complete some tests to see your performance reports
              </p>
            </div>
          </ContentCard>
        ) : (
          <>
            <GridContainer cols={4} className="mb-6">
              <ContentCard className="text-center">
                <Target className="w-8 h-8 mx-auto mb-2 text-coin-blue" />
                <p className="text-3xl font-bold">{reportData.summary.totalTests}</p>
                <p className="text-sm text-muted-foreground">Tests Taken</p>
              </ContentCard>
              <ContentCard className="text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-coin-indigo" />
                <p className="text-3xl font-bold">{reportData.summary.averageScore}%</p>
                <p className="text-sm text-muted-foreground">Average Score</p>
              </ContentCard>
              <ContentCard className="text-center">
                <Award className="w-8 h-8 mx-auto mb-2 text-coin-gold" />
                <p className="text-3xl font-bold">{reportData.summary.bestScore}%</p>
                <p className="text-sm text-muted-foreground">Best Score</p>
              </ContentCard>
              <ContentCard className="text-center">
                <TrendIcon className={`w-8 h-8 mx-auto mb-2 ${trendColor}`} />
                <p className="text-3xl font-bold capitalize">{reportData.summary.trend}</p>
                <p className="text-sm text-muted-foreground">Trend</p>
              </ContentCard>
            </GridContainer>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ContentCard title="Topic-wise Accuracy">
                {reportData.topicAccuracy.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No topic data available</p>
                ) : (
                  <div className="space-y-4 mt-4">
                    {reportData.topicAccuracy.map((topic) => (
                      <div key={topic.topic}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{topic.topic}</span>
                          <span className="text-sm text-muted-foreground">
                            {topic.accuracy}% ({topic.attempted} Qs)
                          </span>
                        </div>
                        <Progress
                          value={topic.accuracy}
                          className={`h-2 ${
                            topic.accuracy >= 80 ? "[&>div]:bg-green-500" :
                            topic.accuracy >= 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ContentCard>

              <ContentCard title="Strengths & Weaknesses">
                <div className="space-y-4 mt-4">
                  <div>
                    <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Strong Areas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {reportData.topicAccuracy
                        .filter((t) => t.accuracy >= 70)
                        .slice(0, 5)
                        .map((topic) => (
                          <Badge key={topic.topic} className="bg-green-100 text-green-700">
                            {topic.topic}
                          </Badge>
                        ))}
                      {reportData.topicAccuracy.filter((t) => t.accuracy >= 70).length === 0 && (
                        <p className="text-sm text-muted-foreground">Keep practicing!</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4" />
                      Needs Improvement
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {reportData.topicAccuracy
                        .filter((t) => t.accuracy < 50)
                        .slice(0, 5)
                        .map((topic) => (
                          <Badge key={topic.topic} className="bg-red-100 text-red-700">
                            {topic.topic}
                          </Badge>
                        ))}
                      {reportData.topicAccuracy.filter((t) => t.accuracy < 50).length === 0 && (
                        <p className="text-sm text-muted-foreground">Great work!</p>
                      )}
                    </div>
                  </div>
                </div>
              </ContentCard>
            </div>

            <ContentCard title="Test History">
              {reportData.attempts.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No test attempts yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.attempts.map((attempt) => {
                        const percentage = attempt.totalMarks
                          ? Math.round((attempt.score || 0) / attempt.totalMarks * 100)
                          : 0;
                        return (
                          <TableRow key={attempt.id}>
                            <TableCell className="font-medium">
                              Test #{attempt.testId.slice(-6)}
                            </TableCell>
                            <TableCell>
                              {attempt.submittedAt
                                ? new Date(attempt.submittedAt).toLocaleDateString()
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{attempt.score || 0}/{attempt.totalMarks}</span>
                                <Badge
                                  className={
                                    percentage >= 80 ? "bg-green-100 text-green-700" :
                                    percentage >= 50 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  }
                                >
                                  {percentage}%
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {attempt.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                <CoinButton
                                  color="blue"
                                  shape="square"
                                  icon={<Download className="w-4 h-4" />}
                                  onClick={() => downloadMutation.mutate(attempt.id)}
                                  isLoading={downloadMutation.isPending}
                                  data-testid={`button-download-${attempt.id}`}
                                />
                                {isTeacher && (
                                  <CoinButton
                                    color="green"
                                    shape="square"
                                    icon={<Send className="w-4 h-4" />}
                                    onClick={() => sendToParentMutation.mutate(attempt.id)}
                                    isLoading={sendToParentMutation.isPending}
                                    data-testid={`button-send-${attempt.id}`}
                                  />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ContentCard>
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}
