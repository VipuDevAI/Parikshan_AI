import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Clock, FileText, Plus, RefreshCw, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface Test {
  id: string;
  name: string;
  subject: string;
  classLevel: string;
  totalMarks: number;
  duration: number;
  examDate: string;
  status: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  classLevel: string;
}

interface MakeupTest {
  id: string;
  testId: string;
  testName: string;
  studentId: string;
  studentName: string;
  reason: string;
  scheduledDate: string;
  status: string;
}

export default function MakeupTestsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTest, setSelectedTest] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [reason, setReason] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  const { data: tests = [] } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['/api/students'],
  });

  const { data: makeupTests = [], isLoading } = useQuery<MakeupTest[]>({
    queryKey: ['/api/makeup-tests'],
  });

  const createMakeupMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/makeup-tests", data);
    },
    onSuccess: () => {
      toast({
        title: "Makeup Test Scheduled",
        description: "The makeup test has been scheduled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/makeup-tests'] });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule makeup test",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedTest("");
    setSelectedStudent("");
    setReason("");
    setScheduledDate("");
  };

  if (!user) {
    navigate("/");
    return null;
  }

  const canManageMakeup = ["admin", "hod", "teacher"].includes(user.role);

  if (!canManageMakeup) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">You do not have permission to manage makeup tests.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const completedTests = tests.filter(t => ["locked", "completed", "sent_to_committee"].includes(t.status));

  const handleScheduleMakeup = () => {
    if (!selectedTest || !selectedStudent || !scheduledDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const test = tests.find(t => t.id === selectedTest);
    const student = students.find(s => s.id === selectedStudent);

    createMakeupMutation.mutate({
      testId: selectedTest,
      testName: test?.name,
      studentId: selectedStudent,
      studentName: student?.name,
      reason,
      scheduledDate,
      tenantId: user.tenantId,
      createdBy: user.id,
      status: "scheduled",
    });
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-coin-blue text-white",
    in_progress: "bg-coin-orange text-white",
    completed: "bg-coin-green text-white",
    cancelled: "bg-coin-red text-white",
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
            <h1 className="text-xl font-bold">Makeup Tests</h1>
            <p className="text-sm text-muted-foreground">Schedule Retest for Absent Students</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold">Scheduled Makeup Tests</h2>
            <p className="text-sm text-muted-foreground">Manage makeup tests for students who missed exams</p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="bg-coin-green hover:bg-coin-green/90" data-testid="button-schedule-makeup">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Makeup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Makeup Test</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Select Original Test *</Label>
                  <Select value={selectedTest} onValueChange={setSelectedTest}>
                    <SelectTrigger data-testid="select-test">
                      <SelectValue placeholder="Choose a test" />
                    </SelectTrigger>
                    <SelectContent>
                      {completedTests.map((test) => (
                        <SelectItem key={test.id} value={test.id}>
                          {test.name} - {test.subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Student *</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger data-testid="select-student">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} - Class {student.classLevel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Makeup</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Medical leave, Family emergency"
                    data-testid="input-reason"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Scheduled Date *</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    data-testid="input-scheduled-date"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleScheduleMakeup}
                    disabled={createMakeupMutation.isPending}
                    className="bg-coin-green hover:bg-coin-green/90"
                    data-testid="button-confirm-schedule"
                  >
                    {createMakeupMutation.isPending ? "Scheduling..." : "Schedule"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ContentCard>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading makeup tests...</div>
          ) : makeupTests.length === 0 ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Makeup Tests Scheduled</h3>
              <p className="text-muted-foreground mt-2">
                Schedule makeup tests for students who missed their exams
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {makeupTests.map((makeup) => (
                <Card key={makeup.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">{makeup.testName}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <User className="w-4 h-4" />
                          {makeup.studentName}
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[makeup.status] || "bg-muted"}>
                        {makeup.status.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Scheduled: {new Date(makeup.scheduledDate).toLocaleDateString()}</span>
                      </div>
                      {makeup.reason && (
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>Reason: {makeup.reason}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid={`button-start-${makeup.id}`}
                      >
                        Start Test
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-coin-red border-coin-red"
                        data-testid={`button-cancel-${makeup.id}`}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ContentCard>
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
