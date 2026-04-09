import { useState, useEffect, useRef } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, Plus, Edit, Trash2, Building2, Users, Mail, Shield, 
  GraduationCap, UserCheck, AlertTriangle, Upload, Download, FileSpreadsheet,
  CheckCircle2, XCircle, BookOpen, Layers
} from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
  active?: boolean;
}

interface Wing {
  id: string;
  name: string;
  displayName: string;
  tenantId: string;
}

interface User {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: string;
  grade: string | null;
  section: string | null;
  wingId: string | null;
  subjects: string[];
  active: boolean;
  userCode?: string;
}

const ROLES = [
  { value: "principal", label: "Principal", color: "bg-purple-100 text-purple-700" },
  { value: "hod", label: "HOD", color: "bg-blue-100 text-blue-700" },
  { value: "teacher", label: "Teacher", color: "bg-green-100 text-green-700" },
  { value: "student", label: "Student", color: "bg-amber-100 text-amber-700" },
  { value: "parent", label: "Parent", color: "bg-pink-100 text-pink-700" },
];

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const COMMON_SUBJECTS = [
  "Mathematics", "Science", "English", "Hindi", "Social Studies", 
  "Physics", "Chemistry", "Biology", "Computer Science", "History",
  "Geography", "Economics", "Political Science", "Accountancy", "Business Studies",
  "Physical Education", "Art", "Music"
];

// CSV Template generators
const generateTeacherTemplate = () => {
  const headers = ["name", "email", "password", "wing", "subjects"];
  const sampleData = [
    ["John Smith", "john.smith@school.edu", "Teacher@123", "Primary", "Mathematics,Science"],
    ["Jane Doe", "jane.doe@school.edu", "Teacher@123", "Middle", "English,Hindi"],
    ["Robert Wilson", "robert.wilson@school.edu", "Teacher@123", "Senior", "Physics,Chemistry,Mathematics"],
  ];
  const instructions = [
    "# TEACHER UPLOAD TEMPLATE",
    "# Instructions:",
    "# - name: Full name of the teacher (Required)",
    "# - email: Email address (Required)",
    "# - password: Initial password (Required)",
    "# - wing: Wing name - Primary/Middle/Senior (Required)",
    "# - subjects: Comma-separated list of subjects (Required)",
    "#",
    "# Note: Wing must match exactly with wings created in Admin Settings",
    ""
  ];
  return [...instructions, headers.join(","), ...sampleData.map(row => row.join(","))].join("\n");
};

const generateStudentTemplate = () => {
  const headers = ["name", "email", "password", "class", "section", "roll_number"];
  const sampleData = [
    ["Alice Johnson", "alice@school.edu", "Student@123", "5", "A", "501"],
    ["Bob Smith", "bob@school.edu", "Student@123", "5", "B", "502"],
    ["Charlie Brown", "charlie@school.edu", "Student@123", "6", "A", "601"],
  ];
  const instructions = [
    "# STUDENT UPLOAD TEMPLATE",
    "# Instructions:",
    "# - name: Full name of the student (Required)",
    "# - email: Email address (Required)",
    "# - password: Initial password (Required)",
    "# - class: Grade/Class number 1-12 (Required)",
    "# - section: Section name like A, B, C (Optional - Super Admin can fill)",
    "# - roll_number: Roll number (Optional)",
    ""
  ];
  return [...instructions, headers.join(","), ...sampleData.map(row => row.join(","))].join("\n");
};

