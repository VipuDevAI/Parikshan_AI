import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, GridContainer, PageFooter } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, FileText, Send, CheckCircle, XCircle, Download, Clock, AlertTriangle, Printer, Image } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

interface Test {
  id: string;
  title: string;
  subject: string;
  grade: string;
  totalMarks: number;
  duration: number;
  workflowState: string;
  questionIds: string[] | null;
  hodApprovedBy: string | null;
  hodApprovedAt: string | null;
  hodComments: string | null;
  principalApprovedBy: string | null;
  principalApprovedAt: string | null;
  paperFormat: string;
  generatedPaperUrl: string | null;
  answerKeyUrl: string | null;
}

const workflowStateLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", color: "bg-coin-blue text-white" },
  pending_hod: { label: "Pending HOD Review", color: "bg-coin-orange text-white" },
  hod_approved: { label: "HOD Approved", color: "bg-coin-green text-white" },
  hod_rejected: { label: "HOD Rejected", color: "bg-coin-red text-white" },
  pending_principal: { label: "Pending Principal", color: "bg-coin-orange text-white" },
  principal_approved: { label: "Principal Approved", color: "bg-coin-green text-white" },
  principal_rejected: { label: "Principal Rejected", color: "bg-coin-red text-white" },
  sent_to_committee: { label: "Sent to Committee", color: "bg-coin-purple text-white" },
  locked: { label: "Locked", color: "bg-coin-indigo text-white" },
};

