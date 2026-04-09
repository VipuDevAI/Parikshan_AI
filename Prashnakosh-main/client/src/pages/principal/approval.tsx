import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, GridContainer, PageFooter } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, XCircle, Send, Eye, AlertTriangle, Clock } from "lucide-react";
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
  hodApprovedBy: string | null;
  hodApprovedAt: string | null;
  hodComments: string | null;
}

const workflowStateLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  pending_hod: { label: "Pending HOD", color: "bg-coin-orange text-white" },
  hod_approved: { label: "HOD Approved", color: "bg-coin-green text-white" },
  pending_principal: { label: "Pending Review", color: "bg-coin-orange text-white" },
  principal_approved: { label: "Approved", color: "bg-coin-green text-white" },
  principal_rejected: { label: "Rejected", color: "bg-coin-red text-white" },
  sent_to_committee: { label: "Sent to Committee", color: "bg-coin-purple text-white" },
  locked: { label: "Locked", color: "bg-coin-indigo text-white" },
};

export default function PrincipalApprovalPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: tests = [], isLoading } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });

  const principalApproveMutation = useMutation({
    mutationFn: async ({ testId, comments }: { testId: string; comments?: string }) => {
      return apiRequest("POST", `/api/tests/${testId}/principal-approve`, { userId: user?.id, comments });
    },
    onSuccess: () => {
      toast({ title: "Paper approved" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      setShowApproveDialog(false);
      setApprovalComments("");
    },
  });

  const principalRejectMutation = useMutation({
    mutationFn: async ({ testId, comments }: { testId: string; comments: string }) => {
      return apiRequest("POST", `/api/tests/${testId}/principal-reject`, { userId: user?.id, comments });
    },
    onSuccess: () => {
      toast({ title: "Paper rejected" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      setShowRejectDialog(false);
      setApprovalComments("");
    },
  });

  const sendToCommitteeMutation = useMutation({
    mutationFn: async (testId: string) => {
      return apiRequest("POST", `/api/tests/${testId}/send-to-committee`);
    },
    onSuccess: () => {
      toast({ title: "Paper sent to Examination Committee" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const pendingTests = tests.filter(t => t.workflowState === "pending_principal");
  const approvedTests = tests.filter(t => t.workflowState === "principal_approved");

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Paper Approval</h1>
            <p className="text-sm text-muted-foreground">Principal Dashboard</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <GridContainer cols={2}>
          <ContentCard title="Pending Approval" description="Papers awaiting your review">
            {isLoading ? (
              <div className="py-4 text-center text-muted-foreground">Loading...</div>
            ) : pendingTests.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-coin-green mb-2" />
                <p className="text-muted-foreground">No pending papers</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {pendingTests.map((test) => (
                  <Card key={test.id} className="bg-background/50" data-testid={`card-pending-${test.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{test.title}</CardTitle>
                        <Badge className="bg-coin-orange text-white">Pending</Badge>
                      </div>
                      <CardDescription>
                        {test.subject} | Grade {test.grade} | {test.totalMarks} marks | {test.duration} min
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      {test.hodComments && (
                        <div className="text-sm p-2 bg-muted rounded">
                          <span className="font-medium">HOD Comments:</span> {test.hodComments}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="pt-2 flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/api/tests/${test.id}/paper-pdf`, '_blank')}
                        data-testid={`button-view-${test.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Paper
                      </Button>
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

          <ContentCard title="Send to Committee" description="Forward approved papers">
            {approvedTests.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No approved papers to send</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {approvedTests.map((test) => (
                  <Card key={test.id} className="bg-background/50" data-testid={`card-approved-${test.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{test.title}</CardTitle>
                        <Badge className="bg-coin-green text-white">Approved</Badge>
                      </div>
                      <CardDescription>{test.subject} | Grade {test.grade}</CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-2">
                      <CoinButton
                        color="purple"
                        icon={<Send className="w-5 h-5" />}
                        onClick={() => sendToCommitteeMutation.mutate(test.id)}
                        disabled={sendToCommitteeMutation.isPending}
                        data-testid={`button-send-committee-${test.id}`}
                      >
                        Send to Committee
                      </CoinButton>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="All Papers Status" description="Track all exam papers" className="col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {tests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-3 rounded bg-background/50" data-testid={`status-${test.id}`}>
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
                onClick={() => selectedTestId && principalApproveMutation.mutate({ testId: selectedTestId, comments: approvalComments })}
                disabled={principalApproveMutation.isPending}
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
                onClick={() => selectedTestId && approvalComments && principalRejectMutation.mutate({ testId: selectedTestId, comments: approvalComments })}
                disabled={principalRejectMutation.isPending || !approvalComments}
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
