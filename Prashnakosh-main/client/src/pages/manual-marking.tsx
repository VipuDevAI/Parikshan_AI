import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Check, CheckCircle, Edit2, FileText, Save, User, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface Submission {
  id: string;
  testId: string;
  testName: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  status: string;
  totalMarks: number;
  obtainedMarks: number | null;
  answers: SubmissionAnswer[];
}

interface SubmissionAnswer {
  questionId: string;
  questionText: string;
  questionType: string;
  maxMarks: number;
  studentAnswer: string;
  correctAnswer: string;
  marksAwarded: number | null;
  feedback: string;
}

export default function ManualMarkingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ['/api/submissions'],
  });

  const saveMarksMutation = useMutation({
    mutationFn: async (data: { submissionId: string; marks: Record<string, number>; feedback: Record<string, string> }) => {
      return apiRequest("PATCH", `/api/submissions/${data.submissionId}/marks`, { 
        marks: data.marks, 
        feedback: data.feedback 
      });
    },
    onSuccess: () => {
      toast({
        title: "Marks Saved",
        description: "Marks have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/submissions'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save marks",
        variant: "destructive",
      });
    },
  });

  const completeMarkingMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      return apiRequest("PATCH", `/api/submissions/${submissionId}/complete`, {});
    },
    onSuccess: () => {
      toast({
        title: "Marking Complete",
        description: "Submission has been marked and finalized.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/submissions'] });
      setSelectedSubmission(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete marking",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const canMark = ["admin", "hod", "teacher"].includes(user.role);

  if (!canMark) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to mark submissions.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const pendingSubmissions = submissions.filter(s => s.status === "submitted" || s.status === "marking_in_progress");

  const handleSelectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    const initialMarks: Record<string, number> = {};
    const initialFeedback: Record<string, string> = {};
    submission.answers?.forEach(answer => {
      initialMarks[answer.questionId] = answer.marksAwarded || 0;
      initialFeedback[answer.questionId] = answer.feedback || "";
    });
    setMarks(initialMarks);
    setFeedback(initialFeedback);
  };

  const handleSaveMarks = () => {
    if (!selectedSubmission) return;
    saveMarksMutation.mutate({
      submissionId: selectedSubmission.id,
      marks,
      feedback,
    });
  };

  const handleCompleteMarking = () => {
    if (!selectedSubmission) return;
    completeMarkingMutation.mutate(selectedSubmission.id);
  };

  const calculateTotalAwarded = () => {
    return Object.values(marks).reduce((sum, m) => sum + (m || 0), 0);
  };

  const statusColors: Record<string, string> = {
    submitted: "bg-coin-orange text-white",
    marking_in_progress: "bg-coin-blue text-white",
    marked: "bg-coin-green text-white",
  };

  const needsManualMarking = (type: string) => {
    return ["short_answer", "long_answer", "essay"].includes(type);
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
            <h1 className="text-xl font-bold">Manual Marking</h1>
            <p className="text-sm text-muted-foreground">Grade Subjective Answers</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ContentCard title="Pending Submissions" description="Select a submission to mark">
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-coin-green mb-4" />
                  <p className="text-muted-foreground">All submissions marked!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingSubmissions.map((submission) => (
                    <Card 
                      key={submission.id}
                      className={`cursor-pointer hover-elevate ${selectedSubmission?.id === submission.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => handleSelectSubmission(submission)}
                      data-testid={`submission-${submission.id}`}
                    >
                      <CardHeader className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm">{submission.studentName}</CardTitle>
                            <CardDescription className="text-xs">{submission.testName}</CardDescription>
                          </div>
                          <Badge className={statusColors[submission.status] || "bg-muted"} variant="secondary">
                            {submission.status === "submitted" ? "Pending" : "In Progress"}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </ContentCard>
          </div>

          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <ContentCard 
                title={`Marking: ${selectedSubmission.studentName}`}
                description={`Test: ${selectedSubmission.testName} | Total Marks: ${selectedSubmission.totalMarks}`}
              >
                <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-md">
                  <div>
                    <p className="font-medium">Total Awarded: {calculateTotalAwarded()} / {selectedSubmission.totalMarks}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={handleSaveMarks}
                      disabled={saveMarksMutation.isPending}
                      data-testid="button-save-marks"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Progress
                    </Button>
                    <Button 
                      onClick={handleCompleteMarking}
                      disabled={completeMarkingMutation.isPending}
                      className="bg-coin-green hover:bg-coin-green/90"
                      data-testid="button-complete-marking"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Complete
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedSubmission.answers?.map((answer, idx) => (
                    <Card key={answer.questionId}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-sm">Question {idx + 1}</CardTitle>
                            <Badge variant="outline" className="mt-1">
                              {answer.questionType.replace(/_/g, " ")} | {answer.maxMarks} marks
                            </Badge>
                          </div>
                          {needsManualMarking(answer.questionType) && (
                            <Badge className="bg-coin-orange text-white">Manual</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Question</Label>
                          <p className="text-sm mt-1">{answer.questionText}</p>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Student Answer</Label>
                          <div className="p-3 bg-muted rounded-md mt-1">
                            <p className="text-sm">{answer.studentAnswer || "No answer provided"}</p>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Correct Answer</Label>
                          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md mt-1 border border-green-200 dark:border-green-800">
                            <p className="text-sm">{answer.correctAnswer}</p>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Marks Awarded (max {answer.maxMarks})</Label>
                            <Input
                              type="number"
                              min={0}
                              max={answer.maxMarks}
                              value={marks[answer.questionId] || 0}
                              onChange={(e) => setMarks({
                                ...marks,
                                [answer.questionId]: Math.min(answer.maxMarks, Math.max(0, parseInt(e.target.value) || 0))
                              })}
                              data-testid={`input-marks-${answer.questionId}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Feedback (optional)</Label>
                            <Input
                              value={feedback[answer.questionId] || ""}
                              onChange={(e) => setFeedback({
                                ...feedback,
                                [answer.questionId]: e.target.value
                              })}
                              placeholder="Add feedback..."
                              data-testid={`input-feedback-${answer.questionId}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ContentCard>
            ) : (
              <ContentCard>
                <div className="py-12 text-center">
                  <Edit2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Select a Submission</h3>
                  <p className="text-muted-foreground mt-2">
                    Choose a submission from the left panel to start marking
                  </p>
                </div>
              </ContentCard>
            )}
          </div>
        </div>
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
