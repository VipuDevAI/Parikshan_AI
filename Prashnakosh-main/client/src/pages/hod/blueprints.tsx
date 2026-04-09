import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, FileText, BookOpen, Target, Layers } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

interface BlueprintSection {
  name: string;
  marks: number;
  questionCount: number;
  questionType: string;
  difficulty?: string;
  chapters?: string[];
  instructions?: string;
}

interface Blueprint {
  id: string;
  name: string;
  subject: string;
  grade: string;
  totalMarks: number;
  sections?: BlueprintSection[];
  createdBy?: string;
  approvedBy?: string;
  isApproved: boolean;
  createdAt?: string;
}

const typeLabels: Record<string, string> = {
  mcq: "MCQ",
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

export default function HODBlueprintsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: blueprints = [], isLoading } = useQuery<Blueprint[]>({
    queryKey: ["/api/blueprints"],
  });

  const approveMutation = useMutation({
    mutationFn: async (blueprintId: string) => {
      return apiRequest("POST", `/api/blueprints/${blueprintId}/approve`, { 
        approvedBy: user?.id 
      });
    },
    onSuccess: () => {
      toast({ title: "Blueprint approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints"] });
      setShowDetailDialog(false);
      setSelectedBlueprint(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (!["hod", "admin", "super_admin", "exam_committee"].includes(user.role)) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied. HOD role required.</p>
        </div>
      </PageLayout>
    );
  }

  const pendingBlueprints = blueprints.filter(b => !b.isApproved);
  const approvedBlueprints = blueprints.filter(b => b.isApproved);

  const viewBlueprint = (blueprint: Blueprint) => {
    setSelectedBlueprint(blueprint);
    setShowDetailDialog(true);
  };

  const getTotalQuestions = (sections: BlueprintSection[] | undefined) => {
    if (!sections) return 0;
    return sections.reduce((sum, s) => sum + s.questionCount, 0);
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
            <h1 className="text-xl font-bold">Blueprint Review</h1>
            <p className="text-sm text-muted-foreground">Review and approve exam blueprints</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              {pendingBlueprints.length} Pending
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800">
              {approvedBlueprints.length} Approved
            </Badge>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        {pendingBlueprints.length > 0 && (
          <ContentCard title="Pending Approval" description="Blueprints awaiting HOD review">
            <div className="space-y-4 mt-4">
              {pendingBlueprints.map((blueprint) => (
                <Card key={blueprint.id} className="bg-background/50" data-testid={`card-blueprint-${blueprint.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {blueprint.name}
                        </CardTitle>
                        <CardDescription>
                          {blueprint.subject} | Grade {blueprint.grade} | {blueprint.totalMarks} marks
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        Pending Approval
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="w-4 h-4" />
                        {blueprint.sections?.length || 0} sections
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {getTotalQuestions(blueprint.sections)} questions
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewBlueprint(blueprint)}
                      data-testid={`button-view-${blueprint.id}`}
                    >
                      <BookOpen className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => approveMutation.mutate(blueprint.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${blueprint.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </ContentCard>
        )}

        <ContentCard title="All Blueprints" description="View all exam blueprints" className="mt-6">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading blueprints...</div>
          ) : blueprints.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No blueprints found</p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {blueprints.map((blueprint) => (
                <Card 
                  key={blueprint.id} 
                  className="bg-background/50 cursor-pointer hover-elevate"
                  onClick={() => viewBlueprint(blueprint)}
                  data-testid={`card-blueprint-all-${blueprint.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${blueprint.isApproved ? "bg-green-100 dark:bg-green-900" : "bg-yellow-100 dark:bg-yellow-900"}`}>
                          <FileText className={`w-5 h-5 ${blueprint.isApproved ? "text-green-600" : "text-yellow-600"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{blueprint.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {blueprint.subject} | Grade {blueprint.grade} | {blueprint.totalMarks} marks
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {blueprint.sections?.length || 0} sections
                        </Badge>
                        {blueprint.isApproved ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ContentCard>
      </PageContent>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedBlueprint?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedBlueprint?.subject} | Grade {selectedBlueprint?.grade} | Total: {selectedBlueprint?.totalMarks} marks
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="font-medium">{selectedBlueprint?.subject}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Grade</p>
                  <p className="font-medium">{selectedBlueprint?.grade}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Marks</p>
                  <p className="font-medium">{selectedBlueprint?.totalMarks}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Sections</h4>
                {selectedBlueprint?.sections && selectedBlueprint.sections.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Section</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead>Marks</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Chapters</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBlueprint.sections.map((section, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{section.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {typeLabels[section.questionType] || section.questionType}
                            </Badge>
                          </TableCell>
                          <TableCell>{section.questionCount}</TableCell>
                          <TableCell>{section.marks}</TableCell>
                          <TableCell>
                            {section.difficulty && (
                              <Badge className={difficultyColors[section.difficulty] || "bg-muted"}>
                                {section.difficulty}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {section.chapters && section.chapters.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {section.chapters.slice(0, 2).map((ch, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {ch}
                                  </Badge>
                                ))}
                                {section.chapters.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{section.chapters.length - 2} more
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">All chapters</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No sections defined</p>
                )}
              </div>

              {selectedBlueprint?.sections?.some(s => s.instructions) && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Section Instructions</h4>
                  <div className="space-y-2">
                    {selectedBlueprint.sections.filter(s => s.instructions).map((section, idx) => (
                      <div key={idx} className="p-2 bg-muted/30 rounded border-l-2 border-l-primary">
                        <p className="text-xs font-medium text-muted-foreground">{section.name}</p>
                        <p className="text-sm">{section.instructions}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
            {!selectedBlueprint?.isApproved && (
              <Button 
                variant="default"
                onClick={() => selectedBlueprint && approveMutation.mutate(selectedBlueprint.id)}
                disabled={approveMutation.isPending}
                data-testid="button-approve-dialog"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {approveMutation.isPending ? "Approving..." : "Approve Blueprint"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
