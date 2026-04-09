import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader, PageContent } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ArrowLeft, Plus, Edit, Trash2, Eye, FileText, 
  GraduationCap, Building2, Calendar, Clock, Award, 
  AlertTriangle, Upload, CheckCircle, XCircle
} from "lucide-react";

// =====================================================
// TYPES
// =====================================================

interface School {
  id: string;
  name: string;
  code: string;
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  tenantId: string;
}

interface AdminExamConfig {
  id: string;
  tenantId: string;
  wing: WingType;
  examName: string;
  academicYearId: string;
  durationMinutes: number;
  totalMarks: number;
  examType: AdminExamType;
  allowMockTest: boolean;
  watermarkText: string | null;
  logoUrl: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  createdBy: string | null;
}

type WingType = "primary" | "middle" | "secondary" | "senior_secondary";
type AdminExamType = "unit" | "term" | "annual" | "practice";

// =====================================================
// CONSTANTS
// =====================================================

const WING_CONFIG: Record<WingType, { label: string; grades: string[]; color: string }> = {
  primary: { 
    label: "Primary (Grades 1-5)", 
    grades: ["1", "2", "3", "4", "5"],
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
  },
  middle: { 
    label: "Middle (Grades 6-8)", 
    grades: ["6", "7", "8"],
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  },
  secondary: { 
    label: "Secondary (Grades 9-10)", 
    grades: ["9", "10"],
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
  },
  senior_secondary: { 
    label: "Senior Secondary (Grades 11-12)", 
    grades: ["11", "12"],
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
  },
};

const WING_OPTIONS: { value: WingType; label: string }[] = [
  { value: "primary", label: "Primary (1-5)" },
  { value: "middle", label: "Middle (6-8)" },
  { value: "secondary", label: "Secondary (9-10)" },
  { value: "senior_secondary", label: "Senior Secondary (11-12)" },
];

const EXAM_TYPE_OPTIONS: { value: AdminExamType; label: string }[] = [
  { value: "unit", label: "Unit Test" },
  { value: "term", label: "Term Exam" },
  { value: "annual", label: "Annual Exam" },
  { value: "practice", label: "Practice Test" },
];

