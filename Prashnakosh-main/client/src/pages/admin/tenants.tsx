import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  ArrowLeft, Plus, Building2, Users, Search, Edit, Trash2
} from "lucide-react";
import type { Tenant } from "@shared/schema";

export default function TenantsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    navigate("/dashboard");
    return null;
  }

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">School Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage schools and tenants
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search schools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card"
              data-testid="input-search-tenants"
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <CoinButton
                color="green"
                icon={<Plus className="w-5 h-5" />}
                data-testid="button-add-school"
              >
                Add School
              </CoinButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New School</DialogTitle>
                <DialogDescription>Create a new tenant for a school</DialogDescription>
              </DialogHeader>
              <TenantForm onSuccess={() => setIsCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <ContentCard>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No schools found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try a different search" : "Add your first school to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Board</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TenantRow key={tenant.id} tenant={tenant} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ContentCard>
      </PageContent>
    </PageLayout>
  );
}

function TenantRow({ tenant }: { tenant: Tenant }) {
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/tenants/${tenant.id}`, {
        active: !tenant.active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: tenant.active ? "School deactivated" : "School activated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/tenants/${tenant.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "School deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <span className="font-medium">{tenant.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <code className="px-2 py-1 bg-secondary rounded text-sm">
          {tenant.code}
        </code>
      </TableCell>
      <TableCell>
        <span className="text-sm">{tenant.principalName || "-"}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm">{tenant.board || "-"}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm">{tenant.city || "-"}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={tenant.active ?? true}
            onCheckedChange={() => toggleMutation.mutate()}
            data-testid={`switch-active-${tenant.id}`}
          />
          <Badge className={tenant.active ? "bg-coin-green text-white" : "bg-gray-500 text-white"}>
            {tenant.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                data-testid={`button-edit-${tenant.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit School</DialogTitle>
                <DialogDescription>Update school details</DialogDescription>
              </DialogHeader>
              <TenantForm tenant={tenant} onSuccess={() => setIsEditOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-${tenant.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TenantForm({ tenant, onSuccess }: { tenant?: Tenant; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: tenant?.name || "",
    code: tenant?.code || "",
    logo: tenant?.logo || "",
    principalName: tenant?.principalName || "",
    address: tenant?.address || "",
    city: tenant?.city || "",
    state: tenant?.state || "",
    pincode: tenant?.pincode || "",
    phone: tenant?.phone || "",
    email: tenant?.email || "",
    website: tenant?.website || "",
    board: tenant?.board || "",
    affiliationNumber: tenant?.affiliationNumber || "",
    establishedYear: tenant?.establishedYear || "",
    studentCount: tenant?.studentCount || 0,
    teacherCount: tenant?.teacherCount || 0,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (tenant) {
        return apiRequest("PATCH", `/api/tenants/${tenant.id}`, formData);
      }
      return apiRequest("POST", "/api/tenants", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schools"] });
      toast({ title: tenant ? "School updated" : "School created" });
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
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>School Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter school name"
            required
            data-testid="input-tenant-name"
          />
        </div>

        <div className="space-y-2">
          <Label>School Code *</Label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g., SCH001"
            required
            disabled={!!tenant}
            data-testid="input-tenant-code"
          />
          <p className="text-xs text-muted-foreground">Unique login identifier</p>
        </div>

        <div className="space-y-2">
          <Label>Board/Affiliation</Label>
          <Input
            value={formData.board}
            onChange={(e) => setFormData({ ...formData, board: e.target.value })}
            placeholder="CBSE, ICSE, State Board..."
            data-testid="input-tenant-board"
          />
        </div>

        <div className="space-y-2">
          <Label>Affiliation Number</Label>
          <Input
            value={formData.affiliationNumber}
            onChange={(e) => setFormData({ ...formData, affiliationNumber: e.target.value })}
            placeholder="Board affiliation number"
            data-testid="input-tenant-affiliation"
          />
        </div>

        <div className="space-y-2">
          <Label>Established Year</Label>
          <Input
            value={formData.establishedYear}
            onChange={(e) => setFormData({ ...formData, establishedYear: e.target.value })}
            placeholder="e.g., 1990"
            data-testid="input-tenant-year"
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Principal Name</Label>
          <Input
            value={formData.principalName}
            onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
            placeholder="Principal's full name"
            data-testid="input-tenant-principal"
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Address</Label>
          <Input
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Street address"
            data-testid="input-tenant-address"
          />
        </div>

        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="City"
            data-testid="input-tenant-city"
          />
        </div>

        <div className="space-y-2">
          <Label>State</Label>
          <Input
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="State"
            data-testid="input-tenant-state"
          />
        </div>

        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="Postal code"
            data-testid="input-tenant-pincode"
          />
        </div>

        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Contact number"
            data-testid="input-tenant-phone"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="School email"
            type="email"
            data-testid="input-tenant-email"
          />
        </div>

        <div className="space-y-2">
          <Label>Website</Label>
          <Input
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://..."
            data-testid="input-tenant-website"
          />
        </div>

        <div className="space-y-2">
          <Label>Total Students</Label>
          <Input
            type="number"
            value={formData.studentCount || ""}
            onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) || 0 })}
            placeholder="Number of students"
            data-testid="input-tenant-students"
          />
        </div>

        <div className="space-y-2">
          <Label>Total Teachers</Label>
          <Input
            type="number"
            value={formData.teacherCount || ""}
            onChange={(e) => setFormData({ ...formData, teacherCount: parseInt(e.target.value) || 0 })}
            placeholder="Number of teachers"
            data-testid="input-tenant-teachers"
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Logo URL (optional)</Label>
          <Input
            value={formData.logo}
            onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
            placeholder="https://..."
            data-testid="input-tenant-logo"
          />
        </div>
      </div>

      <CoinButton
        type="submit"
        color="green"
        className="w-full"
        isLoading={mutation.isPending}
        icon={<Plus className="w-5 h-5" />}
        data-testid="button-submit-tenant"
      >
        {tenant ? "Update School" : "Create School"}
      </CoinButton>
    </form>
  );
}
