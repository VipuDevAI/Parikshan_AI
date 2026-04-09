import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock, Unlock, Calendar, CheckCircle, BookOpen, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

interface Chapter {
  id: string;
  name: string;
  subject: string;
  grade: string;
  orderIndex: number;
  status: "draft" | "locked" | "unlocked" | "completed";
  unlockDate?: string;
  deadline?: string;
  scoresRevealed: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: BookOpen },
  locked: { label: "Locked", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: Lock },
  unlocked: { label: "Unlocked", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Unlock },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: CheckCircle },
};

export default function HODChaptersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [showDeadlineDialog, setShowDeadlineDialog] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");

  const { data: chapters = [], isLoading } = useQuery<Chapter[]>({
    queryKey: ["/api/chapters"],
  });

  const unlockMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      return apiRequest("POST", `/api/chapters/${chapterId}/unlock`);
    },
    onSuccess: () => {
      toast({ title: "Chapter unlocked successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      return apiRequest("POST", `/api/chapters/${chapterId}/lock`);
    },
    onSuccess: () => {
      toast({ title: "Chapter locked successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setDeadlineMutation = useMutation({
    mutationFn: async ({ chapterId, deadline }: { chapterId: string; deadline: string }) => {
      return apiRequest("POST", `/api/chapters/${chapterId}/deadline`, { deadline });
    },
    onSuccess: () => {
      toast({ title: "Deadline set successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      setShowDeadlineDialog(false);
      setSelectedChapter(null);
      setDeadlineDate("");
      setDeadlineTime("23:59");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (!["hod", "admin", "super_admin"].includes(user.role)) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied. HOD role required.</p>
        </div>
      </PageLayout>
    );
  }

  const subjects = Array.from(new Set(chapters.map(c => c.subject)));
  const grades = Array.from(new Set(chapters.map(c => c.grade)));

  const filteredChapters = chapters.filter(c => {
    if (filterSubject !== "all" && c.subject !== filterSubject) return false;
    if (filterGrade !== "all" && c.grade !== filterGrade) return false;
    return true;
  }).sort((a, b) => {
    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    return a.orderIndex - b.orderIndex;
  });

  const groupedChapters = filteredChapters.reduce((acc, chapter) => {
    const key = `${chapter.grade} - ${chapter.subject}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(chapter);
    return acc;
  }, {} as Record<string, Chapter[]>);

  const handleSetDeadline = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    if (chapter.deadline) {
      const date = new Date(chapter.deadline);
      setDeadlineDate(date.toISOString().split("T")[0]);
      setDeadlineTime(date.toTimeString().slice(0, 5));
    }
    setShowDeadlineDialog(true);
  };

  const confirmDeadline = () => {
    if (!selectedChapter || !deadlineDate) {
      toast({ title: "Error", description: "Please select a date", variant: "destructive" });
      return;
    }
    const deadline = new Date(`${deadlineDate}T${deadlineTime}`).toISOString();
    setDeadlineMutation.mutate({ chapterId: selectedChapter.id, deadline });
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString();
  };

  const lockedCount = chapters.filter(c => c.status === "locked").length;
  const unlockedCount = chapters.filter(c => c.status === "unlocked").length;
  const completedCount = chapters.filter(c => c.status === "completed").length;

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="School SAFAL" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Chapter Management</h1>
            <p className="text-sm text-muted-foreground">Unlock and lock chapters for student access</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{lockedCount}</p>
                  <p className="text-sm text-muted-foreground">Locked</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{unlockedCount}</p>
                  <p className="text-sm text-muted-foreground">Unlocked</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedCount}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <ContentCard title="Chapters" description="Manage chapter access for students">
          <div className="flex gap-4 mt-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm">Filter:</Label>
            </div>
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="w-32" data-testid="select-grade-filter">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map(g => (
                  <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-40" data-testid="select-subject-filter">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading chapters...</div>
          ) : Object.keys(groupedChapters).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No chapters found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedChapters).map(([groupKey, groupChapters]) => (
                <div key={groupKey}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">{groupKey}</h3>
                  <div className="space-y-2">
                    {groupChapters.map((chapter) => {
                      const config = statusConfig[chapter.status] || statusConfig.draft;
                      const StatusIcon = config.icon;
                      
                      return (
                        <Card key={chapter.id} className="bg-background/50" data-testid={`card-chapter-${chapter.id}`}>
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}>
                                  <StatusIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {chapter.orderIndex}. {chapter.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="text-xs">{config.label}</Badge>
                                    {chapter.deadline && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Deadline: {formatDate(chapter.deadline)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {chapter.status === "locked" || chapter.status === "draft" ? (
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => unlockMutation.mutate(chapter.id)}
                                    disabled={unlockMutation.isPending}
                                    data-testid={`button-unlock-${chapter.id}`}
                                  >
                                    <Unlock className="w-4 h-4 mr-1" />
                                    Unlock
                                  </Button>
                                ) : chapter.status === "unlocked" ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => lockMutation.mutate(chapter.id)}
                                    disabled={lockMutation.isPending}
                                    data-testid={`button-lock-${chapter.id}`}
                                  >
                                    <Lock className="w-4 h-4 mr-1" />
                                    Lock
                                  </Button>
                                ) : null}
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSetDeadline(chapter)}
                                  data-testid={`button-deadline-${chapter.id}`}
                                >
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {chapter.deadline ? "Edit Deadline" : "Set Deadline"}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ContentCard>
      </PageContent>

      <Dialog open={showDeadlineDialog} onOpenChange={setShowDeadlineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Chapter Deadline</DialogTitle>
            <DialogDescription>
              Set a deadline for when students must complete this chapter's test.
              {selectedChapter && (
                <span className="block mt-2 font-medium text-foreground">
                  {selectedChapter.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                data-testid="input-deadline-date"
              />
            </div>
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                data-testid="input-deadline-time"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeadlineDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmDeadline}
              disabled={setDeadlineMutation.isPending || !deadlineDate}
              data-testid="button-confirm-deadline"
            >
              {setDeadlineMutation.isPending ? "Setting..." : "Set Deadline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
