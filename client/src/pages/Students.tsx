import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  GraduationCap, 
  Loader2,
  User,
  Phone,
  Mail,
  Upload,
  Download,
  Trash2,
  Pencil,
  FileSpreadsheet,
  UserPlus
} from "lucide-react";
import { ActionTile, ActionTileGroup } from "@/components/ui/action-tile";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function StudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    fullName: "",
    admissionNumber: "",
    classId: "",
    sectionId: "",
    parentPhone: "",
    parentEmail: "",
    dateOfBirth: "",
    gender: "MALE",
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const res = await fetch("/api/students", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleDeleteAllStudents = async () => {
    setIsDeletingAll(true);
    try {
      for (const s of students) {
        await deleteStudent.mutateAsync(s.id);
      }
      toast({ title: "All students deleted" });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["/api/classes"],
  });

  const { data: sections = [] } = useQuery<any[]>({
    queryKey: ["/api/sections"],
  });

  const createStudent = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/students", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setIsAddOpen(false);
      setNewStudent({
        fullName: "",
        admissionNumber: "",
        classId: "",
        sectionId: "",
        parentPhone: "",
        parentEmail: "",
        dateOfBirth: "",
        gender: "MALE",
      });
      toast({ title: "Student added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add student", description: error.message, variant: "destructive" });
    },
  });

  const deleteStudent = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Student removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove student", description: error.message, variant: "destructive" });
    },
  });

  const updateStudent = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/students/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setEditingStudent(null);
      toast({ title: "Student updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update student", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpload = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await apiRequest("POST", "/api/students/bulk", { data });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setIsBulkOpen(false);
      setCsvData([]);
      setCsvFile(null);
      const failed = data.errors?.length || 0;
      toast({ 
        title: "Bulk upload completed",
        description: `${data.created} students added, ${failed} failed`
      });
    },
    onError: (error: any) => {
      toast({ title: "Bulk upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "File must have headers and at least one row", variant: "destructive" });
        return;
      }
      // Preserve original header casing for backend field matching
      const headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
      const rows = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/['"]/g, ""));
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || "";
        });
        return obj;
      });
      setCsvData(rows);
    };
    reader.readAsText(file);
  };

  const filteredStudents = students.filter((student: any) => {
    const matchesSearch = student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === "all" || String(student.classId) === selectedClass;
    const matchesSection = selectedSection === "all" || String(student.sectionId) === selectedSection;
    return matchesSearch && matchesClass && matchesSection;
  });

  const getSectionName = (sectionId: number) => {
    const section = sections.find((s: any) => s.id === sectionId);
    if (!section) return "-";
    const classItem = classes.find((c: any) => c.id === section.classId);
    return `${classItem?.name || ""} - ${section.name}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground" data-testid="text-title">
            Students
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage student records and information
          </p>
        </div>
        
        <Card className="p-4">
          <ActionTileGroup>
            <ActionTile
              icon={UserPlus}
              label="Add Student"
              variant="primary"
              size="lg"
              onClick={() => setIsAddOpen(true)}
              data-testid="tile-add-student"
            />
            <ActionTile
              icon={Upload}
              label="Bulk Upload"
              variant="success"
              size="lg"
              onClick={() => setIsBulkOpen(true)}
              data-testid="tile-bulk-upload"
            />
            <ActionTile
              icon={Download}
              label="Download Template"
              variant="info"
              size="lg"
              onClick={() => window.open('/api/students/template', '_blank')}
              data-testid="tile-download-template"
            />
            <ActionTile
              icon={isDeletingAll ? Loader2 : Trash2}
              label="Delete All Students"
              variant="danger"
              size="lg"
              disabled={!students.length || isDeletingAll}
              onClick={() => setDeleteAllDialogOpen(true)}
              data-testid="tile-delete-all-students"
            />
          </ActionTileGroup>
        </Card>
      </div>

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Students?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {students.length} student(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleDeleteAllStudents(); setDeleteAllDialogOpen(false); }}>Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Upload Students</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a CSV file with student data. Download the template for the correct format.
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload-students"
                    data-testid="input-csv-file"
                  />
                  <Button variant="outline" onClick={() => document.getElementById("csv-upload-students")?.click()}>
                    Select CSV File
                  </Button>
                  {csvFile && <p className="mt-2 text-sm">{csvFile.name}</p>}
                </div>
                {csvData.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Preview (first 5 records):</p>
                    <div className="overflow-x-auto max-h-48 border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(csvData[0]).slice(0, 5).map((key) => (
                              <TableHead key={key} className="text-xs whitespace-nowrap">{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvData.slice(0, 5).map((row, idx) => (
                            <TableRow key={idx}>
                              {Object.values(row).slice(0, 5).map((val, i) => (
                                <TableCell key={i} className="text-xs">{String(val)}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setIsBulkOpen(false); setCsvData([]); setCsvFile(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => bulkUpload.mutate(csvData)}
                    disabled={csvData.length === 0 || bulkUpload.isPending}
                    data-testid="button-submit-bulk"
                  >
                    {bulkUpload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Upload {csvData.length} Students
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={newStudent.fullName}
                    onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                    placeholder="Enter student name"
                    data-testid="input-student-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admission Number</Label>
                  <Input
                    value={newStudent.admissionNumber}
                    onChange={(e) => setNewStudent({ ...newStudent, admissionNumber: e.target.value })}
                    placeholder="e.g., STU2025001"
                    data-testid="input-admission-number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select
                      value={newStudent.classId}
                      onValueChange={(v) => setNewStudent({ ...newStudent, classId: v })}
                    >
                      <SelectTrigger data-testid="select-class">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select
                      value={newStudent.sectionId}
                      onValueChange={(v) => setNewStudent({ ...newStudent, sectionId: v })}
                    >
                      <SelectTrigger data-testid="select-section">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections
                          .filter((s: any) => !newStudent.classId || String(s.classId) === newStudent.classId)
                          .map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={newStudent.dateOfBirth}
                      onChange={(e) => setNewStudent({ ...newStudent, dateOfBirth: e.target.value })}
                      data-testid="input-dob"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={newStudent.gender}
                      onValueChange={(v) => setNewStudent({ ...newStudent, gender: v })}
                    >
                      <SelectTrigger data-testid="select-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Parent Phone</Label>
                  <Input
                    value={newStudent.parentPhone}
                    onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                    placeholder="+91 9876543210"
                    data-testid="input-parent-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parent Email</Label>
                  <Input
                    type="email"
                    value={newStudent.parentEmail}
                    onChange={(e) => setNewStudent({ ...newStudent, parentEmail: e.target.value })}
                    placeholder="parent@email.com"
                    data-testid="input-parent-email"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createStudent.mutate({
                    ...newStudent,
                    schoolId: user?.schoolId,
                    classId: Number(newStudent.classId),
                    sectionId: Number(newStudent.sectionId),
                  })}
                  disabled={createStudent.isPending || !newStudent.fullName || !newStudent.sectionId}
                  data-testid="button-save-student"
                >
                  {createStudent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Student
                </Button>
              </div>
            </DialogContent>
          </Dialog>

      <Card className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or admission number..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[150px]" data-testid="filter-class">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="w-[150px]" data-testid="filter-section">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sections.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No students found</p>
            <p className="text-sm">Add students to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Class/Section</TableHead>
                  <TableHead>Parent Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student: any) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{student.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{student.admissionNumber || "-"}</TableCell>
                    <TableCell>{getSectionName(student.sectionId)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {student.parentPhone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3" /> {student.parentPhone}
                          </div>
                        )}
                        {student.parentEmail && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" /> {student.parentEmail}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.isActive !== false ? "default" : "secondary"}>
                        {student.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setEditingStudent(student)}
                          data-testid={`button-edit-student-${student.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-student-${student.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove {student.fullName} from the system. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteStudent.mutate(student.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editingStudent.fullName || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                  data-testid="input-edit-student-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Admission Number</Label>
                <Input
                  value={editingStudent.admissionNumber || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, admissionNumber: e.target.value })}
                  data-testid="input-edit-admission-number"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select
                    value={String(editingStudent.classId || "")}
                    onValueChange={(v) => setEditingStudent({ ...editingStudent, classId: Number(v) })}
                  >
                    <SelectTrigger data-testid="select-edit-class">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={String(editingStudent.sectionId || "")}
                    onValueChange={(v) => setEditingStudent({ ...editingStudent, sectionId: Number(v) })}
                  >
                    <SelectTrigger data-testid="select-edit-section">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections
                        .filter((s: any) => !editingStudent.classId || s.classId === editingStudent.classId)
                        .map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={editingStudent.gender || "MALE"}
                  onValueChange={(v) => setEditingStudent({ ...editingStudent, gender: v })}
                >
                  <SelectTrigger data-testid="select-edit-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parent Phone</Label>
                <Input
                  value={editingStudent.parentPhone || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                  data-testid="input-edit-parent-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Parent Email</Label>
                <Input
                  type="email"
                  value={editingStudent.parentEmail || ""}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parentEmail: e.target.value })}
                  data-testid="input-edit-parent-email"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingStudent(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateStudent.mutate({ 
                    id: editingStudent.id, 
                    data: { 
                      fullName: editingStudent.fullName,
                      admissionNumber: editingStudent.admissionNumber,
                      sectionId: editingStudent.sectionId,
                      gender: editingStudent.gender,
                      parentPhone: editingStudent.parentPhone,
                      parentEmail: editingStudent.parentEmail
                    } 
                  })}
                  disabled={updateStudent.isPending}
                  data-testid="button-save-student"
                >
                  {updateStudent.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
