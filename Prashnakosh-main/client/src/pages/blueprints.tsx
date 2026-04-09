import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Check, FileText, Layers, Plus, Target, Trash2, GraduationCap, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface Blueprint {
  id: string;
  name: string;
  subject: string;
  classLevel: string;
  totalMarks: number;
  sections: BlueprintSection[];
  status: string;
  createdAt: string;
  examConfigId?: string;
}

interface BlueprintSection {
  name: string;
  questionType: string;
  questionCount: number;
  marksPerQuestion: number;
  totalMarks: number;
}

interface Subject {
  id: string;
  name: string;
  classLevel: string;
}

interface AdminExamConfig {
  id: string;
  wingId: string;
  examName: string;
  totalMarks: number;
  durationMinutes: number;
  isActive: boolean;
  subjects?: string[];
}

interface Wing {
  id: string;
  name: string;
  displayName: string;
  grades: string[];
  isActive: boolean;
}

// Wing configuration for grade mapping
const wingGradeMapping: Record<string, string[]> = {
  primary: ["1", "2", "3", "4", "5"],
  middle: ["6", "7", "8"],
  secondary: ["9", "10"],
  senior_secondary: ["11", "12"],
};

const wingLabels: Record<string, string> = {
  primary: "Primary (1-5)",
  middle: "Middle (6-8)",
  secondary: "Secondary (9-10)",
  senior_secondary: "Senior Secondary (11-12)",
};

const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple Choice (MCQ)" },
  { value: "true_false", label: "True/False" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "numerical", label: "Numerical" },
  { value: "passage", label: "Passage-based" },
  { value: "image_based", label: "Image-based" },
];

