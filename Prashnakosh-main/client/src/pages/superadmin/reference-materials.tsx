import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLogo } from "@/components/app-logo";
import { AppFooter } from "@/components/app-footer";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, LogOut, FileText, Plus, Trash2, Pencil, 
  Download, BookOpen, FileQuestion, ClipboardList, Library,
  Filter, Search
} from "lucide-react";

type ReferenceMaterial = {
  id: string;
  title: string;
  description?: string;
  grade: string;
  subject?: string;
  category: string;
  academicYear?: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  s3Key?: string;
  fileUrl?: string;
  isActive: boolean;
  createdAt?: string;
};

const CATEGORIES = [
  { value: "question_paper", label: "Previous Year Question Paper", icon: FileQuestion },
  { value: "reference_notes", label: "Reference Notes", icon: BookOpen },
  { value: "answer_key", label: "Answer Key", icon: ClipboardList },
  { value: "syllabus", label: "Syllabus", icon: Library },
];

const GRADES = ["10", "12"];

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English",
  "Hindi", "Social Science", "Computer Science", "Economics", 
  "Business Studies", "Accountancy", "Physical Education"
];

const ACADEMIC_YEARS = ["2024-25", "2023-24", "2022-23", "2021-22", "2020-21", "2019-20", "2018-19", "2017-18", "2016-17", "2015-16"];

function formatFileSize(bytes: number = 0): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getCategoryIcon(category: string) {
  const cat = CATEGORIES.find(c => c.value === category);
  return cat ? cat.icon : FileText;
}

function getCategoryLabel(category: string) {
  const cat = CATEGORIES.find(c => c.value === category);
  return cat ? cat.label : category;
}

