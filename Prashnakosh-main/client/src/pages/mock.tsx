import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ExamEngine } from "@/components/exam-engine";
import { ExamResults } from "@/components/exam-results";
import {
  ArrowLeft, Clock, FileText, PlayCircle, Trophy, Users, BookOpen, GraduationCap
} from "lucide-react";
import type { Question, Test } from "@shared/schema";

type MockState = "select" | "exam" | "complete";

interface ExamQuestion extends Question {
  passageText?: string | null;
}

interface StartExamResponse {
  attempt: {
    id: string;
    testId: string;
    studentId: string;
    status: string;
    assignedQuestionIds: string[];
    timeRemaining: number | null;
    answers: Record<string, string> | null;
    questionStatuses: Record<string, string> | null;
    markedForReview: string[] | null;
  };
  questions: ExamQuestion[];
  test: Test;
}

interface ExamResultsData {
  score: number;
  total: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  answers?: Record<string, string>;
}

interface QuestionAnalysis {
  id: string;
  content: string;
  topic: string;
  chapter: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  difficulty: string;
  bloomLevel: string;
}

interface MockExamConfig {
  id: string;
  wing: string;
  examName: string;
  totalMarks: number;
  durationMinutes: number;
  examType: string;
  allowMockTest: boolean;
}

const wingLabels: Record<string, string> = {
  primary: "Primary (1-5)",
  middle: "Middle (6-8)",
  secondary: "Secondary (9-10)",
  senior_secondary: "Senior Secondary (11-12)",
};

