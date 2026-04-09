import { useState, useEffect } from "react";
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
  ArrowLeft, HardDrive, Building2, FolderOpen, Save, Check, X, AlertTriangle, Cloud
} from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
}

interface StorageConfig {
  id?: string;
  tenantId: string;
  s3BucketName: string | null;
  s3FolderPath: string | null;
  maxStorageBytes: number;
  isConfigured: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function StoragePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() =>
    localStorage.getItem("superadmin_selected_school") || ""
  );
  const [formData, setFormData] = useState({
    s3BucketName: "",
    s3FolderPath: "",
    maxStorageGB: 5,
  });

  // Queries
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

  const { data: allConfigs = [], isLoading: configsLoading } = useQuery<(StorageConfig & { schoolName?: string; schoolCode?: string })[]>({
    queryKey: ["/api/superadmin/storage/all"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/storage/all", {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: currentConfig } = useQuery<StorageConfig>({
    queryKey: ["/api/superadmin/storage", selectedSchoolId],
    queryFn: async () => {
      if (!selectedSchoolId) return null;
      const res = await fetch(`/api/superadmin/storage?schoolId=${selectedSchoolId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedSchoolId,
  });

  // Update form when config loads
  useEffect(() => {
    if (currentConfig) {
      setFormData({
        s3BucketName: currentConfig.s3BucketName || "",
        s3FolderPath: currentConfig.s3FolderPath || "",
        maxStorageGB: Math.round((currentConfig.maxStorageBytes || 5 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)),
      });
    } else if (selectedSchoolId) {
      const school = schools.find(s => s.id === selectedSchoolId);
      setFormData({
        s3BucketName: "",
        s3FolderPath: school?.code?.toLowerCase() || "",
        maxStorageGB: 5,
      });
    }
  }, [currentConfig, selectedSchoolId, schools]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/superadmin/storage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safal_token")}`,
        },
        body: JSON.stringify({
          tenantId: selectedSchoolId,
          s3BucketName: formData.s3BucketName || null,
          s3FolderPath: formData.s3FolderPath || null,
          maxStorageBytes: formData.maxStorageGB * 1024 * 1024 * 1024,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/storage"] });
      toast({ title: "Storage configuration saved successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  if (!user || user.role !== "super_admin") {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-purple-50 to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">S3 Storage Configuration</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Allocate storage per school</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 space-y-8 w-full">
        {/* Overview Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              Storage Overview
            </CardTitle>
            <CardDescription>All schools and their storage configurations</CardDescription>
          </CardHeader>
          <CardContent>
            {configsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800">
                      <TableHead>School</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>S3 Bucket</TableHead>
                      <TableHead>Folder Path</TableHead>
                      <TableHead>Max Storage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schools.map((school) => {
                      const config = allConfigs.find(c => c.tenantId === school.id);
                      return (
                        <TableRow 
                          key={school.id} 
                          className={`cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30 ${selectedSchoolId === school.id ? "bg-purple-100 dark:bg-purple-950/50" : ""}`}
                          onClick={() => setSelectedSchoolId(school.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              <span className="font-medium">{school.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{school.code}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {config?.s3BucketName || <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {config?.s3FolderPath || <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell>
                            {formatBytes(config?.maxStorageBytes || 5 * 1024 * 1024 * 1024)}
                          </TableCell>
                          <TableCell>
                            {config?.isConfigured ? (
                              <Badge className="bg-green-100 text-green-700">
                                <Check className="w-3 h-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <X className="w-3 h-3 mr-1" />
                                Not Set
                              </Badge>
                            )}
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

        {/* Configuration Form */}
        <Card className="border-2 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-purple-600" />
              Configure Storage
            </CardTitle>
            <CardDescription>
              {selectedSchool 
                ? `Set S3 bucket and folder for ${selectedSchool.name}` 
                : "Select a school from the table above"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedSchoolId ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
                <p className="text-slate-500">Please select a school from the table above to configure storage</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">{selectedSchool?.name}</span>
                  <Badge variant="outline">{selectedSchool?.code}</Badge>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>S3 Bucket Name</Label>
                    <Input
                      value={formData.s3BucketName}
                      onChange={(e) => setFormData({ ...formData, s3BucketName: e.target.value })}
                      placeholder="e.g., prashnakosh-prod"
                      data-testid="input-bucket-name"
                    />
                    <p className="text-xs text-slate-500">The S3 bucket where files will be stored</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Folder Path</Label>
                    <Input
                      value={formData.s3FolderPath}
                      onChange={(e) => setFormData({ ...formData, s3FolderPath: e.target.value })}
                      placeholder="e.g., schools/sch001"
                      data-testid="input-folder-path"
                    />
                    <p className="text-xs text-slate-500">Folder prefix within the bucket (one school = one folder)</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Storage (GB)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.maxStorageGB}
                      onChange={(e) => setFormData({ ...formData, maxStorageGB: parseInt(e.target.value) || 5 })}
                      data-testid="input-max-storage"
                    />
                    <p className="text-xs text-slate-500">Maximum storage allowed for this school</p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    onClick={() => saveMutation.mutate()} 
                    disabled={saveMutation.isPending}
                    data-testid="btn-save-storage"
                  >
                    {saveMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Storage Usage
            </h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
              <li>Exam logos and watermarks</li>
              <li>Question paper uploads</li>
              <li>Reference materials and documents</li>
              <li>Generated exam papers</li>
            </ul>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
