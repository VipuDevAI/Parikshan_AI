import { useState } from "react";
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
  ArrowLeft, Plus, Edit, Trash2, Building2, Phone, Mail, User, MapPin, Shield, ImageIcon
} from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
  logo?: string;
  address?: string;
  phone?: string;
  principalName?: string;
  principalEmail?: string;
  principalPhone?: string;
  active: boolean;
  createdAt?: string;
}

export default function SchoolsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [deleteSchool, setDeleteSchool] = useState<School | null>(null);

  // Fetch schools
  const { data: schools = [], isLoading } = useQuery<School[]>({
    queryKey: ["/api/superadmin/schools"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/schools", {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch schools");
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<School>) => {
      const res = await fetch("/api/superadmin/schools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create school");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/schools"] });
      toast({ title: "School created successfully" });
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<School> & { id: string }) => {
      const res = await fetch(`/api/superadmin/schools/${data.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update school");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/schools"] });
      toast({ title: "School updated successfully" });
      setEditSchool(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/superadmin/schools/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete school");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/schools"] });
      toast({ title: "School deleted successfully" });
      setDeleteSchool(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user || user.role !== "super_admin") {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Schools Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Add, Edit, Delete Schools</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button onClick={() => setIsCreateOpen(true)} data-testid="btn-add-school">
              <Plus className="w-4 h-4 mr-2" />
              Add New School
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Registered Schools
            </CardTitle>
            <CardDescription>
              {schools.length} school(s) onboarded in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : schools.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <Building2 className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Schools Yet</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Get started by adding your first school
                </p>
                <Button onClick={() => setIsCreateOpen(true)} data-testid="btn-add-school-empty">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First School
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800">
                      <TableHead className="font-semibold">School</TableHead>
                      <TableHead className="font-semibold">Code</TableHead>
                      <TableHead className="font-semibold">Principal</TableHead>
                      <TableHead className="font-semibold">Contact</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schools.map((school) => (
                      <TableRow key={school.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{school.name}</p>
                              {school.address && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {school.address}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{school.code}</Badge>
                        </TableCell>
                        <TableCell>
                          {school.principalName ? (
                            <div>
                              <p className="text-sm font-medium">{school.principalName}</p>
                              {school.principalEmail && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {school.principalEmail}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {school.phone ? (
                            <span className="text-sm flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {school.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={school.active 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }>
                            {school.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditSchool(school)}
                              data-testid={`btn-edit-${school.id}`}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteSchool(school)}
                              data-testid={`btn-delete-${school.id}`}
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
      </main>

      {/* Footer */}
      <AppFooter />

      {/* Create/Edit Dialog */}
      <SchoolFormDialog
        isOpen={isCreateOpen || !!editSchool}
        onClose={() => {
          setIsCreateOpen(false);
          setEditSchool(null);
        }}
        school={editSchool}
        onSubmit={(data) => {
          if (editSchool) {
            updateMutation.mutate({ ...data, id: editSchool.id });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSchool} onOpenChange={() => setDeleteSchool(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete School
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deleteSchool?.name}"</strong>?
              <br /><br />
              This action will soft-delete the school. All associated data (wings, exams) will be preserved but hidden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSchool && deleteMutation.mutate(deleteSchool.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="btn-confirm-delete"
            >
              Delete School
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// School Form Dialog
function SchoolFormDialog({
  isOpen,
  onClose,
  school,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  school: School | null;
  onSubmit: (data: Partial<School>) => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const isEditing = !!school;

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    logo: "",
    address: "",
    phone: "",
    principalName: "",
    principalEmail: "",
    principalPhone: "",
  });

  // Reset form when school changes
  useState(() => {
    if (school) {
      setFormData({
        name: school.name || "",
        code: school.code || "",
        logo: school.logo || "",
        address: school.address || "",
        phone: school.phone || "",
        principalName: school.principalName || "",
        principalEmail: school.principalEmail || "",
        principalPhone: school.principalPhone || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        logo: "",
        address: "",
        phone: "",
        principalName: "",
        principalEmail: "",
        principalPhone: "",
      });
    }
  });

  // Update form when school prop changes
  if (isOpen && school && formData.name !== school.name) {
    setFormData({
      name: school.name || "",
      code: school.code || "",
      logo: school.logo || "",
      address: school.address || "",
      phone: school.phone || "",
      principalName: school.principalName || "",
      principalEmail: school.principalEmail || "",
      principalPhone: school.principalPhone || "",
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ title: "School name is required", variant: "destructive" });
      return;
    }
    if (!isEditing && !formData.code.trim()) {
      toast({ title: "School code is required", variant: "destructive" });
      return;
    }
    
    onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({
      name: "",
      code: "",
      logo: "",
      address: "",
      phone: "",
      principalName: "",
      principalEmail: "",
      principalPhone: "",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {isEditing ? "Edit School" : "Add New School"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update school information" : "Enter the school details to onboard"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* School Info */}
          <div className="space-y-4 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              School Information
            </h4>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>School Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Delhi Public School"
                  data-testid="input-school-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>School Code <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., DPS001"
                    disabled={isEditing}
                    data-testid="input-school-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label>School Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., +91 9876543210"
                    data-testid="input-school-phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 123 Main Street, City"
                  data-testid="input-school-address"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  School Logo URL
                </Label>
                <Input
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  data-testid="input-school-logo"
                />
                <p className="text-xs text-muted-foreground">Used in question papers and certificates</p>
                {formData.logo && (
                  <div className="mt-2 p-2 border rounded-lg bg-white dark:bg-slate-800">
                    <img 
                      src={formData.logo} 
                      alt="Logo preview" 
                      className="h-16 w-auto mx-auto object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Principal Info */}
          <div className="space-y-4 p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <User className="w-4 h-4" />
              Principal Information
            </h4>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Principal Name</Label>
                <Input
                  value={formData.principalName}
                  onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                  placeholder="e.g., Dr. Sharma"
                  data-testid="input-principal-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Email</Label>
                  <Input
                    type="email"
                    value={formData.principalEmail}
                    onChange={(e) => setFormData({ ...formData, principalEmail: e.target.value })}
                    placeholder="principal@school.edu"
                    data-testid="input-principal-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Principal Phone</Label>
                  <Input
                    value={formData.principalPhone}
                    onChange={(e) => setFormData({ ...formData, principalPhone: e.target.value })}
                    placeholder="+91 9876543210"
                    data-testid="input-principal-phone"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} data-testid="btn-submit-school">
              {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
              {isEditing ? "Update School" : "Create School"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