export default function HODPaperGeneratorPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState<"A4" | "Legal">("A4");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<number>(1);
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");
  const [approvalComments, setApprovalComments] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: tests = [], isLoading } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });

  const generatePaperMutation = useMutation({
    mutationFn: async ({ testId, format }: { testId: string; format: string }) => {
      return apiRequest("POST", `/api/tests/${testId}/generate-paper`, { format });
    },
    onSuccess: () => {
      toast({ title: "Paper generated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const hodApproveMutation = useMutation({
    mutationFn: async ({ testId, comments }: { testId: string; comments?: string }) => {
      return apiRequest("POST", `/api/tests/${testId}/hod-approve`, { userId: user?.id, comments });
    },
    onSuccess: () => {
      toast({ title: "Paper approved" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      setShowApproveDialog(false);
      setApprovalComments("");
    },
  });

  const hodRejectMutation = useMutation({
    mutationFn: async ({ testId, comments }: { testId: string; comments: string }) => {
      return apiRequest("POST", `/api/tests/${testId}/hod-reject`, { userId: user?.id, comments });
    },
    onSuccess: () => {
      toast({ title: "Paper rejected" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      setShowRejectDialog(false);
      setApprovalComments("");
    },
  });

  const submitToPrincipalMutation = useMutation({
    mutationFn: async (testId: string) => {
      return apiRequest("POST", `/api/tests/${testId}/submit-to-principal`, { userId: user?.id });
    },
    onSuccess: () => {
      toast({ title: "Paper submitted to Principal" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const pendingTests = tests.filter(t => t.workflowState === "pending_hod" || t.workflowState === "draft");
  const approvedTests = tests.filter(t => t.workflowState === "hod_approved");
  const allTests = tests;

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Paper Generation & Approval</h1>
            <p className="text-sm text-muted-foreground">HOD Dashboard</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <GridContainer cols={2}>
          <ContentCard title="Pending Review" description="Papers awaiting your approval">
            {isLoading ? (
              <div className="py-4 text-center text-muted-foreground">Loading...</div>
            ) : pendingTests.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No pending papers</div>
            ) : (
              <div className="space-y-3 mt-4">
                {pendingTests.map((test) => (
                  <Card key={test.id} className="bg-background/50" data-testid={`card-test-${test.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{test.title}</CardTitle>
                        <Badge className={workflowStateLabels[test.workflowState]?.color || "bg-muted"}>
                          {workflowStateLabels[test.workflowState]?.label || test.workflowState}
                        </Badge>
                      </div>
                      <CardDescription>{test.subject} | Grade {test.grade} | {test.totalMarks} marks</CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-2 flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => { setSelectedTestId(test.id); setShowApproveDialog(true); }}
                        data-testid={`button-approve-${test.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setSelectedTestId(test.id); setShowRejectDialog(true); }}
                        data-testid={`button-reject-${test.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Generate Paper" description="Create question paper and answer key">
            <div className="space-y-4 mt-4">
              <div>
                <Label>Select Test</Label>
                <Select onValueChange={(v) => setSelectedTestId(v)}>
                  <SelectTrigger data-testid="select-test">
                    <SelectValue placeholder="Choose a test" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTests.map((test) => (
                      <SelectItem key={test.id} value={test.id}>
                        {test.title} ({test.subject})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Paper Format</Label>
                <Select value={selectedFormat} onValueChange={(v: "A4" | "Legal") => setSelectedFormat(v)}>
                  <SelectTrigger data-testid="select-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Paper Set</Label>
                <Select value={String(selectedSet)} onValueChange={(v) => setSelectedSet(Number(v))}>
                  <SelectTrigger data-testid="select-set">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Set 1</SelectItem>
                    <SelectItem value="2">Set 2</SelectItem>
                    <SelectItem value="3">Set 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  School Logo URL (Optional)
                </Label>
                <Input
                  value={customLogoUrl}
                  onChange={(e) => setCustomLogoUrl(e.target.value)}
                  placeholder="https://example.com/school-logo.png"
                  data-testid="input-logo-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If left empty, school's default logo will be used (if configured)
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <CoinButton
                  color="gold"
                  icon={<FileText className="w-5 h-5" />}
                  onClick={() => selectedTestId && generatePaperMutation.mutate({ testId: selectedTestId, format: selectedFormat })}
                  disabled={!selectedTestId || generatePaperMutation.isPending}
                  data-testid="button-generate"
                >
                  Generate Paper
                </CoinButton>

                {selectedTestId && user?.role !== "teacher" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/api/tests/${selectedTestId}/paper-pdf?format=${selectedFormat}&set=${selectedSet}${customLogoUrl ? `&logoUrl=${encodeURIComponent(customLogoUrl)}` : ''}`, '_blank')}
                      data-testid="button-download-paper-pdf"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF Paper (Set {selectedSet})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/api/tests/${selectedTestId}/paper-docx?set=${selectedSet}`, '_blank')}
                      data-testid="button-download-paper-docx"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Word Paper (Set {selectedSet})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/api/tests/${selectedTestId}/answer-key-pdf?set=${selectedSet}${customLogoUrl ? `&logoUrl=${encodeURIComponent(customLogoUrl)}` : ''}`, '_blank')}
                      data-testid="button-download-key-pdf"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF Key (Set {selectedSet})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/api/tests/${selectedTestId}/answer-key-docx?set=${selectedSet}`, '_blank')}
                      data-testid="button-download-key-docx"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Word Key (Set {selectedSet})
                    </Button>
                  </>
                )}
              </div>
            </div>
          </ContentCard>


          <ContentCard title="Submit to Principal" description="Send approved papers for principal review">
            {approvedTests.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No approved papers ready to submit</div>
            ) : (
              <div className="space-y-3 mt-4">
                {approvedTests.map((test) => (
                  <Card key={test.id} className="bg-background/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{test.title}</CardTitle>
                        <Badge className="bg-coin-green text-white">Ready</Badge>
                      </div>
                      <CardDescription>{test.subject} | Grade {test.grade}</CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-2">
                      <CoinButton
                        color="blue"
                        icon={<Send className="w-5 h-5" />}
                        onClick={() => submitToPrincipalMutation.mutate(test.id)}
                        disabled={submitToPrincipalMutation.isPending}
                        data-testid={`button-submit-principal-${test.id}`}
                      >
                        Submit to Principal
                      </CoinButton>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="All Papers Status" description="Overview of all exam papers">
            <div className="space-y-2 mt-4">
              {allTests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-2 rounded bg-background/50" data-testid={`status-${test.id}`}>
                  <div>
                    <p className="font-medium text-sm">{test.title}</p>
                    <p className="text-xs text-muted-foreground">{test.subject} | Grade {test.grade}</p>
                  </div>
                  <Badge className={workflowStateLabels[test.workflowState]?.color || "bg-muted"}>
                    {workflowStateLabels[test.workflowState]?.label || test.workflowState}
                  </Badge>
                </div>
              ))}
            </div>
          </ContentCard>
        </GridContainer>

        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Paper</DialogTitle>
              <DialogDescription>Add any comments (optional)</DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Approval comments..."
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              data-testid="input-approve-comments"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
              <Button
                onClick={() => selectedTestId && hodApproveMutation.mutate({ testId: selectedTestId, comments: approvalComments })}
                disabled={hodApproveMutation.isPending}
                data-testid="button-confirm-approve"
              >
                Confirm Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Paper</DialogTitle>
              <DialogDescription>Please provide a reason for rejection</DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Rejection reason (required)..."
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              data-testid="input-reject-comments"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => selectedTestId && approvalComments && hodRejectMutation.mutate({ testId: selectedTestId, comments: approvalComments })}
                disabled={hodRejectMutation.isPending || !approvalComments}
                data-testid="button-confirm-reject"
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
      <PageFooter />
    </PageLayout>
  );
}
