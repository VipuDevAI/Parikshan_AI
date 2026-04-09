import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader, PageContent, ContentCard, GridContainer } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft, Plus, Search, Filter, CheckCircle, XCircle, Edit, Trash2,
  Upload, FileText, BookOpen
} from "lucide-react";
import type { Question, QuestionType, DifficultyLevel } from "@shared/schema";

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "true_false", label: "True/False" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "matching", label: "Matching" },
  { value: "numerical", label: "Numerical" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
];

const difficultyLevels: { value: DifficultyLevel; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function QuestionsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = !filterSubject || q.subject === filterSubject;
    const matchesType = !filterType || q.type === filterType;
    return matchesSearch && matchesSubject && matchesType;
  });

  const subjects = Array.from(new Set(questions.map((q) => q.subject)));

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
            <h1 className="text-xl font-bold">Question Bank</h1>
            <p className="text-sm text-muted-foreground">
              Manage your questions
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card"
              data-testid="input-search-questions"
            />
          </div>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-full sm:w-40 bg-card" data-testid="select-filter-subject">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-40 bg-card" data-testid="select-filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {questionTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <CoinButton
              color="gold"
              icon={<Upload className="w-5 h-5" />}
              onClick={() => navigate("/questions/upload")}
              data-testid="button-upload"
            >
              Upload
            </CoinButton>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <CoinButton
                  color="green"
                  icon={<Plus className="w-5 h-5" />}
                  data-testid="button-create-question"
                >
                  Create
                </CoinButton>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Question</DialogTitle>
                  <DialogDescription>Add a new question to the bank</DialogDescription>
                </DialogHeader>
                <QuestionForm onSuccess={() => setIsCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <ContentCard>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No questions found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterSubject || filterType
                  ? "Try adjusting your filters"
                  : "Start by creating or uploading questions"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Chapter</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((question) => (
                    <QuestionRow key={question.id} question={question} />
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

function QuestionRow({ question }: { question: Question }) {
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/questions/${question.id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({ title: "Question approved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/questions/${question.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({ title: "Question deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const typeLabel = questionTypes.find((t) => t.value === question.type)?.label || question.type;
  const difficultyLabel = difficultyLevels.find((d) => d.value === question.difficulty)?.label || question.difficulty;

  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <p className="truncate" title={question.content}>
          {question.content}
        </p>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" size="sm">{typeLabel}</Badge>
      </TableCell>
      <TableCell>{question.subject}</TableCell>
      <TableCell>{question.chapter}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          size="sm"
          className={
            question.difficulty === "easy"
              ? "text-green-600 border-green-600"
              : question.difficulty === "hard"
              ? "text-red-600 border-red-600"
              : "text-yellow-600 border-yellow-600"
          }
        >
          {difficultyLabel}
        </Badge>
      </TableCell>
      <TableCell>
        {question.isVerified ? (
          <Badge className="bg-coin-green text-white" size="sm">Verified</Badge>
        ) : (
          <Badge variant="outline" size="sm">Draft</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {!question.isVerified && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid={`button-approve-${question.id}`}
            >
              <CheckCircle className="w-4 h-4 text-green-600" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            data-testid={`button-edit-${question.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-${question.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuestionForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    content: "",
    type: "mcq" as QuestionType,
    options: ["", "", "", ""],
    correctAnswer: "",
    explanation: "",
    hint: "",
    subject: "",
    chapter: "",
    topic: "",
    grade: "",
    difficulty: "medium" as DifficultyLevel,
    marks: 1,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...formData,
        options: formData.type === "mcq" ? formData.options.filter(Boolean) : undefined,
      };
      return apiRequest("POST", "/api/questions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({ title: "Question created successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="e.g., Mathematics"
            required
            data-testid="input-question-subject"
          />
        </div>
        <div className="space-y-2">
          <Label>Grade</Label>
          <Input
            value={formData.grade}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            placeholder="e.g., 10"
            required
            data-testid="input-question-grade"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Chapter</Label>
          <Input
            value={formData.chapter}
            onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
            placeholder="e.g., Algebra"
            required
            data-testid="input-question-chapter"
          />
        </div>
        <div className="space-y-2">
          <Label>Topic (optional)</Label>
          <Input
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            placeholder="e.g., Linear Equations"
            data-testid="input-question-topic"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value: QuestionType) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger data-testid="select-question-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {questionTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={formData.difficulty}
            onValueChange={(value: DifficultyLevel) => setFormData({ ...formData, difficulty: value })}
          >
            <SelectTrigger data-testid="select-question-difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {difficultyLevels.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Marks</Label>
          <Input
            type="number"
            min={1}
            value={formData.marks}
            onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) || 1 })}
            data-testid="input-question-marks"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Question Content</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Enter your question here..."
          rows={3}
          required
          data-testid="textarea-question-content"
        />
      </div>

      {formData.type === "mcq" && (
        <div className="space-y-2">
          <Label>Options</Label>
          {formData.options.map((option, index) => (
            <Input
              key={index}
              value={option}
              onChange={(e) => {
                const newOptions = [...formData.options];
                newOptions[index] = e.target.value;
                setFormData({ ...formData, options: newOptions });
              }}
              placeholder={`Option ${index + 1}`}
              data-testid={`input-option-${index}`}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label>Correct Answer</Label>
        <Input
          value={formData.correctAnswer}
          onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
          placeholder={formData.type === "mcq" ? "Enter correct option (e.g., A)" : "Enter correct answer"}
          data-testid="input-correct-answer"
        />
      </div>

      <div className="space-y-2">
        <Label>Explanation (optional)</Label>
        <Textarea
          value={formData.explanation}
          onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
          placeholder="Explain the answer..."
          rows={2}
          data-testid="textarea-explanation"
        />
      </div>

      <div className="space-y-2">
        <Label>Hint (optional)</Label>
        <Input
          value={formData.hint}
          onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
          placeholder="Add a hint for students"
          data-testid="input-hint"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <CoinButton
          type="submit"
          color="green"
          isLoading={createMutation.isPending}
          icon={<Plus className="w-5 h-5" />}
          data-testid="button-submit-question"
        >
          Create Question
        </CoinButton>
      </div>
    </form>
  );
}