export default function BlueprintsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  
  // Blueprint form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [totalMarks, setTotalMarks] = useState<"40" | "80">("40");
  const [sections, setSections] = useState<BlueprintSection[]>([]);
  
  // Wing and Exam selection state
  const [selectedWingId, setSelectedWingId] = useState<string>("");
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  const { data: blueprints = [], isLoading } = useQuery<Blueprint[]>({
    queryKey: ['/api/blueprints'],
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
  });

  // Fetch wings from API
  const { data: wings = [] } = useQuery<Wing[]>({
    queryKey: ['/api/wings'],
  });

  // Fetch exams configured by Super Admin for blueprint dropdown
  const { data: adminExamConfigs = [] } = useQuery<AdminExamConfig[]>({
    queryKey: ['/api/exams/for-blueprint'],
    queryFn: async () => {
      const response = await fetch('/api/exams/for-blueprint', {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Filter exams by selected wing ID
  const filteredExams = adminExamConfigs.filter(
    exam => !selectedWingId || exam.wingId === selectedWingId
  );

  // Get selected wing object
  const selectedWing = wings.find(w => w.id === selectedWingId);

  // Get grades available for selected wing (from API data or fallback)
  const availableGrades = selectedWing?.grades || [];

  // When exam is selected, update total marks automatically
  const handleExamSelect = (examId: string) => {
    setSelectedExamId(examId);
    const exam = adminExamConfigs.find(e => e.id === examId);
    if (exam) {
      if (exam.totalMarks === 40 || exam.totalMarks === 80) {
        setTotalMarks(String(exam.totalMarks) as "40" | "80");
      }
    }
  };

  // Reset form when wing changes
  const handleWingChange = (wingId: string) => {
    setSelectedWingId(wingId);
    setSelectedExamId("");
    setClassLevel("");
  };

  const createBlueprintMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/blueprints", data);
    },
    onSuccess: () => {
      toast({
        title: "Blueprint Created",
        description: "The blueprint has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/blueprints'] });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create blueprint",
        variant: "destructive",
      });
    },
  });

  const deleteBlueprintMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/blueprints/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Blueprint Deleted",
        description: "The blueprint has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/blueprints'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete blueprint",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setName("");
    setSubject("");
    setClassLevel("");
    setTotalMarks("40");
    setSections([]);
    setSelectedWingId("");
    setSelectedExamId("");
  };

  if (!user) {
    navigate("/");
    return null;
  }

  const canManageBlueprints = ["admin", "hod"].includes(user.role);

  if (!canManageBlueprints) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to manage blueprints.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const addSection = () => {
    setSections([
      ...sections,
      {
        name: `Section ${String.fromCharCode(65 + sections.length)}`,
        questionType: "mcq",
        questionCount: 5,
        marksPerQuestion: 1,
        totalMarks: 5,
      },
    ]);
  };

  const updateSection = (index: number, field: keyof BlueprintSection, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "questionCount" || field === "marksPerQuestion") {
      updated[index].totalMarks = updated[index].questionCount * updated[index].marksPerQuestion;
    }
    setSections(updated);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const calculateTotalMarks = () => {
    return sections.reduce((sum, s) => sum + s.totalMarks, 0);
  };

  const validateBlueprint = () => {
    const total = calculateTotalMarks();
    const expected = parseInt(totalMarks);
    if (total !== expected) {
      toast({
        title: "Validation Error",
        description: `Total marks (${total}) must equal ${expected}. Adjust your sections.`,
        variant: "destructive",
      });
      return false;
    }
    if (!name || !subject || !classLevel) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return false;
    }
    if (sections.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one section.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleCreateBlueprint = () => {
    if (!validateBlueprint()) return;

    createBlueprintMutation.mutate({
      name,
      subject,
      classLevel,
      totalMarks: parseInt(totalMarks),
      sections,
      tenantId: user.tenantId,
      createdBy: user.id,
      status: "active",
      examConfigId: selectedExamId || undefined,
    });
  };

  const statusColors: Record<string, string> = {
    active: "bg-coin-green text-white",
    draft: "bg-coin-orange text-white",
    archived: "bg-muted",
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
            <h1 className="text-xl font-bold">Blueprint Management</h1>
            <p className="text-sm text-muted-foreground">Define Exam Paper Structure</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold">Exam Blueprints</h2>
            <p className="text-sm text-muted-foreground">Create and manage paper blueprints for tests</p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="bg-coin-green hover:bg-coin-green/90" data-testid="button-create-blueprint">
                <Plus className="w-4 h-4 mr-2" />
                Create Blueprint
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Exam Blueprint</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                {/* Wing and Exam Selection - CRITICAL: Only Super Admin created exams appear here */}
                <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <GraduationCap className="w-4 h-4" />
                    <span>Select Wing and Exam (as configured by Super Admin)</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Wing *</Label>
                      <Select value={selectedWingId} onValueChange={handleWingChange}>
                        <SelectTrigger data-testid="select-wing">
                          <SelectValue placeholder="Select wing first" />
                        </SelectTrigger>
                        <SelectContent>
                          {wings.length === 0 ? (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              No wings configured. Contact Super Admin.
                            </div>
                          ) : (
                            wings.filter(w => w.isActive).map((wing) => (
                              <SelectItem key={wing.id} value={wing.id}>{wing.displayName}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Exam *</Label>
                      <Select 
                        value={selectedExamId} 
                        onValueChange={handleExamSelect}
                        disabled={!selectedWingId}
                      >
                        <SelectTrigger data-testid="select-exam">
                          <SelectValue placeholder={selectedWingId ? "Select exam" : "Select wing first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredExams.length === 0 ? (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              No exams configured for this wing.
                              <br />
                              Contact Super Admin to create exams.
                            </div>
                          ) : (
                            filteredExams.map((exam) => (
                              <SelectItem key={exam.id} value={exam.id}>
                                {exam.examName} ({exam.totalMarks} marks, {exam.durationMinutes} min)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Blueprint Name *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Mid-Term Math Blueprint"
                      data-testid="input-blueprint-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Marks *</Label>
                    <Select value={totalMarks} onValueChange={(v: "40" | "80") => setTotalMarks(v)}>
                      <SelectTrigger data-testid="select-total-marks">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="40">40 Marks (90 min)</SelectItem>
                        <SelectItem value="80">80 Marks (180 min)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger data-testid="select-subject">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Grade *</Label>
                    <Select 
                      value={classLevel} 
                      onValueChange={setClassLevel}
                      disabled={!selectedWingId || availableGrades.length === 0}
                    >
                      <SelectTrigger data-testid="select-class">
                        <SelectValue placeholder={selectedWingId ? "Select grade" : "Select wing first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGrades.length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            No grades available for this wing.
                          </div>
                        ) : (
                          availableGrades.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                              Grade {grade}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-base">Sections</Label>
                      <p className="text-sm text-muted-foreground">Define question types and marks per section</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addSection} data-testid="button-add-section">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Section
                    </Button>
                  </div>

                  {sections.length === 0 ? (
                    <div className="py-8 text-center border border-dashed rounded-md">
                      <Layers className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No sections added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sections.map((section, idx) => (
                        <Card key={idx}>
                          <CardContent className="pt-4">
                            <div className="grid gap-4 sm:grid-cols-5">
                              <div className="space-y-2">
                                <Label className="text-xs">Section Name</Label>
                                <Input
                                  value={section.name}
                                  onChange={(e) => updateSection(idx, "name", e.target.value)}
                                  data-testid={`input-section-name-${idx}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Question Type</Label>
                                <Select
                                  value={section.questionType}
                                  onValueChange={(v) => updateSection(idx, "questionType", v)}
                                >
                                  <SelectTrigger data-testid={`select-type-${idx}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {QUESTION_TYPES.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Questions</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={section.questionCount}
                                  onChange={(e) => updateSection(idx, "questionCount", parseInt(e.target.value) || 1)}
                                  data-testid={`input-count-${idx}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Marks Each</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={section.marksPerQuestion}
                                  onChange={(e) => updateSection(idx, "marksPerQuestion", parseInt(e.target.value) || 1)}
                                  data-testid={`input-marks-${idx}`}
                                />
                              </div>
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <Label className="text-xs">Total</Label>
                                  <div className="h-9 flex items-center px-3 bg-muted rounded-md font-medium">
                                    {section.totalMarks}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeSection(idx)}
                                  className="text-coin-red"
                                  data-testid={`button-remove-${idx}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-muted rounded-md flex items-center justify-between">
                    <span className="font-medium">Total Blueprint Marks:</span>
                    <Badge className={calculateTotalMarks() === parseInt(totalMarks) ? "bg-coin-green text-white" : "bg-coin-red text-white"}>
                      {calculateTotalMarks()} / {totalMarks}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateBlueprint}
                    disabled={createBlueprintMutation.isPending}
                    className="bg-coin-green hover:bg-coin-green/90"
                    data-testid="button-save-blueprint"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {createBlueprintMutation.isPending ? "Creating..." : "Create Blueprint"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ContentCard>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading blueprints...</div>
          ) : blueprints.length === 0 ? (
            <div className="py-12 text-center">
              <Target className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Blueprints Yet</h3>
              <p className="text-muted-foreground mt-2">
                Create blueprints to define the structure of exam papers
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {blueprints.map((blueprint) => (
                <Card key={blueprint.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {blueprint.name}
                        </CardTitle>
                        <CardDescription>
                          {blueprint.subject} - Class {blueprint.classLevel}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[blueprint.status] || "bg-muted"}>
                          {blueprint.status}
                        </Badge>
                        <Badge variant="outline">{blueprint.totalMarks} marks</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {blueprint.sections?.map((section, idx) => (
                        <Badge key={idx} variant="secondary">
                          {section.name}: {section.questionCount} x {section.marksPerQuestion}m ({section.questionType.replace(/_/g, " ")})
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid={`button-edit-${blueprint.id}`}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-coin-red"
                        onClick={() => deleteBlueprintMutation.mutate(blueprint.id)}
                        data-testid={`button-delete-${blueprint.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ContentCard>
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
