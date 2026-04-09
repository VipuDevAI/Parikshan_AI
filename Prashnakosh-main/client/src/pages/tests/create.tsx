import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Clock, Target, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface Blueprint {
  id: string;
  name: string;
  subject: string;
  classLevel: string;
  totalMarks: number;
  sections: any;
}

export default function TestCreatePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [testName, setTestName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBlueprint, setSelectedBlueprint] = useState("");
  const [examDate, setExamDate] = useState("");
  const [paperSize, setPaperSize] = useState("A4");

  const { data: blueprints = [], isLoading: loadingBlueprints } = useQuery<Blueprint[]>({
    queryKey: ['/api/blueprints'],
  });

  const createTestMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/tests", data);
    },
    onSuccess: () => {
      toast({
        title: "Test Created",
        description: "Test has been created successfully and is ready for paper generation.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      navigate("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create test",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const canCreateTests = ["admin", "hod"].includes(user.role);

  if (!canCreateTests) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to create tests.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const selectedBlueprintData = blueprints.find(b => b.id === selectedBlueprint);
  const autoTimer = selectedBlueprintData 
    ? (selectedBlueprintData.totalMarks === 40 ? 90 : selectedBlueprintData.totalMarks === 80 ? 180 : 120)
    : 120;

  const handleCreateTest = () => {
    if (!testName || !selectedBlueprint || !examDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createTestMutation.mutate({
      name: testName,
      description,
      blueprintId: selectedBlueprint,
      examDate,
      paperSize,
      duration: autoTimer,
      totalMarks: selectedBlueprintData?.totalMarks || 0,
      tenantId: user.tenantId,
      createdBy: user.id,
      status: "draft",
    });
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Create Test</h1>
            <p className="text-sm text-muted-foreground">Blueprint-Driven Paper Creation</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="grid gap-6 md:grid-cols-2">
          <ContentCard title="Test Details" description="Enter the basic information for this test">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testName">Test Name *</Label>
                <Input
                  id="testName"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g., Mid-Term Mathematics Exam"
                  data-testid="input-test-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter test description..."
                  data-testid="input-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="examDate">Exam Date *</Label>
                <Input
                  id="examDate"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  data-testid="input-exam-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paperSize">Paper Size</Label>
                <Select value={paperSize} onValueChange={setPaperSize}>
                  <SelectTrigger data-testid="select-paper-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ContentCard>

          <ContentCard title="Blueprint Selection" description="Choose a blueprint for automatic question selection">
            {loadingBlueprints ? (
              <div className="py-8 text-center text-muted-foreground">Loading blueprints...</div>
            ) : blueprints.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No blueprints available</p>
                <p className="text-sm text-muted-foreground mt-2">Create a blueprint first to generate tests</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Blueprint *</Label>
                  <Select value={selectedBlueprint} onValueChange={setSelectedBlueprint}>
                    <SelectTrigger data-testid="select-blueprint">
                      <SelectValue placeholder="Choose a blueprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {blueprints.map((blueprint) => (
                        <SelectItem key={blueprint.id} value={blueprint.id}>
                          {blueprint.name} - {blueprint.subject} ({blueprint.totalMarks} marks)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBlueprintData && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Blueprint Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Subject: {selectedBlueprintData.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Class: {selectedBlueprintData.classLevel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Total Marks: {selectedBlueprintData.totalMarks}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Auto Duration: {autoTimer} minutes</span>
                        <Badge variant="secondary" className="text-xs">Auto-calculated</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ContentCard>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate("/dashboard")} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleCreateTest} 
            disabled={createTestMutation.isPending}
            className="bg-coin-green hover:bg-coin-green/90"
            data-testid="button-create-test"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createTestMutation.isPending ? "Creating..." : "Create Test"}
          </Button>
        </div>
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
