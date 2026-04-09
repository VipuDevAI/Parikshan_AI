import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader } from "@/components/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, PenLine, ArrowLeft, Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TeacherUploadPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

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

  return (
    <PageLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold">Upload Questions</h1>
              <p className="text-sm text-muted-foreground">Choose how you want to add questions to the question bank</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </PageHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            All questions will be submitted for HOD approval before becoming active.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover-elevate cursor-pointer" onClick={() => navigate("/teacher/upload/word")} data-testid="card-word-upload">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Word Document Upload</CardTitle>
              <CardDescription>
                Upload a Word (.docx) file with multiple questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Best for:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>MCQ questions</li>
                  <li>Assertion-Reason questions</li>
                  <li>Short answer (2-3 marks)</li>
                  <li>Long answer (4-5 marks)</li>
                </ul>
                <p className="font-medium text-foreground mt-4">Requirements:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Numbered questions (Q1, Q2...)</li>
                  <li>Answer: line for MCQ</li>
                  <li>Marks: line for subjective</li>
                </ul>
              </div>
              <Button className="w-full mt-6" data-testid="button-go-word-upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload Word Document
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => navigate("/teacher/questions/new")} data-testid="card-manual-entry">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                <PenLine className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Add questions one at a time with full control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Best for:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Questions with images/diagrams</li>
                  <li>Map-based questions</li>
                  <li>Comprehension passages</li>
                  <li>Poem-based questions</li>
                </ul>
                <p className="font-medium text-foreground mt-4">Features:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Math symbol support</li>
                  <li>Image upload to cloud</li>
                  <li>Link to passages</li>
                </ul>
              </div>
              <Button className="w-full mt-6" variant="outline" data-testid="button-go-manual-entry">
                <PenLine className="w-4 h-4 mr-2" />
                Create Question Manually
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Submitted Questions</CardTitle>
            <CardDescription>View and track your submitted questions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/teacher/questions")} data-testid="button-view-my-questions">
              View My Questions
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
