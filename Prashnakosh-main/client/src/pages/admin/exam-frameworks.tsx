import { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, FileText, Edit, Trash2, Monitor, FileEdit } from "lucide-react";

interface ExamFramework {
  id: string;
  tenantId: string;
  academicYearId: string;
  gradeGroup: "primary" | "middle" | "senior";
  applicableGrades: string[] | null;
  examName: string;
  examCategory: "lesson" | "chapter" | "unit" | "term" | "annual";
  examOrder: number;
  examType: "online" | "offline";
  durationMinutes: number;
  maxMarks: number;
  startDate: string | null;
  endDate: string | null;
  isVisible: boolean;
  isActive: boolean;
  createdAt: string;
}

const gradeOptions: Record<string, { value: string; label: string }[]> = {
  primary: [
    { value: "1", label: "Grade 1" },
    { value: "2", label: "Grade 2" },
    { value: "3", label: "Grade 3" },
    { value: "4", label: "Grade 4" },
    { value: "5", label: "Grade 5" },
  ],
  middle: [
    { value: "6", label: "Grade 6" },
    { value: "7", label: "Grade 7" },
    { value: "8", label: "Grade 8" },
  ],
  senior: [
    { value: "9", label: "Grade 9" },
    { value: "10", label: "Grade 10" },
    { value: "11", label: "Grade 11" },
    { value: "12", label: "Grade 12" },
  ],
};

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
}

const gradeGroupOptions = [
  { value: "primary", label: "Primary (1-5)" },
  { value: "middle", label: "Middle (6-8)" },
  { value: "senior", label: "Senior (9-12)" },
];

const examTypeOptions = [
  { value: "online", label: "Online (Objective Only)" },
  { value: "offline", label: "Offline (Paper)" },
];

const examCategoryOptions = [
  { value: "lesson", label: "Lesson" },
  { value: "chapter", label: "Chapter" },
  { value: "unit", label: "Unit" },
  { value: "term", label: "Term" },
  { value: "annual", label: "Annual" },
];

