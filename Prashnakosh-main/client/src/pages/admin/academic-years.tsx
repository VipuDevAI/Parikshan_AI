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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Plus, Calendar, CheckCircle, Lock, Edit, Trash2,
  Building2, AlertTriangle, XCircle
} from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
}

interface AcademicYear {
  id: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
}

export default function AcademicYearsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // State
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => 
    localStorage.getItem("superadmin_selected_school") || ""
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editYear, setEditYear] = useState<AcademicYear | null>(null);
  const [deleteYear, setDeleteYear] = useState<AcademicYear | null>(null);

  const isAuthorized = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  // Persist selection
  useEffect(() => {
    if (selectedSchoolId) {
      localStorage.setItem("superadmin_selected_school", selectedSchoolId);
    }
  }, [selectedSchoolId]);

  // Fetch schools
  const { data: schools = [], isLoading: schoolsLoading } = useQuery<School[]>({
    queryKey: ["/api/admin/schools"],
    queryFn: async () => {
      const res = await fetch("/api/admin/schools", {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  // Determine which tenant to use
  const targetTenantId = isSuperAdmin ? selectedSchoolId : user?.tenantId;

  // Fetch academic years
  const { data: years = [], isLoading } = useQuery<AcademicYear[]>({
    queryKey: ["/api/admin/academic-years", targetTenantId],
    queryFn: async () => {
      if (!targetTenantId) return [];
      const res = await fetch(`/api/admin/academic-years?tenantId=${targetTenantId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!targetTenantId,
  });

  // Get selected school info
  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; startDate: string; endDate: string; isActive: boolean }) => {
      const res = await fetch("/api/admin/academic-years", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}` 
        },
        body: JSON.stringify({ ...data, tenantId: targetTenantId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Academic Year Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/academic-years"] });
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; startDate: string; endDate: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/academic-years/${data.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}` 
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Academic Year Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/academic-years"] });
      setEditYear(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/academic-years/${id}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) throw new Error("Failed to activate");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Academic Year Set as Active" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/academic-years"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!isAuthorized) {
    navigate("/dashboard");
    return null;
  }

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="btn-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Academic Years</h1>
            <p className="text-sm text-muted-foreground">
              Manage academic years for schools
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="space-y-6">
          {/* School Selection (Super Admin Only) */}
          {isSuperAdmin && (
            <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-5 h-5 text-primary" />
                  School Selection
                </CardTitle>
                <CardDescription>
                  Select a school to manage its academic years
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select
                      value={selectedSchoolId}
                      onValueChange={setSelectedSchoolId}
                    >
                      <SelectTrigger className="h-12" data-testid="select-school">
                        <SelectValue placeholder="-- Select School --" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((school) => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name} ({school.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedSchool && (
                    <Badge variant="default" className="px-4 py-2">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {selectedSchool.name}
                    </Badge>
                  )}
                </div>
                {!selectedSchoolId && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Please select a school first
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Academic Years Table */}
          {targetTenantId ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Academic Years
                    </CardTitle>
                    <CardDescription>
                      {selectedSchool ? `Academic years for ${selectedSchool.name}` : "Academic years for your school"}
                    </CardDescription>
                  </div>
                  <CoinButton
                    color="green"
                    icon={<Plus className="w-5 h-5" />}
                    onClick={() => setIsCreateOpen(true)}
                    data-testid="btn-create-year"
                  >
                    Add Academic Year
                  </CoinButton>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : years.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Academic Years</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first academic year to get started
                    </p>
                    <CoinButton
                      color="green"
                      icon={<Plus className="w-5 h-5" />}
                      onClick={() => setIsCreateOpen(true)}
                      data-testid="btn-create-year-empty"
                    >
                      Add Academic Year
                    </CoinButton>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Name</TableHead>
                          <TableHead className="font-semibold">Start Date</TableHead>
                          <TableHead className="font-semibold">End Date</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {years.map((year) => (
                          <TableRow key={year.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{year.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(year.startDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {new Date(year.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {year.isActive && (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Active
                                  </Badge>
                                )}
                                {year.isLocked && (
                                  <Badge variant="secondary">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Locked
                                  </Badge>
                                )}
                                {!year.isActive && !year.isLocked && (
                                  <Badge variant="outline">Inactive</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {!year.isActive && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setActiveMutation.mutate(year.id)}
                                    data-testid={`btn-activate-${year.id}`}
                                  >
                                    Set Active
                                  </Button>
                                )}
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => setEditYear(year)}
                                  data-testid={`btn-edit-${year.id}`}
                                >
                                  <Edit className="w-4 h-4" />
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
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center">
                  <XCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-medium mb-2">School Selection Required</h3>
                  <p className="text-muted-foreground">
                    Please select a school above to manage academic years.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>

      {/* Create Dialog */}
      <AcademicYearDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
        title="Create Academic Year"
      />

      {/* Edit Dialog */}
      {editYear && (
        <AcademicYearDialog
          isOpen={!!editYear}
          onClose={() => setEditYear(null)}
          onSubmit={(data) => updateMutation.mutate({ ...data, id: editYear.id })}
          isLoading={updateMutation.isPending}
          title="Edit Academic Year"
          defaultValues={{
            name: editYear.name,
            startDate: editYear.startDate.split("T")[0],
            endDate: editYear.endDate.split("T")[0],
            isActive: editYear.isActive,
          }}
        />
      )}
    </PageLayout>
  );
}

// Form Dialog Component
function AcademicYearDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; startDate: string; endDate: string; isActive: boolean }) => void;
  isLoading: boolean;
  title: string;
  defaultValues?: { name: string; startDate: string; endDate: string; isActive: boolean };
}) {
  const [formData, setFormData] = useState({
    name: defaultValues?.name || "",
    startDate: defaultValues?.startDate || "",
    endDate: defaultValues?.endDate || "",
    isActive: defaultValues?.isActive || false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (defaultValues) {
      setFormData({
        name: defaultValues.name,
        startDate: defaultValues.startDate,
        endDate: defaultValues.endDate,
        isActive: defaultValues.isActive,
      });
    } else {
      setFormData({ name: "", startDate: "", endDate: "", isActive: false });
    }
  }, [defaultValues, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast({ title: "Start and End dates are required", variant: "destructive" });
      return;
    }
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Enter the academic year details
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., 2024-2025"
              data-testid="input-year-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                data-testid="input-end-date"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <Label>Set as Active Year</Label>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              data-testid="switch-is-active"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <CoinButton
              type="submit"
              color="green"
              isLoading={isLoading}
              data-testid="btn-submit-year"
            >
              {defaultValues ? "Update" : "Create"}
            </CoinButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
