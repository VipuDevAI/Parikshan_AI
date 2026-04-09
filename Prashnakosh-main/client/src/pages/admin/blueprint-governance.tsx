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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Lock, Unlock, FileText, Edit, Trash2, Eye, CheckCircle, XCircle } from "lucide-react";

interface Blueprint {
  id: string;
  tenantId: string;
  academicYearId: string | null;
  examFrameworkId: string | null;
  name: string;
  subject: string;
  grade: string;
  totalMarks: number;
  sections: any[] | null;
  createdBy: string | null;
  approvedBy: string | null;
  isApproved: boolean;
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
  isLocked: boolean;
}

interface ExamFramework {
  id: string;
  examName: string;
  gradeGroup: string;
  examCategory: string;
}

export default function BlueprintGovernancePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool, isSuperAdmin } = useSchoolContext();
  
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);
  const [blueprintToToggle, setBlueprintToToggle] = useState<Blueprint | null>(null);
  const [viewBlueprint, setViewBlueprint] = useState<Blueprint | null>(null);

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

  const { data: examFrameworks = [] } = useQuery<ExamFramework[]>({
    queryKey: ["/api/admin/exam-frameworks", selectedSchool?.id, selectedYear],
    queryFn: async () => {
      if (!selectedSchool) return [];
      let url = `/api/admin/exam-frameworks?tenantId=${selectedSchool.id}`;
      if (selectedYear) url += `&academicYearId=${selectedYear}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  const { data: blueprints = [], isLoading } = useQuery<Blueprint[]>({
    queryKey: ["/api/blueprints", selectedSchool?.id],
    queryFn: async () => {
      if (!selectedSchool) return [];
      const response = await fetch(`/api/blueprints?tenantId=${selectedSchool.id}`);
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  const filteredBlueprints = blueprints.filter(bp => {
    if (selectedYear && bp.academicYearId !== selectedYear) return false;
    if (selectedExam && bp.examFrameworkId !== selectedExam) return false;
    if (selectedGrade && bp.grade !== selectedGrade) return false;
    if (selectedSubject && bp.subject !== selectedSubject) return false;
    return true;
  });

  const uniqueGrades = Array.from(new Set(blueprints.map(bp => bp.grade))).sort();
  const uniqueSubjects = Array.from(new Set(blueprints.map(bp => bp.subject))).sort();

  const lockMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/blueprints/${id}/lock`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Blueprint Locked", description: "Blueprint is now locked and cannot be edited" });
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints", selectedSchool?.id] });
      setLockConfirmOpen(false);
      setBlueprintToToggle(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/blueprints/${id}/unlock`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Blueprint Unlocked", description: "Blueprint can now be edited" });
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints", selectedSchool?.id] });
      setUnlockConfirmOpen(false);
      setBlueprintToToggle(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openLockConfirm = (blueprint: Blueprint) => {
    setBlueprintToToggle(blueprint);
    setLockConfirmOpen(true);
  };

  const openUnlockConfirm = (blueprint: Blueprint) => {
    setBlueprintToToggle(blueprint);
    setUnlockConfirmOpen(true);
  };

  const getYearName = (yearId: string | null) => {
    if (!yearId) return "Not assigned";
    const year = academicYears.find(y => y.id === yearId);
    return year?.name || "Unknown";
  };

  const getExamName = (examId: string | null) => {
    if (!examId) return "Not assigned";
    const exam = examFrameworks.find(e => e.id === examId);
    return exam?.examName || "Unknown";
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
              <h1 className="text-xl font-bold">Blueprint Governance</h1>
              <p className="text-sm text-muted-foreground">
                Manage blueprint approvals, locks, and year/exam linkage
              </p>
            </div>
          </div>
          {isSuperAdmin && <SchoolSwitcher />}
        </div>
      </PageHeader>
      <PageContent>
        <RequireSchoolSelection>
          <ContentCard className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Academic Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger data-testid="select-academic-year">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Years</SelectItem>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name} {year.isActive && "(Active)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Exam Framework</Label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger data-testid="select-exam-framework">
                    <SelectValue placeholder="All exams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Exams</SelectItem>
                    {examFrameworks.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.examName} ({exam.examCategory})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grade</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger data-testid="select-grade">
                    <SelectValue placeholder="All grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Grades</SelectItem>
                    {uniqueGrades.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        Grade {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Subjects</SelectItem>
                    {uniqueSubjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ContentCard>

          <ContentCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Blueprints</h2>
              <Badge variant="outline">{filteredBlueprints.length} found</Badge>
            </div>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredBlueprints.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No blueprints found. Adjust filters or create blueprints in the HOD dashboard.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBlueprints.map((blueprint) => (
                    <TableRow key={blueprint.id} data-testid={`row-blueprint-${blueprint.id}`}>
                      <TableCell className="font-medium">{blueprint.name}</TableCell>
                      <TableCell>{blueprint.subject}</TableCell>
                      <TableCell>{blueprint.grade}</TableCell>
                      <TableCell>
                        <span className={!blueprint.academicYearId ? "text-muted-foreground" : ""}>
                          {getYearName(blueprint.academicYearId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={!blueprint.examFrameworkId ? "text-muted-foreground" : ""}>
                          {getExamName(blueprint.examFrameworkId)}
                        </span>
                      </TableCell>
                      <TableCell>{blueprint.totalMarks}</TableCell>
                      <TableCell>
                        {blueprint.isApproved ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {blueprint.isLocked ? (
                          <Badge className="bg-red-100 text-red-800">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Unlock className="w-3 h-3 mr-1" />
                            Editable
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewBlueprint(blueprint)}
                            data-testid={`button-view-${blueprint.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {blueprint.isLocked ? (
                            <CoinButton
                              color="gold"
                              onClick={() => openUnlockConfirm(blueprint)}
                              data-testid={`button-unlock-${blueprint.id}`}
                            >
                              <Unlock className="w-4 h-4 mr-1" />
                              Unlock
                            </CoinButton>
                          ) : (
                            <CoinButton
                              color="red"
                              onClick={() => openLockConfirm(blueprint)}
                              data-testid={`button-lock-${blueprint.id}`}
                            >
                              <Lock className="w-4 h-4 mr-1" />
                              Lock
                            </CoinButton>
                          )}
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

      <AlertDialog open={lockConfirmOpen} onOpenChange={setLockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Blueprint?</AlertDialogTitle>
            <AlertDialogDescription>
              Locking "{blueprintToToggle?.name}" will prevent any further edits. 
              Only a Super Admin can unlock it later. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blueprintToToggle && lockMutation.mutate(blueprintToToggle.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Lock Blueprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unlockConfirmOpen} onOpenChange={setUnlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock Blueprint?</AlertDialogTitle>
            <AlertDialogDescription>
              Unlocking "{blueprintToToggle?.name}" will allow edits again.
              This may affect exam consistency if exams are already scheduled with this blueprint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blueprintToToggle && unlockMutation.mutate(blueprintToToggle.id)}
            >
              Unlock Blueprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewBlueprint} onOpenChange={(open) => !open && setViewBlueprint(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewBlueprint?.name}</DialogTitle>
            <DialogDescription>
              Blueprint details for {viewBlueprint?.subject} - Grade {viewBlueprint?.grade}
            </DialogDescription>
          </DialogHeader>
          {viewBlueprint && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Subject</Label>
                  <p className="font-medium">{viewBlueprint.subject}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Grade</Label>
                  <p className="font-medium">{viewBlueprint.grade}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Marks</Label>
                  <p className="font-medium">{viewBlueprint.totalMarks}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Academic Year</Label>
                  <p className="font-medium">{getYearName(viewBlueprint.academicYearId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Exam Framework</Label>
                  <p className="font-medium">{getExamName(viewBlueprint.examFrameworkId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex gap-2">
                    {viewBlueprint.isApproved ? (
                      <Badge className="bg-green-100 text-green-800">Approved</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                    {viewBlueprint.isLocked ? (
                      <Badge className="bg-red-100 text-red-800">Locked</Badge>
                    ) : (
                      <Badge variant="outline">Editable</Badge>
                    )}
                  </div>
                </div>
              </div>
              {viewBlueprint.sections && viewBlueprint.sections.length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Sections</Label>
                  <div className="space-y-2">
                    {viewBlueprint.sections.map((section: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{section.name}</span>
                          <Badge variant="outline">{section.marks} marks</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {section.questionCount} questions | {section.questionType}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
