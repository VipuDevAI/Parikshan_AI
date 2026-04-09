import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, GridContainer } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, PlayCircle, CheckCircle, XCircle, Lightbulb, HelpCircle,
  ChevronLeft, ChevronRight, BookOpen, Trophy
} from "lucide-react";
import type { Question } from "@shared/schema";

type PracticeState = "select" | "practicing" | "complete";

export default function PracticePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [state, setState] = useState<PracticeState>("select");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number } | null>(null);

  const { data: allQuestions = [] } = useQuery<Question[]>({
    queryKey: ["/api/questions", "practice"],
  });

  const subjects = [...new Set(allQuestions.filter(q => q.isPractice).map((q) => q.subject))];
  const chapters = selectedSubject
    ? [...new Set(allQuestions.filter((q) => q.subject === selectedSubject && q.isPractice).map((q) => q.chapter))]
    : [];

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/practice/start", {
        subject: selectedSubject,
        chapter: selectedChapter || undefined,
      });
      return response;
    },
    onSuccess: (data: any) => {
      setQuestions(data.questions || []);
      setState("practicing");
      setCurrentIndex(0);
      setAnswers({});
      setShowHint(false);
      setShowAnswer(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/practice/submit", {
        answers,
        questionIds: questions.map((q) => q.id),
      });
      return response;
    },
    onSuccess: (data: any) => {
      setResults(data);
      setState("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleAnswer = (answer: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: answer });
  };

  const handleNext = () => {
    setShowHint(false);
    setShowAnswer(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    setShowHint(false);
    setShowAnswer(false);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (state === "select") {
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
              <h1 className="text-xl font-bold">Practice Zone</h1>
              <p className="text-sm text-muted-foreground">
                Practice at your own pace with hints
              </p>
            </div>
          </div>
        </PageHeader>

        <PageContent>
          <div className="max-w-xl mx-auto">
            <ContentCard title="Start Practice Session">
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Select Subject</Label>
                  <Select value={selectedSubject} onValueChange={(v) => {
                    setSelectedSubject(v);
                    setSelectedChapter("");
                  }}>
                    <SelectTrigger data-testid="select-practice-subject">
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSubject && chapters.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Chapter (optional)</Label>
                    <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                      <SelectTrigger data-testid="select-practice-chapter">
                        <SelectValue placeholder="All chapters" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Chapters</SelectItem>
                        {chapters.map((chapter) => (
                          <SelectItem key={chapter} value={chapter}>
                            {chapter}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <CoinButton
                  color="green"
                  className="w-full"
                  icon={<PlayCircle className="w-5 h-5" />}
                  onClick={() => startMutation.mutate()}
                  isLoading={startMutation.isPending}
                  disabled={!selectedSubject}
                  data-testid="button-start-practice"
                >
                  Start Practice
                </CoinButton>
              </div>
            </ContentCard>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  if (state === "complete" && results) {
    const percentage = Math.round((results.correct / results.total) * 100);
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
            <h1 className="text-xl font-bold">Practice Complete</h1>
          </div>
        </PageHeader>

        <PageContent>
          <div className="max-w-md mx-auto">
            <ContentCard className="text-center">
              <div className="p-6">
                <Trophy className={`w-20 h-20 mx-auto mb-4 ${
                  percentage >= 80 ? "text-coin-gold" :
                  percentage >= 50 ? "text-coin-blue" : "text-coin-orange"
                }`} />
                <h2 className="text-2xl font-bold mb-2">Great Job!</h2>
                <p className="text-4xl font-bold text-primary mb-4">{percentage}%</p>
                <p className="text-muted-foreground mb-6">
                  You got {results.correct} out of {results.total} questions correct
                </p>
                <div className="flex gap-4 justify-center">
                  <CoinButton
                    color="blue"
                    onClick={() => {
                      setState("select");
                      setQuestions([]);
                      setAnswers({});
                      setResults(null);
                    }}
                    data-testid="button-practice-again"
                  >
                    Practice Again
                  </CoinButton>
                  <CoinButton
                    color="green"
                    onClick={() => navigate("/dashboard")}
                    data-testid="button-go-dashboard"
                  >
                    Dashboard
                  </CoinButton>
                </div>
              </div>
            </ContentCard>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  if (!currentQuestion) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard>
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No questions available</h3>
              <p className="text-muted-foreground mb-4">
                No practice questions found for your selection
              </p>
              <CoinButton
                color="blue"
                onClick={() => setState("select")}
                data-testid="button-go-back-select"
              >
                Go Back
              </CoinButton>
            </div>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setState("select");
              setQuestions([]);
              setAnswers({});
            }}
            data-testid="button-exit-practice"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Practice Mode</h1>
            <p className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          <Badge variant="secondary">
            {currentQuestion.subject} - {currentQuestion.chapter}
          </Badge>
        </div>
        <div className="px-6 pb-4">
          <Progress value={progress} className="h-2" />
        </div>
      </PageHeader>

      <PageContent className="pb-24">
        <div className="max-w-3xl mx-auto">
          <ContentCard>
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <Badge variant="outline">{currentQuestion.type.toUpperCase()}</Badge>
                <Badge className={
                  currentQuestion.difficulty === "easy" ? "bg-green-100 text-green-700" :
                  currentQuestion.difficulty === "hard" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }>
                  {currentQuestion.difficulty}
                </Badge>
              </div>
              <h2 className="text-lg font-medium leading-relaxed">
                {currentQuestion.content}
              </h2>
            </div>

            {currentQuestion.type === "mcq" && currentQuestion.options && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={handleAnswer}
                className="space-y-3"
              >
                {(currentQuestion.options as string[]).map((option, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
                    <RadioGroupItem
                      value={option}
                      id={`option-${index}`}
                      data-testid={`radio-option-${index}`}
                    />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.type === "true_false" && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={handleAnswer}
                className="space-y-3"
              >
                {["True", "False"].map((option) => (
                  <div key={option} className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
                    <RadioGroupItem
                      value={option}
                      id={`option-${option}`}
                      data-testid={`radio-option-${option.toLowerCase()}`}
                    />
                    <Label htmlFor={`option-${option}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {(currentQuestion.type === "short_answer" || currentQuestion.type === "fill_blank") && (
              <Textarea
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={3}
                data-testid="textarea-practice-answer"
              />
            )}

            <div className="flex gap-2 mt-6">
              {currentQuestion.hint && !showHint && (
                <Button
                  variant="outline"
                  onClick={() => setShowHint(true)}
                  data-testid="button-show-hint"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Show Hint
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowAnswer(!showAnswer)}
                data-testid="button-show-answer"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                {showAnswer ? "Hide Answer" : "Show Answer"}
              </Button>
            </div>

            {showHint && currentQuestion.hint && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{currentQuestion.hint}</p>
                </div>
              </div>
            )}

            {showAnswer && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Correct Answer: {currentQuestion.correctAnswer}
                    </p>
                    {currentQuestion.explanation && (
                      <p className="text-sm mt-2 text-green-700 dark:text-green-300">
                        {currentQuestion.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </ContentCard>
        </div>
      </PageContent>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            data-testid="button-prev-question"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            {Object.keys(answers).length} / {questions.length} answered
          </div>
          {currentIndex === questions.length - 1 ? (
            <CoinButton
              color="blue"
              onClick={() => submitMutation.mutate()}
              isLoading={submitMutation.isPending}
              icon={<CheckCircle className="w-4 h-4" />}
              data-testid="button-finish-practice"
            >
              Finish
            </CoinButton>
          ) : (
            <Button onClick={handleNext} data-testid="button-next-question">
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
