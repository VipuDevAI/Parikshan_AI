import { useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DialogTrigger,
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
import {
  ArrowLeft, Plus, Users, Search, Edit, Trash2, UserPlus, Upload
} from "lucide-react";
import type { User, UserRole } from "@shared/schema";

const roleConfig: Record<UserRole, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-coin-gold text-white" },
  admin: { label: "Admin", color: "bg-primary text-primary-foreground" },
  hod: { label: "HOD", color: "bg-orange-500 text-white" },
  principal: { label: "Principal", color: "bg-indigo-600 text-white" },
  exam_committee: { label: "Exam Committee", color: "bg-teal-500 text-white" },
  teacher: { label: "Teacher", color: "bg-coin-green text-white" },
  student: { label: "Student", color: "bg-coin-blue text-white" },
  parent: { label: "Parent", color: "bg-coin-purple text-white" },
};

export default function UsersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool, isSuperAdmin } = useSchoolContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    navigate("/dashboard");
    return null;
  }

  const targetTenantId = isSuperAdmin ? selectedSchool?.id : user?.tenantId;

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users", targetTenantId],
    queryFn: async () => {
      if (!targetTenantId) return [];
      const response = await fetch(`/api/users?tenantId=${targetTenantId}`);
      return response.json();
    },
    enabled: !!targetTenantId,
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !filterRole || filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

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
              <h1 className="text-xl font-bold">User Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage users {selectedSchool ? `for ${selectedSchool.name}` : ""}
              </p>
            </div>
          </div>
          {isSuperAdmin && <SchoolSwitcher />}
        </div>
      </PageHeader>

      <PageContent>
        <RequireSchoolSelection>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card"
              data-testid="input-search-users"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-40 bg-card" data-testid="select-filter-role">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(roleConfig).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CoinButton
            color="gold"
            icon={<Upload className="w-5 h-5" />}
            onClick={() => navigate("/admin/user-bulk-upload?type=student")}
            data-testid="button-bulk-upload-students"
          >
            Bulk Upload Students
          </CoinButton>
          <CoinButton
            color="gold"
            icon={<Upload className="w-5 h-5" />}
            onClick={() => navigate("/admin/user-bulk-upload?type=teacher")}
            data-testid="button-bulk-upload-teachers"
          >
            Bulk Upload Teachers
          </CoinButton>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <CoinButton
                color="indigo"
                icon={<UserPlus className="w-5 h-5" />}
                data-testid="button-add-user"
              >
                Add User
              </CoinButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Create a new user account</DialogDescription>
              </DialogHeader>
              <UserForm onSuccess={() => setIsCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <ContentCard>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No users found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterRole ? "Try different filters" : "Add users to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userData) => (
                    <UserRow key={userData.id} userData={userData} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ContentCard>
        </RequireSchoolSelection>
      </PageContent>
    </PageLayout>
  );
}

function UserRow({ userData }: { userData: User }) {
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const config = roleConfig[userData.role as UserRole] || roleConfig.student;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/users/${userData.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {userData.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{userData.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{userData.email}</TableCell>
      <TableCell>
        <Badge className={config.color}>{config.label}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={userData.active ? "default" : "secondary"}>
          {userData.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                data-testid={`button-edit-${userData.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user details</DialogDescription>
              </DialogHeader>
              <UserForm user={userData} onSuccess={() => setIsEditOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-${userData.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function UserForm({ user, onSuccess }: { user?: User; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: (user?.role as UserRole) || "student",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...formData,
        password: formData.password || undefined,
      };
      if (user) {
        return apiRequest("PATCH", `/api/users/${user.id}`, data);
      }
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: user ? "User updated" : "User created" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter full name"
          required
          data-testid="input-user-name"
        />
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="Enter email"
          required
          data-testid="input-user-email"
        />
      </div>

      <div className="space-y-2">
        <Label>{user ? "New Password (leave blank to keep)" : "Password"}</Label>
        <Input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Enter password"
          required={!user}
          data-testid="input-user-password"
        />
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
        >
          <SelectTrigger data-testid="select-user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(roleConfig).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CoinButton
        type="submit"
        color="indigo"
        className="w-full"
        isLoading={mutation.isPending}
        icon={<UserPlus className="w-5 h-5" />}
        data-testid="button-submit-user"
      >
        {user ? "Update User" : "Create User"}
      </CoinButton>
    </form>
  );
}
