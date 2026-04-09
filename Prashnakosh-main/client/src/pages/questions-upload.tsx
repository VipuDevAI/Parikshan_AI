import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, AlertCircle, Check, Download, FileSpreadsheet, Upload, X, HelpCircle, BookOpen, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface UploadRow {
  row: number;
  content: string;
  type: string;
  subject: string;
  chapter: string;
  topic: string;
  grade: string;
  difficulty: string;
  bloomLevel: string;
  options: string;
  correctAnswer: string;
  explanation: string;
  hint: string;
  marks: string;
  status: "valid" | "error";
  errors: string[];
}

const TEMPLATE_COLUMNS = [
  "Content",
  "Type",
  "Subject",
  "Chapter",
  "Topic",
  "Grade",
  "Difficulty",
  "BloomLevel",
  "Options",
  "CorrectAnswer",
  "Explanation",
  "Hint",
  "Marks",
];

const VALID_TYPES = ["mcq", "true_false", "fill_blank", "matching", "numerical", "short_answer", "long_answer"];
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

export default function QuestionsUploadPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedData, setParsedData] = useState<UploadRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [activeTab, setActiveTab] = useState("instructions");

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects"],
  });

  const { data: chapters = [] } = useQuery<any[]>({
    queryKey: ["/api/chapters"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (questions: any[]) => {
      return apiRequest("POST", "/api/questions/bulk", { questions });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Upload Successful",
        description: `${data.count} questions uploaded successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      setUploadComplete(true);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload questions",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const canUploadQuestions = ["teacher", "hod", "admin"].includes(user.role);

  if (!canUploadQuestions) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to upload questions.</p>
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
      "What is 2+2?,mcq,Mathematics,Basic Arithmetic,Addition,5,easy,remember,\"4;3;5;6\",4,Two plus two equals four,Start with basic addition,1\n" +
      "The sun rises in the east,true_false,Science,Earth Science,Solar System,5,easy,remember,,True,The sun always rises in the east due to Earth's rotation,,1\n" +
      "The capital of India is ____,fill_blank,Social Studies,Geography,Countries,6,medium,remember,,New Delhi,New Delhi is the capital city of India,Think of the largest democracy,1\n" +
      "Solve: 5x + 10 = 25,numerical,Mathematics,Algebra,Linear Equations,8,medium,apply,,3,\"5x = 25-10 = 15, x = 3\",Subtract 10 from both sides first,2\n" +
      "Explain photosynthesis in plants,short_answer,Science,Biology,Plant Biology,7,medium,understand,,\"Plants use sunlight water and CO2 to make glucose and oxygen\",Process by which plants make their own food,Use the word chlorophyll,3";
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_upload_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const validateRow = (row: any, rowNum: number): UploadRow => {
    const errors: string[] = [];
    
    if (!row.Content || row.Content.trim() === "") {
      errors.push("Content is required");
    }
    if (!row.Type || !VALID_TYPES.includes(row.Type.toLowerCase())) {
      errors.push(`Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (!row.Subject || row.Subject.trim() === "") {
      errors.push("Subject is required");
    }
    if (!row.Chapter || row.Chapter.trim() === "") {
      errors.push("Chapter is required");
    }
    if (!row.Grade || row.Grade.trim() === "") {
      errors.push("Grade is required");
    }
    if (row.Difficulty && !VALID_DIFFICULTIES.includes(row.Difficulty.toLowerCase())) {
      errors.push(`Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(", ")}`);
    }
    if (row.BloomLevel && !VALID_BLOOM_LEVELS.includes(row.BloomLevel.toLowerCase())) {
      errors.push(`Invalid Bloom level. Must be one of: ${VALID_BLOOM_LEVELS.join(", ")}`);
    }
    if (row.Type?.toLowerCase() === "mcq") {
      if (!row.Options || row.Options.trim() === "") {
        errors.push("Options are required for MCQ type questions (separate with semicolon)");
      } else {
        const options = row.Options.split(";").map((o: string) => o.trim());
        if (options.length < 2) {
          errors.push("MCQ must have at least 2 options");
        }
        if (row.CorrectAnswer && !options.includes(row.CorrectAnswer.trim())) {
          errors.push("Correct answer must be one of the provided options");
        }
      }
    }
    if (!row.CorrectAnswer || row.CorrectAnswer.trim() === "") {
      errors.push("Correct Answer is required");
    }
    if (row.Marks) {
      const marksNum = parseInt(row.Marks);
      if (isNaN(marksNum) || marksNum < 1 || marksNum > 100) {
        errors.push("Marks must be a number between 1 and 100");
      }
    }

    return {
      row: rowNum,
      content: row.Content || "",
      type: row.Type || "",
      subject: row.Subject || "",
      chapter: row.Chapter || "",
      topic: row.Topic || "",
      grade: row.Grade || "",
      difficulty: row.Difficulty || "medium",
      bloomLevel: row.BloomLevel || "",
      options: row.Options || "",
      correctAnswer: row.CorrectAnswer || "",
      explanation: row.Explanation || "",
      hint: row.Hint || "",
      marks: row.Marks || "1",
      status: errors.length === 0 ? "valid" : "error",
      errors,
    };
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const rows: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }
    
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      const validated = rows.map((row, idx) => validateRow(row, idx + 2));
      setParsedData(validated);
      setIsProcessing(false);
      setActiveTab("preview");
    };
    
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read file",
        variant: "destructive",
      });
      setIsProcessing(false);
    };
    
    reader.readAsText(file);
  };

  const handleUpload = () => {
    const validRows = parsedData.filter(r => r.status === "valid");
    if (validRows.length === 0) {
      toast({
        title: "No Valid Questions",
        description: "Please fix errors before uploading",
        variant: "destructive",
      });
      return;
    }

    const questions = validRows.map(row => ({
      content: row.content,
      type: row.type.toLowerCase(),
      subject: row.subject,
      chapter: row.chapter,
      topic: row.topic || null,
      grade: row.grade,
      difficulty: row.difficulty.toLowerCase() || "medium",
      bloomLevel: row.bloomLevel.toLowerCase() || null,
      options: row.options ? row.options.split(";").map(o => o.trim()) : null,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation || null,
      hint: row.hint || null,
      marks: parseInt(row.marks) || 1,
      createdBy: user?.id,
      status: "draft",
      isVerified: false,
      isPractice: true,
      isAssessment: false,
    }));

    uploadMutation.mutate(questions);
  };

  const validCount = parsedData.filter(r => r.status === "valid").length;
  const errorCount = parsedData.filter(r => r.status === "error").length;

  if (uploadComplete) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Upload Complete</h2>
              <p className="text-muted-foreground mb-6">
                {validCount} questions have been successfully uploaded to the question bank.
              </p>
              <div className="flex gap-4 justify-center">
                <CoinButton color="blue" onClick={() => navigate("/questions")}>
                  View Questions
                </CoinButton>
                <Button variant="outline" onClick={() => {
                  setParsedData([]);
                  setUploadComplete(false);
                  setActiveTab("instructions");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}>
                  Upload More
                </Button>
              </div>
            </div>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/questions")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Bulk Question Upload</h1>
            <p className="text-sm text-muted-foreground">
              Upload multiple questions using CSV
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="instructions" data-testid="tab-instructions">
              <HelpCircle className="w-4 h-4 mr-2" />
              Instructions
            </TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={parsedData.length === 0} data-testid="tab-preview">
              <BookOpen className="w-4 h-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instructions">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    CSV Format Guide
                  </CardTitle>
                  <CardDescription>
                    Follow these instructions to prepare your question file
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Required Columns</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><Badge variant="secondary" className="mr-2">Content</Badge> The question text</li>
                      <li><Badge variant="secondary" className="mr-2">Type</Badge> mcq, true_false, fill_blank, numerical, short_answer, long_answer</li>
                      <li><Badge variant="secondary" className="mr-2">Subject</Badge> e.g., Mathematics, Science</li>
                      <li><Badge variant="secondary" className="mr-2">Chapter</Badge> Chapter name</li>
                      <li><Badge variant="secondary" className="mr-2">Grade</Badge> Class/Grade level (e.g., 5, 10)</li>
                      <li><Badge variant="secondary" className="mr-2">CorrectAnswer</Badge> The correct answer</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Optional Columns</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><Badge variant="outline" className="mr-2">Topic</Badge> Specific topic within chapter</li>
                      <li><Badge variant="outline" className="mr-2">Difficulty</Badge> easy, medium, hard</li>
                      <li><Badge variant="outline" className="mr-2">BloomLevel</Badge> remember, understand, apply, analyze, evaluate, create</li>
                      <li><Badge variant="outline" className="mr-2">Options</Badge> For MCQ: separate with semicolon (;)</li>
                      <li><Badge variant="outline" className="mr-2">Explanation</Badge> Answer explanation</li>
                      <li><Badge variant="outline" className="mr-2">Hint</Badge> Hint for students</li>
                      <li><Badge variant="outline" className="mr-2">Marks</Badge> Points for the question (default: 1)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Tips & Examples
                  </CardTitle>
                  <CardDescription>
                    Best practices for successful uploads
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>MCQ Options Format</AlertTitle>
                    <AlertDescription>
                      For multiple choice questions, separate options with semicolons.<br />
                      Example: <code className="bg-muted px-1">4;3;5;6</code>
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>True/False Questions</AlertTitle>
                    <AlertDescription>
                      For true/false, set CorrectAnswer as "True" or "False".<br />
                      No Options needed for this type.
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Fill in the Blank</AlertTitle>
                    <AlertDescription>
                      Use ____ (four underscores) to indicate the blank in Content.<br />
                      CorrectAnswer should be the word/phrase that fills the blank.
                    </AlertDescription>
                  </Alert>
                  <div className="pt-4">
                    <CoinButton
                      color="gold"
                      icon={<Download className="w-5 h-5" />}
                      onClick={downloadTemplate}
                      className="w-full"
                      data-testid="button-download-template"
                    >
                      Download Sample Template
                    </CoinButton>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV File</CardTitle>
                <CardDescription>
                  Select your prepared CSV file to upload questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  {isProcessing ? (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                      <p>Processing file...</p>
                    </div>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
                      <p className="text-muted-foreground mb-4">or click to browse</p>
                      <Button variant="outline">Select File</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle>Preview Questions</CardTitle>
                    <CardDescription>
                      Review before uploading
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="text-sm">
                      <Check className="w-4 h-4 mr-1" />
                      {validCount} Valid
                    </Badge>
                    {errorCount > 0 && (
                      <Badge variant="destructive" className="text-sm">
                        <X className="w-4 h-4 mr-1" />
                        {errorCount} Errors
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {errorCount > 0 && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Errors Found</AlertTitle>
                    <AlertDescription>
                      {errorCount} questions have errors. Only valid questions will be uploaded.
                    </AlertDescription>
                  </Alert>
                )}
                
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead className="w-16">Status</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Chapter</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((row) => (
                        <TableRow 
                          key={row.row} 
                          className={row.status === "error" ? "bg-destructive/5" : ""}
                          data-testid={`row-question-${row.row}`}
                        >
                          <TableCell>{row.row}</TableCell>
                          <TableCell>
                            {row.status === "valid" ? (
                              <Check className="w-5 h-5 text-green-500" />
                            ) : (
                              <X className="w-5 h-5 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{row.content}</TableCell>
                          <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
                          <TableCell>{row.subject}</TableCell>
                          <TableCell>{row.chapter}</TableCell>
                          <TableCell>{row.grade}</TableCell>
                          <TableCell className="text-destructive text-xs max-w-[200px]">
                            {row.errors.join("; ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setParsedData([]);
                      setActiveTab("upload");
                    }}
                  >
                    Upload Different File
                  </Button>
                  <CoinButton
                    color="green"
                    icon={<Upload className="w-5 h-5" />}
                    onClick={handleUpload}
                    isLoading={uploadMutation.isPending}
                    disabled={validCount === 0}
                    data-testid="button-confirm-upload"
                  >
                    Upload {validCount} Questions
                  </CoinButton>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContent>
    </PageLayout>
  );
}
