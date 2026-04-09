import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader } from "@/components/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PreviewQuestion {
  index: number;
  type: string;
  content: string;
  options: string[] | null;
  correctAnswer: string | null;
  marks: number;
  difficulty: string;
}

interface SkippedContent {
  lineNumber: number;
  content: string;
  reason: string;
}

interface PreviewResult {
  success: boolean;
  preview: {
    questions: PreviewQuestion[];
    totalParsed: number;
    skippedContent: SkippedContent[];
    warnings: string[];
  };
  metadata: {
    subject: string;
    chapter: string;
    grade: string;
    filename: string;
  };
  rawQuestions: any[];
}

export default function TeacherWordUploadPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [grade, setGrade] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const { data: chapters = [] } = useQuery<any[]>({
    queryKey: ["/api/chapters"],
  });

  const subjects = Array.from(new Set(chapters.map(c => c.subject))).sort();
  const grades = ["6", "7", "8", "9", "10", "11", "12"];

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subject", subject);
      formData.append("chapter", chapter);
      formData.append("grade", grade);

      const response = await fetch("/api/teacher/upload/word/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse document");
      }

      return response.json() as Promise<PreviewResult>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setStep("preview");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) throw new Error("No preview data");
      const response = await apiRequest("POST", "/api/teacher/upload/word/confirm", {
        questions: previewData.rawQuestions,
        metadata: previewData.metadata,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message || `${data.questionsCreated} questions submitted for approval`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/questions"] });
      navigate("/teacher/questions");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (!["teacher", "hod", "admin", "super_admin"].includes(user.role)) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied. Teacher role required.</p>
        </div>
      </PageLayout>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".docx")) {
        toast({
          title: "Invalid file",
          description: "Please upload a Word (.docx) file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handlePreview = () => {
    if (!file || !subject || !grade) {
      toast({
        title: "Missing fields",
        description: "Please select a file, subject, and grade",
        variant: "destructive",
      });
      return;
    }
    previewMutation.mutate();
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "mcq": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "assertion_reason": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "short_answer": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "long_answer": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  if (step === "preview" && previewData) {
    return (
      <PageLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <PageHeader>
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h1 className="text-xl font-bold">Preview Parsed Questions</h1>
                <p className="text-sm text-muted-foreground">{previewData.preview.totalParsed} questions found in {previewData.metadata.filename}</p>
              </div>
              <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back-upload">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Upload
              </Button>
            </div>
          </PageHeader>

          {previewData.preview.warnings.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {previewData.preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {previewData.preview.skippedContent.length > 0 && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertTitle>Skipped Content ({previewData.preview.skippedContent.length} items)</AlertTitle>
              <AlertDescription>
                <p className="mb-2">The following content was skipped and will NOT be imported:</p>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {previewData.preview.skippedContent.map((s, i) => (
                    <div key={i} className="text-sm p-2 bg-muted rounded">
                      <span className="font-medium">Line {s.lineNumber}:</span> {s.reason}
                      <br />
                      <span className="text-muted-foreground italic">{s.content}</span>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Questions to Import ({previewData.preview.totalParsed})
              </CardTitle>
              <CardDescription>
                Subject: {previewData.metadata.subject} | Grade: {previewData.metadata.grade}
                {previewData.metadata.chapter && ` | Chapter: ${previewData.metadata.chapter}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {previewData.preview.questions.map((q) => (
                  <div key={q.index} className="p-4 border rounded-lg" data-testid={`preview-question-${q.index}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">Q{q.index}</span>
                          <Badge className={getTypeBadgeColor(q.type)}>{q.type.replace("_", " ")}</Badge>
                          <Badge variant="outline">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
                          <Badge variant="secondary">{q.difficulty}</Badge>
                        </div>
                        <p className="text-sm">{q.content}</p>
                        {q.options && (
                          <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                            {q.options.map((opt, i) => (
                              <div key={i}>{String.fromCharCode(65 + i)}. {opt}</div>
                            ))}
                          </div>
                        )}
                        {q.correctAnswer && (
                          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                            Answer: {q.correctAnswer}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setStep("upload")}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || previewData.preview.totalParsed === 0}
              className="flex-1"
              data-testid="button-confirm-import"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Import ({previewData.preview.totalParsed} questions)
                </>
              )}
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold">Upload Word Document</h1>
              <p className="text-sm text-muted-foreground">Upload a .docx file with questions in the required format</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/teacher/upload")} data-testid="button-back-modes">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </PageHeader>

        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Required Format</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2 text-sm">
              <p><strong>Questions:</strong> Start with Q1., Q2., or 1., 2., etc.</p>
              <p><strong>MCQ Options:</strong> A., B., C., D. on separate lines</p>
              <p><strong>Answer:</strong> Answer: B (required for MCQ)</p>
              <p><strong>Marks:</strong> Marks: 3 (required for non-MCQ)</p>
              <p><strong>Assertion-Reason:</strong> Use "Assertion:" and "Reason:" labels</p>
              <p className="text-muted-foreground mt-2">
                Questions with images, diagrams, passages, or poems will be skipped.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Upload Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Word Document (.docx)</Label>
              <Input
                id="file"
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                data-testid="input-file"
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger id="subject" data-testid="select-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.length > 0 ? (
                      subjects.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Mathematics">Mathematics</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Social Studies">Social Studies</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger id="grade" data-testid="select-grade">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((g) => (
                      <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chapter">Chapter (Optional)</Label>
              <Select value={chapter} onValueChange={setChapter}>
                <SelectTrigger id="chapter" data-testid="select-chapter">
                  <SelectValue placeholder="Select chapter (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific chapter</SelectItem>
                  {chapters
                    .filter(c => c.subject === subject)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handlePreview}
              disabled={!file || !subject || !grade || previewMutation.isPending}
              className="w-full"
              data-testid="button-preview"
            >
              {previewMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing Document...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Preview Questions
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
