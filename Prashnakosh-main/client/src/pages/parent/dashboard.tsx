import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Award, BarChart3, Bell, BookOpen, Calendar, GraduationCap, TrendingUp, User, Play, Clock, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import logoImg from "@/assets/logo.png";

interface ChildInfo {
  id: string;
  name: string;
  classLevel: string;
  section: string;
  rollNumber: string;
}

interface ChildResult {
  testId: string;
  testName: string;
  subject: string;
  examDate: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  rank: number | null;
}

interface ProgressData {
  subject: string;
  averageScore: number;
  testsCompleted: number;
  improvement: number;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  childName: string;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const parentId = user?.id;

  const { data: children = [] } = useQuery<ChildInfo[]>({
    queryKey: ['/api/parent/children', parentId],
    enabled: !!parentId,
  });

  const { data: results = [] } = useQuery<ChildResult[]>({
    queryKey: ['/api/parent/results', parentId],
    enabled: !!parentId,
  });

  const { data: progressData = [] } = useQuery<ProgressData[]>({
    queryKey: ['/api/parent/progress', parentId],
    enabled: !!parentId,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/parent/notifications', parentId],
    enabled: !!parentId,
  });

  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: ['/api/parent/activity-timeline', parentId],
    enabled: !!parentId,
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (user.role !== "parent") {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">This page is only accessible to parents.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'A+': 'bg-coin-green text-white',
      'A': 'bg-coin-green text-white',
      'B+': 'bg-coin-blue text-white',
      'B': 'bg-coin-blue text-white',
      'C+': 'bg-coin-orange text-white',
      'C': 'bg-coin-orange text-white',
      'D': 'bg-coin-red text-white',
      'F': 'bg-coin-red text-white',
    };
    return colors[grade] || 'bg-muted';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src={logoImg} alt="Question Bank" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold">Parent Dashboard</h1>
              <p className="text-sm text-muted-foreground">Track Your Child's Progress</p>
            </div>
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
            </Button>
            {unreadNotifications > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-coin-red">
                {unreadNotifications}
              </Badge>
            )}
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <Tabs defaultValue="overview">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">Activity</TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => (
                <Card key={child.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-muted">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{child.name}</CardTitle>
                        <CardDescription>Class {child.classLevel} - {child.section}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      Roll Number: {child.rollNumber}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {children.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No children linked to your account</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <ContentCard title="Recent Results" description="Latest test performances" className="mt-6">
              {results.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No results available yet
                </div>
              ) : (
                <div className="space-y-4">
                  {results.slice(0, 5).map((result, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{result.testName}</CardTitle>
                            <CardDescription>{result.subject}</CardDescription>
                          </div>
                          <Badge className={getGradeColor(result.grade)}>
                            {result.grade}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <span>Score: {result.obtainedMarks}/{result.totalMarks}</span>
                          <span className="text-muted-foreground">{formatDate(result.examDate)}</span>
                        </div>
                        <Progress value={result.percentage} className="h-2 mt-2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ContentCard>
          </TabsContent>

          <TabsContent value="results">
            <ContentCard title="All Test Results" description="Complete history of test performances">
              {results.length === 0 ? (
                <div className="py-12 text-center">
                  <Award className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Results Yet</h3>
                  <p className="text-muted-foreground mt-2">Results will appear here after tests are completed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((result, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{result.testName}</CardTitle>
                            <CardDescription>{result.subject}</CardDescription>
                          </div>
                          <div className="text-right">
                            <Badge className={getGradeColor(result.grade)}>{result.grade}</Badge>
                            {result.rank && (
                              <p className="text-xs text-muted-foreground mt-1">Rank: #{result.rank}</p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 sm:grid-cols-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Score: </span>
                            <span className="font-medium">{result.obtainedMarks}/{result.totalMarks}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Percentage: </span>
                            <span className="font-medium">{result.percentage}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date: </span>
                            <span className="font-medium">{formatDate(result.examDate)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ContentCard>
          </TabsContent>

          <TabsContent value="progress">
            <ContentCard title="Subject-wise Progress" description="Track improvement across subjects">
              {progressData.length === 0 ? (
                <div className="py-12 text-center">
                  <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Progress Data</h3>
                  <p className="text-muted-foreground mt-2">Progress analytics will appear after completing multiple tests</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {progressData.map((subject, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            {subject.subject}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {subject.improvement > 0 ? (
                              <Badge className="bg-coin-green text-white">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                +{subject.improvement}%
                              </Badge>
                            ) : subject.improvement < 0 ? (
                              <Badge className="bg-coin-red text-white">
                                {subject.improvement}%
                              </Badge>
                            ) : (
                              <Badge variant="secondary">No change</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Average Score</span>
                            <span className="font-medium">{subject.averageScore}%</span>
                          </div>
                          <Progress value={subject.averageScore} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {subject.testsCompleted} tests completed
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ContentCard>
          </TabsContent>

          <TabsContent value="timeline">
            <ContentCard title="Activity Timeline" description="Recent activities of your children">
              {activities.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Recent Activity</h3>
                  <p className="text-muted-foreground mt-2">Activities will appear here as your children take tests</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="relative pl-6 border-l-2 border-muted space-y-6">
                    {activities.map((activity) => (
                      <div key={activity.id} className="relative">
                        <div className="absolute -left-[29px] p-2 rounded-full bg-card border-2 border-muted">
                          {activity.icon === "award" ? (
                            <Award className="w-4 h-4 text-coin-green" />
                          ) : activity.icon === "play" ? (
                            <Play className="w-4 h-4 text-coin-blue" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-coin-orange" />
                          )}
                        </div>
                        <Card className="ml-4">
                          <CardHeader className="py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-sm">{activity.title}</CardTitle>
                                <CardDescription className="mt-1">{activity.description}</CardDescription>
                              </div>
                              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                {activity.childName}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </CardHeader>
                        </Card>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </ContentCard>
          </TabsContent>

          <TabsContent value="notifications">
            <ContentCard title="Notifications" description="Stay updated with your child's activities">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Notifications</h3>
                  <p className="text-muted-foreground mt-2">You'll receive updates about tests and results here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <Card key={notification.id} className={notification.isRead ? 'opacity-60' : ''}>
                      <CardHeader className="py-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${notification.isRead ? 'bg-muted' : 'bg-coin-blue/10'}`}>
                            <Bell className={`w-4 h-4 ${notification.isRead ? 'text-muted-foreground' : 'text-coin-blue'}`} />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-sm">{notification.title}</CardTitle>
                            <CardDescription className="mt-1">{notification.message}</CardDescription>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDate(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <Badge className="bg-coin-blue text-white">New</Badge>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </ContentCard>
          </TabsContent>
        </Tabs>
      </PageContent>

      <PageFooter />
    </PageLayout>
  );
}
