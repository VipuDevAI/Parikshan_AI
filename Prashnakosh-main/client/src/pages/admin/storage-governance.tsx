import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSchoolContext } from "@/lib/school-context";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { RequireSchoolSelection, SchoolSwitcher } from "@/components/school-switcher";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, HardDrive, RefreshCw, Image, FileText, BookOpen, 
  Building2, Settings, Check, X, Edit, FolderOpen, Cloud
} from "lucide-react";

interface StorageUsage {
  tenantId: string;
  totalBytes: number;
  questionImageBytes: number;
  uploadFileBytes: number;
  referenceFileBytes: number;
  lastCalculatedAt: string;
}

interface SchoolStorageConfig {
  id?: string;
  tenantId: string;
  tenantName?: string;
  tenantCode?: string;
  s3BucketName?: string;
  s3FolderPath?: string;
  maxStorageBytes?: number;
  isConfigured?: boolean;
  usage?: StorageUsage;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function StorageGovernancePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool, isSuperAdmin } = useSchoolContext();
  const [activeTab, setActiveTab] = useState<"overview" | "config">("overview");
  const [editingConfig, setEditingConfig] = useState<SchoolStorageConfig | null>(null);

  useEffect(() => {
    if (user && user.role !== "super_admin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  if (!user || user.role !== "super_admin") {
    return null;
  }

  // Fetch single school storage usage
  const { data: usage, isLoading: usageLoading } = useQuery<StorageUsage>({
    queryKey: ["/api/admin/storage-usage", selectedSchool?.id],
    queryFn: async () => {
      if (!selectedSchool) return null;
      const response = await fetch(`/api/admin/storage-usage?tenantId=${selectedSchool.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  // Fetch single school storage config
  const { data: storageConfig } = useQuery<SchoolStorageConfig>({
    queryKey: ["/api/admin/storage-configs", selectedSchool?.id],
    queryFn: async () => {
      if (!selectedSchool) return null;
      const response = await fetch(`/api/admin/storage-configs?tenantId=${selectedSchool.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      return response.json();
    },
    enabled: !!selectedSchool,
  });

  // Fetch all storage configs for overview
  const { data: allConfigs = [], isLoading: allConfigsLoading } = useQuery<SchoolStorageConfig[]>({
    queryKey: ["/api/admin/all-storage-configs"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/all-storage-configs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      return response.json();
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/storage-usage/recalculate", {
        tenantId: selectedSchool?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Storage Usage Recalculated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/storage-usage"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const totalBytes = usage?.totalBytes || 0;
  const maxBytes = storageConfig?.maxStorageBytes || (5 * 1024 * 1024 * 1024); // 5GB default
  const usagePercent = Math.min((totalBytes / maxBytes) * 100, 100);

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
            <h1 className="text-xl font-bold">Storage Governance</h1>
            <p className="text-sm text-muted-foreground">
              Manage S3 storage configuration and monitor usage
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Building2 className="w-4 h-4 mr-2" />
              All Schools Overview
            </TabsTrigger>
            <TabsTrigger value="config" data-testid="tab-config">
              <Settings className="w-4 h-4 mr-2" />
              School Configuration
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - All Schools */}
          <TabsContent value="overview">
            <ContentCard 
              title="Storage Configuration Overview" 
              description="S3 bucket and folder assignments for all schools"
            >
              {allConfigsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : allConfigs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No schools configured yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>School</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>S3 Bucket</TableHead>
                        <TableHead>Folder Path</TableHead>
                        <TableHead>Storage Used</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allConfigs.map((config) => (
                        <TableRow key={config.tenantId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{config.tenantName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="px-2 py-1 bg-muted rounded text-sm">
                              {config.tenantCode}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {config.s3BucketName || <span className="text-muted-foreground">Not set</span>}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono">
                              {config.s3FolderPath || <span className="text-muted-foreground">Not set</span>}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {formatBytes(config.usage?.totalBytes || 0)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {config.isConfigured ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <Check className="w-3 h-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                <X className="w-3 h-3 mr-1" />
                                Not Configured
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingConfig(config)}
                              data-testid={`button-edit-${config.tenantId}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ContentCard>
          </TabsContent>

          {/* Config Tab - Single School */}
          <TabsContent value="config">
            <RequireSchoolSelection>
              {selectedSchool && (
                <div className="space-y-6">
                  {/* Storage Usage Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <HardDrive className="w-5 h-5" />
                            Storage Usage for {selectedSchool.name}
                          </CardTitle>
                          <CardDescription>
                            Monitor storage consumption and limits
                          </CardDescription>
                        </div>
                        <CoinButton
                          color="blue"
                          onClick={() => recalculateMutation.mutate()}
                          disabled={recalculateMutation.isPending}
                          data-testid="button-recalculate"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
                          Recalculate
                        </CoinButton>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>{formatBytes(totalBytes)} used</span>
                        <span className="text-muted-foreground">of {formatBytes(maxBytes)}</span>
                      </div>
                      <Progress value={usagePercent} className="h-3" />
                      {usage?.lastCalculatedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last calculated: {new Date(usage.lastCalculatedAt).toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Usage Breakdown */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Image className="w-4 h-4 text-blue-500" />
                          Question Images
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatBytes(usage?.questionImageBytes || 0)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Images attached to questions
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileText className="w-4 h-4 text-green-500" />
                          Upload Files
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatBytes(usage?.uploadFileBytes || 0)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          CSV/XLSX bulk uploads
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BookOpen className="w-4 h-4 text-purple-500" />
                          Reference Library
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatBytes(usage?.referenceFileBytes || 0)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Previous papers & materials
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* S3 Configuration Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Cloud className="w-5 h-5" />
                            S3 Storage Configuration
                          </CardTitle>
                          <CardDescription>
                            Bucket and folder path for {selectedSchool.name}
                          </CardDescription>
                        </div>
                        <CoinButton
                          color="gold"
                          onClick={() => setEditingConfig({
                            tenantId: selectedSchool.id,
                            tenantName: selectedSchool.name,
                            ...storageConfig,
                          })}
                          data-testid="button-edit-config"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Configuration
                        </CoinButton>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 rounded-lg border bg-muted/50">
                          <Label className="text-xs text-muted-foreground">S3 Bucket Name</Label>
                          <p className="font-medium mt-1">
                            {storageConfig?.s3BucketName || <span className="text-muted-foreground">Not configured</span>}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-muted/50">
                          <Label className="text-xs text-muted-foreground">Folder Path</Label>
                          <p className="font-mono font-medium mt-1">
                            {storageConfig?.s3FolderPath || <span className="text-muted-foreground">Not configured</span>}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-muted/50">
                          <Label className="text-xs text-muted-foreground">Max Storage Limit</Label>
                          <p className="font-medium mt-1">
                            {formatBytes(storageConfig?.maxStorageBytes || 5 * 1024 * 1024 * 1024)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-muted/50">
                          <Label className="text-xs text-muted-foreground">Configuration Status</Label>
                          <p className="mt-1">
                            {storageConfig?.isConfigured ? (
                              <Badge className="bg-green-100 text-green-800">
                                <Check className="w-3 h-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800">
                                <X className="w-3 h-3 mr-1" />
                                Not Configured
                              </Badge>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Security Info */}
                      <div className="mt-6 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Security Settings
                        </h4>
                        <div className="grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tenant Path Isolation</span>
                            <span className="text-green-600 font-medium">Enabled</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Signed URLs</span>
                            <span className="text-green-600 font-medium">Enabled</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Server-Side Encryption</span>
                            <span className="text-green-600 font-medium">AES-256</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </RequireSchoolSelection>
          </TabsContent>
        </Tabs>
      </PageContent>

      {/* Edit Configuration Dialog */}
      <StorageConfigDialog
        config={editingConfig}
        onClose={() => setEditingConfig(null)}
      />
    </PageLayout>
  );
}

// Storage Config Edit Dialog
function StorageConfigDialog({
  config,
  onClose,
}: {
  config: SchoolStorageConfig | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    s3BucketName: "",
    s3FolderPath: "",
    maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5GB
  });

  useEffect(() => {
    if (config) {
      setFormData({
        s3BucketName: config.s3BucketName || "",
        s3FolderPath: config.s3FolderPath || config.tenantCode?.toLowerCase() || "",
        maxStorageBytes: config.maxStorageBytes || 5 * 1024 * 1024 * 1024,
      });
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/storage-configs", {
        tenantId: config?.tenantId,
        ...formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/storage-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-storage-configs"] });
      toast({ title: "Storage configuration updated" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update storage configuration",
        variant: "destructive",
      });
    },
  });

  if (!config) return null;

  return (
    <Dialog open={!!config} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Configure Storage for {config.tenantName}
          </DialogTitle>
          <DialogDescription>
            Set up S3 bucket and folder path for this school
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>S3 Bucket Name</Label>
            <Input
              value={formData.s3BucketName}
              onChange={(e) => setFormData({ ...formData, s3BucketName: e.target.value })}
              placeholder="e.g., prashnakosh-prod"
              data-testid="input-bucket-name"
            />
            <p className="text-xs text-muted-foreground">
              The S3 bucket where files will be stored
            </p>
          </div>

          <div className="space-y-2">
            <Label>Folder Path</Label>
            <Input
              value={formData.s3FolderPath}
              onChange={(e) => setFormData({ ...formData, s3FolderPath: e.target.value })}
              placeholder="e.g., schools/sch001"
              data-testid="input-folder-path"
            />
            <p className="text-xs text-muted-foreground">
              Folder prefix within the bucket (one school = one folder)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Max Storage Limit (GB)</Label>
            <Input
              type="number"
              value={Math.round(formData.maxStorageBytes / (1024 * 1024 * 1024))}
              onChange={(e) => setFormData({ 
                ...formData, 
                maxStorageBytes: parseInt(e.target.value) * 1024 * 1024 * 1024 
              })}
              min={1}
              max={100}
              data-testid="input-max-storage"
            />
            <p className="text-xs text-muted-foreground">
              Maximum storage allowed for this school
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <CoinButton
            color="green"
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            data-testid="button-save-config"
          >
            Save Configuration
          </CoinButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
