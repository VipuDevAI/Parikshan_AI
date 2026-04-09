import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader } from "@/components/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, FileText } from "lucide-react";

interface Question {
  id: string;
  content: string;
  type: string;
  subject: string;
  chapter: string | null;
  grade: string;
  marks: number;
  difficulty: string;
  status: string;
  createdAt?: string;
  rejectionReason?: string;
  reviewedAt?: string;
}

export default function TeacherQuestionsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["/api/teacher/questions"],
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (!["teacher", "hod", "admin", "super_admin"].includes(user.role)) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied. Teacher role required.</p>
        </div>
      </PageLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "mcq": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "assertion_reason": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "short_answer": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "long_answer": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "true_false": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
      case "fill_blank": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const pendingCount = questions.filter(q => q.status === "pending_approval").length;
  const approvedCount = questions.filter(q => q.status === "active").length;
  const rejectedCount = questions.filter(q => q.status === "rejected").length;

  return (
    <PageLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold">My Questions</h1>
              <p className="text-sm text-muted-foreground">Track your submitted questions and their approval status</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/teacher/upload")} data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => navigate("/teacher/questions/new")} data-testid="button-new-question">
                <Plus className="w-4 h-4 mr-2" />
                New Question
              </Button>
            </div>
          </div>
        </PageHeader>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedCount}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rejectedCount}</p>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submitted Questions</CardTitle>
            <CardDescription>
              {questions.length} total questions submitted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No questions submitted yet</p>
                <Button onClick={() => navigate("/teacher/upload")} data-testid="button-upload-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Your First Question
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 border rounded-lg"
                    data-testid={`question-${q.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {getStatusBadge(q.status)}
                          <Badge className={getTypeBadgeColor(q.type)}>
                            {q.type.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
                          <Badge variant="secondary">{q.difficulty}</Badge>
                        </div>
                        <p className="text-sm line-clamp-2">{q.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{q.subject}</span>
                          {q.chapter && (
                            <>
                              <span>•</span>
                              <span>{q.chapter}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>Grade {q.grade}</span>
                        </div>
                        {q.status === "rejected" && q.rejectionReason && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">Rejection Reason:</p>
                            <p className="text-sm text-red-700 dark:text-red-300">{q.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
