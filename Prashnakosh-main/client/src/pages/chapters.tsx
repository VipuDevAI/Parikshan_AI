import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PageLayout, PageHeader, PageContent, ContentCard } from "@/components/page-layout";
import { CoinButton } from "@/components/coin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Lock, Unlock, Calendar, Eye, CheckCircle, Clock, BookOpen
} from "lucide-react";
import type { Chapter, ChapterStatus } from "@shared/schema";

const statusConfig: Record<ChapterStatus, { label: string; color: string; icon: typeof Lock }> = {
  draft: { label: "Draft", color: "bg-gray-500", icon: Clock },
  locked: { label: "Locked", color: "bg-coin-red", icon: Lock },
  unlocked: { label: "Unlocked", color: "bg-coin-green", icon: Unlock },
  completed: { label: "Completed", color: "bg-coin-blue", icon: CheckCircle },
};

export default function ChaptersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const { data: chapters = [], isLoading } = useQuery<Chapter[]>({
    queryKey: ["/api/chapters"],
  });

  const subjects = [...new Set(chapters.map((c) => c.subject))];
  const filteredChapters = selectedSubject
    ? chapters.filter((c) => c.subject === selectedSubject)
    : chapters;

  const groupedByGrade = filteredChapters.reduce((acc, chapter) => {
    if (!acc[chapter.grade]) acc[chapter.grade] = [];
    acc[chapter.grade].push(chapter);
    return acc;
  }, {} as Record<string, Chapter[]>);

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
          <div className="flex-1">
            <h1 className="text-xl font-bold">Chapter Unlock Manager</h1>
            <p className="text-sm text-muted-foreground">
              Control chapter access and deadlines
            </p>
          </div>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-48 bg-card" data-testid="select-subject-filter">
              <SelectValue placeholder="All Subjects" />
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
        </div>
      </PageHeader>

      <PageContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : Object.keys(groupedByGrade).length === 0 ? (
          <ContentCard>
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No chapters found</h3>
              <p className="text-muted-foreground">
                Chapters will appear here once they are created
              </p>
            </div>
          </ContentCard>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByGrade)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([grade, gradeChapters]) => (
                <div key={grade}>
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Grade {grade}
                  </h2>
                  <div className="space-y-3">
                    {gradeChapters
                      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                      .map((chapter) => (
                        <ChapterCard key={chapter.id} chapter={chapter} />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}

function ChapterCard({ chapter }: { chapter: Chapter }) {
  const { toast } = useToast();
  const [isDeadlineOpen, setIsDeadlineOpen] = useState(false);
  const [deadline, setDeadline] = useState(
    chapter.deadline ? new Date(chapter.deadline).toISOString().slice(0, 16) : ""
  );

  const config = statusConfig[chapter.status as ChapterStatus] || statusConfig.draft;
  const StatusIcon = config.icon;

  const unlockMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/chapters/${chapter.id}/unlock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      toast({ title: "Chapter unlocked" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/chapters/${chapter.id}/lock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      toast({ title: "Chapter locked" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setDeadlineMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/chapters/${chapter.id}/deadline`, {
        deadline: new Date(deadline).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      toast({ title: "Deadline set" });
      setIsDeadlineOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const revealMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/chapters/${chapter.id}/reveal`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters"] });
      toast({ title: "Scores revealed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ContentCard className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1">
        <div className={`p-2 rounded-lg ${config.color}`}>
          <StatusIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{chapter.name}</h3>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Badge variant="secondary" size="sm">{chapter.subject}</Badge>
            <Badge variant="outline" size="sm">{config.label}</Badge>
            {chapter.deadline && (
              <span className="text-xs text-muted-foreground">
                Deadline: {new Date(chapter.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {chapter.status === "locked" || chapter.status === "draft" ? (
          <CoinButton
            color="green"
            icon={<Unlock className="w-4 h-4" />}
            onClick={() => unlockMutation.mutate()}
            isLoading={unlockMutation.isPending}
            data-testid={`button-unlock-${chapter.id}`}
          >
            Unlock
          </CoinButton>
        ) : chapter.status === "unlocked" ? (
          <>
            <Dialog open={isDeadlineOpen} onOpenChange={setIsDeadlineOpen}>
              <DialogTrigger asChild>
                <CoinButton
                  color="blue"
                  icon={<Calendar className="w-4 h-4" />}
                  data-testid={`button-deadline-${chapter.id}`}
                >
                  Set Deadline
                </CoinButton>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Deadline</DialogTitle>
                  <DialogDescription>
                    Set when this chapter test should end
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Deadline Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      data-testid="input-deadline"
                    />
                  </div>
                  <CoinButton
                    color="blue"
                    className="w-full"
                    onClick={() => setDeadlineMutation.mutate()}
                    isLoading={setDeadlineMutation.isPending}
                    data-testid="button-save-deadline"
                  >
                    Save Deadline
                  </CoinButton>
                </div>
              </DialogContent>
            </Dialog>
            <CoinButton
              color="slate"
              icon={<Lock className="w-4 h-4" />}
              onClick={() => lockMutation.mutate()}
              isLoading={lockMutation.isPending}
              data-testid={`button-lock-${chapter.id}`}
            >
              Lock
            </CoinButton>
          </>
        ) : chapter.status === "completed" && !chapter.scoresRevealed ? (
          <CoinButton
            color="orange"
            icon={<Eye className="w-4 h-4" />}
            onClick={() => revealMutation.mutate()}
            isLoading={revealMutation.isPending}
            data-testid={`button-reveal-${chapter.id}`}
          >
            Reveal Scores
          </CoinButton>
        ) : (
          <Badge className="bg-coin-green text-white">Scores Revealed</Badge>
        )}
      </div>
    </ContentCard>
  );
}
