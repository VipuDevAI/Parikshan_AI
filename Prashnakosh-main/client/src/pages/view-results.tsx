import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Award, BarChart3, BookOpen, CheckCircle, Clock, Download, Eye, FileText, TrendingUp, XCircle } from "lucide-react";
import logoImg from "@/assets/logo.png";

interface Result {
  id: string;
  testId: string;
  testName: string;
  subject: string;
  classLevel: string;
  examDate: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  rank: number | null;
  totalStudents: number;
  status: string;
  answers: ResultAnswer[];
}

interface ResultAnswer {
  questionId: string;
  questionNumber: number;
  questionText: string;
  questionType: string;
  maxMarks: number;
  marksObtained: number;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

export default function ViewResultsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

  const { data: results = [], isLoading } = useQuery<Result[]>({
    queryKey: ['/api/results'],
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'A+': 'bg-coin-green text-white',
      'A': 'bg-coin-green text-white',
      'B+': 'bg-coin-blue text-white',
      'B': 'bg-coin-blue text-white',
      'C+': 'bg-coin-orange text-white',
      'C': 'bg-coin-orange text-white',
      'D': 'bg-coin-red text-white',
      'F': 'bg-coin-red text-white',
    };
    return colors[grade] || 'bg-muted';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">View Results</h1>
            <p className="text-sm text-muted-foreground">Your Test Performance</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        {!selectedResult ? (
          <ContentCard title="Your Results" description="View your test scores and detailed analysis">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading results...</div>
            ) : results.length === 0 ? (
              <div className="py-12 text-center">
                <Award className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Results Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Complete tests to see your results here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((result) => (
                  <Card key={result.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedResult(result)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base">{result.testName}</CardTitle>
                          <CardDescription>{result.subject} - Class {result.classLevel}</CardDescription>
                        </div>
                        <Badge className={getGradeColor(result.grade)}>
                          Grade {result.grade}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Score</span>
                          <span className="font-medium">{result.obtainedMarks} / {result.totalMarks} ({result.percentage}%)</span>
                        </div>
                        <Progress value={result.percentage} className="h-2" />
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatDate(result.examDate)}</span>
                          </div>
                          {result.rank && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" />
                              <span>Rank: {result.rank} of {result.totalStudents}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ContentCard>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setSelectedResult(null)} data-testid="button-back-results">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Results
              </Button>
              <Button variant="outline" data-testid="button-download-result">
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Award className="w-8 h-8 mx-auto text-coin-green mb-2" />
                    <p className="text-2xl font-bold">{selectedResult.percentage}%</p>
                    <p className="text-sm text-muted-foreground">Score</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <FileText className="w-8 h-8 mx-auto text-coin-blue mb-2" />
                    <p className="text-2xl font-bold">{selectedResult.obtainedMarks}/{selectedResult.totalMarks}</p>
                    <p className="text-sm text-muted-foreground">Marks</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 mx-auto text-coin-orange mb-2" />
                    <p className="text-2xl font-bold">{selectedResult.grade}</p>
                    <p className="text-sm text-muted-foreground">Grade</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 mx-auto text-coin-purple mb-2" />
                    <p className="text-2xl font-bold">{selectedResult.rank || '-'}</p>
                    <p className="text-sm text-muted-foreground">Rank</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <ContentCard title="Question-wise Analysis" description="Review your answers and learn from explanations">
              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">All Questions</TabsTrigger>
                  <TabsTrigger value="correct">Correct</TabsTrigger>
                  <TabsTrigger value="incorrect">Incorrect</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-4">
                  <div className="space-y-4">
                    {selectedResult.answers?.map((answer) => (
                      <Card key={answer.questionId}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-2">
                              {answer.isCorrect ? (
                                <CheckCircle className="w-5 h-5 text-coin-green" />
                              ) : (
                                <XCircle className="w-5 h-5 text-coin-red" />
                              )}
                              <CardTitle className="text-sm">Question {answer.questionNumber}</CardTitle>
                            </div>
                            <Badge variant="outline">
                              {answer.marksObtained}/{answer.maxMarks} marks
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm">{answer.questionText}</p>
                          
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className={`p-3 rounded-md ${answer.isCorrect ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}>
                              <p className="text-xs text-muted-foreground mb-1">Your Answer</p>
                              <p className="text-sm">{answer.studentAnswer || "Not answered"}</p>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                              <p className="text-xs text-muted-foreground mb-1">Correct Answer</p>
                              <p className="text-sm">{answer.correctAnswer}</p>
                            </div>
                          </div>

                          {answer.explanation && (
                            <div className="p-3 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                Explanation
                              </p>
                              <p className="text-sm">{answer.explanation}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="correct" className="mt-4">
                  <div className="space-y-4">
                    {selectedResult.answers?.filter(a => a.isCorrect).map((answer) => (
                      <Card key={answer.questionId}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-coin-green" />
                            <CardTitle className="text-sm">Question {answer.questionNumber}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{answer.questionText}</p>
                          <p className="text-sm text-coin-green mt-2">Your answer: {answer.studentAnswer}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="incorrect" className="mt-4">
                  <div className="space-y-4">
                    {selectedResult.answers?.filter(a => !a.isCorrect).map((answer) => (
                      <Card key={answer.questionId}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-coin-red" />
                            <CardTitle className="text-sm">Question {answer.questionNumber}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-sm">{answer.questionText}</p>
                          <p className="text-sm text-coin-red">Your answer: {answer.studentAnswer || "Not answered"}</p>
                          <p className="text-sm text-coin-green">Correct: {answer.correctAnswer}</p>
                          {answer.explanation && (
                            <p className="text-sm text-muted-foreground">{answer.explanation}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </ContentCard>
          </div>
        )}
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
