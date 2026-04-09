import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Papa from "papaparse";
import { useAuth } from "@/lib/auth";
import { useSchoolContext } from "@/lib/school-context";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { RequireSchoolSelection } from "@/components/school-switcher";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Download, Upload, Users, CheckCircle, XCircle } from "lucide-react";

const roleOptions = [
  { value: "teacher", label: "Teachers" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "hod", label: "HODs" },
];

export default function UserBulkUploadPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedSchool, isSuperAdmin } = useSchoolContext();
  
  const [selectedRole, setSelectedRole] = useState<string>("teacher");
  const [csvData, setCsvData] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    if (user && user.role !== "super_admin" && user.role !== "admin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return null;
  }

  const downloadTemplate = async () => {
    try {
      const response = await fetch(`/api/admin/upload/template?role=${selectedRole}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedRole}_upload_template.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
      });
      
      if (parsed.errors.length > 0) {
        throw new Error(`CSV parsing error: ${parsed.errors[0].message}`);
      }
      
      const users = parsed.data.filter(u => u.name && u.email);
      
      if (users.length === 0) {
        throw new Error("No valid users found in CSV. Each row must have 'name' and 'email' columns.");
      }
      
      const response = await apiRequest("POST", "/api/admin/users/bulk-upload", {
        tenantId: selectedSchool?.id,
        users,
        role: selectedRole,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setUploadResult(data);
      toast({ title: "Upload Complete", description: `Created ${data.created} users` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const targetTenantId = isSuperAdmin ? selectedSchool?.id : user?.tenantId;

  return (
    <PageLayout>
      <PageHeader
        title="Bulk User Upload"
        subtitle="Import teachers, students, and parents via CSV"
        actions={
          <Button variant="ghost" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />
      <PageContent>
        {isSuperAdmin ? (
          <RequireSchoolSelection>
            <BulkUploadContent
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              csvData={csvData}
              setCsvData={setCsvData}
              uploadResult={uploadResult}
              downloadTemplate={downloadTemplate}
              uploadMutation={uploadMutation}
              targetTenantId={targetTenantId}
            />
          </RequireSchoolSelection>
        ) : (
          <BulkUploadContent
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            csvData={csvData}
            setCsvData={setCsvData}
            uploadResult={uploadResult}
            downloadTemplate={downloadTemplate}
            uploadMutation={uploadMutation}
            targetTenantId={targetTenantId}
          />
        )}
      </PageContent>
    </PageLayout>
  );
}

function BulkUploadContent({
  selectedRole,
  setSelectedRole,
  csvData,
  setCsvData,
  uploadResult,
  downloadTemplate,
  uploadMutation,
  targetTenantId,
}: any) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Step 1: Download Template
          </CardTitle>
          <CardDescription>
            Get the CSV template for the user type you want to upload
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>User Type</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger data-testid="select-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CoinButton color="gold" onClick={downloadTemplate} data-testid="button-download-template">
            <Download className="w-4 h-4 mr-2" />
            Download {roleOptions.find(r => r.value === selectedRole)?.label} Template
          </CoinButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Step 2: Paste CSV Data
          </CardTitle>
          <CardDescription>
            Paste your filled CSV data below (including headers)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="name,email,grade,section&#10;John Doe,john@school.com,10,A&#10;Jane Smith,jane@school.com,10,B"
            className="min-h-[150px] font-mono text-sm"
            data-testid="textarea-csv"
          />
          <CoinButton
            color="green"
            onClick={() => uploadMutation.mutate()}
            disabled={!csvData.trim() || !targetTenantId || uploadMutation.isPending}
            data-testid="button-upload"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Users
          </CoinButton>
        </CardContent>
      </Card>

      {uploadResult && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {uploadResult.created} Created
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {uploadResult.skipped} Skipped
              </Badge>
            </div>
            {uploadResult.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
                <Label className="text-red-600">Errors:</Label>
                <ul className="list-disc list-inside text-sm text-red-600 mt-2">
                  {uploadResult.errors.slice(0, 10).map((error: string, i: number) => (
                    <li key={i}>{error}</li>
                  ))}
                  {uploadResult.errors.length > 10 && (
                    <li>... and {uploadResult.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