export default function MockPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [state, setState] = useState<MockState>("select");
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [attemptId, setAttemptId] = useState<string>("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [initialData, setInitialData] = useState<{
    answers?: Record<string, string>;
    statuses?: Record<string, any>;
    markedForReview?: string[];
    timeRemaining?: number;
  }>({});
  const [results, setResults] = useState<ExamResultsData | null>(null);
  const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis[]>([]);

  // Existing tests available for mock
  const { data: availableTests = [], isLoading } = useQuery<Test[]>({
    queryKey: ["/api/mock/available"],
  });

  // Mock exam configs (exams with allowMockTest=true from Super Admin)
  const { data: mockExamConfigs = [] } = useQuery<MockExamConfig[]>({
    queryKey: ["/api/exams/mock-tests"],
    queryFn: async () => {
      const response = await fetch('/api/exams/mock-tests', {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const startMutation = useMutation({
    mutationFn: async (): Promise<StartExamResponse> => {
      const response = await apiRequest("POST", "/api/mock/start", {
        testId: selectedTest?.id,
      });
      return response.json();
    },
    onSuccess: (data: StartExamResponse) => {
      setAttemptId(data.attempt.id);
      setQuestions(data.questions);
      setInitialData({
        answers: data.attempt.answers || {},
        statuses: data.attempt.questionStatuses || {},
        markedForReview: data.attempt.markedForReview || [],
        timeRemaining: data.attempt.timeRemaining || undefined,
      });
      setState("exam");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleStartExam = () => {
    if (!selectedTest) {
      toast({ title: "Select a test", description: "Please select a test to begin", variant: "destructive" });
      return;
    }
    startMutation.mutate();
  };

  const handleExamComplete = (examResults: ExamResultsData) => {
    setResults(examResults);
    
    const analysis: QuestionAnalysis[] = questions.map(q => {
      const userAnswer = examResults.answers?.[q.id] || "";
      const correctAnswer = q.correctAnswer || "";
      const isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      return {
        id: q.id,
        content: q.content,
        topic: q.topic || "",
        chapter: q.chapter || "",
        isCorrect,
        userAnswer,
        correctAnswer,
        difficulty: q.difficulty || "medium",
        bloomLevel: q.bloomLevel || "",
      };
    });
    setQuestionAnalysis(analysis);
    setState("complete");
  };

  const handlePractice = (chapter?: string, topic?: string) => {
    const params = new URLSearchParams();
    if (selectedTest?.subject) params.set("subject", selectedTest.subject);
    if (chapter) params.set("chapter", chapter);
    if (topic) params.set("topic", topic);
    navigate(`/practice?${params.toString()}`);
  };

  const handleExitExam = () => {
    setState("select");
    setSelectedTest(null);
    setQuestions([]);
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await fetch(`/api/reports/pdf/${attemptId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exam-report-${attemptId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Error", description: "Failed to download report", variant: "destructive" });
    }
  };

  if (state === "exam" && selectedTest && questions.length > 0) {
    return (
      <ExamEngine
        test={selectedTest}
        questions={questions}
        attemptId={attemptId}
        initialAnswers={initialData.answers}
        initialStatuses={initialData.statuses}
        initialMarkedForReview={initialData.markedForReview}
        initialTimeRemaining={initialData.timeRemaining}
        onComplete={handleExamComplete}
        onExit={handleExitExam}
      />
    );
  }

  if (state === "complete" && results && selectedTest) {
    return (
      <ExamResults
        testTitle={selectedTest.title}
        subject={selectedTest.subject}
        score={results.score}
        totalMarks={results.total}
        percentage={results.percentage}
        correctCount={results.correctCount}
        incorrectCount={results.incorrectCount}
        unansweredCount={results.unansweredCount}
        totalQuestions={questions.length}
        attemptId={attemptId}
        questionAnalysis={questionAnalysis}
        onBack={handleExitExam}
        onDownloadPdf={handleDownloadPdf}
        onPractice={handlePractice}
      />
    );
  }

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
          <div>
            <h1 className="text-xl font-bold">Mock Exam</h1>
            <p className="text-sm text-muted-foreground">
              Timed exam simulation with question navigator
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="max-w-3xl mx-auto">
          {/* Mock Exam Configs (from Super Admin) */}
          {mockExamConfigs.length > 0 && (
            <Card className="mb-6 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  Available Mock Exams
                </CardTitle>
                <CardDescription>
                  Official mock exams configured by administration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {mockExamConfigs.map((exam) => (
                    <Card key={exam.id} className="bg-background">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{exam.examName}</h4>
                            <Badge variant="outline" className="mt-1">
                              {wingLabels[exam.wing] || exam.wing}
                            </Badge>
                          </div>
                          <Badge variant="secondary">{exam.examType}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {exam.durationMinutes}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {exam.totalMarks} marks
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  These exams appear automatically when Super Admin enables &quot;Allow Mock Test&quot;
                </p>
              </CardContent>
            </Card>
          )}

          <ContentCard title="Available Mock Tests">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Loading available tests...</p>
              </div>
            ) : availableTests.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No mock tests available</h3>
                <p className="text-muted-foreground mb-6">
                  Check back later for new mock tests
                </p>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Back to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {availableTests.map((test) => (
                  <Card
                    key={test.id}
                    className={`cursor-pointer transition-all ${
                      selectedTest?.id === test.id
                        ? "ring-2 ring-primary border-primary"
                        : "hover-elevate"
                    }`}
                    onClick={() => setSelectedTest(test)}
                    data-testid={`card-test-${test.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{test.title}</h3>
                            <Badge variant="secondary">{test.subject}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Mock examination for practice
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4" />
                              <span>{test.questionCount || 0} Questions</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{test.duration || 60} Minutes</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Trophy className="w-4 h-4" />
                              <span>{test.totalMarks || 0} Marks</span>
                            </div>
                          </div>
                        </div>
                        {selectedTest?.id === test.id && (
                          <Badge className="bg-green-600">Selected</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="pt-4 border-t">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {selectedTest ? (
                        <span>
                          Ready to start <strong>{selectedTest.title}</strong>
                        </span>
                      ) : (
                        <span>Select a test to begin</span>
                      )}
                    </div>
                    <CoinButton
                      color="blue"
                      onClick={handleStartExam}
                      disabled={!selectedTest || startMutation.isPending}
                      data-testid="button-start-exam"
                    >
                      <PlayCircle className="w-5 h-5 mr-2" />
                      {startMutation.isPending ? "Starting..." : "Start Exam"}
                    </CoinButton>
                  </div>
                </div>
              </div>
            )}
          </ContentCard>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Exam Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">1</div>
                <p><strong>Gray dots</strong> indicate questions you haven't visited yet.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">2</div>
                <p><strong>Blue dots</strong> show questions you've answered.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs">3</div>
                <p><strong>Purple dots</strong> are questions marked for review.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">4</div>
                <p><strong>Red dots</strong> show visited but unanswered questions.</p>
              </div>
              <div className="pt-2 border-t mt-4">
                <p>Your progress is automatically saved every 30 seconds. If you close the browser, you can resume from where you left off.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </PageLayout>
  );
}
