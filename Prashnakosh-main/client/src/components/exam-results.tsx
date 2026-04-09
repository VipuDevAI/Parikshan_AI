import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, CheckCircle, XCircle, Clock, ArrowLeft, Download,
  TrendingUp, TrendingDown, Minus, BookOpen, Target, Lightbulb, ArrowRight
} from "lucide-react";

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

interface ExamResultsProps {
  testTitle: string;
  subject: string;
  score: number;
  totalMarks: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  timeTaken?: number;
  attemptId: string;
  questionAnalysis?: QuestionAnalysis[];
  onBack: () => void;
  onDownloadPdf?: () => void;
  onPractice?: (chapter?: string, topic?: string) => void;
}

export function ExamResults({
  testTitle,
  subject,
  score,
  totalMarks,
  percentage,
  correctCount,
  incorrectCount,
  unansweredCount,
  totalQuestions,
  timeTaken,
  attemptId,
  questionAnalysis = [],
  onBack,
  onDownloadPdf,
  onPractice,
}: ExamResultsProps) {
  const [activeTab, setActiveTab] = useState("summary");

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const getGrade = (pct: number) => {
    if (pct >= 90) return { grade: "A+", color: "text-green-600", bg: "bg-green-100 dark:bg-green-950" };
    if (pct >= 80) return { grade: "A", color: "text-green-600", bg: "bg-green-100 dark:bg-green-950" };
    if (pct >= 70) return { grade: "B+", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" };
    if (pct >= 60) return { grade: "B", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" };
    if (pct >= 50) return { grade: "C", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" };
    if (pct >= 40) return { grade: "D", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950" };
    return { grade: "F", color: "text-red-600", bg: "bg-red-100 dark:bg-red-950" };
  };

  const topicStats: Record<string, { correct: number; total: number; chapter: string }> = {};
  questionAnalysis.forEach(q => {
    const key = q.topic || q.chapter || "General";
    if (!topicStats[key]) {
      topicStats[key] = { correct: 0, total: 0, chapter: q.chapter };
    }
    topicStats[key].total++;
    if (q.isCorrect) topicStats[key].correct++;
  });

  const topicPerformance = Object.entries(topicStats).map(([topic, stats]) => ({
    topic,
    chapter: stats.chapter,
    correct: stats.correct,
    total: stats.total,
    percentage: Math.round((stats.correct / stats.total) * 100),
  }));

  const strengths = topicPerformance.filter(t => t.percentage >= 70).sort((a, b) => b.percentage - a.percentage);
  const improvements = topicPerformance.filter(t => t.percentage < 70).sort((a, b) => a.percentage - b.percentage);

  const gradeInfo = getGrade(percentage);
  const isPassing = percentage >= 40;

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy": return "outline";
      case "medium": return "secondary";
      case "hard": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${gradeInfo.bg} mb-3`}>
            <span className={`text-3xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</span>
          </div>
          <h1 className="text-xl font-bold mb-1">{testTitle}</h1>
          <Badge variant="outline" className="mb-2">{subject}</Badge>
          <p className={`text-base ${isPassing ? "text-green-600" : "text-red-600"}`}>
            {isPassing ? "Congratulations! You passed!" : "Keep practicing to improve!"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" data-testid="tab-summary">
              <Trophy className="w-4 h-4 mr-2" />
              Score
            </TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">
              <Target className="w-4 h-4 mr-2" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="review" data-testid="tab-review">
              <CheckCircle className="w-4 h-4 mr-2" />
              Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Your Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="text-5xl font-bold mb-2">
                    {score} <span className="text-2xl text-muted-foreground">/ {totalMarks}</span>
                  </div>
                  <Progress value={percentage} className="h-3 mt-4" />
                  <p className="text-lg font-medium mt-2">{percentage.toFixed(1)}%</p>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Correct</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">{correctCount}</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-muted-foreground">Incorrect</span>
                    </div>
                    <span className="text-2xl font-bold text-red-600">{incorrectCount}</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Minus className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-muted-foreground">Skipped</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-500">{unansweredCount}</span>
                  </div>
                </div>

                {timeTaken && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Time Taken</span>
                      </div>
                      <span className="font-medium">{formatTime(timeTaken)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Performance by Topic
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2 text-green-600">
                      <TrendingUp className="w-4 h-4" />
                      What You Did Well ({strengths.length})
                    </h4>
                    {strengths.length > 0 ? (
                      <ul className="space-y-2">
                        {strengths.slice(0, 5).map((topic, i) => (
                          <li key={i} className="flex items-center justify-between p-2 rounded-md bg-green-50 dark:bg-green-950/30">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium">{topic.topic}</span>
                            </div>
                            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              {topic.correct}/{topic.total}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-sm">Keep practicing to build your strengths!</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2 text-amber-600">
                      <TrendingDown className="w-4 h-4" />
                      Areas to Improve ({improvements.length})
                    </h4>
                    {improvements.length > 0 ? (
                      <ul className="space-y-2">
                        {improvements.slice(0, 5).map((topic, i) => (
                          <li key={i} className="flex items-center justify-between p-2 rounded-md bg-amber-50 dark:bg-amber-950/30">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-sm font-medium">{topic.topic}</span>
                            </div>
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                              {topic.correct}/{topic.total}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-sm">Great job! You&apos;re doing well in all topics!</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Practice Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {improvements.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Focus on these areas to improve your score:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {improvements.slice(0, 4).map((topic, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="justify-between h-auto py-3"
                          onClick={() => onPractice?.(topic.chapter, topic.topic)}
                          data-testid={`button-practice-${i}`}
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{topic.topic}</span>
                          </div>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="w-full mt-4"
                      onClick={() => onPractice?.()}
                      data-testid="button-start-practice"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Start Practice Session
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <p className="font-medium text-green-600 mb-2">Excellent Performance!</p>
                    <p className="text-muted-foreground mb-4">
                      You&apos;ve mastered the content. Try challenging yourself with harder questions.
                    </p>
                    <Button onClick={() => onPractice?.()} data-testid="button-advanced-practice">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Try Advanced Practice
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Question Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {correctCount} Correct
                  </Badge>
                  <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    <XCircle className="w-3 h-3 mr-1" />
                    {incorrectCount} Incorrect
                  </Badge>
                </div>

                {questionAnalysis.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {questionAnalysis.map((q, i) => (
                      <div
                        key={q.id}
                        className={`p-3 rounded-md border ${
                          q.isCorrect 
                            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" 
                            : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                        }`}
                        data-testid={`question-review-${i}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {q.isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium">Q{i + 1}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={getDifficultyVariant(q.difficulty)}>
                              {q.difficulty}
                            </Badge>
                            <Badge variant="outline">{q.topic || q.chapter}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{q.content}</p>
                        {!q.isCorrect && (
                          <div className="text-xs space-y-1 pt-2 border-t">
                            <p className="text-red-600">
                              <span className="font-medium">Your answer:</span> {q.userAnswer || "Not answered"}
                            </p>
                            <p className="text-green-600">
                              <span className="font-medium">Correct answer:</span> {q.correctAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Detailed question review is not available for this test.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-4">
          <Button variant="outline" onClick={onBack} className="flex-1" data-testid="button-back-results">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tests
          </Button>
          {onDownloadPdf && (
            <Button onClick={onDownloadPdf} className="flex-1" data-testid="button-download-pdf">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