export default function ExamFrameworksPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool, isSuperAdmin } = useSchoolContext();
  
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedGradeGroup, setSelectedGradeGroup] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editFramework, setEditFramework] = useState<ExamFramework | null>(null);
  const [formData, setFormData] = useState({
    examName: "",
    examCategory: "unit" as "lesson" | "chapter" | "unit" | "term" | "annual",
    examOrder: 1,
    examType: "offline" as "online" | "offline",
    durationMinutes: 60,
    maxMarks: 40,
    gradeGroup: "primary" as "primary" | "middle" | "senior",
    applicableGrades: [] as string[],
    startDate: "",
    endDate: "",
  });

  const isAuthorized = user?.role === "super_admin";

  useEffect(() => {
    if (user && !isAuthorized) {
      navigate("/dashboard");
    }
  }, [user, isAuthorized, navigate]);

  const { data: academicYears = [] } = useQuery<AcademicYear[]>({
    queryKey: ["/api/admin/academic-years", selectedSchool?.id],
    queryFn: async () => {
      if (!selectedSchool) return [];
      const response = await fetch(`/api/admin/academic-years?tenantId=${selectedSchool.id}`);
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  const { data: frameworks = [], isLoading } = useQuery<ExamFramework[]>({
    queryKey: ["/api/admin/exam-frameworks", selectedSchool?.id, selectedYear, selectedGradeGroup],
    queryFn: async () => {
      if (!selectedSchool) return [];
      let url = `/api/admin/exam-frameworks?tenantId=${selectedSchool.id}`;
      if (selectedYear) url += `&academicYearId=${selectedYear}`;
      if (selectedGradeGroup) url += `&gradeGroup=${selectedGradeGroup}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin/exam-frameworks", {
        ...data,
        tenantId: selectedSchool?.id,
        academicYearId: selectedYear,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Exam Framework Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-frameworks"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ExamFramework> }) => {
      const response = await apiRequest("PATCH", `/api/admin/exam-frameworks/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Exam Framework Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-frameworks"] });
      setEditFramework(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/exam-frameworks/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Exam Framework Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-frameworks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      examName: "",
      examCategory: "unit",
      examOrder: 1,
      examType: "offline",
      durationMinutes: 60,
      maxMarks: 40,
      gradeGroup: "primary",
      applicableGrades: [],
      startDate: "",
      endDate: "",
    });
  };

  const handleCreate = () => {
    if (!selectedYear) {
      toast({ title: "Error", description: "Please select an academic year first", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editFramework) return;
    updateMutation.mutate({ id: editFramework.id, updates: formData });
  };

  const openEdit = (framework: ExamFramework) => {
    setEditFramework(framework);
    setFormData({
      examName: framework.examName,
      examCategory: framework.examCategory || "unit",
      examOrder: framework.examOrder,
      examType: framework.examType,
      durationMinutes: framework.durationMinutes,
      maxMarks: framework.maxMarks,
      gradeGroup: framework.gradeGroup,
      applicableGrades: framework.applicableGrades || [],
      startDate: framework.startDate ? framework.startDate.split("T")[0] : "",
      endDate: framework.endDate ? framework.endDate.split("T")[0] : "",
    });
  };

  const toggleGrade = (grade: string) => {
    setFormData(prev => ({
      ...prev,
      applicableGrades: prev.applicableGrades.includes(grade)
        ? prev.applicableGrades.filter(g => g !== grade)
        : [...prev.applicableGrades, grade]
    }));
  };

  const selectAllGrades = () => {
    const grades = gradeOptions[formData.gradeGroup]?.map(g => g.value) || [];
    setFormData(prev => ({ ...prev, applicableGrades: grades }));
  };

  const clearAllGrades = () => {
    setFormData(prev => ({ ...prev, applicableGrades: [] }));
  };

  if (!isAuthorized) {
    return null;
  }

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
              <h1 className="text-xl font-bold">Exam Master</h1>
              <p className="text-sm text-muted-foreground">
                Define whole-year exam framework {selectedSchool ? `for ${selectedSchool.name}` : ""}
              </p>
            </div>
          </div>
          {isSuperAdmin && <SchoolSwitcher />}
        </div>
      </PageHeader>
      <PageContent>
        <RequireSchoolSelection>
          <ContentCard className="mb-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
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
              <div className="flex-1 min-w-[200px]">
                <Label>Grade Group</Label>
                <Select value={selectedGradeGroup} onValueChange={setSelectedGradeGroup}>
                  <SelectTrigger data-testid="select-grade-group-filter">
                    <SelectValue placeholder="All grade groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Grade Groups</SelectItem>
                    {gradeGroupOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <CoinButton
                color="blue"
                onClick={() => setIsCreateOpen(true)}
                disabled={!selectedYear}
                data-testid="button-add-exam-framework"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Exam
              </CoinButton>
            </div>
          </ContentCard>

          <ContentCard>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : frameworks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No exam frameworks configured. Select an academic year and add exams.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Grade Group</TableHead>
                    <TableHead>Grades</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Max Marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {frameworks.map((framework) => (
                    <TableRow key={framework.id} data-testid={`row-exam-${framework.id}`}>
                      <TableCell>{framework.examOrder}</TableCell>
                      <TableCell className="font-medium">{framework.examName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {examCategoryOptions.find(c => c.value === framework.examCategory)?.label || "Unit"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {gradeGroupOptions.find(g => g.value === framework.gradeGroup)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {framework.applicableGrades && framework.applicableGrades.length > 0 ? (
                          <span className="text-sm">{framework.applicableGrades.join(", ")}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={framework.examType === "online" ? "default" : "secondary"}>
                          {framework.examType === "online" ? (
                            <><Monitor className="w-3 h-3 mr-1" />Online</>
                          ) : (
                            <><FileEdit className="w-3 h-3 mr-1" />Offline</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{framework.durationMinutes} min</TableCell>
                      <TableCell>{framework.maxMarks}</TableCell>
                      <TableCell>
                        {framework.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(framework)}
                            data-testid={`button-edit-${framework.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(framework.id)}
                            data-testid={`button-delete-${framework.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ContentCard>
        </RequireSchoolSelection>
      </PageContent>

      <Dialog open={isCreateOpen || !!editFramework} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditFramework(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editFramework ? "Edit Exam Framework" : "Add Exam Framework"}</DialogTitle>
            <DialogDescription>
              Configure exam details for {selectedSchool?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Exam Name</Label>
              <Input
                value={formData.examName}
                onChange={(e) => setFormData({ ...formData, examName: e.target.value })}
                placeholder="e.g., Unit Test 1, Quarterly, Annual"
                data-testid="input-exam-name"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Grade Group</Label>
                <Select
                  value={formData.gradeGroup}
                  onValueChange={(v) => setFormData({ ...formData, gradeGroup: v as any })}
                >
                  <SelectTrigger data-testid="select-grade-group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeGroupOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Exam Category</Label>
                <Select
                  value={formData.examCategory}
                  onValueChange={(v) => setFormData({ ...formData, examCategory: v as any })}
                >
                  <SelectTrigger data-testid="select-exam-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {examCategoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Exam Type</Label>
                <Select
                  value={formData.examType}
                  onValueChange={(v) => setFormData({ ...formData, examType: v as any })}
                >
                  <SelectTrigger data-testid="select-exam-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {examTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Applicable Grades (leave empty for all grades in group)</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllGrades}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAllGrades}>
                    Clear
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {gradeOptions[formData.gradeGroup]?.map((grade) => (
                  <Button
                    key={grade.value}
                    type="button"
                    variant={formData.applicableGrades.includes(grade.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleGrade(grade.value)}
                    data-testid={`toggle-grade-${grade.value}`}
                  >
                    {grade.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label>End Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Order</Label>
                <Input
                  type="number"
                  value={formData.examOrder}
                  onChange={(e) => setFormData({ ...formData, examOrder: parseInt(e.target.value) || 1 })}
                  min={1}
                  data-testid="input-exam-order"
                />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })}
                  min={10}
                  data-testid="input-duration"
                />
              </div>
              <div>
                <Label>Max Marks</Label>
                <Input
                  type="number"
                  value={formData.maxMarks}
                  onChange={(e) => setFormData({ ...formData, maxMarks: parseInt(e.target.value) || 40 })}
                  min={10}
                  data-testid="input-max-marks"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditFramework(null);
              resetForm();
            }} data-testid="button-cancel">
              Cancel
            </Button>
            <CoinButton
              color="green"
              onClick={editFramework ? handleUpdate : handleCreate}
              disabled={!formData.examName || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-exam-framework"
            >
              {editFramework ? "Update" : "Create"}
            </CoinButton>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
