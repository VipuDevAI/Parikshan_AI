import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, GridContainer, PageFooter } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Lock, Shield, Printer, Download, Eye, CheckCircle } from "lucide-react";
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
  isConfidential: boolean;
  printingReady: boolean;
  paperFormat: string;
}

const workflowStateLabels: Record<string, { label: string; color: string }> = {
  sent_to_committee: { label: "Received", color: "bg-coin-purple text-white" },
  locked: { label: "Locked", color: "bg-coin-indigo text-white" },
};

export default function CommitteePanelPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: tests = [], isLoading } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });

  const markConfidentialMutation = useMutation({
    mutationFn: async (testId: string) => {
      return apiRequest("POST", `/api/tests/${testId}/mark-confidential`);
    },
    onSuccess: () => {
      toast({ title: "Paper marked as confidential" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
  });

  const lockTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      return apiRequest("POST", `/api/tests/${testId}/lock`);
    },
    onSuccess: () => {
      toast({ title: "Paper locked for printing" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
  });

  const printingReadyMutation = useMutation({
    mutationFn: async (testId: string) => {
      return apiRequest("POST", `/api/tests/${testId}/printing-ready`);
    },
    onSuccess: () => {
      toast({ title: "Paper marked as printing ready" });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const committeeTests = tests.filter(t => 
    t.workflowState === "sent_to_committee" || t.workflowState === "locked"
  );
  const lockedTests = tests.filter(t => t.workflowState === "locked");

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Examination Committee Panel</h1>
            <p className="text-sm text-muted-foreground">Paper Management & Printing</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <GridContainer cols={2}>
          <ContentCard title="Received Papers" description="Papers sent from Principal">
            {isLoading ? (
              <div className="py-4 text-center text-muted-foreground">Loading...</div>
            ) : committeeTests.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No papers received yet</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {committeeTests.map((test) => (
                  <Card key={test.id} className="bg-background/50" data-testid={`card-paper-${test.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-base">{test.title}</CardTitle>
                        <div className="flex gap-1 flex-wrap">
                          <Badge className={workflowStateLabels[test.workflowState]?.color || "bg-muted"}>
                            {workflowStateLabels[test.workflowState]?.label || test.workflowState}
                          </Badge>
                          {test.isConfidential && (
                            <Badge className="bg-coin-red text-white">Confidential</Badge>
                          )}
                          {test.printingReady && (
                            <Badge className="bg-coin-green text-white">Print Ready</Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription>
                        {test.subject} | Grade {test.grade} | {test.totalMarks} marks | Format: {test.paperFormat}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-2 flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/api/tests/${test.id}/paper-pdf?format=${test.paperFormat}`, '_blank')}
                        data-testid={`button-view-${test.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {!test.isConfidential && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => markConfidentialMutation.mutate(test.id)}
                          disabled={markConfidentialMutation.isPending}
                          data-testid={`button-confidential-${test.id}`}
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          Mark Confidential
                        </Button>
                      )}
                      {test.workflowState !== "locked" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => lockTestMutation.mutate(test.id)}
                          disabled={lockTestMutation.isPending}
                          data-testid={`button-lock-${test.id}`}
                        >
                          <Lock className="w-4 h-4 mr-1" />
                          Lock
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Printing Management" description="Download and track printing">
            {lockedTests.length === 0 ? (
              <div className="py-8 text-center">
                <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No locked papers ready for printing</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {lockedTests.map((test) => (
                  <Card key={test.id} className="bg-background/50" data-testid={`card-print-${test.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{test.title}</CardTitle>
                        <Badge className="bg-coin-indigo text-white">Locked</Badge>
                      </div>
                      <CardDescription>{test.subject} | Grade {test.grade}</CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-2 flex gap-2 flex-wrap">
                      <CoinButton
                        color="gold"
                        icon={<Download className="w-5 h-5" />}
                        onClick={() => window.open(`/api/tests/${test.id}/paper-pdf?format=${test.paperFormat}`, '_blank')}
                        data-testid={`button-download-paper-${test.id}`}
                      >
                        Download Paper
                      </CoinButton>
                      <CoinButton
                        color="teal"
                        icon={<Download className="w-5 h-5" />}
                        onClick={() => window.open(`/api/tests/${test.id}/answer-key-pdf`, '_blank')}
                        data-testid={`button-download-key-${test.id}`}
                      >
                        Answer Key
                      </CoinButton>
                      {!test.printingReady && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printingReadyMutation.mutate(test.id)}
                          disabled={printingReadyMutation.isPending}
                          data-testid={`button-printing-ready-${test.id}`}
                        >
                          <Printer className="w-4 h-4 mr-1" />
                          Mark Printed
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Statistics" description="Overview" className="col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="p-4 rounded bg-background/50 text-center">
                <p className="text-3xl font-bold text-foreground">{committeeTests.length}</p>
                <p className="text-sm text-muted-foreground">Total Received</p>
              </div>
              <div className="p-4 rounded bg-background/50 text-center">
                <p className="text-3xl font-bold text-coin-indigo">{lockedTests.length}</p>
                <p className="text-sm text-muted-foreground">Locked</p>
              </div>
              <div className="p-4 rounded bg-background/50 text-center">
                <p className="text-3xl font-bold text-coin-red">{committeeTests.filter(t => t.isConfidential).length}</p>
                <p className="text-sm text-muted-foreground">Confidential</p>
              </div>
              <div className="p-4 rounded bg-background/50 text-center">
                <p className="text-3xl font-bold text-coin-green">{committeeTests.filter(t => t.printingReady).length}</p>
                <p className="text-sm text-muted-foreground">Printed</p>
              </div>
            </div>
          </ContentCard>
        </GridContainer>
      </PageContent>
      <PageFooter />
    </PageLayout>
  );
}
