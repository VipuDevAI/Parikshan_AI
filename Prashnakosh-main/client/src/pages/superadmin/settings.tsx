import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { AppFooter } from "@/components/app-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, Plus, Edit, Trash2, Building2, GraduationCap, FileText, 
  Settings, Clock, Award, Calendar, AlertTriangle, ChevronRight, Layers
} from "lucide-react";

// Types
interface School {
  id: string;
  name: string;
  code: string;
}

interface Wing {
  id: string;
  tenantId: string;
  name: string;
  displayName: string;
  grades: string[];
  sortOrder: number;
  isActive: boolean;
}

interface Exam {
  id: string;
  tenantId: string;
  wingId: string;
  examName: string;
  academicYear: string;
  totalMarks: number;
  durationMinutes: number;
  examDate: string | null;
  subjects: string[];
  questionPaperSets: number;
  watermarkText: string | null;
  logoUrl: string | null;
  pageSize: string;
  allowMockTest: boolean;
  isActive: boolean;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // State
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() =>
    localStorage.getItem("superadmin_selected_school") || ""
  );
  const [selectedWingId, setSelectedWingId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"wings" | "exams">("wings");

  // Wing dialogs
  const [isWingCreateOpen, setIsWingCreateOpen] = useState(false);
  const [editWing, setEditWing] = useState<Wing | null>(null);
  const [deleteWing, setDeleteWing] = useState<Wing | null>(null);

  // Exam dialogs
  const [isExamCreateOpen, setIsExamCreateOpen] = useState(false);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null);

  // Persist selection
  useEffect(() => {
    if (selectedSchoolId) {
      localStorage.setItem("superadmin_selected_school", selectedSchoolId);
    }
  }, [selectedSchoolId]);

  // Queries
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/superadmin/schools"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/schools", {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: wings = [], isLoading: wingsLoading } = useQuery<Wing[]>({
    queryKey: ["/api/superadmin/wings", selectedSchoolId],
    queryFn: async () => {
      if (!selectedSchoolId) return [];
      const res = await fetch(`/api/superadmin/wings?schoolId=${selectedSchoolId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSchoolId,
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: ["/api/superadmin/exams", selectedSchoolId, selectedWingId],
    queryFn: async () => {
      if (!selectedSchoolId || !selectedWingId) return [];
      const res = await fetch(`/api/superadmin/exams?schoolId=${selectedSchoolId}&wingId=${selectedWingId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSchoolId && !!selectedWingId,
  });

  // Get selected objects
  const selectedSchool = schools.find(s => s.id === selectedSchoolId);
  const selectedWing = wings.find(w => w.id === selectedWingId);

  // Wing Mutations
  const createWingMutation = useMutation({
    mutationFn: async (data: Partial<Wing>) => {
      const res = await fetch("/api/superadmin/wings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
        body: JSON.stringify({ ...data, tenantId: selectedSchoolId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/wings"] });
      toast({ title: "Wing created successfully" });
      setIsWingCreateOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateWingMutation = useMutation({
    mutationFn: async (data: Partial<Wing> & { id: string }) => {
      const res = await fetch(`/api/superadmin/wings/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/wings"] });
      toast({ title: "Wing updated successfully" });
      setEditWing(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteWingMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/superadmin/wings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/wings"] });
      toast({ title: "Wing deleted successfully" });
      setDeleteWing(null);
      if (selectedWingId === deleteWing?.id) setSelectedWingId("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Exam Mutations
  const createExamMutation = useMutation({
    mutationFn: async (data: Partial<Exam>) => {
      const res = await fetch("/api/superadmin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
        body: JSON.stringify({ ...data, tenantId: selectedSchoolId, wingId: selectedWingId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/exams"] });
      toast({ title: "Exam created successfully" });
      setIsExamCreateOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateExamMutation = useMutation({
    mutationFn: async (data: Partial<Exam> & { id: string }) => {
      const res = await fetch(`/api/superadmin/exams/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/exams"] });
      toast({ title: "Exam updated successfully" });
      setEditExam(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/superadmin/exams/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/exams"] });
      toast({ title: "Exam deleted successfully" });
      setDeleteExam(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!user || user.role !== "super_admin") {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/superadmin")} data-testid="btn-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img 
              src={BRAND.logo} 
              alt={BRAND.name}
              className="h-12 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Settings</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure Wings & Exams per School</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 space-y-6 w-full">
        {/* Step 1: School Selection */}
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">1</span>
              Select School
            </CardTitle>
            <CardDescription>All configurations below will apply to the selected school only</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedSchoolId} onValueChange={(v) => { setSelectedSchoolId(v); setSelectedWingId(""); }}>
              <SelectTrigger className="max-w-md h-12" data-testid="select-school">
                <SelectValue placeholder="-- Choose a School --" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {school.name}
                      <Badge variant="outline" className="ml-2">{school.code}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedSchoolId && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Please select a school to proceed
              </p>
            )}
          </CardContent>
        </Card>

        {/* Steps 2 & 3: Wings and Exams */}
        {selectedSchoolId && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="w-5 h-5 text-blue-600" />
                {selectedSchool?.name}
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">Configuration</span>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="mb-6">
                  <TabsTrigger value="wings" className="flex items-center gap-2" data-testid="tab-wings">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold">2</span>
                    <Layers className="w-4 h-4" />
                    Wings
                  </TabsTrigger>
                  <TabsTrigger value="exams" className="flex items-center gap-2" disabled={!selectedWingId} data-testid="tab-exams">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold">3</span>
                    <FileText className="w-4 h-4" />
                    Exams
                  </TabsTrigger>
                </TabsList>

                {/* Wings Tab */}
                <TabsContent value="wings">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Wing Management</h3>
                        <p className="text-sm text-slate-500">Create wings for {selectedSchool?.name}</p>
                      </div>
                      <Button onClick={() => setIsWingCreateOpen(true)} data-testid="btn-add-wing">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Wing
                      </Button>
                    </div>

                    {wingsLoading ? (
                      <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : wings.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="font-medium mb-2">No Wings Created</h3>
                        <p className="text-sm text-slate-500 mb-4">Add wings like Primary, Middle, Secondary, etc.</p>
                        <Button onClick={() => setIsWingCreateOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Wing
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {wings.map((wing) => (
                          <div
                            key={wing.id}
                            className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedWingId === wing.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50"
                                : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                            }`}
                            onClick={() => { setSelectedWingId(wing.id); setActiveTab("exams"); }}
                            data-testid={`wing-${wing.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                <GraduationCap className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div>
                                <p className="font-medium">{wing.displayName}</p>
                                <p className="text-xs text-slate-500">
                                  Grades: {wing.grades?.join(", ") || "Not set"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={wing.isActive ? "default" : "secondary"}>
                                {wing.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditWing(wing); }}>
                                <Edit className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteWing(wing); }}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {wings.length > 0 && !selectedWingId && (
                      <p className="text-sm text-amber-600 flex items-center gap-1 mt-4">
                        <AlertTriangle className="w-4 h-4" />
                        Click on a wing above to manage its exams
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* Exams Tab */}
                <TabsContent value="exams">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          Exams for 
                          <Badge variant="outline" className="text-base">
                            <GraduationCap className="w-4 h-4 mr-1" />
                            {selectedWing?.displayName}
                          </Badge>
                        </h3>
                        <p className="text-sm text-slate-500">These exams will appear in Student Mock Tests</p>
                      </div>
                      <Button onClick={() => setIsExamCreateOpen(true)} data-testid="btn-add-exam">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Exam
                      </Button>
                    </div>

                    {examsLoading ? (
                      <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : exams.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="font-medium mb-2">No Exams Created</h3>
                        <p className="text-sm text-slate-500 mb-4">Add exams for {selectedWing?.displayName}</p>
                        <Button onClick={() => setIsExamCreateOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Exam
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 dark:bg-slate-800">
                              <TableHead>Exam Name</TableHead>
                              <TableHead>Academic Year</TableHead>
                              <TableHead>Marks</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Subjects</TableHead>
                              <TableHead>Mock Test</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {exams.map((exam) => (
                              <TableRow key={exam.id}>
                                <TableCell className="font-medium">{exam.examName}</TableCell>
                                <TableCell>{exam.academicYear}</TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1">
                                    <Award className="w-3 h-3 text-slate-400" />
                                    {exam.totalMarks}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {exam.durationMinutes} min
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {exam.subjects?.slice(0, 2).map((s, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                                    ))}
                                    {exam.subjects?.length > 2 && (
                                      <Badge variant="outline" className="text-xs">+{exam.subjects.length - 2}</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {exam.allowMockTest ? (
                                    <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-slate-400">Disabled</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={exam.isActive ? "default" : "secondary"}>
                                    {exam.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button size="icon" variant="ghost" onClick={() => setEditExam(exam)}>
                                    <Edit className="w-4 h-4 text-blue-600" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => setDeleteExam(exam)}>
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <AppFooter />

      {/* Wing Form Dialog */}
      <WingFormDialog
        isOpen={isWingCreateOpen || !!editWing}
        onClose={() => { setIsWingCreateOpen(false); setEditWing(null); }}
        wing={editWing}
        onSubmit={(data) => editWing ? updateWingMutation.mutate({ ...data, id: editWing.id }) : createWingMutation.mutate(data)}
        isLoading={createWingMutation.isPending || updateWingMutation.isPending}
      />

      {/* Wing Delete Dialog */}
      <AlertDialog open={!!deleteWing} onOpenChange={() => setDeleteWing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Wing
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>"{deleteWing?.displayName}"</strong>? All exams under this wing will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteWing && deleteWingMutation.mutate(deleteWing.id)} className="bg-red-600 hover:bg-red-700">
              Delete Wing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exam Form Dialog */}
      <ExamFormDialog
        isOpen={isExamCreateOpen || !!editExam}
        onClose={() => { setIsExamCreateOpen(false); setEditExam(null); }}
        exam={editExam}
        onSubmit={(data) => editExam ? updateExamMutation.mutate({ ...data, id: editExam.id }) : createExamMutation.mutate(data)}
        isLoading={createExamMutation.isPending || updateExamMutation.isPending}
      />

      {/* Exam Delete Dialog */}
      <AlertDialog open={!!deleteExam} onOpenChange={() => setDeleteExam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Exam
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>"{deleteExam?.examName}"</strong>? This exam will no longer appear in student mock tests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteExam && deleteExamMutation.mutate(deleteExam.id)} className="bg-red-600 hover:bg-red-700">
              Delete Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Wing Form Dialog Component
function WingFormDialog({ isOpen, onClose, wing, onSubmit, isLoading }: {
  isOpen: boolean;
  onClose: () => void;
  wing: Wing | null;
  onSubmit: (data: Partial<Wing>) => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: "", displayName: "", grades: "" });

  useEffect(() => {
    if (wing) {
      setFormData({ name: wing.name, displayName: wing.displayName, grades: wing.grades?.join(", ") || "" });
    } else {
      setFormData({ name: "", displayName: "", grades: "" });
    }
  }, [wing, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.displayName.trim()) {
      toast({ title: "Name and Display Name are required", variant: "destructive" });
      return;
    }
    onSubmit({
      name: formData.name.toLowerCase().replace(/\s+/g, "_"),
      displayName: formData.displayName,
      grades: formData.grades.split(",").map(g => g.trim()).filter(Boolean),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{wing ? "Edit Wing" : "Create Wing"}</DialogTitle>
          <DialogDescription>Define a wing for the school</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Wing Name (Internal) <span className="text-red-500">*</span></Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., primary" data-testid="input-wing-name" />
          </div>
          <div className="space-y-2">
            <Label>Display Name <span className="text-red-500">*</span></Label>
            <Input value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} placeholder="e.g., Primary Wing (1-5)" data-testid="input-wing-display" />
          </div>
          <div className="space-y-2">
            <Label>Grades (comma separated)</Label>
            <Input value={formData.grades} onChange={(e) => setFormData({ ...formData, grades: e.target.value })} placeholder="e.g., 1, 2, 3, 4, 5" data-testid="input-wing-grades" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{wing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Exam Form Dialog Component
function ExamFormDialog({ isOpen, onClose, exam, onSubmit, isLoading }: {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  onSubmit: (data: Partial<Exam>) => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    examName: "",
    academicYear: "",
    totalMarks: 100,
    durationMinutes: 60,
    examDate: "",
    subjects: "",
    questionPaperSets: 1,
    watermarkText: "",
    logoUrl: "",
    pageSize: "A4",
    allowMockTest: false,
  });

  useEffect(() => {
    if (exam) {
      setFormData({
        examName: exam.examName,
        academicYear: exam.academicYear,
        totalMarks: exam.totalMarks,
        durationMinutes: exam.durationMinutes,
        examDate: exam.examDate?.split("T")[0] || "",
        subjects: exam.subjects?.join(", ") || "",
        questionPaperSets: exam.questionPaperSets,
        watermarkText: exam.watermarkText || "",
        logoUrl: exam.logoUrl || "",
        pageSize: exam.pageSize || "A4",
        allowMockTest: exam.allowMockTest || false,
      });
    } else {
      setFormData({
        examName: "",
        academicYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
        totalMarks: 100,
        durationMinutes: 60,
        examDate: "",
        subjects: "",
        questionPaperSets: 1,
        watermarkText: "",
        logoUrl: "",
        pageSize: "A4",
        allowMockTest: false,
      });
    }
  }, [exam, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.examName.trim() || !formData.academicYear.trim()) {
      toast({ title: "Exam Name and Academic Year are required", variant: "destructive" });
      return;
    }
    onSubmit({
      examName: formData.examName,
      academicYear: formData.academicYear,
      totalMarks: formData.totalMarks,
      durationMinutes: formData.durationMinutes,
      examDate: formData.examDate || null,
      subjects: formData.subjects.split(",").map(s => s.trim()).filter(Boolean),
      questionPaperSets: formData.questionPaperSets,
      watermarkText: formData.watermarkText || null,
      logoUrl: formData.logoUrl || null,
      pageSize: formData.pageSize,
      allowMockTest: formData.allowMockTest,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exam ? "Edit Exam" : "Create Exam"}</DialogTitle>
          <DialogDescription>Configure all exam details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Exam Name <span className="text-red-500">*</span></Label>
              <Input value={formData.examName} onChange={(e) => setFormData({ ...formData, examName: e.target.value })} placeholder="e.g., Mid Term Exam" data-testid="input-exam-name" />
            </div>
            <div className="space-y-2">
              <Label>Academic Year <span className="text-red-500">*</span></Label>
              <Input value={formData.academicYear} onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })} placeholder="e.g., 2024-2025" data-testid="input-exam-year" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Total Marks</Label>
              <Input type="number" value={formData.totalMarks} onChange={(e) => setFormData({ ...formData, totalMarks: +e.target.value })} data-testid="input-exam-marks" />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={formData.durationMinutes} onChange={(e) => setFormData({ ...formData, durationMinutes: +e.target.value })} data-testid="input-exam-duration" />
            </div>
            <div className="space-y-2">
              <Label>Exam Date</Label>
              <Input type="date" value={formData.examDate} onChange={(e) => setFormData({ ...formData, examDate: e.target.value })} data-testid="input-exam-date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subjects (comma separated)</Label>
            <Input value={formData.subjects} onChange={(e) => setFormData({ ...formData, subjects: e.target.value })} placeholder="e.g., Math, Science, English" data-testid="input-exam-subjects" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Question Paper Sets</Label>
              <Input type="number" min={1} max={10} value={formData.questionPaperSets} onChange={(e) => setFormData({ ...formData, questionPaperSets: +e.target.value })} data-testid="input-exam-sets" />
            </div>
            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select value={formData.pageSize} onValueChange={(v) => setFormData({ ...formData, pageSize: v })}>
                <SelectTrigger data-testid="select-page-size"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="Letter">Letter</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Watermark Text</Label>
            <Input value={formData.watermarkText} onChange={(e) => setFormData({ ...formData, watermarkText: e.target.value })} placeholder="e.g., CONFIDENTIAL" data-testid="input-exam-watermark" />
          </div>
          <div className="space-y-2">
            <Label>Logo URL (PNG)</Label>
            <Input value={formData.logoUrl} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} placeholder="https://..." data-testid="input-exam-logo" />
          </div>
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg border">
            <input
              type="checkbox"
              id="allow-mock-test"
              checked={formData.allowMockTest}
              onChange={(e) => setFormData({ ...formData, allowMockTest: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
              data-testid="checkbox-allow-mock-test"
            />
            <Label htmlFor="allow-mock-test" className="cursor-pointer">
              <span className="font-medium">Allow Mock Test</span>
              <p className="text-xs text-muted-foreground">When enabled, students can take this exam as a practice mock test</p>
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{exam ? "Update Exam" : "Create Exam"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
