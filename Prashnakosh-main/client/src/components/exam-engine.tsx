import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle, AlertTriangle,
  XCircle, Eye, Send, BookOpen
} from "lucide-react";
import type { Question, Test } from "@shared/schema";
import { MathText } from "./math-text";

type QuestionStatus = "not_visited" | "answered" | "marked_review" | "unanswered";

interface ExamQuestion extends Question {
  passageText?: string | null;
}

interface ExamEngineProps {
  test: Test;
  questions: ExamQuestion[];
  attemptId: string;
  initialAnswers?: Record<string, string>;
  initialStatuses?: Record<string, QuestionStatus>;
  initialMarkedForReview?: string[];
  initialTimeRemaining?: number;
  onComplete: (results: ExamResults) => void;
  onExit: () => void;
}

interface ExamResults {
  score: number;
  total: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  answers?: Record<string, string>;
}

const STATUS_COLORS = {
  not_visited: "bg-gray-400",
  answered: "bg-blue-500",
  marked_review: "bg-purple-500", 
  unanswered: "bg-red-500",
};

const STATUS_LABELS = {
  not_visited: "Not Visited",
  answered: "Answered",
  marked_review: "Marked for Review",
  unanswered: "Unanswered",
};

export function ExamEngine({
  test,
  questions,
  attemptId,
  initialAnswers = {},
  initialStatuses = {},
  initialMarkedForReview = [],
  initialTimeRemaining,
  onComplete,
  onExit,
}: ExamEngineProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>(() => {
    const statuses: Record<string, QuestionStatus> = {};
    questions.forEach(q => {
      statuses[q.id] = initialStatuses[q.id] || "not_visited";
    });
    return statuses;
  });
  const [markedForReview, setMarkedForReview] = useState<string[]>(initialMarkedForReview);
  const [timeRemaining, setTimeRemaining] = useState(() => {
    if (initialTimeRemaining !== undefined) return initialTimeRemaining;
    return (test.duration || 60) * 60;
  });
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownWarning = useRef(false);

  const currentQuestion = questions[currentIndex];
  const isLowTime = timeRemaining < 300;
  const answeredCount = Object.keys(answers).filter(id => answers[id]).length;
  const unansweredCount = questions.length - answeredCount;
  const reviewCount = markedForReview.length;

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const saveStateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/exam/save-state", {
        attemptId,
        answers,
        questionStatuses,
        markedForReview,
        timeRemaining,
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (): Promise<ExamResults> => {
      const response = await apiRequest("POST", "/api/exam/submit", {
        attemptId,
        answers,
      });
      return response.json();
    },
    onSuccess: (data: ExamResults) => {
      setIsSubmitting(false);
      onComplete({ ...data, answers });
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      toast({ title: "Submission Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsSubmitting(true);
          submitMutation.mutate();
          return 0;
        }
        if (prev === 300 && !hasShownWarning.current) {
          hasShownWarning.current = true;
          setShowTimeWarning(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    saveIntervalRef.current = setInterval(() => {
      saveStateMutation.mutate();
    }, 30000);

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [answers, questionStatuses, markedForReview]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      saveStateMutation.mutate();
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [answers, questionStatuses, markedForReview]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          setShowTabWarning(true);
          
          apiRequest("POST", "/api/exam/log-tab-switch", {
            attemptId,
            studentId: test.createdBy,
            tenantId: test.tenantId,
          }).catch(console.error);
          
          toast({
            title: "Warning: Tab Switch Detected",
            description: `You switched tabs. This has been logged. (${newCount} warning${newCount > 1 ? 's' : ''})`,
            variant: "destructive",
          });
          
          if (newCount >= 3) {
            toast({
              title: "Final Warning",
              description: "Multiple tab switches detected. Your exam may be flagged for review.",
              variant: "destructive",
            });
          }
          
          return newCount;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [attemptId, test.createdBy, test.tenantId, toast]);

  useEffect(() => {
    if (currentQuestion) {
      setQuestionStatuses(prev => ({
        ...prev,
        [currentQuestion.id]: prev[currentQuestion.id] === "not_visited" 
          ? "unanswered" 
          : prev[currentQuestion.id],
      }));
    }
  }, [currentIndex, currentQuestion]);

  const handleAnswer = (answer: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: answer });
    setQuestionStatuses(prev => ({
      ...prev,
      [currentQuestion.id]: markedForReview.includes(currentQuestion.id) 
        ? "marked_review" 
        : "answered",
    }));
  };

  const toggleReview = () => {
    const qId = currentQuestion.id;
    if (markedForReview.includes(qId)) {
      setMarkedForReview(markedForReview.filter(id => id !== qId));
      setQuestionStatuses(prev => ({
        ...prev,
        [qId]: answers[qId] ? "answered" : "unanswered",
      }));
    } else {
      setMarkedForReview([...markedForReview, qId]);
      setQuestionStatuses(prev => ({
        ...prev,
        [qId]: "marked_review",
      }));
    }
  };

  const goToQuestion = (index: number) => {
    setCurrentIndex(index);
  };

  const handleSubmit = () => {
    setShowSubmitConfirm(false);
    setIsSubmitting(true);
    submitMutation.mutate();
  };

  const renderQuestionContent = () => {
    if (!currentQuestion) return null;

    return (
      <div className="space-y-6">
        {currentQuestion.passageText && (
          <Card className="bg-muted/30 border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Reading Passage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <p className="text-sm whitespace-pre-wrap">{currentQuestion.passageText}</p>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {currentQuestion.imageUrl && (
          <div className="flex justify-center">
            <img 
              src={currentQuestion.imageUrl} 
              alt="Question" 
              className="max-h-48 rounded-lg shadow"
            />
          </div>
        )}

        <div className="prose prose-sm max-w-none">
          <p className="text-lg font-medium">
            <MathText text={currentQuestion.content} />
          </p>
        </div>

        {renderAnswerInput()}
      </div>
    );
  };

  const renderAnswerInput = () => {
    const answer = answers[currentQuestion.id] || "";

    switch (currentQuestion.type) {
      case "mcq":
      case "true_false":
        const options = currentQuestion.type === "true_false" 
          ? ["True", "False"]
          : currentQuestion.options || [];
        
        return (
          <RadioGroup value={answer} onValueChange={handleAnswer} className="space-y-3">
            {options.map((option, idx) => (
              <div
                key={idx}
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  answer === option 
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                    : "border-gray-200 dark:border-gray-700"
                }`}
                onClick={() => handleAnswer(option)}
              >
                <RadioGroupItem value={option} id={`option-${idx}`} />
                <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                  <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                  <MathText text={option} />
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "fill_blank":
        return (
          <div className="space-y-2">
            <Label>Your Answer</Label>
            <Input
              value={answer}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="text-lg"
              data-testid="input-answer"
            />
          </div>
        );

      case "numerical":
        return (
          <div className="space-y-2">
            <Label>Numerical Answer</Label>
            <Input
              type="number"
              value={answer}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Enter a number..."
              className="text-lg"
              data-testid="input-numerical"
            />
          </div>
        );

      case "short_answer":
      case "long_answer":
        return (
          <div className="space-y-2">
            <Label>Your Answer</Label>
            <Textarea
              value={answer}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Type your answer..."
              rows={currentQuestion.type === "long_answer" ? 8 : 4}
              className="text-base"
              data-testid="textarea-answer"
            />
          </div>
        );

      case "matching":
        return (
          <div className="space-y-2">
            <Label>Match the pairs (format: 1-A, 2-B, etc.)</Label>
            <Textarea
              value={answer}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="1-A, 2-B, 3-C..."
              rows={4}
              data-testid="textarea-matching"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold truncate max-w-xs">{test.title}</h1>
          <Badge variant="outline">{test.subject}</Badge>
        </div>
        
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          isLowTime ? "bg-red-100 dark:bg-red-950 animate-pulse" : "bg-muted"
        }`}>
          <Clock className={`w-5 h-5 ${isLowTime ? "text-red-600" : ""}`} />
          <span className={`font-mono text-xl font-bold ${isLowTime ? "text-red-600" : ""}`}>
            {formatTime(timeRemaining)}
          </span>
        </div>

        <Button
          onClick={() => setShowSubmitConfirm(true)}
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700"
          data-testid="button-submit-exam"
        >
          <Send className="w-4 h-4 mr-2" />
          Submit Exam
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r bg-card p-4 flex flex-col">
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Question Navigator</h3>
            <div className="grid grid-cols-5 gap-1">
              {questions.map((q, idx) => {
                const status = questionStatuses[q.id] || "not_visited";
                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(idx)}
                    className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-medium text-white transition-all ${
                      STATUS_COLORS[status]
                    } ${currentIndex === idx ? "ring-2 ring-offset-2 ring-black dark:ring-white" : ""}`}
                    data-testid={`nav-question-${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 text-sm border-t pt-4">
            <h4 className="font-medium mb-2">Legend</h4>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${color}`} />
                <span className="text-muted-foreground">
                  {STATUS_LABELS[status as QuestionStatus]}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-2 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span>Answered:</span>
              <span className="font-medium text-blue-600">{answeredCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Unanswered:</span>
              <span className="font-medium text-red-600">{unansweredCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>For Review:</span>
              <span className="font-medium text-purple-600">{reviewCount}</span>
            </div>
            <Progress value={(answeredCount / questions.length) * 100} className="mt-2" />
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                Question {currentIndex + 1} of {questions.length}
              </Badge>
              <Badge variant="outline">
                {currentQuestion?.type?.replace("_", " ").toUpperCase()}
              </Badge>
              {currentQuestion?.marks && (
                <Badge>
                  {currentQuestion.marks} {currentQuestion.marks === 1 ? "Mark" : "Marks"}
                </Badge>
              )}
            </div>

            <Button
              variant={markedForReview.includes(currentQuestion?.id || "") ? "default" : "outline"}
              size="sm"
              onClick={toggleReview}
              className={markedForReview.includes(currentQuestion?.id || "") ? "bg-purple-600" : ""}
              data-testid="button-mark-review"
            >
              <Flag className="w-4 h-4 mr-2" />
              {markedForReview.includes(currentQuestion?.id || "") ? "Remove Mark" : "Mark for Review"}
            </Button>
          </div>

          <ScrollArea className="flex-1 p-6">
            {renderQuestionContent()}
          </ScrollArea>

          <div className="flex items-center justify-between px-6 py-4 border-t bg-card">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              data-testid="button-prev"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => handleAnswer("")}
                disabled={!answers[currentQuestion?.id || ""]}
              >
                Clear Answer
              </Button>
            </div>

            <Button
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </main>
      </div>

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to submit your exam?</p>
              <div className="bg-muted p-4 rounded-lg space-y-1 mt-4">
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span className="font-medium">{questions.length}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>Answered:</span>
                  <span className="font-medium">{answeredCount}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Unanswered:</span>
                  <span className="font-medium">{unansweredCount}</span>
                </div>
                <div className="flex justify-between text-purple-600">
                  <span>Marked for Review:</span>
                  <span className="font-medium">{reviewCount}</span>
                </div>
              </div>
              {unansweredCount > 0 && (
                <p className="text-amber-600 flex items-center gap-2 mt-2">
                  <AlertTriangle className="w-4 h-4" />
                  You have {unansweredCount} unanswered question(s).
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} className="bg-green-600">
              Submit Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showTimeWarning} onOpenChange={setShowTimeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              5 Minutes Remaining!
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have only 5 minutes left to complete your exam. Please review your answers and submit before time runs out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
