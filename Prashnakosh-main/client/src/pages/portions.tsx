import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen, Check, Plus, Save, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface Chapter {
  id: string;
  name: string;
  subjectId: string;
  topics: string[];
  isCompleted: boolean;
  completedTopics: string[];
}

interface Subject {
  id: string;
  name: string;
  classLevel: string;
}

export default function PortionsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedSubject, setSelectedSubject] = useState("");

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
  });

  const { data: chapters = [], isLoading } = useQuery<Chapter[]>({
    queryKey: ['/api/chapters'],
  });

  const updatePortionMutation = useMutation({
    mutationFn: async (data: { chapterId: string; completedTopics: string[] }) => {
      return apiRequest("PATCH", `/api/chapters/${data.chapterId}/portions`, { completedTopics: data.completedTopics });
    },
    onSuccess: () => {
      toast({
        title: "Portion Updated",
        description: "Chapter portion has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chapters'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update portion",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const canManagePortions = ["admin", "hod", "teacher"].includes(user.role);

  if (!canManagePortions) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to manage portions.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const filteredChapters = selectedSubject 
    ? chapters.filter(c => c.subjectId === selectedSubject)
    : chapters;

  const calculateProgress = (chapter: Chapter) => {
    if (!chapter.topics || chapter.topics.length === 0) return 0;
    const completed = chapter.completedTopics?.length || 0;
    return Math.round((completed / chapter.topics.length) * 100);
  };

  const handleTopicToggle = (chapter: Chapter, topic: string) => {
    const currentCompleted = chapter.completedTopics || [];
    const newCompleted = currentCompleted.includes(topic)
      ? currentCompleted.filter(t => t !== topic)
      : [...currentCompleted, topic];
    
    updatePortionMutation.mutate({
      chapterId: chapter.id,
      completedTopics: newCompleted,
    });
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Portions Management</h1>
            <p className="text-sm text-muted-foreground">Track Syllabus Completion</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <ContentCard title="Filter by Subject">
          <div className="flex gap-4">
            <div className="flex-1 max-w-xs">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger data-testid="select-subject">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name} - Class {subject.classLevel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ContentCard>

        <ContentCard 
          title="Chapter Portions" 
          description="Mark topics as completed to track syllabus progress"
          className="mt-6"
        >
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading chapters...</div>
          ) : filteredChapters.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Chapters Found</h3>
              <p className="text-muted-foreground mt-2">
                {selectedSubject ? "No chapters for this subject" : "Add chapters to start tracking portions"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredChapters.map((chapter) => {
                const progress = calculateProgress(chapter);
                return (
                  <Card key={chapter.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            {chapter.name}
                          </CardTitle>
                        </div>
                        <Badge 
                          className={progress === 100 ? "bg-coin-green text-white" : "bg-muted"}
                        >
                          {progress}% Complete
                        </Badge>
                      </div>
                      <Progress value={progress} className="h-2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      {chapter.topics && chapter.topics.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {chapter.topics.map((topic, idx) => {
                            const isCompleted = chapter.completedTopics?.includes(topic);
                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 rounded-md border hover-elevate cursor-pointer"
                                onClick={() => handleTopicToggle(chapter, topic)}
                                data-testid={`topic-${chapter.id}-${idx}`}
                              >
                                <Checkbox 
                                  checked={isCompleted} 
                                  onCheckedChange={() => handleTopicToggle(chapter, topic)}
                                />
                                <span className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                  {topic}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No topics defined for this chapter</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ContentCard>
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
