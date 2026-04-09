import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSchoolContext } from "@/lib/school-context";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { SchoolSwitcher, RequireSchoolSelection } from "@/components/school-switcher";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Plus, GraduationCap, Check, X
} from "lucide-react";

interface GradeConfig {
  id: string;
  tenantId: string;
  academicYearId: string;
  grade: string;
  displayName?: string;
  gradeGroup?: string;
  isActive: boolean;
  createdAt: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
}

const GRADE_GROUPS = [
  { value: "primary", label: "Primary (1-5)" },
  { value: "middle", label: "Middle (6-8)" },
  { value: "senior", label: "Senior (9-12)" },
];

export default function GradeConfigsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool, isSuperAdmin } = useSchoolContext();
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [formData, setFormData] = useState({
    grade: "",
    displayName: "",
    gradeGroup: "",
  });
  const [bulkGrades, setBulkGrades] = useState("");

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    navigate("/dashboard");
    return null;
  }

  const targetTenantId = isSuperAdmin ? selectedSchool?.id : user?.tenantId;

  const { data: years = [] } = useQuery<AcademicYear[]>({
    queryKey: ["/api/admin/academic-years"],
  });

  const { data: configs = [], isLoading } = useQuery<GradeConfig[]>({
    queryKey: ["/api/admin/grade-configs", selectedYear],
    queryFn: async () => {
      const url = selectedYear
        ? `/api/admin/grade-configs?academicYearId=${selectedYear}`
        : "/api/admin/grade-configs";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch grade configs");
      return res.json();
    },
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/grade-configs", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Grade Configuration Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grade-configs"] });
      setIsCreateOpen(false);
      setFormData({ grade: "", displayName: "", gradeGroup: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (grades: any[]) => {
      const response = await apiRequest("POST", "/api/admin/grade-configs/bulk", {
        academicYearId: selectedYear,
        grades,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Grade Configurations Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grade-configs"] });
      setIsBulkOpen(false);
      setBulkGrades("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/grade-configs/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Grade Configuration Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grade-configs"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!selectedYear) {
      toast({ title: "Please select an academic year first", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      academicYearId: selectedYear,
      grade: formData.grade,
      displayName: formData.displayName || formData.grade,
      gradeGroup: formData.gradeGroup || null,
    });
  };

  const handleBulkCreate = () => {
    const grades = bulkGrades.split(",").map((g) => g.trim()).filter(Boolean);
    if (grades.length === 0) {
      toast({ title: "Please enter at least one grade", variant: "destructive" });
      return;
    }
    const gradeConfigs = grades.map((grade) => ({ grade, displayName: grade }));
    bulkCreateMutation.mutate(gradeConfigs);
  };

  const toggleActive = (config: GradeConfig) => {
    updateMutation.mutate({ id: config.id, data: { isActive: !config.isActive } });
  };

  const activeYear = years.find((y) => y.id === selectedYear);

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Grade Configurations</h1>
              <p className="text-sm text-muted-foreground">
                Configure grades {selectedSchool ? `for ${selectedSchool.name}` : ""}
              </p>
            </div>
          </div>
          {isSuperAdmin && <SchoolSwitcher />}
        </div>
      </PageHeader>

      <PageContent>
        <RequireSchoolSelection>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 max-w-xs">
            <Label className="text-sm mb-2 block">Academic Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger data-testid="select-academic-year">
                <SelectValue placeholder="Select academic year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name} {year.isActive && "(Active)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 items-end">
            <CoinButton
              onClick={() => setIsCreateOpen(true)}
              color="blue"
              disabled={!selectedYear}
              data-testid="button-create-grade"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Grade
            </CoinButton>
            <CoinButton
              onClick={() => setIsBulkOpen(true)}
              color="gold"
              disabled={!selectedYear}
              data-testid="button-bulk-add"
            >
              <Plus className="w-4 h-4 mr-2" />
              Bulk Add
            </CoinButton>
          </div>
        </div>

        {!selectedYear ? (
          <ContentCard>
            <div className="text-center py-12">
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select an Academic Year</h3>
              <p className="text-muted-foreground">Choose an academic year to view and manage grades</p>
            </div>
          </ContentCard>
        ) : (
          <ContentCard>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-12">
                <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Grades Configured</h3>
                <p className="text-muted-foreground">Add grades for {activeYear?.name}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id} data-testid={`row-grade-${config.id}`}>
                      <TableCell className="font-medium">{config.grade}</TableCell>
                      <TableCell>{config.displayName || config.grade}</TableCell>
                      <TableCell>
                        {config.gradeGroup ? (
                          <Badge variant="secondary">{config.gradeGroup}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {config.isActive ? (
                          <Badge className="bg-coin-green text-white">
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <X className="w-3 h-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={config.isActive}
                          onCheckedChange={() => toggleActive(config)}
                          data-testid={`switch-active-${config.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ContentCard>
        )}
        </RequireSchoolSelection>
      </PageContent>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Grade Configuration</DialogTitle>
            <DialogDescription>
              Add a new grade for {activeYear?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Input
                id="grade"
                placeholder="e.g., 10, 11, 12"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                data-testid="input-grade"
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name (Optional)</Label>
              <Input
                id="displayName"
                placeholder="e.g., Class 10"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                data-testid="input-display-name"
              />
            </div>
            <div>
              <Label htmlFor="gradeGroup">Grade Group (Optional)</Label>
              <Select
                value={formData.gradeGroup}
                onValueChange={(v) => setFormData({ ...formData, gradeGroup: v })}
              >
                <SelectTrigger data-testid="select-grade-group">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_GROUPS.map((group) => (
                    <SelectItem key={group.value} value={group.value}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <CoinButton
                color="blue"
                onClick={handleCreate}
                disabled={createMutation.isPending || !formData.grade}
                data-testid="button-submit-grade"
              >
                Create
              </CoinButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add Grades</DialogTitle>
            <DialogDescription>
              Add multiple grades at once for {activeYear?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulkGrades">Grades (comma-separated)</Label>
              <Input
                id="bulkGrades"
                placeholder="e.g., 1, 2, 3, 4, 5, 6, 7, 8, 9, 10"
                value={bulkGrades}
                onChange={(e) => setBulkGrades(e.target.value)}
                data-testid="input-bulk-grades"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter grade names separated by commas
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsBulkOpen(false)}>
                Cancel
              </Button>
              <CoinButton
                color="gold"
                onClick={handleBulkCreate}
                disabled={bulkCreateMutation.isPending || !bulkGrades.trim()}
                data-testid="button-submit-bulk"
              >
                Add Grades
              </CoinButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