const downloadTemplate = (type: "teacher" | "student") => {
  const content = type === "teacher" ? generateTeacherTemplate() : generateStudentTemplate();
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}_upload_template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function SuperAdminUsersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() =>
    localStorage.getItem("superadmin_selected_school") || ""
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  // Persist school selection
  useEffect(() => {
    if (selectedSchoolId) {
      localStorage.setItem("superadmin_selected_school", selectedSchoolId);
    }
  }, [selectedSchoolId]);

  // Fetch schools
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

  // Fetch wings for selected school
  const { data: wings = [] } = useQuery<Wing[]>({
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

  // Fetch users for selected school
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/superadmin/users", selectedSchoolId],
    queryFn: async () => {
      if (!selectedSchoolId) return [];
      const res = await fetch(`/api/superadmin/users?schoolId=${selectedSchoolId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSchoolId,
  });

  const activeSchools = schools.filter(s => s.active !== false);
  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<User> & { password: string }) => {
      const res = await fetch("/api/superadmin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}`,
        },
        body: JSON.stringify({ ...data, tenantId: selectedSchoolId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      toast({ title: "User created successfully" });
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<User> & { id: string; password?: string }) => {
      const res = await fetch(`/api/superadmin/users/${data.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      toast({ title: "User updated successfully" });
      setEditUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/superadmin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users"] });
      toast({ title: "User deleted successfully" });
      setDeleteUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getRoleBadge = (role: string) => {
    const roleConfig = ROLES.find(r => r.value === role);
    return roleConfig ? (
      <Badge className={roleConfig.color}>{roleConfig.label}</Badge>
    ) : (
      <Badge variant="outline">{role}</Badge>
    );
  };

  const getWingName = (wingId: string | null) => {
    if (!wingId) return null;
    const wing = wings.find(w => w.id === wingId);
    return wing?.displayName || wing?.name || null;
  };

  if (!user || user.role !== "super_admin") {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Users Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create users for each school</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 space-y-6 w-full">
        {/* School Selection */}
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-600 text-white text-sm font-bold">1</span>
              Select School
            </CardTitle>
            <CardDescription>Choose a school to manage its users</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
              <SelectTrigger className="max-w-md h-12" data-testid="select-school">
                <SelectValue placeholder="-- Choose a School --" />
              </SelectTrigger>
              <SelectContent>
                {activeSchools.map((school) => (
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
                Please select a school to manage users
              </p>
            )}
          </CardContent>
        </Card>

        {/* Users List */}
        {selectedSchoolId && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Users for {selectedSchool?.name}
                  </CardTitle>
                  <CardDescription>
                    {users.length} user(s) in this school
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)} data-testid="btn-bulk-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Upload
                  </Button>
                  <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="btn-add-user">
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                  <Users className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Users Yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Add principals, teachers, and students for this school
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Bulk Upload
                    </Button>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First User
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800">
                        <TableHead className="font-semibold">User</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Wing/Class</TableHead>
                        <TableHead className="font-semibold">Subjects/Section</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                <UserCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                                {u.userCode && (
                                  <p className="text-xs text-slate-500 font-mono">{u.userCode}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {u.email}
                            </span>
                          </TableCell>
                          <TableCell>{getRoleBadge(u.role)}</TableCell>
                          <TableCell>
                            {(u.role === "teacher" || u.role === "hod") && u.wingId ? (
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30">
                                <Layers className="w-3 h-3 mr-1" />
                                {getWingName(u.wingId)}
                              </Badge>
                            ) : u.role === "student" && u.grade ? (
                              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30">
                                <GraduationCap className="w-3 h-3 mr-1" />
                                Class {u.grade}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(u.role === "teacher" || u.role === "hod") && u.subjects && u.subjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {u.subjects.slice(0, 2).map((subj, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {subj}
                                  </Badge>
                                ))}
                                {u.subjects.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{u.subjects.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : u.role === "student" && u.section ? (
                              <Badge variant="outline">
                                Section {u.section}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={u.active !== false
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }>
                              {u.active !== false ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditUser(u)}
                                data-testid={`btn-edit-${u.id}`}
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteUser(u)}
                                data-testid={`btn-delete-${u.id}`}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <AppFooter />

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Add a new user for school {selectedSchool?.code}
            </DialogDescription>
          </DialogHeader>
          <UserForm
            wings={wings}
            onSubmit={(data) => createMutation.mutate(data as any)}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <UserForm
              user={editUser}
              wings={wings}
              onSubmit={(data) => updateMutation.mutate({ ...data, id: editUser.id })}
              onCancel={() => setEditUser(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Bulk Upload Users
            </DialogTitle>
            <DialogDescription>
              Upload multiple teachers or students using CSV file
            </DialogDescription>
          </DialogHeader>
          <BulkUploadForm
            schoolId={selectedSchoolId}
            schoolCode={selectedSchool?.code || ""}
            wings={wings}
            onSuccess={() => {
              refetchUsers();
              setIsBulkUploadOpen(false);
            }}
            onCancel={() => setIsBulkUploadOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deleteUser?.name}"</strong>?
              <br /><br />
              This will deactivate the user account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// User Form Component
function UserForm({
  user,
  wings,
  onSubmit,
  onCancel,
  isLoading,
}: {
  user?: User | null;
  wings: Wing[];
  onSubmit: (data: Partial<User> & { password?: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const isEditing = !!user;

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "teacher");
  const [grade, setGrade] = useState(user?.grade || "");
  const [section, setSection] = useState(user?.section || "");
  const [wingId, setWingId] = useState(user?.wingId || "");
  const [subjects, setSubjects] = useState<string[]>(user?.subjects || []);

  const handleSubjectToggle = (subject: string) => {
    setSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }
    if (!isEditing && !password.trim()) {
      toast({ title: "Password is required for new users", variant: "destructive" });
      return;
    }
    if ((role === "teacher" || role === "hod") && !wingId) {
      toast({ title: "Wing is required for teachers and HODs", variant: "destructive" });
      return;
    }
    if ((role === "teacher" || role === "hod") && subjects.length === 0) {
      toast({ title: "At least one subject is required for teachers and HODs", variant: "destructive" });
      return;
    }
    if (role === "student" && !grade) {
      toast({ title: "Class is required for students", variant: "destructive" });
      return;
    }
    
    const data: any = {
      name: name.trim(),
      email: email.trim(),
      role,
      grade: role === "student" ? grade : null,
      section: role === "student" ? section || null : null,
      wingId: (role === "teacher" || role === "hod") ? wingId : null,
      subjects: (role === "teacher" || role === "hod") ? subjects : [],
    };
    
    if (password) {
      data.password = password;
    }
    
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., John Doe"
          data-testid="input-user-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g., john@school.edu"
          data-testid="input-user-email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          Password {!isEditing && <span className="text-red-500">*</span>}
          {isEditing && <span className="text-slate-400 text-xs ml-2">(leave blank to keep current)</span>}
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEditing ? "Enter new password" : "Enter password"}
          data-testid="input-user-password"
        />
      </div>

      <div className="space-y-2">
        <Label>Role <span className="text-red-500">*</span></Label>
        <Select value={role} onValueChange={(v) => { setRole(v); setWingId(""); setSubjects([]); setGrade(""); setSection(""); }}>
          <SelectTrigger data-testid="select-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {r.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Teacher and HOD specific fields */}
      {(role === "teacher" || role === "hod") && (
        <>
          <div className="space-y-2">
            <Label>Wing <span className="text-red-500">*</span></Label>
            <Select value={wingId} onValueChange={setWingId}>
              <SelectTrigger data-testid="select-wing">
                <SelectValue placeholder="Select wing" />
              </SelectTrigger>
              <SelectContent>
                {wings.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      {w.displayName || w.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {wings.length === 0 && (
              <p className="text-xs text-amber-600">
                No wings found. Please create wings in Admin Settings first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Subjects <span className="text-red-500">*</span></Label>
            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-2">
                {COMMON_SUBJECTS.map((subj) => (
                  <div key={subj} className="flex items-center space-x-2">
                    <Checkbox
                      id={`subj-${subj}`}
                      checked={subjects.includes(subj)}
                      onCheckedChange={() => handleSubjectToggle(subj)}
                    />
                    <label
                      htmlFor={`subj-${subj}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {subj}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {subjects.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Student specific fields */}
      {role === "student" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Class <span className="text-red-500">*</span></Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger data-testid="select-grade">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Class {g}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Section</Label>
            <Input
              value={section}
              onChange={(e) => setSection(e.target.value.toUpperCase())}
              placeholder="e.g., A, B, C"
              maxLength={5}
              data-testid="input-section"
            />
          </div>
        </div>
      )}

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="btn-submit-user">
          {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
          {isEditing ? "Update User" : "Create User"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Bulk Upload Form Component
function BulkUploadForm({
  schoolId,
  schoolCode,
  wings,
  onSuccess,
  onCancel,
}: {
  schoolId: string;
  schoolCode: string;
  wings: Wing[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"teacher" | "student">("teacher");
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n")
        .filter(line => line.trim() && !line.trim().startsWith("#"));
      
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "File must have header row and at least one data row", variant: "destructive" });
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const data = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = values[i]?.trim() || "";
        });
        return obj;
      }).filter(row => row.name && row.email);

      setParsedData(data);
      setUploadResults(null);
    };
    reader.readAsText(file);
  };

  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast({ title: "No data to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadResults(null);

    try {
      const res = await fetch("/api/superadmin/users/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}`,
        },
        body: JSON.stringify({
          tenantId: schoolId,
          role: uploadType,
          users: parsedData,
          wingMapping: wings.reduce((acc, w) => {
            acc[w.name.toLowerCase()] = w.id;
            acc[w.displayName?.toLowerCase() || ""] = w.id;
            return acc;
          }, {} as Record<string, string>),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setUploadResults(result);
      
      if (result.created > 0) {
        toast({ 
          title: "Upload Complete", 
          description: `${result.created} users created successfully${result.failed > 0 ? `, ${result.failed} failed` : ""}` 
        });
      }

      if (result.failed === 0) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setParsedData([]);
    setUploadResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Upload Type Tabs */}
      <Tabs value={uploadType} onValueChange={(v) => { setUploadType(v as any); clearFile(); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="teacher" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Teachers
          </TabsTrigger>
          <TabsTrigger value="student" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Students
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teacher" className="mt-4">
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <h4 className="font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Teacher CSV Format
            </h4>
            <div className="text-sm text-green-700 dark:text-green-400 mb-3 space-y-1">
              <p><strong>Required:</strong> <code className="bg-green-100 dark:bg-green-900 px-1 rounded">name, email, password, wing, subjects</code></p>
              <p><strong>Wing values:</strong> {wings.length > 0 ? wings.map(w => w.displayName || w.name).join(", ") : "No wings created yet"}</p>
              <p><strong>Subjects:</strong> Comma-separated (e.g., "Mathematics,Science,English")</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate("teacher")} className="bg-white dark:bg-slate-800">
              <Download className="w-4 h-4 mr-2" />
              Download Teacher Template
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="student" className="mt-4">
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Student CSV Format
            </h4>
            <div className="text-sm text-amber-700 dark:text-amber-400 mb-3 space-y-1">
              <p><strong>Required:</strong> <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">name, email, password, class</code></p>
              <p><strong>Optional:</strong> <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">section, roll_number</code></p>
              <p><strong>Class:</strong> 1-12</p>
              <p><strong>Section:</strong> Leave blank if Super Admin will fill later</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate("student")} className="bg-white dark:bg-slate-800">
              <Download className="w-4 h-4 mr-2" />
              Download Student Template
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* File Upload */}
      <div className="space-y-2">
        <Label>Upload CSV File</Label>
        <div className="flex items-center gap-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="flex-1"
            data-testid="input-csv-file"
          />
          {parsedData.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFile}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      {parsedData.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Preview ({parsedData.length} rows)
            </h4>
          </div>
          <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  {uploadType === "teacher" ? (
                    <>
                      <TableHead>Wing</TableHead>
                      <TableHead>Subjects</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.slice(0, 10).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    {uploadType === "teacher" ? (
                      <>
                        <TableCell>{row.wing || "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{row.subjects || "-"}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{row.class || "-"}</TableCell>
                        <TableCell>{row.section || "-"}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {parsedData.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">
                      ... and {parsedData.length - 10} more rows
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <div className={`p-4 rounded-lg border ${
          uploadResults.failed === 0 
            ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
        }`}>
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{uploadResults.created} created</span>
            </div>
            {uploadResults.failed > 0 && (
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">{uploadResults.failed} failed</span>
              </div>
            )}
          </div>
          {uploadResults.errors && uploadResults.errors.length > 0 && (
            <div className="text-sm text-red-600 dark:text-red-400 mt-2">
              <p className="font-medium mb-1">Errors:</p>
              <ul className="list-disc list-inside space-y-1">
                {uploadResults.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {uploadResults.errors.length > 5 && (
                  <li>... and {uploadResults.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleUpload} 
          disabled={parsedData.length === 0 || isUploading}
          data-testid="btn-upload-users"
        >
          {isUploading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
          <Upload className="w-4 h-4 mr-2" />
          Upload {parsedData.length} {uploadType === "teacher" ? "Teachers" : "Students"}
        </Button>
      </DialogFooter>
    </div>
  );
}
