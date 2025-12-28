import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Building2, 
  Loader2,
  Copy,
  Check,
  Key,
  MapPin,
  Phone,
  Mail,
  Users,
  GraduationCap,
  Settings,
  Eye,
  EyeOff,
  School,
  Trash2,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ActionTile, ActionTileGroup } from "@/components/ui/action-tile";
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

export default function SchoolOnboardingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [newSchool, setNewSchool] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    website: "",
    principalName: "",
    principalUsername: "",
    principalPassword: "",
    principalEmail: "",
    principalPhone: "",
  });

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["/api/admin/schools"],
    queryFn: async () => {
      const res = await fetch("/api/admin/schools", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: user?.role === "SUPER_ADMIN",
  });

  const createSchool = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/schools", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schools"] });
      setIsAddOpen(false);
      toast({ 
        title: "School created successfully",
        description: `School code: ${data.school?.code || newSchool.code}. Principal login created.`
      });
      setNewSchool({
        name: "",
        code: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        phone: "",
        email: "",
        website: "",
        principalName: "",
        principalUsername: "",
        principalPassword: "",
        principalEmail: "",
        principalPhone: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create school", description: error.message, variant: "destructive" });
    },
  });

  const generateSchoolCode = () => {
    const prefix = newSchool.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 4);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    setNewSchool({ ...newSchool, code: `${prefix}${suffix}` });
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewSchool({ ...newSchool, principalPassword: password });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({ title: `${label} copied to clipboard` });
  };

  const filteredSchools = schools.filter((school: any) => 
    school.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteAllSchools = async () => {
    setIsDeletingAll(true);
    try {
      for (const school of schools) {
        await apiRequest("DELETE", `/api/admin/schools/${school.id}`);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schools"] });
      toast({ title: "All schools deleted" });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeletingAll(false);
    }
  };

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="p-8 text-center">
        <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">Only Super Admins can access school onboarding.</p>
      </div>
    );
  }

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
            School Onboarding
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage schools in the platform
          </p>
        </div>
        
        <Card className="p-4">
          <ActionTileGroup>
            <ActionTile
              icon={School}
              label="Onboard New School"
              variant="primary"
              size="lg"
              onClick={() => setIsAddOpen(true)}
              data-testid="tile-add-school"
            />
            <ActionTile
              icon={Users}
              label="View All Schools"
              variant="info"
              size="lg"
              onClick={() => {}}
              data-testid="tile-view-schools"
            />
            <ActionTile
              icon={Settings}
              label="Platform Settings"
              variant="purple"
              size="lg"
              onClick={() => {}}
              data-testid="tile-settings"
            />
            <ActionTile
              icon={isDeletingAll ? Loader2 : Trash2}
              label="Delete All Schools"
              variant="danger"
              size="lg"
              disabled={!schools.length || isDeletingAll}
              onClick={() => setDeleteAllDialogOpen(true)}
              data-testid="tile-delete-all-schools"
            />
          </ActionTileGroup>
        </Card>
      </div>

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Schools?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {schools.length} school(s) and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleDeleteAllSchools(); setDeleteAllDialogOpen(false); }}>Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Onboard New School</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="school" className="mt-4">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="school">School Details</TabsTrigger>
                <TabsTrigger value="principal">Principal Account</TabsTrigger>
              </TabsList>
              
              <TabsContent value="school" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input
                    value={newSchool.name}
                    onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                    placeholder="e.g., Delhi Public School"
                    data-testid="input-school-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>School Code (Unique Identifier)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newSchool.code}
                      onChange={(e) => setNewSchool({ ...newSchool, code: e.target.value.toUpperCase() })}
                      placeholder="DPS2025"
                      className="font-mono"
                      data-testid="input-school-code"
                    />
                    <Button type="button" variant="outline" onClick={generateSchoolCode}>
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">This code will be used for login</p>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={newSchool.address}
                    onChange={(e) => setNewSchool({ ...newSchool, address: e.target.value })}
                    placeholder="Full school address"
                    data-testid="input-address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={newSchool.city}
                      onChange={(e) => setNewSchool({ ...newSchool, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={newSchool.state}
                      onChange={(e) => setNewSchool({ ...newSchool, state: e.target.value })}
                      placeholder="State"
                      data-testid="input-state"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input
                      value={newSchool.pincode}
                      onChange={(e) => setNewSchool({ ...newSchool, pincode: e.target.value })}
                      placeholder="110001"
                      data-testid="input-pincode"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newSchool.phone}
                      onChange={(e) => setNewSchool({ ...newSchool, phone: e.target.value })}
                      placeholder="+91 11-12345678"
                      data-testid="input-school-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newSchool.email}
                      onChange={(e) => setNewSchool({ ...newSchool, email: e.target.value })}
                      placeholder="info@school.edu"
                      data-testid="input-school-email"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="principal" className="space-y-4 mt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Create the principal account. They will use these credentials to log in and set up the school.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Principal Full Name</Label>
                  <Input
                    value={newSchool.principalName}
                    onChange={(e) => setNewSchool({ ...newSchool, principalName: e.target.value })}
                    placeholder="Dr. Rajesh Kumar"
                    data-testid="input-principal-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username (for login)</Label>
                  <Input
                    value={newSchool.principalUsername}
                    onChange={(e) => setNewSchool({ ...newSchool, principalUsername: e.target.value })}
                    placeholder="principal"
                    data-testid="input-principal-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial Password</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newSchool.principalPassword}
                        onChange={(e) => setNewSchool({ ...newSchool, principalPassword: e.target.value })}
                        placeholder="Secure password"
                        className="pr-10"
                        data-testid="input-principal-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <Button type="button" variant="outline" onClick={generatePassword}>
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newSchool.principalEmail}
                      onChange={(e) => setNewSchool({ ...newSchool, principalEmail: e.target.value })}
                      placeholder="principal@school.edu"
                      data-testid="input-principal-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newSchool.principalPhone}
                      onChange={(e) => setNewSchool({ ...newSchool, principalPhone: e.target.value })}
                      placeholder="+91 9876543210"
                      data-testid="input-principal-phone"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Credentials Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">School Code:</span>
                  <span className="font-mono ml-2">{newSchool.code || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-mono ml-2">{newSchool.principalUsername || "-"}</span>
                </div>
              </div>
            </div>
            
            <Button
              className="w-full mt-4"
              onClick={() => createSchool.mutate(newSchool)}
              disabled={
                createSchool.isPending || 
                !newSchool.name || 
                !newSchool.code || 
                !newSchool.principalName ||
                !newSchool.principalUsername ||
                !newSchool.principalPassword
              }
              data-testid="button-create-school"
            >
              {createSchool.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create School & Principal Account
            </Button>
          </DialogContent>
        </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{schools.length}</p>
              <p className="text-sm text-muted-foreground">Total Schools</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{schools.filter((s: any) => s.isActive !== false).length}</p>
              <p className="text-sm text-muted-foreground">Active Schools</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">-</p>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">-</p>
              <p className="text-sm text-muted-foreground">Total Staff</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search schools..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        {filteredSchools.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No schools onboarded yet</p>
            <p className="text-sm">Click "Onboard New School" to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.map((school: any) => (
                  <TableRow key={school.id} data-testid={`row-school-${school.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{school.name}</p>
                          <p className="text-xs text-muted-foreground">{school.website || "-"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{school.code}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(school.code, "School code")}
                        >
                          {copiedCode === "School code" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {school.city || "-"}, {school.state || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {school.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {school.phone}
                          </div>
                        )}
                        {school.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" /> {school.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={school.isActive !== false ? "default" : "secondary"}>
                        {school.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4 mr-1" /> Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
