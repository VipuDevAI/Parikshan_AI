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
  Users, 
  Loader2,
  User,
  Phone,
  Mail,
  Shield,
  Building,
  Trash2,
  Pencil,
  Upload,
  Download,
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

const ROLES = [
  { value: "TEACHER", label: "Teacher" },
  { value: "WING_ADMIN", label: "Wing Admin" },
  { value: "VICE_PRINCIPAL", label: "Vice Principal" },
  { value: "PRINCIPAL", label: "Principal" },
  { value: "CORRESPONDENT", label: "Correspondent" },
];

export default function StaffPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedWing, setSelectedWing] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    role: "TEACHER",
    wingId: "",
    password: "",
    employeeId: "",
  });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: wings = [] } = useQuery<any[]>({
    queryKey: ["/api/wings"],
  });

  const createStaff = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/staff", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setIsAddOpen(false);
      setNewStaff({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        role: "TEACHER",
        wingId: "",
        password: "",
        employeeId: "",
      });
      toast({ title: "Staff member added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add staff", description: error.message, variant: "destructive" });
    },
  });

  const deleteStaff = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove staff", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteAllStaff = async () => {
    setIsDeletingAll(true);
    try {
      for (const s of staff) {
        await deleteStaff.mutateAsync(s.id);
      }
      toast({ title: "All staff members deleted" });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const updateStaff = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/staff/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setEditingStaff(null);
      toast({ title: "Staff member updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update staff", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpload = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await apiRequest("POST", "/api/staff/bulk", { data });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setIsBulkOpen(false);
      setCsvData([]);
      setCsvFileName("");
      toast({ 
        title: "Bulk upload completed", 
        description: `Created ${result.created} of ${result.total} staff members${result.errors?.length ? `. ${result.errors.length} errors.` : ''}`
      });
    },
    onError: (error: any) => {
      toast({ title: "Bulk upload failed", description: error.message, variant: "destructive" });
    },
  });

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      data.push(row);
    }
    return data;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      setCsvData(data);
    };
    reader.readAsText(file);
  };

  const filteredStaff = staff.filter((member: any) => {
    const matchesSearch = member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === "all" || member.role === selectedRole;
    const matchesWing = selectedWing === "all" || String(member.wingId) === selectedWing;
    return matchesSearch && matchesRole && matchesWing;
  });

  const getWingName = (wingId: number) => {
    const wing = wings.find((w: any) => w.id === wingId);
    return wing?.name || "-";
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "PRINCIPAL":
      case "CORRESPONDENT":
        return "default";
      case "VICE_PRINCIPAL":
      case "WING_ADMIN":
        return "secondary";
      default:
        return "outline";
    }
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
            Staff Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage teachers and administrative staff
          </p>
        </div>
        
        <Card className="p-4">
          <ActionTileGroup>
            <ActionTile
              icon={UserPlus}
              label="Add Staff"
              variant="primary"
              size="lg"
              onClick={() => setIsAddOpen(true)}
              data-testid="tile-add-staff"
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
              onClick={() => window.open('/api/staff/template', '_blank')}
              data-testid="tile-download-template"
            />
            <ActionTile
              icon={isDeletingAll ? Loader2 : Trash2}
              label="Delete All Staff"
              variant="danger"
              size="lg"
              disabled={!staff.length || isDeletingAll}
              onClick={() => setDeleteAllDialogOpen(true)}
              data-testid="tile-delete-all-staff"
            />
          </ActionTileGroup>
        </Card>
      </div>

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Staff Members?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {staff.length} staff member(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleDeleteAllStaff(); setDeleteAllDialogOpen(false); }}>Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Upload Staff</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a CSV file with staff data. Download the template for the correct format.
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                    data-testid="input-csv-file"
                  />
                  <label htmlFor="csv-upload">
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" /> Choose CSV File
                      </span>
                    </Button>
                  </label>
                  {csvFileName && (
                    <p className="mt-2 text-sm font-medium text-primary">{csvFileName}</p>
                  )}
                </div>
                
                {csvData.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Preview ({csvData.length} records)</p>
                    <div className="overflow-x-auto max-h-48 border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Wing</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvData.slice(0, 5).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.fullName || row.name || '-'}</TableCell>
                              <TableCell>{row.username || '-'}</TableCell>
                              <TableCell>{row.role || 'TEACHER'}</TableCell>
                              <TableCell>{row.wing || '-'}</TableCell>
                            </TableRow>
                          ))}
                          {csvData.length > 5 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                ...and {csvData.length - 5} more
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setIsBulkOpen(false); setCsvData([]); setCsvFileName(""); }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => bulkUpload.mutate(csvData)}
                    disabled={csvData.length === 0 || bulkUpload.isPending}
                    data-testid="button-submit-bulk"
                  >
                    {bulkUpload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload {csvData.length} Staff
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  placeholder="Enter full name"
                  data-testid="input-staff-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={newStaff.username}
                    onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                    placeholder="username"
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input
                    value={newStaff.employeeId}
                    onChange={(e) => setNewStaff({ ...newStaff, employeeId: e.target.value })}
                    placeholder="EMP001"
                    data-testid="input-employee-id"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="staff@school.com"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  data-testid="input-phone"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={newStaff.role}
                    onValueChange={(v) => setNewStaff({ ...newStaff, role: v })}
                  >
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Wing</Label>
                  <Select
                    value={newStaff.wingId}
                    onValueChange={(v) => setNewStaff({ ...newStaff, wingId: v })}
                  >
                    <SelectTrigger data-testid="select-wing">
                      <SelectValue placeholder="Select wing" />
                    </SelectTrigger>
                    <SelectContent>
                      {wings.map((w: any) => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Initial Password</Label>
                <Input
                  type="password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  placeholder="Set initial password"
                  data-testid="input-password"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createStaff.mutate({
                  ...newStaff,
                  schoolId: user?.schoolId,
                  wingId: newStaff.wingId ? Number(newStaff.wingId) : null,
                })}
                disabled={createStaff.isPending || !newStaff.fullName || !newStaff.username || !newStaff.password}
                data-testid="button-save-staff"
              >
                {createStaff.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Add Staff Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      <Card className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, username, or email..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[150px]" data-testid="filter-role">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedWing} onValueChange={setSelectedWing}>
            <SelectTrigger className="w-[150px]" data-testid="filter-wing">
              <SelectValue placeholder="All Wings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wings</SelectItem>
              {wings.map((w: any) => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No staff found</p>
            <p className="text-sm">Add staff members to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Wing</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member: any) => (
                  <TableRow key={member.id} data-testid={`row-staff-${member.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{member.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{member.username}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        <Shield className="w-3 h-3 mr-1" />
                        {member.role?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building className="w-3 h-3 text-muted-foreground" />
                        {getWingName(member.wingId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {member.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3" /> {member.phone}
                          </div>
                        )}
                        {member.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" /> {member.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive !== false ? "default" : "secondary"}>
                        {member.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setEditingStaff(member)}
                          data-testid={`button-edit-staff-${member.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-staff-${member.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove {member.fullName} from the system. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteStaff.mutate(member.id)}
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

      {/* Edit Staff Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          {editingStaff && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editingStaff.fullName || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, fullName: e.target.value })}
                  data-testid="input-edit-staff-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editingStaff.email || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editingStaff.phone || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editingStaff.role}
                    onValueChange={(v) => setEditingStaff({ ...editingStaff, role: v })}
                  >
                    <SelectTrigger data-testid="select-edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Wing</Label>
                  <Select
                    value={String(editingStaff.wingId || "")}
                    onValueChange={(v) => setEditingStaff({ ...editingStaff, wingId: v ? Number(v) : null })}
                  >
                    <SelectTrigger data-testid="select-edit-wing">
                      <SelectValue placeholder="Select wing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Wing</SelectItem>
                      {wings.map((w: any) => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingStaff.isActive !== false ? "active" : "inactive"}
                  onValueChange={(v) => setEditingStaff({ ...editingStaff, isActive: v === "active" })}
                >
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingStaff(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateStaff.mutate({ 
                    id: editingStaff.id, 
                    data: { 
                      fullName: editingStaff.fullName,
                      email: editingStaff.email,
                      phone: editingStaff.phone,
                      role: editingStaff.role,
                      wingId: editingStaff.wingId,
                      isActive: editingStaff.isActive
                    } 
                  })}
                  disabled={updateStaff.isPending}
                  data-testid="button-save-staff"
                >
                  {updateStaff.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
