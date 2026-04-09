import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle, XCircle, TrendingUp, TrendingDown,
  BookOpen, Target, Lightbulb, ArrowRight
} from "lucide-react";

interface TopicPerformance {
  topic: string;
  chapter: string;
  correct: number;
  total: number;
  percentage: number;
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

interface ExamFeedbackProps {
  questions: QuestionAnalysis[];
  overallPercentage: number;
  subject: string;
  onPractice: (chapter?: string, topic?: string) => void;
}

export function ExamFeedback({
  questions,
  overallPercentage,
  subject,
  onPractice,
}: ExamFeedbackProps) {
  const topicStats: Record<string, { correct: number; total: number; chapter: string }> = {};
  
  questions.forEach(q => {
    const key = q.topic || q.chapter || "General";
    if (!topicStats[key]) {
      topicStats[key] = { correct: 0, total: 0, chapter: q.chapter };
    }
    topicStats[key].total++;
    if (q.isCorrect) topicStats[key].correct++;
  });

  const topicPerformance: TopicPerformance[] = Object.entries(topicStats).map(([topic, stats]) => ({
    topic,
    chapter: stats.chapter,
    correct: stats.correct,
    total: stats.total,
    percentage: Math.round((stats.correct / stats.total) * 100),
  }));

  const strengths = topicPerformance.filter(t => t.percentage >= 70).sort((a, b) => b.percentage - a.percentage);
  const improvements = topicPerformance.filter(t => t.percentage < 70).sort((a, b) => a.percentage - b.percentage);

  const correctQuestions = questions.filter(q => q.isCorrect);
  const incorrectQuestions = questions.filter(q => !q.isCorrect);

  const getPerformanceLevel = (pct: number) => {
    if (pct >= 90) return { label: "Excellent", color: "text-green-600", bg: "bg-green-100 dark:bg-green-950" };
    if (pct >= 70) return { label: "Good", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" };
    if (pct >= 50) return { label: "Average", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" };
    return { label: "Needs Work", color: "text-red-600", bg: "bg-red-100 dark:bg-red-950" };
  };

  const getDifficultyBadgeVariant = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy": return "outline";
      case "medium": return "secondary";
      case "hard": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-green-600">
                <TrendingUp className="w-4 h-4" />
                Your Strengths ({strengths.length})
              </h4>
              {strengths.length > 0 ? (
                <ul className="space-y-2">
                  {strengths.slice(0, 5).map((topic, i) => (
                    <li key={i} className="flex items-center justify-between p-2 rounded-md bg-green-50 dark:bg-green-950/30">
                      <span className="text-sm font-medium">{topic.topic}</span>
                      <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {topic.percentage}%
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
                      <span className="text-sm font-medium">{topic.topic}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                          {topic.percentage}%
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPractice(topic.chapter, topic.topic)}
                          data-testid={`button-practice-${topic.topic}`}
                        >
                          Practice
                        </Button>
                      </div>
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
                Based on your performance, we recommend focusing on these areas:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {improvements.slice(0, 4).map((topic, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="justify-between h-auto py-3"
                    onClick={() => onPractice(topic.chapter, topic.topic)}
                    data-testid={`button-recommend-${topic.topic}`}
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
                onClick={() => onPractice()}
                data-testid="button-start-practice"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Start Practice Session
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Excellent work! You&apos;ve mastered the content. Try challenging yourself with harder questions.
              </p>
              <Button onClick={() => onPractice()} data-testid="button-advanced-practice">
                <BookOpen className="w-4 h-4 mr-2" />
                Try Advanced Practice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Question-by-Question Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 mb-4">
              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                {correctQuestions.length} Correct
              </Badge>
              <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                <XCircle className="w-3 h-3 mr-1" />
                {incorrectQuestions.length} Incorrect
              </Badge>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {questions.map((q, i) => {
                const perfLevel = getPerformanceLevel(q.isCorrect ? 100 : 0);
                return (
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
                      <div className="flex gap-1">
                        <Badge size="sm" variant={getDifficultyBadgeVariant(q.difficulty)}>
                          {q.difficulty}
                        </Badge>
                        <Badge size="sm" variant="outline">{q.topic || q.chapter}</Badge>
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
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
