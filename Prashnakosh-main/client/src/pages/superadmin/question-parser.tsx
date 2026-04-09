import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLogo } from "@/components/app-logo";
import { AppFooter } from "@/components/app-footer";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, LogOut, FileText, Upload, FileUp, Sparkles, CheckCircle, 
  XCircle, Eye, Edit, Trash2, Save, AlertTriangle, BookOpen, 
  GraduationCap, Clock, Target, Loader2, FileQuestion, Settings
} from "lucide-react";

// CBSE Subjects and Chapters
const CBSE_SUBJECTS: Record<string, string[]> = {
  "Mathematics": ["Real Numbers", "Polynomials", "Pair of Linear Equations", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Trigonometry", "Circles", "Surface Areas and Volumes", "Statistics", "Probability"],
  "Science": ["Chemical Reactions", "Acids Bases and Salts", "Metals and Non-metals", "Carbon Compounds", "Life Processes", "Control and Coordination", "Reproduction", "Heredity", "Light", "Human Eye", "Electricity", "Magnetic Effects", "Sources of Energy", "Environment"],
  "Physics": ["Electric Charges and Fields", "Electrostatic Potential", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics", "Wave Optics", "Dual Nature of Radiation", "Atoms", "Nuclei", "Semiconductor Electronics"],
  "Chemistry": ["Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "Isolation of Elements", "p-Block Elements", "d and f Block Elements", "Coordination Compounds", "Haloalkanes", "Alcohols Phenols Ethers", "Aldehydes Ketones", "Amines", "Biomolecules", "Polymers"],
  "Biology": ["Reproduction in Organisms", "Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health", "Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease", "Microbes in Human Welfare", "Biotechnology Principles", "Biotechnology Applications", "Organisms and Populations", "Ecosystem", "Biodiversity"],
  "English": ["Reading Comprehension", "Writing Skills", "Grammar", "Literature", "Poetry", "Prose"],
  "Hindi": ["Gadya Khand", "Kavya Khand", "Lekhan", "Vyakaran"],
  "Social Science": ["India and Contemporary World", "Contemporary India", "Democratic Politics", "Understanding Economic Development"],
  "Computer Science": ["Programming Basics", "Data Structures", "Database Management", "Networking", "Python Programming", "File Handling"],
  "Accountancy": ["Accounting for Partnership", "Reconstitution of Partnership", "Dissolution of Partnership", "Accounting for Share Capital", "Issue of Debentures", "Financial Statements", "Cash Flow Statement", "Financial Statement Analysis"],
  "Business Studies": ["Nature and Purpose of Business", "Forms of Business Organisation", "Business Services", "Business Environment", "Planning", "Organising", "Staffing", "Directing", "Controlling", "Financial Management", "Marketing Management"],
  "Economics": ["Introduction to Economics", "Consumer Behaviour", "Producer Behaviour", "Market Types", "National Income", "Money and Banking", "Government Budget", "Balance of Payments"]
};

const EXAM_TYPES = [
  "Unit Test",
  "Class Test",
  "Half Yearly",
  "Annual Exam",
  "Board Exam",
  "Practice Paper",
  "Sample Paper",
  "Previous Year Paper"
];

const CLASSES = ["9", "10", "11", "12"];

const QUESTION_TYPES: Record<string, string> = {
  "mcq": "Multiple Choice",
  "true_false": "True/False",
  "fill_blank": "Fill in the Blank",
  "short_answer": "Short Answer",
  "long_answer": "Long Answer",
  "numerical": "Numerical",
  "case_study": "Case Study"
};

const DIFFICULTIES: Record<string, { label: string; color: string }> = {
  "easy": { label: "Easy", color: "bg-green-100 text-green-700" },
  "medium": { label: "Medium", color: "bg-yellow-100 text-yellow-700" },
  "hard": { label: "Hard", color: "bg-red-100 text-red-700" }
};

interface ParsedQuestion {
  id?: string;
  questionNumber: string;
  section?: string;
  content: string;
  type: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  chapterHint?: string;
  topicHint?: string;
  difficulty: string;
  subject?: string;
  grade?: string;
  pageNumber: number;
  selected?: boolean;
}

interface School {
  id: string;
  name: string;
  code: string;
}

export default function QuestionPaperParserPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [selectedExamType, setSelectedExamType] = useState<string>("");
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Processing state
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatus, setParseStatus] = useState("");

  // Results state
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [paperMetadata, setPaperMetadata] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);

  // API Key dialog
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  if (!user || user.role !== "super_admin") {
    navigate("/");
    return null;
  }

  // Fetch schools
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/superadmin/schools"],
    enabled: !!user,
  });

  // Get chapters for selected subject
  const chapters = selectedSubject ? CBSE_SUBJECTS[selectedSubject] || [] : [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, PNG, or JPG file",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setShowResults(false);
      setParsedQuestions([]);
    }
  };

  const handleParse = async () => {
    if (!selectedFile) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }
    if (!openaiKey) {
      setShowApiKeyDialog(true);
      return;
    }
    if (!selectedSchool) {
      toast({ title: "Please select a school", variant: "destructive" });
      return;
    }
    if (!selectedSubject) {
      toast({ title: "Please select a subject", variant: "destructive" });
      return;
    }
    if (!selectedClass) {
      toast({ title: "Please select a class", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    setParseProgress(10);
    setParseStatus("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("subject", selectedSubject);
      formData.append("class_level", selectedClass);
      if (selectedChapter) formData.append("chapter", selectedChapter);
      if (selectedExamType) formData.append("exam_type", selectedExamType);
      formData.append("openai_api_key", openaiKey);

      setParseProgress(30);
      setParseStatus("Processing with AI...");

      // Use the backend proxy which forwards to the parser service
      const response = await fetch("/api/parser/parse-paper", {
        method: "POST",
        body: formData,
      });

      setParseProgress(80);
      setParseStatus("Extracting questions...");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to parse paper");
      }

      const result = await response.json();

      setParseProgress(100);
      setParseStatus("Complete!");

      // Add IDs and selection state to questions
      const questionsWithIds = result.questions.map((q: ParsedQuestion, idx: number) => ({
        ...q,
        id: `q-${idx}-${Date.now()}`,
        selected: true,
        subject: selectedSubject,
        grade: selectedClass,
      }));

      setParsedQuestions(questionsWithIds);
      setPaperMetadata(result.paperMetadata);
      setShowResults(true);

      toast({
        title: "Parsing Complete!",
        description: result.message,
      });

    } catch (error: any) {
      toast({
        title: "Parsing Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsParsing(false);
      setParseProgress(0);
      setParseStatus("");
    }
  };

  const toggleQuestionSelection = (id: string) => {
    setParsedQuestions(prev => 
      prev.map(q => q.id === id ? { ...q, selected: !q.selected } : q)
    );
  };

  const selectAllQuestions = (selected: boolean) => {
    setParsedQuestions(prev => prev.map(q => ({ ...q, selected })));
  };

  const updateQuestion = (id: string, updates: Partial<ParsedQuestion>) => {
    setParsedQuestions(prev =>
      prev.map(q => q.id === id ? { ...q, ...updates } : q)
    );
  };

  const deleteQuestion = (id: string) => {
    setParsedQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleSaveQuestions = async () => {
    const selectedQuestions = parsedQuestions.filter(q => q.selected);
    if (selectedQuestions.length === 0) {
      toast({ title: "No questions selected", variant: "destructive" });
      return;
    }

    try {
      // Format questions for database
      const formattedQuestions = selectedQuestions.map(q => ({
        content: q.content,
        type: q.type,
        subject: q.subject || selectedSubject,
        chapter: q.chapterHint || selectedChapter || "General",
        topic: q.topicHint || "",
        grade: q.grade || selectedClass,
        difficulty: q.difficulty || "medium",
        marks: q.marks || 1,
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer || null,
        bloomLevel: "understand",
        tenantId: selectedSchool,
        status: "pending"
      }));

      // Save to database
      const response = await apiRequest("POST", "/api/questions/bulk", { 
        questions: formattedQuestions 
      });

      toast({
        title: "Questions Saved!",
        description: `${formattedQuestions.length} questions added to question bank for HOD review.`,
      });

      // Reset
      setParsedQuestions([]);
      setShowResults(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const selectedCount = parsedQuestions.filter(q => q.selected).length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-300">
      {/* Header */}
      <header className="relative border-b border-white/20 dark:border-slate-800/50 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 dark:from-violet-900 dark:via-purple-900 dark:to-fuchsia-900 text-white shadow-xl shadow-purple-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo size="lg" showText={false} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                AI Question Paper Parser
              </h1>
              <p className="text-sm text-white/80">Extract questions from PDF/Images using AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/superadmin")}
              className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKeyDialog(true)}
              className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              API Key
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {!showResults ? (
          <>
            {/* Upload Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="w-5 h-5" />
                  Upload Question Paper
                </CardTitle>
                <CardDescription>
                  Upload a PDF or image of a CBSE question paper. AI will extract all questions with marks, type, and chapter classification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Classification Options */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>School *</Label>
                    <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                      <SelectTrigger data-testid="select-school">
                        <SelectValue placeholder="Select school" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((school) => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Class *</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger data-testid="select-class">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASSES.map((cls) => (
                          <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Select value={selectedSubject} onValueChange={(v) => {
                      setSelectedSubject(v);
                      setSelectedChapter("");
                    }}>
                      <SelectTrigger data-testid="select-subject">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(CBSE_SUBJECTS).map((subject) => (
                          <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Chapter (Optional)</Label>
                    <Select value={selectedChapter || "auto"} onValueChange={(v) => setSelectedChapter(v === "auto" ? "" : v)} disabled={!selectedSubject}>
                      <SelectTrigger data-testid="select-chapter">
                        <SelectValue placeholder="Auto-detect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-detect from content</SelectItem>
                        {chapters.map((chapter) => (
                          <SelectItem key={chapter} value={chapter}>{chapter}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Exam Type</Label>
                    <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                      <SelectTrigger data-testid="select-exam-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* File Upload */}
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-purple-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-4">
                      {selectedFile ? (
                        <>
                          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-green-600">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={(e) => {
                            e.preventDefault();
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}>
                            Remove & Choose Another
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Upload className="w-8 h-8 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium">Click to upload or drag and drop</p>
                            <p className="text-sm text-muted-foreground">PDF, PNG, or JPG (max 20MB)</p>
                          </div>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                {/* Parse Button */}
                {isParsing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                      <span className="font-medium">{parseStatus}</span>
                    </div>
                    <Progress value={parseProgress} className="h-2" />
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700"
                    onClick={handleParse}
                    disabled={!selectedFile || !selectedSchool || !selectedSubject || !selectedClass}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Parse Question Paper with AI
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  How it works
                </h3>
                <div className="grid md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <p className="font-medium">Upload Paper</p>
                      <p className="text-muted-foreground">PDF or scanned image</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <p className="font-medium">AI Extraction</p>
                      <p className="text-muted-foreground">GPT-4 Vision reads & extracts</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <p className="font-medium">Review & Edit</p>
                      <p className="text-muted-foreground">Verify marks, type, chapter</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</div>
                    <div>
                      <p className="font-medium">Save to Bank</p>
                      <p className="text-muted-foreground">Questions go to HOD review</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Results Section */
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Extraction Complete!</h3>
                      <p className="text-muted-foreground">
                        Found {parsedQuestions.length} questions from {paperMetadata?.totalPages || 1} page(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Selected</p>
                      <p className="text-2xl font-bold text-green-600">{selectedCount}</p>
                    </div>
                    <Button onClick={() => setShowResults(false)} variant="outline">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Upload Another
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions Bar */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedCount === parsedQuestions.length}
                    onCheckedChange={(checked) => selectAllQuestions(!!checked)}
                  />
                  <span className="text-sm">Select All ({parsedQuestions.length})</span>
                </div>
                <Button
                  onClick={handleSaveQuestions}
                  disabled={selectedCount === 0}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save {selectedCount} Questions to Bank
                </Button>
              </CardContent>
            </Card>

            {/* Questions List */}
            <Card>
              <CardHeader>
                <CardTitle>Extracted Questions</CardTitle>
                <CardDescription>Review, edit, or remove questions before saving</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {parsedQuestions.map((question, idx) => (
                      <div
                        key={question.id}
                        className={`p-4 rounded-lg border ${question.selected ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={question.selected}
                            onCheckedChange={() => toggleQuestionSelection(question.id!)}
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">Q{question.questionNumber}</Badge>
                              {question.section && <Badge variant="secondary">Section {question.section}</Badge>}
                              <Badge className={DIFFICULTIES[question.difficulty]?.color || "bg-slate-100"}>
                                {DIFFICULTIES[question.difficulty]?.label || question.difficulty}
                              </Badge>
                              <Badge variant="outline">{QUESTION_TYPES[question.type] || question.type}</Badge>
                              <Badge className="bg-purple-100 text-purple-700">{question.marks} marks</Badge>
                              {question.chapterHint && (
                                <Badge variant="outline" className="text-xs">
                                  {question.chapterHint}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{question.content}</p>
                            {question.options && question.options.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {question.options.map((opt, i) => (
                                  <div key={i} className="text-xs p-2 bg-white dark:bg-slate-800 rounded border">
                                    {String.fromCharCode(65 + i)}. {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingQuestion(question)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => deleteQuestion(question.id!)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OpenAI API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your OpenAI API key to use GPT-4 Vision for question extraction.
              Your key is stored locally and never sent to our servers.
            </p>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                OpenAI Platform
              </a>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              if (openaiKey) {
                setShowApiKeyDialog(false);
                toast({ title: "API Key saved" });
              }
            }}>Save Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Question Content</Label>
                <Textarea
                  value={editingQuestion.content}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, content: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={editingQuestion.type}
                    onValueChange={(v) => setEditingQuestion({ ...editingQuestion, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUESTION_TYPES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Marks</Label>
                  <Input
                    type="number"
                    value={editingQuestion.marks}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, marks: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={editingQuestion.difficulty}
                    onValueChange={(v) => setEditingQuestion({ ...editingQuestion, difficulty: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Chapter</Label>
                <Select
                  value={editingQuestion.chapterHint || ""}
                  onValueChange={(v) => setEditingQuestion({ ...editingQuestion, chapterHint: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {chapters.map((chapter) => (
                      <SelectItem key={chapter} value={chapter}>{chapter}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuestion(null)}>Cancel</Button>
            <Button onClick={() => {
              if (editingQuestion) {
                updateQuestion(editingQuestion.id!, editingQuestion);
                setEditingQuestion(null);
              }
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