export default function ReferenceMaterialsPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ReferenceMaterial | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    grade: "10",
    subject: "",
    category: "question_paper",
    academicYear: "2024-25",
    fileName: "",
    fileSize: 0,
    mimeType: "",
  });

  if (!user || user.role !== "super_admin") {
    navigate("/");
    return null;
  }

  // Fetch reference materials
  const { data: materials = [], isLoading } = useQuery<ReferenceMaterial[]>({
    queryKey: ["/api/superadmin/reference-materials"],
    enabled: !!user,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<ReferenceMaterial>) => {
      const token = localStorage.getItem("safal_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch("/api/superadmin/reference-materials", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/reference-materials"] });
      toast({ title: "Success", description: "Reference material created successfully" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReferenceMaterial> }) => {
      const token = localStorage.getItem("safal_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/superadmin/reference-materials/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/reference-materials"] });
      toast({ title: "Success", description: "Reference material updated successfully" });
      setEditingMaterial(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("safal_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/superadmin/reference-materials/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/reference-materials"] });
      toast({ title: "Success", description: "Reference material deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      grade: "10",
      subject: "",
      category: "question_paper",
      academicYear: "2024-25",
      fileName: "",
      fileSize: 0,
      mimeType: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMaterial) {
      updateMutation.mutate({ id: editingMaterial.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (material: ReferenceMaterial) => {
    setEditingMaterial(material);
    setFormData({
      title: material.title,
      description: material.description || "",
      grade: material.grade,
      subject: material.subject || "",
      category: material.category,
      academicYear: material.academicYear || "",
      fileName: material.fileName,
      fileSize: material.fileSize || 0,
      mimeType: material.mimeType || "",
    });
  };

  // Filter materials
  const filteredMaterials = materials.filter((m) => {
    if (filterGrade !== "all" && m.grade !== filterGrade) return false;
    if (filterCategory !== "all" && m.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.subject?.toLowerCase().includes(q) ||
        m.fileName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: materials.length,
    class10: materials.filter(m => m.grade === "10").length,
    class12: materials.filter(m => m.grade === "12").length,
    questionPapers: materials.filter(m => m.category === "question_paper").length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-300">
      {/* Header */}
      <header className="relative border-b border-white/20 dark:border-slate-800/50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900 text-white shadow-xl shadow-indigo-500/20 dark:shadow-indigo-900/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo size="lg" showText={false} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reference Materials Library</h1>
              <p className="text-sm text-white/80">Global resources for Class 10 & 12 students</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/superadmin")}
              className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white"
              data-testid="btn-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white"
              data-testid="btn-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-blue-100">Total Materials</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.class10}</p>
              <p className="text-sm text-green-100">Class 10</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.class12}</p>
              <p className="text-sm text-purple-100">Class 12</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.questionPapers}</p>
              <p className="text-sm text-orange-100">Question Papers</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger className="w-[140px]" data-testid="filter-grade">
                      <SelectValue placeholder="Grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      <SelectItem value="10">Class 10</SelectItem>
                      <SelectItem value="12">Class 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[200px]" data-testid="filter-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search materials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-[200px]"
                    data-testid="search-input"
                  />
                </div>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    data-testid="btn-add-material"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Reference Material
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add New Reference Material</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Grade (Class)</Label>
                        <Select
                          value={formData.grade}
                          onValueChange={(v) => setFormData({ ...formData, grade: v })}
                        >
                          <SelectTrigger data-testid="input-grade">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADES.map((g) => (
                              <SelectItem key={g} value={g}>Class {g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(v) => setFormData({ ...formData, category: v })}
                        >
                          <SelectTrigger data-testid="input-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., CBSE Maths Question Paper 2023"
                        required
                        data-testid="input-title"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Subject</Label>
                        <Select
                          value={formData.subject}
                          onValueChange={(v) => setFormData({ ...formData, subject: v })}
                        >
                          <SelectTrigger data-testid="input-subject">
                            <SelectValue placeholder="Select subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBJECTS.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Academic Year</Label>
                        <Select
                          value={formData.academicYear}
                          onValueChange={(v) => setFormData({ ...formData, academicYear: v })}
                        >
                          <SelectTrigger data-testid="input-academic-year">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACADEMIC_YEARS.map((y) => (
                              <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Description (Optional)</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of this material..."
                        rows={3}
                        data-testid="input-description"
                      />
                    </div>
                    <div>
                      <Label>File Name</Label>
                      <Input
                        value={formData.fileName}
                        onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                        placeholder="e.g., cbse_maths_2023.pdf"
                        required
                        data-testid="input-filename"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Note: Actual file upload to S3 will be enabled after S3 is configured.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        data-testid="btn-submit-material"
                      >
                        {createMutation.isPending ? "Creating..." : "Create Material"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reference Materials</CardTitle>
            <CardDescription>
              Global resources accessible to Class 10 & 12 students (read-only for students)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Library className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No reference materials found</p>
                <p className="text-sm">
                  {materials.length === 0
                    ? "Add your first reference material to get started."
                    : "Try adjusting your filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => {
                      const CategoryIcon = getCategoryIcon(material.category);
                      return (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium max-w-[200px] truncate" title={material.title}>
                            {material.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Class {material.grade}</Badge>
                          </TableCell>
                          <TableCell>{material.subject || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CategoryIcon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{getCategoryLabel(material.category)}</span>
                            </div>
                          </TableCell>
                          <TableCell>{material.academicYear || "-"}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="truncate max-w-[120px]" title={material.fileName}>
                                {material.fileName}
                              </p>
                              {material.fileSize && material.fileSize > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(material.fileSize)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(material)}
                                data-testid={`btn-edit-${material.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this material?")) {
                                    deleteMutation.mutate(material.id);
                                  }
                                }}
                                data-testid={`btn-delete-${material.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingMaterial} onOpenChange={(open) => !open && setEditingMaterial(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Reference Material</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Grade (Class)</Label>
                  <Select
                    value={formData.grade}
                    onValueChange={(v) => setFormData({ ...formData, grade: v })}
                  >
                    <SelectTrigger data-testid="edit-grade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g} value={g}>Class {g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-testid="edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  data-testid="edit-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subject</Label>
                  <Select
                    value={formData.subject}
                    onValueChange={(v) => setFormData({ ...formData, subject: v })}
                  >
                    <SelectTrigger data-testid="edit-subject">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Academic Year</Label>
                  <Select
                    value={formData.academicYear}
                    onValueChange={(v) => setFormData({ ...formData, academicYear: v })}
                  >
                    <SelectTrigger data-testid="edit-academic-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACADEMIC_YEARS.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  data-testid="edit-description"
                />
              </div>
              <div>
                <Label>File Name</Label>
                <Input
                  value={formData.fileName}
                  onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                  required
                  data-testid="edit-filename"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMaterial(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="btn-update-material"
                >
                  {updateMutation.isPending ? "Updating..." : "Update Material"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
