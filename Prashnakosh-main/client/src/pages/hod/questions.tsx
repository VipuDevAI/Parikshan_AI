import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, XCircle, BookOpen, Image as ImageIcon, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MathText } from "@/components/math-text";
import logoImg from "@/assets/logo.png";

interface Question {
  id: string;
  content: string;
  type: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  imageUrl?: string;
  passageId?: string;
  subject: string;
  chapter: string;
  grade: string;
  marks: number;
  difficulty: string;
  status: string;
  createdBy?: string;
}

interface Passage {
  id: string;
  title: string;
  content: string;
}

const typeLabels: Record<string, string> = {
  mcq: "Multiple Choice",
  assertion_reason: "Assertion-Reason",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  true_false: "True/False",
  fill_blank: "Fill in Blank",
  numerical: "Numerical",
  matching: "Matching",
};

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  hard: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function HODQuestionsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectionComments, setRejectionComments] = useState("");

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["/api/hod/questions/pending"],
  });

  const { data: passages = [] } = useQuery<Passage[]>({
    queryKey: ["/api/passages"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ questionId, comments }: { questionId: string; comments?: string }) => {
      return apiRequest("POST", `/api/questions/${questionId}/hod-approve`, { 
        reviewerId: user?.id, 
        comments 
      });
    },
    onSuccess: () => {
      toast({ title: "Question approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/hod/questions/pending"] });
      setShowApproveDialog(false);
      setSelectedQuestion(null);
      setApprovalComments("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ questionId, comments }: { questionId: string; comments: string }) => {
      return apiRequest("POST", `/api/questions/${questionId}/hod-reject`, { 
        reviewerId: user?.id, 
        comments 
      });
    },
    onSuccess: () => {
      toast({ title: "Question rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/hod/questions/pending"] });
      setShowRejectDialog(false);
      setSelectedQuestion(null);
      setRejectionComments("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (!["hod", "admin", "super_admin"].includes(user.role)) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied. HOD role required.</p>
        </div>
      </PageLayout>
    );
  }

  const getPassageContent = (passageId: string | undefined) => {
    if (!passageId) return null;
    return passages.find(p => p.id === passageId);
  };

  const handleApprove = (question: Question) => {
    setSelectedQuestion(question);
    setShowApproveDialog(true);
  };

  const handleReject = (question: Question) => {
    setSelectedQuestion(question);
    setShowRejectDialog(true);
  };

  const confirmApprove = () => {
    if (selectedQuestion) {
      approveMutation.mutate({ 
        questionId: selectedQuestion.id, 
        comments: approvalComments || undefined 
      });
    }
  };

  const confirmReject = () => {
    if (!rejectionComments.trim()) {
      toast({ title: "Error", description: "Rejection reason is required", variant: "destructive" });
      return;
    }
    if (selectedQuestion) {
      rejectMutation.mutate({ 
        questionId: selectedQuestion.id, 
        comments: rejectionComments 
      });
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="School SAFAL" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Question Approval</h1>
            <p className="text-sm text-muted-foreground">Review and approve teacher-submitted questions</p>
          </div>
          <Badge className="ml-auto bg-yellow-100 text-yellow-800">
            {questions.length} Pending
          </Badge>
        </div>
      </PageHeader>

      <PageContent>
        <ContentCard title="Pending Questions" description="Questions awaiting HOD review">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No pending questions to review</p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {questions.map((question) => {
                const passage = getPassageContent(question.passageId);
                
                return (
                  <Card key={question.id} className="bg-background/50" data-testid={`card-question-${question.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{typeLabels[question.type] || question.type}</Badge>
                          <Badge className={difficultyColors[question.difficulty] || "bg-muted"}>
                            {question.difficulty}
                          </Badge>
                          <Badge variant="secondary">{question.marks} mark{question.marks !== 1 ? "s" : ""}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {question.imageUrl && <ImageIcon className="w-4 h-4 text-blue-500" />}
                          {question.passageId && <BookOpen className="w-4 h-4 text-purple-500" />}
                        </div>
                      </div>
                      <CardDescription className="mt-2">
                        {question.subject} | {question.chapter} | Grade {question.grade}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {passage && (
                        <Card className="bg-muted/30 border-l-4 border-l-purple-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              Passage: {passage.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="max-h-32">
                              <p className="text-sm whitespace-pre-wrap">{passage.content}</p>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )}

                      {question.imageUrl && (
                        <div className="flex justify-center p-2 bg-muted/30 rounded-lg">
                          <img 
                            src={question.imageUrl} 
                            alt="Question image" 
                            className="max-h-48 object-contain rounded"
                          />
                        </div>
                      )}

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <Label className="text-xs text-muted-foreground mb-1 block">Question Content</Label>
                        <div className="text-base">
                          <MathText text={question.content} />
                        </div>
                      </div>

                      {question.options && question.options.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Options</Label>
                          <div className="grid gap-2">
                            {question.options.map((option, idx) => {
                              const optionLabel = String.fromCharCode(65 + idx);
                              const isCorrect = question.correctAnswer === optionLabel || 
                                               question.correctAnswer === option;
                              return (
                                <div 
                                  key={idx} 
                                  className={`p-2 rounded border ${isCorrect ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-border"}`}
                                >
                                  <span className="font-medium mr-2">{optionLabel}.</span>
                                  <MathText text={option} />
                                  {isCorrect && (
                                    <Badge className="ml-2 bg-green-500 text-white text-xs">Correct</Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {question.correctAnswer && !question.options && (
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-500">
                          <Label className="text-xs text-muted-foreground block mb-1">Correct Answer</Label>
                          <MathText text={question.correctAnswer} />
                        </div>
                      )}

                      {question.explanation && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-300">
                          <Label className="text-xs text-muted-foreground block mb-1">Explanation</Label>
                          <MathText text={question.explanation} />
                        </div>
                      )}
                    </CardContent>
                    
                    <CardFooter className="pt-2 flex gap-2 flex-wrap border-t">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(question)}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${question.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(question)}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-${question.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </ContentCard>
      </PageContent>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Question</DialogTitle>
            <DialogDescription>
              This question will be added to the active question bank and can be used in tests.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Comments (Optional)</Label>
              <Textarea
                placeholder="Add any comments for the teacher..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                data-testid="input-approval-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Question</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be visible to the teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason (Required)</Label>
              <Textarea
                placeholder="Explain why this question is being rejected..."
                value={rejectionComments}
                onChange={(e) => setRejectionComments(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending || !rejectionComments.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
