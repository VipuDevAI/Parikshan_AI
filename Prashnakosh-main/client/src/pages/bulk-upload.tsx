import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, Check, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface UploadRow {
  row: number;
  userName: string;
  name: string;
  password: string;
  role: string;
  department: string;
  parentNumber: string;
  classLevel: string;
  section: string;
  status: "valid" | "error";
  errors: string[];
}

const TEMPLATE_COLUMNS = [
  "UserName",
  "Name",
  "Password",
  "Role",
  "Department",
  "Parent Number",
  "Class",
  "Section",
];

const VALID_ROLES = ["teacher", "student", "parent", "hod", "principal", "exam_committee"];

export default function BulkUploadPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedData, setParsedData] = useState<UploadRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (users: any[]) => {
      return apiRequest("POST", "/api/users/bulk", { users });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Upload Successful",
        description: `${data.created} users created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setUploadComplete(true);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload users",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const canBulkUpload = ["admin"].includes(user.role);

  if (!canBulkUpload) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to bulk upload users.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const downloadTemplate = () => {
    const csvContent = TEMPLATE_COLUMNS.join(",") + "\n" +
      "john.doe,John Doe,password123,student,Science,9876543210,10,A\n" +
      "jane.smith,Jane Smith,password456,teacher,Mathematics,,," ;
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_upload_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const validateRow = (row: any, rowNum: number): UploadRow => {
    const errors: string[] = [];
    
    if (!row.UserName || row.UserName.trim() === "") {
      errors.push("UserName is required");
    }
    if (!row.Name || row.Name.trim() === "") {
      errors.push("Name is required");
    }
    if (!row.Password || row.Password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }
    if (!row.Role || !VALID_ROLES.includes(row.Role.toLowerCase())) {
      errors.push(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
    }
    if (row.Role?.toLowerCase() === "student" && !row.Class) {
      errors.push("Class is required for students");
    }

    return {
      row: rowNum,
      userName: row.UserName || "",
      name: row.Name || "",
      password: row.Password || "",
      role: row.Role || "",
      department: row.Department || "",
      parentNumber: row["Parent Number"] || "",
      classLevel: row.Class || "",
      section: row.Section || "",
      status: errors.length === 0 ? "valid" : "error",
      errors,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setParsedData([]);
    setUploadComplete(false);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid File",
          description: "File must contain headers and at least one data row",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim());
      const dataRows = lines.slice(1);
      
      const parsed: UploadRow[] = dataRows.map((line, idx) => {
        const values = line.split(",").map(v => v.trim());
        const rowObj: Record<string, string> = {};
        headers.forEach((header, i) => {
          rowObj[header] = values[i] || "";
        });
        return validateRow(rowObj, idx + 2);
      });

      setParsedData(parsed);
    } catch (error) {
      toast({
        title: "Parse Error",
        description: "Failed to parse the uploaded file",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmUpload = () => {
    const validRows = parsedData.filter(r => r.status === "valid");
    if (validRows.length === 0) {
      toast({
        title: "No Valid Data",
        description: "Please fix errors before uploading",
        variant: "destructive",
      });
      return;
    }

    const users = validRows.map(row => ({
      username: row.userName,
      name: row.name,
      password: row.password,
      role: row.role.toLowerCase(),
      department: row.department,
      parentPhone: row.parentNumber,
      classLevel: row.classLevel,
      section: row.section,
      tenantId: user.tenantId,
    }));

    uploadMutation.mutate(users);
  };

  const validCount = parsedData.filter(r => r.status === "valid").length;
  const errorCount = parsedData.filter(r => r.status === "error").length;

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Bulk User Upload</h1>
            <p className="text-sm text-muted-foreground">Import Users from Excel/CSV</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <Alert className="mb-6">
          <FileSpreadsheet className="h-4 w-4" />
          <AlertTitle>Upload Instructions</AlertTitle>
          <AlertDescription>
            Download the template below and fill in user details. Required columns: UserName, Name, Password, Role.
            Supported roles: {VALID_ROLES.join(", ")}.
          </AlertDescription>
        </Alert>

        <ContentCard title="Step 1: Download Template">
          <Button onClick={downloadTemplate} variant="outline" data-testid="button-download-template">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Required Columns:</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_COLUMNS.map((col, idx) => (
                <Badge key={idx} variant="outline">{col}</Badge>
              ))}
            </div>
          </div>
        </ContentCard>

        <ContentCard title="Step 2: Upload File" className="mt-6">
          <div className="flex items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-file"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="bg-coin-orange hover:bg-coin-orange/90"
              data-testid="button-select-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isProcessing ? "Processing..." : "Select File"}
            </Button>
            <span className="text-sm text-muted-foreground">Supports CSV, XLSX, XLS</span>
          </div>
        </ContentCard>

        {parsedData.length > 0 && (
          <ContentCard title="Step 3: Review & Confirm" className="mt-6">
            <div className="flex items-center gap-4 mb-4">
              <Badge className="bg-coin-green text-white">
                <Check className="w-3 h-3 mr-1" />
                {validCount} Valid
              </Badge>
              {errorCount > 0 && (
                <Badge className="bg-coin-red text-white">
                  <X className="w-3 h-3 mr-1" />
                  {errorCount} Errors
                </Badge>
              )}
            </div>

            <div className="border rounded-md overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row) => (
                    <TableRow key={row.row} className={row.status === "error" ? "bg-red-50 dark:bg-red-950" : ""}>
                      <TableCell>{row.row}</TableCell>
                      <TableCell>
                        {row.status === "valid" ? (
                          <Check className="w-4 h-4 text-coin-green" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-coin-red" />
                        )}
                      </TableCell>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell>{row.classLevel}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 && (
                          <span className="text-sm text-coin-red">{row.errors.join("; ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex gap-4">
              <Button
                variant="outline"
                onClick={() => setParsedData([])}
                data-testid="button-clear"
              >
                Clear
              </Button>
              <Button
                onClick={handleConfirmUpload}
                disabled={uploadMutation.isPending || validCount === 0 || uploadComplete}
                className="bg-coin-green hover:bg-coin-green/90"
                data-testid="button-confirm-upload"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadMutation.isPending ? "Uploading..." : uploadComplete ? "Upload Complete" : `Upload ${validCount} Users`}
              </Button>
            </div>

            {uploadComplete && (
              <Alert className="mt-4 border-coin-green bg-coin-green/10">
                <Check className="h-4 w-4 text-coin-green" />
                <AlertTitle className="text-coin-green">Upload Successful</AlertTitle>
                <AlertDescription>
                  Users have been created. They can now log in with their credentials.
                </AlertDescription>
              </Alert>
            )}
          </ContentCard>
        )}
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
