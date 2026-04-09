import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { ArrowLeft, Library, FileText, BookOpen, FileQuestion, Notebook, ExternalLink } from "lucide-react";

interface ReferenceItem {
  id: string;
  grade: string;
  subject: string;
  title: string;
  description: string | null;
  referenceType: "question_paper" | "notes" | "model_answer" | "study_material";
  fileUrl: string;
  year: string | null;
}

const referenceTypeConfig = {
  question_paper: { label: "Previous Year Paper", icon: FileQuestion, color: "text-blue-600" },
  notes: { label: "Notes", icon: Notebook, color: "text-green-600" },
  model_answer: { label: "Model Answer", icon: FileText, color: "text-purple-600" },
  study_material: { label: "Study Material", icon: BookOpen, color: "text-amber-600" },
};

export default function StudentReferenceMaterialsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  useEffect(() => {
    if (user && user.role !== "student") {
      navigate("/dashboard");
    }
    if (user && user.grade !== "10" && user.grade !== "12") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  if (!user || user.role !== "student" || (user.grade !== "10" && user.grade !== "12")) {
    return null;
  }

  const queryUrl = selectedSubject 
    ? `/api/student/reference-materials?subject=${encodeURIComponent(selectedSubject)}`
    : "/api/student/reference-materials";
    
  const { data: materials = [], isLoading, error } = useQuery<ReferenceItem[]>({
    queryKey: [queryUrl],
  });

  const subjects = Array.from(new Set(materials.map(m => m.subject))).sort();

  const getTypeIcon = (type: keyof typeof referenceTypeConfig) => {
    const TypeIcon = referenceTypeConfig[type]?.icon || FileText;
    return <TypeIcon className={`w-4 h-4 ${referenceTypeConfig[type]?.color || ""}`} />;
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Reference Materials</h1>
            <p className="text-sm text-muted-foreground">Study resources for Class {user.grade}</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </PageHeader>
      <PageContent>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-amber-600" />
              Class {user.grade} Resources
            </CardTitle>
            <CardDescription>
              Access previous year question papers, notes, and study materials for your grade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] max-w-xs">
                <Label>Filter by Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger data-testid="select-subject-filter">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Subjects</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                {materials.length} resource{materials.length !== 1 ? "s" : ""} available
              </div>
            </div>
          </CardContent>
        </Card>

        <ContentCard>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading resources...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              {(error as Error).message}
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reference materials available{selectedSubject ? ` for ${selectedSubject}` : ""}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((item) => (
                  <TableRow key={item.id} data-testid={`row-material-${item.id}`}>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {getTypeIcon(item.referenceType)}
                        {referenceTypeConfig[item.referenceType]?.label || item.referenceType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.title}</div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.subject}</TableCell>
                    <TableCell>{item.year || "-"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(item.fileUrl, "_blank")}
                        data-testid={`button-view-${item.id}`}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ContentCard>
      </PageContent>
    </PageLayout>
  );
}