const EXAM_TYPE_COLORS: Record<AdminExamType, string> = {
  unit: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  term: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  annual: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  practice: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ExamConfigsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Selection state - persisted in localStorage
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => 
    localStorage.getItem("superadmin_selected_school") || ""
  );
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>(() =>
    localStorage.getItem("superadmin_selected_year") || ""
  );
  const [activeWing, setActiveWing] = useState<WingType>("primary");

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AdminExamConfig | null>(null);
  const [viewingConfig, setViewingConfig] = useState<AdminExamConfig | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<AdminExamConfig | null>(null);

  // Redirect if not super admin
  useEffect(() => {
    if (user && user.role !== "super_admin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Persist selections
  useEffect(() => {
    if (selectedSchoolId) {
      localStorage.setItem("superadmin_selected_school", selectedSchoolId);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    if (selectedAcademicYearId) {
      localStorage.setItem("superadmin_selected_year", selectedAcademicYearId);
    }
  }, [selectedAcademicYearId]);

  // =====================================================
  // QUERIES
  // =====================================================

  // Fetch all schools
  const { data: schools = [], isLoading: schoolsLoading } = useQuery<School[]>({
    queryKey: ["/api/admin/schools"],
    queryFn: async () => {
      const res = await fetch("/api/admin/schools", {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch academic years for selected school
  const { data: academicYears = [], isLoading: yearsLoading } = useQuery<AcademicYear[]>({
    queryKey: ["/api/admin/academic-years", selectedSchoolId],
    queryFn: async () => {
      if (!selectedSchoolId) return [];
      const res = await fetch(`/api/admin/academic-years?tenantId=${selectedSchoolId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSchoolId,
  });

  // Auto-select active academic year
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYearId) {
      const activeYear = academicYears.find(y => y.isActive);
      if (activeYear) {
        setSelectedAcademicYearId(activeYear.id);
      }
    }
  }, [academicYears, selectedAcademicYearId]);

  // Fetch exam configs for selected school
  const { data: examConfigs = [], isLoading: configsLoading } = useQuery<AdminExamConfig[]>({
    queryKey: ["/api/admin/exam-configs", selectedSchoolId],
    queryFn: async () => {
      if (!selectedSchoolId) return [];
      const res = await fetch(`/api/admin/exam-configs?tenantId=${selectedSchoolId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSchoolId,
  });

  // Filter configs by wing and academic year
  const filteredConfigs = examConfigs.filter(c => 
    c.wing === activeWing && 
    (!selectedAcademicYearId || c.academicYearId === selectedAcademicYearId)
  );

  // Get selected school name
  const selectedSchool = schools.find(s => s.id === selectedSchoolId);
  const selectedYear = academicYears.find(y => y.id === selectedAcademicYearId);

  // =====================================================
  // MUTATIONS
  // =====================================================

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/exam-configs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-configs"] });
      toast({ title: "Exam configuration deleted successfully" });
      setDeleteConfig(null);
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Delete",
        description: error.message || "This exam may be in use",
        variant: "destructive",
      });
      setDeleteConfig(null);
    },
  });

  // =====================================================
  // RENDER
  // =====================================================

  if (!user || user.role !== "super_admin") {
    return null;
  }

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            data-testid="btn-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Exam Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Super Admin: Configure exams by wing for each school
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="space-y-6">
          {/* ============================================= */}
          {/* MANDATORY SELECTION CARD */}
          {/* ============================================= */}
          <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-primary" />
                School & Academic Year Selection
              </CardTitle>
              <CardDescription>
                Select a school and academic year to manage exam configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* School Dropdown */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    School <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedSchoolId}
                    onValueChange={(value) => {
                      setSelectedSchoolId(value);
                      setSelectedAcademicYearId(""); // Reset year on school change
                    }}
                  >
                    <SelectTrigger 
                      className="h-12 text-base" 
                      data-testid="select-school"
                    >
                      <SelectValue placeholder="-- Select School --" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {school.name} 
                            <Badge variant="outline" className="ml-2">{school.code}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedSchoolId && (
                    <p className="text-sm text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Please select a school first
                    </p>
                  )}
                </div>

                {/* Academic Year Dropdown */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Academic Year <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedAcademicYearId}
                    onValueChange={setSelectedAcademicYearId}
                    disabled={!selectedSchoolId}
                  >
                    <SelectTrigger 
                      className="h-12 text-base" 
                      data-testid="select-academic-year"
                    >
                      <SelectValue placeholder={selectedSchoolId ? "-- Select Academic Year --" : "Select school first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No academic years found. Create one first.
                        </div>
                      ) : (
                        academicYears.map((year) => (
                          <SelectItem key={year.id} value={year.id}>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              {year.name}
                              {year.isActive && (
                                <Badge className="bg-green-100 text-green-800 ml-2">Active</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Selected Info Display */}
              {selectedSchool && selectedYear && (
                <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">
                      Managing: {selectedSchool.name} - {selectedYear.name}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ============================================= */}
          {/* EXAM CONFIGURATION - Only show when school & year selected */}
          {/* ============================================= */}
          {selectedSchoolId && selectedAcademicYearId ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5" />
                      Wing-wise Exam Configuration
                    </CardTitle>
                    <CardDescription>
                      Create, edit, and delete exams for each wing. These exams will appear in HOD Blueprint and Mock Test dropdowns.
                    </CardDescription>
                  </div>
                  <CoinButton
                    color="green"
                    icon={<Plus className="w-5 h-5" />}
                    onClick={() => setIsCreateOpen(true)}
                    data-testid="btn-add-exam"
                  >
                    Add New Exam
                  </CoinButton>
                </div>
              </CardHeader>
              <CardContent>
                {/* Wing Tabs */}
                <Tabs value={activeWing} onValueChange={(v) => setActiveWing(v as WingType)}>
                  <TabsList className="grid grid-cols-4 mb-6">
                    {WING_OPTIONS.map((wing) => (
                      <TabsTrigger 
                        key={wing.value} 
                        value={wing.value}
                        data-testid={`tab-${wing.value}`}
                        className="text-sm"
                      >
                        {wing.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {WING_OPTIONS.map((wing) => (
                    <TabsContent key={wing.value} value={wing.value}>
                      <div className="mb-4 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={WING_CONFIG[wing.value].color}>
                              {WING_CONFIG[wing.value].label}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Grades: {WING_CONFIG[wing.value].grades.join(", ")}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {filteredConfigs.length} exam(s) configured
                          </span>
                        </div>
                      </div>

                      {configsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : filteredConfigs.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No exams configured</h3>
                          <p className="text-muted-foreground mb-4">
                            Add your first exam for {wing.label}
                          </p>
                          <CoinButton
                            color="green"
                            icon={<Plus className="w-5 h-5" />}
                            onClick={() => setIsCreateOpen(true)}
                            data-testid="btn-add-exam-empty"
                          >
                            Add Exam
                          </CoinButton>
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold">Exam Name</TableHead>
                                <TableHead className="font-semibold">Type</TableHead>
                                <TableHead className="font-semibold">Duration</TableHead>
                                <TableHead className="font-semibold">Total Marks</TableHead>
                                <TableHead className="font-semibold">Mock Test</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredConfigs.map((config) => (
                                <ExamRow
                                  key={config.id}
                                  config={config}
                                  onView={() => setViewingConfig(config)}
                                  onEdit={() => setEditingConfig(config)}
                                  onDelete={() => setDeleteConfig(config)}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center">
                  <XCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-medium mb-2">Selection Required</h3>
                  <p className="text-muted-foreground">
                    Please select a School and Academic Year above to manage exam configurations.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <CardContent className="py-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                How Exam Configuration Works
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Exams created here automatically appear in <strong>HOD Blueprint dropdown</strong></li>
                <li>If "Allow Mock Test" is enabled, exam appears in <strong>Student Mock Tests</strong></li>
                <li>Only active exams are visible to HOD and students</li>
                <li>Exams in use (linked to blueprints/tests) cannot be deleted</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </PageContent>

      {/* ============================================= */}
      {/* CREATE/EDIT DIALOG */}
      {/* ============================================= */}
      <ExamFormDialog
        isOpen={isCreateOpen || !!editingConfig}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingConfig(null);
        }}
        config={editingConfig}
        tenantId={selectedSchoolId}
        academicYearId={selectedAcademicYearId}
        defaultWing={activeWing}
        academicYears={academicYears}
      />

      {/* ============================================= */}
      {/* VIEW DIALOG */}
      {/* ============================================= */}
      <ViewExamDialog
        config={viewingConfig}
        academicYears={academicYears}
        onClose={() => setViewingConfig(null)}
      />

      {/* ============================================= */}
      {/* DELETE CONFIRMATION */}
      {/* ============================================= */}
      <AlertDialog open={!!deleteConfig} onOpenChange={() => setDeleteConfig(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Exam Configuration
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deleteConfig?.examName}"</strong>?
              <br /><br />
              <span className="text-amber-600">
                ⚠️ If this exam is already linked to blueprints or tests, deletion will be blocked.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfig && deleteMutation.mutate(deleteConfig.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete"
            >
              Delete Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

// =====================================================
// EXAM ROW COMPONENT
// =====================================================

function ExamRow({
  config,
  onView,
  onEdit,
  onDelete,
}: {
  config: AdminExamConfig;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/exam-configs/${config.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}` 
        },
        body: JSON.stringify({ isActive: !config.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-configs"] });
      toast({ title: config.isActive ? "Exam deactivated" : "Exam activated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    },
  });

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{config.examName}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={EXAM_TYPE_COLORS[config.examType]}>
          {EXAM_TYPE_OPTIONS.find(t => t.value === config.examType)?.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-muted-foreground" />
          {config.durationMinutes} min
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Award className="w-4 h-4 text-muted-foreground" />
          {config.totalMarks} marks
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={config.allowMockTest ? "default" : "outline"}>
          {config.allowMockTest ? "Yes" : "No"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={config.isActive}
            onCheckedChange={() => toggleMutation.mutate()}
            data-testid={`switch-${config.id}`}
          />
          <Badge className={config.isActive 
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }>
            {config.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={onView} title="View" data-testid={`btn-view-${config.id}`}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onEdit} title="Edit" data-testid={`btn-edit-${config.id}`}>
            <Edit className="w-4 h-4 text-blue-600" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} title="Delete" data-testid={`btn-delete-${config.id}`}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// =====================================================
// EXAM FORM DIALOG (CREATE/EDIT)
// =====================================================

function ExamFormDialog({
  isOpen,
  onClose,
  config,
  tenantId,
  academicYearId,
  defaultWing,
  academicYears,
}: {
  isOpen: boolean;
  onClose: () => void;
  config: AdminExamConfig | null;
  tenantId: string;
  academicYearId: string;
  defaultWing: WingType;
  academicYears: AcademicYear[];
}) {
  const { toast } = useToast();
  const isEditing = !!config;

  const [formData, setFormData] = useState({
    wing: defaultWing,
    examName: "",
    academicYearId: academicYearId,
    durationMinutes: 60,
    totalMarks: 100,
    examType: "unit" as AdminExamType,
    allowMockTest: false,
    watermarkText: "",
    logoUrl: "",
    isActive: true,
  });

  // Reset form when opening
  useEffect(() => {
    if (config) {
      setFormData({
        wing: config.wing,
        examName: config.examName,
        academicYearId: config.academicYearId,
        durationMinutes: config.durationMinutes,
        totalMarks: config.totalMarks,
        examType: config.examType,
        allowMockTest: config.allowMockTest,
        watermarkText: config.watermarkText || "",
        logoUrl: config.logoUrl || "",
        isActive: config.isActive,
      });
    } else {
      setFormData({
        wing: defaultWing,
        examName: "",
        academicYearId: academicYearId,
        durationMinutes: 60,
        totalMarks: 100,
        examType: "unit",
        allowMockTest: false,
        watermarkText: "",
        logoUrl: "",
        isActive: true,
      });
    }
  }, [config, defaultWing, academicYearId, isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEditing 
        ? `/api/admin/exam-configs/${config.id}` 
        : "/api/admin/exam-configs";
      const method = isEditing ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}` 
        },
        body: JSON.stringify(isEditing ? formData : { ...formData, tenantId }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-configs"] });
      toast({ title: isEditing ? "Exam updated successfully" : "Exam created successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save exam configuration",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.examName.trim()) {
      toast({ title: "Exam name is required", variant: "destructive" });
      return;
    }
    if (!formData.academicYearId) {
      toast({ title: "Academic year is required", variant: "destructive" });
      return;
    }
    if (formData.durationMinutes < 10) {
      toast({ title: "Duration must be at least 10 minutes", variant: "destructive" });
      return;
    }
    if (formData.totalMarks < 10) {
      toast({ title: "Total marks must be at least 10", variant: "destructive" });
      return;
    }
    
    mutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {isEditing ? "Edit Exam Configuration" : "Create New Exam"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the exam settings. Changes will reflect in HOD blueprints." 
              : "Create a new exam. It will automatically appear in HOD blueprint dropdowns."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Row 1: Wing & Academic Year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Wing <span className="text-destructive">*</span></Label>
              <Select
                value={formData.wing}
                onValueChange={(v) => setFormData({ ...formData, wing: v as WingType })}
              >
                <SelectTrigger data-testid="form-select-wing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WING_OPTIONS.map((wing) => (
                    <SelectItem key={wing.value} value={wing.value}>
                      {wing.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Academic Year <span className="text-destructive">*</span></Label>
              <Select
                value={formData.academicYearId}
                onValueChange={(v) => setFormData({ ...formData, academicYearId: v })}
              >
                <SelectTrigger data-testid="form-select-year">
                  <SelectValue />
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

          {/* Exam Name */}
          <div className="space-y-2">
            <Label className="font-semibold">Exam Name <span className="text-destructive">*</span></Label>
            <Input
              value={formData.examName}
              onChange={(e) => setFormData({ ...formData, examName: e.target.value })}
              placeholder="e.g., Unit Test 1, Mid Term Exam, Annual Examination"
              data-testid="form-input-name"
            />
          </div>

          {/* Row 2: Duration, Marks, Type */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Duration (minutes) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })}
                min={10}
                max={300}
                data-testid="form-input-duration"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Total Marks <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                value={formData.totalMarks}
                onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) || 100 })}
                min={10}
                max={500}
                data-testid="form-input-marks"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Exam Type <span className="text-destructive">*</span></Label>
              <Select
                value={formData.examType}
                onValueChange={(v) => setFormData({ ...formData, examType: v as AdminExamType })}
              >
                <SelectTrigger data-testid="form-select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Allow Mock Test Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-base font-semibold">Allow Mock Test</Label>
              <p className="text-sm text-muted-foreground">
                If enabled, students can practice this exam as a mock test
              </p>
            </div>
            <Switch
              checked={formData.allowMockTest}
              onCheckedChange={(checked) => setFormData({ ...formData, allowMockTest: checked })}
              data-testid="form-switch-mock"
            />
          </div>

          {/* Watermark Text */}
          <div className="space-y-2">
            <Label className="font-semibold">Watermark Text</Label>
            <Input
              value={formData.watermarkText}
              onChange={(e) => setFormData({ ...formData, watermarkText: e.target.value })}
              placeholder="e.g., CONFIDENTIAL, DRAFT, School Name"
              data-testid="form-input-watermark"
            />
            <p className="text-xs text-muted-foreground">
              This text will appear as watermark on generated question papers
            </p>
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <Label className="font-semibold">Logo URL (PNG)</Label>
            <Input
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://example.com/school-logo.png"
              data-testid="form-input-logo"
            />
            <p className="text-xs text-muted-foreground">
              School logo URL for question paper headers (PNG format recommended)
            </p>
            {formData.logoUrl && (
              <div className="mt-2 p-2 border rounded bg-muted/30">
                <img 
                  src={formData.logoUrl} 
                  alt="Logo Preview" 
                  className="h-12 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-base font-semibold">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Only active exams appear in HOD blueprint and student mock test dropdowns
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              data-testid="form-switch-active"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <CoinButton
              type="submit"
              color="green"
              isLoading={mutation.isPending}
              icon={isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              data-testid="form-btn-submit"
            >
              {isEditing ? "Update Exam" : "Create Exam"}
            </CoinButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// VIEW EXAM DIALOG
// =====================================================

function ViewExamDialog({
  config,
  academicYears,
  onClose,
}: {
  config: AdminExamConfig | null;
  academicYears: AcademicYear[];
  onClose: () => void;
}) {
  if (!config) return null;
  
  const academicYear = academicYears.find(y => y.id === config.academicYearId);

  return (
    <Dialog open={!!config} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {config.examName}
          </DialogTitle>
          <DialogDescription>
            Exam configuration details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Wing</Label>
              <div className="mt-1">
                <Badge className={WING_CONFIG[config.wing].color}>
                  {WING_CONFIG[config.wing].label}
                </Badge>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Exam Type</Label>
              <div className="mt-1">
                <Badge className={EXAM_TYPE_COLORS[config.examType]}>
                  {EXAM_TYPE_OPTIONS.find(t => t.value === config.examType)?.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Academic Year</Label>
              <p className="font-medium mt-1">{academicYear?.name || "-"}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={config.isActive ? "default" : "secondary"}>
                  {config.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <p className="font-medium mt-1">{config.durationMinutes} minutes</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Total Marks</Label>
              <p className="font-medium mt-1">{config.totalMarks}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Mock Test Enabled</Label>
              <div className="mt-1">
                <Badge variant={config.allowMockTest ? "default" : "secondary"}>
                  {config.allowMockTest ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Watermark</Label>
              <p className="font-medium mt-1">{config.watermarkText || "None"}</p>
            </div>
          </div>

          {config.logoUrl && (
            <div className="p-3 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Logo</Label>
              <img 
                src={config.logoUrl} 
                alt="Exam Logo" 
                className="h-12 mt-2 object-contain"
              />
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted/50">
            <Label className="text-xs text-muted-foreground">Applicable Grades</Label>
            <div className="flex gap-1 mt-2 flex-wrap">
              {WING_CONFIG[config.wing].grades.map(grade => (
                <Badge key={grade} variant="outline">Grade {grade}</Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
