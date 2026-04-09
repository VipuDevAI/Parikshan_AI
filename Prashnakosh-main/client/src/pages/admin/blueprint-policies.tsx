import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSchoolContext } from "@/lib/school-context";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { RequireSchoolSelection } from "@/components/school-switcher";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Settings, FileText, Lock } from "lucide-react";

interface BlueprintPolicy {
  id: string;
  tenantId: string;
  academicYearId: string;
  isBlueprintMandatory: boolean;
  blueprintMode: "academic_year" | "exam_specific";
  allowEditAfterLock: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
}

export default function BlueprintPoliciesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool } = useSchoolContext();
  
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [formData, setFormData] = useState({
    isBlueprintMandatory: true,
    blueprintMode: "academic_year" as "academic_year" | "exam_specific",
    allowEditAfterLock: false,
  });

  useEffect(() => {
    if (user && user.role !== "super_admin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  if (!user || user.role !== "super_admin") {
    return null;
  }

  const { data: academicYears = [] } = useQuery<AcademicYear[]>({
    queryKey: ["/api/admin/academic-years", selectedSchool?.id],
    queryFn: async () => {
      if (!selectedSchool) return [];
      const response = await fetch(`/api/admin/academic-years?tenantId=${selectedSchool.id}`);
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  const { data: policy, isLoading } = useQuery<BlueprintPolicy | null>({
    queryKey: ["/api/admin/blueprint-policies", selectedSchool?.id, selectedYear],
    queryFn: async () => {
      if (!selectedSchool || !selectedYear) return null;
      const response = await fetch(`/api/admin/blueprint-policies?tenantId=${selectedSchool.id}&academicYearId=${selectedYear}`);
      const data = await response.json();
      if (data) {
        setFormData({
          isBlueprintMandatory: data.isBlueprintMandatory,
          blueprintMode: data.blueprintMode,
          allowEditAfterLock: data.allowEditAfterLock,
        });
      }
      return data;
    },
    enabled: !!selectedSchool && !!selectedYear,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/blueprint-policies", {
        tenantId: selectedSchool?.id,
        academicYearId: selectedYear,
        ...formData,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Blueprint Policy Saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blueprint-policies"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <PageLayout>
      <PageHeader
        title="Blueprint Policy Configuration"
        subtitle="Control blueprint behavior and requirements per school"
        actions={
          <Button variant="ghost" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />
      <PageContent>
        <RequireSchoolSelection>
          <ContentCard className="mb-6">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label>Academic Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger data-testid="select-academic-year">
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name} {year.isActive && "(Active)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ContentCard>

          {selectedYear && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Blueprint Requirement
                  </CardTitle>
                  <CardDescription>
                    Should blueprints be mandatory for this school?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Blueprints Mandatory</Label>
                      <p className="text-sm text-muted-foreground">
                        Tests cannot be created without a blueprint
                      </p>
                    </div>
                    <Switch
                      checked={formData.isBlueprintMandatory}
                      onCheckedChange={(checked) => setFormData({ ...formData, isBlueprintMandatory: checked })}
                      data-testid="switch-mandatory"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Blueprint Mode
                  </CardTitle>
                  <CardDescription>
                    How blueprints are applied to exams
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Mode</Label>
                    <Select
                      value={formData.blueprintMode}
                      onValueChange={(v) => setFormData({ ...formData, blueprintMode: v as any })}
                    >
                      <SelectTrigger data-testid="select-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="academic_year">
                          <div className="flex flex-col">
                            <span>Academic Year Blueprint</span>
                            <span className="text-xs text-muted-foreground">One blueprint per grade+subject+exam type</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="exam_specific">
                          <div className="flex flex-col">
                            <span>Exam-Specific Blueprint</span>
                            <span className="text-xs text-muted-foreground">Blueprint attached to each exam individually</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Lock Policy
                  </CardTitle>
                  <CardDescription>
                    What happens after blueprint is locked
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Edit After Lock</Label>
                      <p className="text-sm text-muted-foreground">
                        Can blueprints be modified after exam is locked?
                      </p>
                    </div>
                    <Switch
                      checked={formData.allowEditAfterLock}
                      onCheckedChange={(checked) => setFormData({ ...formData, allowEditAfterLock: checked })}
                      data-testid="switch-edit-after-lock"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardContent className="pt-6">
                  <div className="flex justify-end">
                    <CoinButton
                      color="green"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      data-testid="button-save-policy"
                    >
                      Save Policy
                    </CoinButton>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </RequireSchoolSelection>
      </PageContent>
    </PageLayout>
  );
}
