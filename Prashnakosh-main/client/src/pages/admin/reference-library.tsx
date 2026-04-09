import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSchoolContext } from "@/lib/school-context";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { RequireSchoolSelection } from "@/components/school-switcher";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Plus, FileText, Trash2, RotateCcw, BookOpen, FileQuestion, Notebook, EyeOff, Eye } from "lucide-react";

interface ReferenceItem {
  id: string;
  tenantId: string;
  academicYearId: string | null;
  grade: string;
  subject: string;
  title: string;
  description: string | null;
  referenceType: "question_paper" | "notes" | "model_answer" | "study_material";
  fileUrl: string;
  fileName: string | null;
  year: string | null;
  isActive: boolean;
  createdAt: string;
}

const referenceTypeOptions = [
  { value: "question_paper", label: "Previous Year Paper", icon: FileQuestion },
  { value: "notes", label: "Notes", icon: Notebook },
  { value: "model_answer", label: "Model Answer", icon: FileText },
  { value: "study_material", label: "Study Material", icon: BookOpen },
];

const gradeOptions = [
  { value: "10", label: "Grade 10" },
  { value: "12", label: "Grade 12" },
];

const subjectOptions = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English", "Hindi",
  "Computer Science", "Economics", "Commerce", "History", "Geography"
];

export default function ReferenceLibraryPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool } = useSchoolContext();
  
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    grade: "10",
    subject: "",
    title: "",
    description: "",
    referenceType: "question_paper" as ReferenceItem["referenceType"],
    fileUrl: "",
    year: "",
  });

  useEffect(() => {
    if (user && user.role !== "super_admin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  if (!user || user.role !== "super_admin") {
    return null;
  }

  const { data: items = [], isLoading } = useQuery<ReferenceItem[]>({
    queryKey: ["/api/admin/reference-library", selectedSchool?.id, selectedGrade, selectedSubject],
    queryFn: async () => {
      if (!selectedSchool) return [];
      let url = `/api/admin/reference-library?tenantId=${selectedSchool.id}`;
      if (selectedGrade) url += `&grade=${selectedGrade}`;
      if (selectedSubject) url += `&subject=${selectedSubject}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin/reference-library", {
        ...data,
        tenantId: selectedSchool?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Reference Item Added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reference-library"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/reference-library/${id}/soft`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Reference Item Disabled" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reference-library"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/admin/reference-library/${id}/restore`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Reference Item Restored" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reference-library"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      grade: "10",
      subject: "",
      title: "",
      description: "",
      referenceType: "question_paper",
      fileUrl: "",
      year: "",
    });
  };

  const getTypeIcon = (type: string) => {
    const TypeIcon = referenceTypeOptions.find(t => t.value === type)?.icon || FileText;
    return <TypeIcon className="w-4 h-4" />;
  };

  return (
    <PageLayout>
      <PageHeader
        title="Reference Library"
        subtitle="Manage previous year papers and study materials for Grade 10 & 12"
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
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[150px]">
                <Label>Grade</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger data-testid="select-grade-filter">
                    <SelectValue placeholder="All grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Grades</SelectItem>
                    {gradeOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label>Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger data-testid="select-subject-filter">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Subjects</SelectItem>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <CoinButton color="blue" onClick={() => setIsCreateOpen(true)} data-testid="button-add-reference">
                <Plus className="w-4 h-4 mr-2" />
                Add Resource
              </CoinButton>
            </div>
          </ContentCard>

          <ContentCard>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reference materials found. Add resources for Grade 10 & 12 students.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-50" : ""} data-testid={`row-reference-${item.id}`}>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getTypeIcon(item.referenceType)}
                          {referenceTypeOptions.find(t => t.value === item.referenceType)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {item.title}
                          {!item.isActive && (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <EyeOff className="w-3 h-3" />
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>Grade {item.grade}</TableCell>
                      <TableCell>{item.subject}</TableCell>
                      <TableCell>{item.year || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {item.isActive ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(item.id)}
                              data-testid={`button-disable-${item.id}`}
                              title="Disable resource"
                            >
                              <EyeOff className="w-4 h-4 text-orange-500" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => restoreMutation.mutate(item.id)}
                              data-testid={`button-restore-${item.id}`}
                              title="Restore resource"
                            >
                              <Eye className="w-4 h-4 text-green-500" />
                            </Button>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Reference Resource</DialogTitle>
            <DialogDescription>
              Add study materials for {selectedSchool?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Grade</Label>
                <Select
                  value={formData.grade}
                  onValueChange={(v) => setFormData({ ...formData, grade: v })}
                >
                  <SelectTrigger data-testid="select-grade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select
                  value={formData.subject}
                  onValueChange={(v) => setFormData({ ...formData, subject: v })}
                >
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Resource Type</Label>
              <Select
                value={formData.referenceType}
                onValueChange={(v) => setFormData({ ...formData, referenceType: v as any })}
              >
                <SelectTrigger data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {referenceTypeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., CBSE 2024 Mathematics Paper"
                data-testid="input-title"
              />
            </div>
            <div>
              <Label>Year (for previous papers)</Label>
              <Input
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="e.g., 2024"
                data-testid="input-year"
              />
            </div>
            <div>
              <Label>File URL</Label>
              <Input
                value={formData.fileUrl}
                onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                placeholder="https://..."
                data-testid="input-file-url"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the resource"
                data-testid="input-description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }} data-testid="button-cancel">
              Cancel
            </Button>
            <CoinButton
              color="green"
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.title || !formData.subject || !formData.fileUrl || createMutation.isPending}
              data-testid="button-save-reference"
            >
              Add Resource
            </CoinButton>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
