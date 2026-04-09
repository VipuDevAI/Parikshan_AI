import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, EyeOff, Lock, FileText, Calendar, Clock } from "lucide-react";
import logoImg from "@/assets/logo.png";

interface Test {
  id: string;
  name: string;
  subject: string;
  classLevel: string;
  totalMarks: number;
  duration: number;
  examDate: string;
  status: string;
  isRevealed: boolean;
}

export default function TestRevealPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: tests = [], isLoading } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const canReveal = ["admin", "hod", "principal", "exam_committee"].includes(user.role);
  const lockedTests = tests.filter(t => t.status === "locked" || t.status === "sent_to_committee");

  const statusColors: Record<string, string> = {
    locked: "bg-coin-purple text-white",
    sent_to_committee: "bg-coin-blue text-white",
    completed: "bg-coin-green text-white",
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (!canReveal) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to view this page.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Test Reveal</h1>
            <p className="text-sm text-muted-foreground">View Locked Papers After Exam</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <ContentCard 
          title="Locked Papers" 
          description="Papers that have been locked and are ready for or have completed examination"
        >
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading tests...</div>
          ) : lockedTests.length === 0 ? (
            <div className="py-12 text-center">
              <Lock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Locked Papers</h3>
              <p className="text-muted-foreground mt-2">Papers will appear here once they are locked by the Examination Committee</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lockedTests.map((test) => (
                <Card key={test.id} className="hover-elevate">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-muted">
                          {test.isRevealed ? (
                            <Eye className="w-5 h-5 text-coin-green" />
                          ) : (
                            <EyeOff className="w-5 h-5 text-coin-purple" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">{test.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{test.subject} - Class {test.classLevel}</p>
                        </div>
                      </div>
                      <Badge className={statusColors[test.status] || "bg-muted"}>
                        {test.status.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{test.totalMarks} marks</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{test.duration} mins</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(test.examDate)}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid={`button-view-paper-${test.id}`}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View Paper
                      </Button>
                      <Button 
                        size="sm"
                        className="bg-coin-green hover:bg-coin-green/90"
                        data-testid={`button-view-key-${test.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Answer Key
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ContentCard>
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
