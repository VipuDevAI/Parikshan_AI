import { useAuth } from "@/hooks/use-auth";
import { useDashboardStats, useAlerts, useTimetable, useSubstitutions, useLeaveRequests, useAttendanceTrend } from "@/hooks/use-data";
import { AlertCard } from "@/components/AlertCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Users, 
  GraduationCap, 
  UserCheck, 
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Clock,
  Calendar,
  BookOpen,
  User,
  CheckCircle,
  XCircle,
  Bell,
  ArrowRight,
  ClipboardList,
  Building
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";
import { format } from "date-fns";

const COLORS = ['#22C55E', '#166534', '#EF4444', '#3B82F6', '#F59E0B'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Dashboard() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const role = user.role;
  
  if (role === 'SUPER_ADMIN' || role === 'CORRESPONDENT' || role === 'PRINCIPAL' || role === 'VICE_PRINCIPAL') {
    return <AdminDashboard user={user} />;
  } else if (role === 'WING_ADMIN') {
    return <WingAdminDashboard user={user} />;
  } else if (role === 'TEACHER') {
    return <TeacherDashboard user={user} />;
  } else if (role === 'PARENT') {
    return <ParentDashboard user={user} />;
  }
  
  return <AdminDashboard user={user} />;
}

function AdminDashboard({ user }: { user: any }) {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useAlerts();
  const { data: leaveRequests } = useLeaveRequests();
  const { data: attendanceTrend } = useAttendanceTrend();
  
  const pendingLeaves = leaveRequests?.filter((l: any) => l.status === 'PENDING') || [];

  if (statsLoading || alertsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const trendData = attendanceTrend?.trend || [
    { day: 'Mon', present: 0 },
    { day: 'Tue', present: 0 },
    { day: 'Wed', present: 0 },
    { day: 'Thu', present: 0 },
    { day: 'Fri', present: 0 },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground" data-testid="text-greeting">
          Good Morning, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-subtitle">
          Complete overview of your school operations
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Students" 
          value={stats?.totalStudents || 0} 
          icon={GraduationCap} 
          trend="+12%"
          color="emerald"
          testId="stat-students"
        />
        <StatCard 
          title="Total Staff" 
          value={stats?.totalTeachers || 0} 
          icon={Users} 
          trend="Stable"
          color="teal"
          testId="stat-staff"
        />
        <StatCard 
          title="Present Today" 
          value={stats?.presentToday || 0} 
          icon={UserCheck} 
          trend="92% Rate"
          color="blue"
          testId="stat-present"
        />
        <StatCard 
          title="Active Alerts" 
          value={stats?.alertsToday || 0} 
          icon={AlertTriangle} 
          trend={`Critical: ${alerts?.filter(a => a.severity === 'CRITICAL').length || 0}`}
          color="orange"
          isDestructive
          testId="stat-alerts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-2 mb-6">
              <h3 className="font-bold text-lg">Weekly Attendance Trend</h3>
              <Badge variant="outline">This Week</Badge>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} className="fill-muted-foreground text-xs" dy={10} />
                  <YAxis axisLine={false} tickLine={false} className="fill-muted-foreground text-xs" />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))'}} 
                  />
                  <Bar dataKey="present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h4 className="font-semibold">Pending Leave Requests</h4>
                <Badge variant="secondary">{pendingLeaves.length}</Badge>
              </div>
              {pendingLeaves.length > 0 ? (
                <div className="space-y-3">
                  {pendingLeaves.slice(0, 3).map((leave: any) => (
                    <div key={leave.id} className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="truncate">
                          <p className="font-medium text-sm truncate">Teacher #{leave.teacherId}</p>
                          <p className="text-xs text-muted-foreground">{leave.leaveType}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0">{format(new Date(leave.date), 'MMM d')}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No pending requests
                </div>
              )}
              <Link href="/leave">
                <Button variant="ghost" size="sm" className="w-full mt-3" data-testid="button-view-leaves">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h4 className="font-semibold">Quick Actions</h4>
              </div>
              <div className="space-y-2">
                <Link href="/timetable">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-view-timetable">
                    <Calendar className="w-4 h-4 mr-2" /> View Timetable
                  </Button>
                </Link>
                <Link href="/substitutions">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-manage-subs">
                    <ClipboardList className="w-4 h-4 mr-2" /> Manage Substitutions
                  </Button>
                </Link>
                <Link href="/alerts">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-view-alerts">
                    <Bell className="w-4 h-4 mr-2" /> View All Alerts
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-settings">
                    <Building className="w-4 h-4 mr-2" /> School Settings
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>

        <div>
          <Card className="p-5 h-full flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Live AI Insights
              </h3>
              <Badge variant="outline" className="text-xs">Real-time</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px]">
              {alerts && alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert: any) => (
                  <AlertCard key={alert.id} alert={alert} compact />
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">All clear! No alerts detected.</p>
                </div>
              )}
            </div>
            
            {alerts && alerts.length > 5 && (
              <Link href="/alerts">
                <Button variant="ghost" size="sm" className="w-full mt-3" data-testid="button-all-alerts">
                  View All Alerts <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function WingAdminDashboard({ user }: { user: any }) {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: alerts } = useAlerts();
  const { data: substitutions } = useSubstitutions();
  
  const todaySubs = substitutions?.filter((s: any) => {
    const today = new Date();
    const subDate = new Date(s.date);
    return subDate.toDateString() === today.toDateString();
  }) || [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-greeting">
          Wing Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your wing operations
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Wing Students" 
          value={stats?.totalStudents || 0} 
          icon={GraduationCap} 
          color="emerald"
          testId="stat-wing-students"
        />
        <StatCard 
          title="Wing Teachers" 
          value={stats?.totalTeachers || 0} 
          icon={Users} 
          color="purple"
          testId="stat-wing-teachers"
        />
        <StatCard 
          title="Today's Subs" 
          value={todaySubs.length} 
          icon={ClipboardList} 
          color="amber"
          testId="stat-subs"
        />
        <StatCard 
          title="Wing Alerts" 
          value={alerts?.length || 0} 
          icon={AlertTriangle} 
          color="red"
          isDestructive
          testId="stat-wing-alerts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h4 className="font-semibold mb-4">Today's Substitutions</h4>
          {todaySubs.length > 0 ? (
            <div className="space-y-3">
              {todaySubs.map((sub: any) => (
                <div key={sub.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">Period {sub.periodIndex}</span>
                    <Badge variant="outline">Section #{sub.sectionId}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Teacher #{sub.originalTeacherId} replaced by #{sub.substituteTeacherId}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No substitutions today
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h4 className="font-semibold mb-4">Recent Alerts</h4>
          {alerts && alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.slice(0, 4).map((alert: any) => (
                <AlertCard key={alert.id} alert={alert} compact />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No alerts
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TeacherDashboard({ user }: { user: any }) {
  const { data: timetable, isLoading: timetableLoading } = useTimetable(undefined, String(user.id));
  const { data: substitutions } = useSubstitutions();
  const { data: leaveRequests } = useLeaveRequests();
  
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  
  const todaySchedule = timetable?.filter((t: any) => t.dayOfWeek === dayOfWeek)
    .sort((a: any, b: any) => a.periodIndex - b.periodIndex) || [];
  
  const myLeaves = leaveRequests?.filter((l: any) => l.teacherId === user.id) || [];
  const mySubs = substitutions?.filter((s: any) => s.substituteTeacherId === user.id) || [];

  if (timetableLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-greeting">
          Good Morning, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {DAYS[today.getDay()]}, {format(today, 'MMMM d, yyyy')}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Today's Classes" 
          value={todaySchedule.length} 
          icon={BookOpen} 
          color="emerald"
          testId="stat-classes"
        />
        <StatCard 
          title="My Substitutions" 
          value={mySubs.length} 
          icon={ClipboardList} 
          color="indigo"
          testId="stat-my-subs"
        />
        <StatCard 
          title="Leave Balance" 
          value={12} 
          icon={Calendar} 
          color="green"
          testId="stat-leave-balance"
        />
        <StatCard 
          title="Pending Leaves" 
          value={myLeaves.filter((l: any) => l.status === 'PENDING').length} 
          icon={Clock} 
          color="amber"
          testId="stat-pending-leaves"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Today's Schedule
          </h4>
          {todaySchedule.length > 0 ? (
            <div className="space-y-2">
              {todaySchedule.map((period: any, idx: number) => (
                <div key={period.id || idx} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">{period.periodIndex}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Subject #{period.subjectId || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">Section #{period.sectionId}</p>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0">
                    {getTimeSlot(period.periodIndex)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No classes scheduled for today</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h4 className="font-semibold mb-4">Quick Actions</h4>
          <div className="space-y-2">
            <Link href="/leave">
              <Button variant="outline" className="w-full justify-start" data-testid="button-apply-leave">
                <Calendar className="w-4 h-4 mr-2" /> Apply for Leave
              </Button>
            </Link>
            <Link href="/timetable">
              <Button variant="outline" className="w-full justify-start" data-testid="button-full-timetable">
                <Clock className="w-4 h-4 mr-2" /> Full Timetable
              </Button>
            </Link>
            <Link href="/substitutions">
              <Button variant="outline" className="w-full justify-start" data-testid="button-my-subs">
                <ClipboardList className="w-4 h-4 mr-2" /> My Substitutions
              </Button>
            </Link>
          </div>
          
          {mySubs.length > 0 && (
            <div className="mt-6">
              <h5 className="font-medium text-sm mb-3">Assigned Substitutions</h5>
              <div className="space-y-2">
                {mySubs.slice(0, 2).map((sub: any) => (
                  <div key={sub.id} className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span>Period {sub.periodIndex}</span>
                      <Badge variant="outline" className="text-xs">{format(new Date(sub.date), 'MMM d')}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ParentDashboard({ user }: { user: any }) {
  const today = new Date();

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-greeting">
          Good Morning, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {format(today, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          title="Attendance Rate" 
          value="94%" 
          icon={UserCheck} 
          color="green"
          testId="stat-attendance"
        />
        <StatCard 
          title="Days Present" 
          value={180} 
          icon={Calendar} 
          color="blue"
          testId="stat-days-present"
        />
      </div>

      <Card className="p-5">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <GraduationCap className="w-4 h-4" /> Child Information
        </h4>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Student Name</p>
              <p className="text-sm text-muted-foreground">Class 8-A | Roll No: 15</p>
            </div>
            <Badge variant="secondary" className="ml-auto">Present Today</Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600">180</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-2xl font-bold text-red-600">12</p>
              <p className="text-xs text-muted-foreground">Absent</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">5</p>
              <p className="text-xs text-muted-foreground">Late</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Recent Announcements
        </h4>
        <div className="space-y-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-sm">Parent-Teacher Meeting</span>
              <span className="text-xs text-muted-foreground">2 days ago</span>
            </div>
            <p className="text-sm text-muted-foreground">PTM scheduled for December 28th. Please mark your calendars.</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-sm">Winter Break</span>
              <span className="text-xs text-muted-foreground">5 days ago</span>
            </div>
            <p className="text-sm text-muted-foreground">School will remain closed from Dec 25 to Jan 1.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, color, isDestructive, testId }: any) {
  const colorStyles: Record<string, { icon: string; border: string; trend: string }> = {
    emerald: {
      icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
      border: "border-l-4 border-l-emerald-500",
      trend: "text-emerald-600 dark:text-emerald-400"
    },
    teal: {
      icon: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400",
      border: "border-l-4 border-l-teal-500",
      trend: "text-teal-600 dark:text-teal-400"
    },
    green: {
      icon: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
      border: "border-l-4 border-l-green-500",
      trend: "text-green-600 dark:text-green-400"
    },
    blue: {
      icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
      border: "border-l-4 border-l-blue-500",
      trend: "text-blue-600 dark:text-blue-400"
    },
    indigo: {
      icon: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
      border: "border-l-4 border-l-indigo-500",
      trend: "text-indigo-600 dark:text-indigo-400"
    },
    purple: {
      icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
      border: "border-l-4 border-l-purple-500",
      trend: "text-purple-600 dark:text-purple-400"
    },
    amber: {
      icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
      border: "border-l-4 border-l-amber-500",
      trend: "text-amber-600 dark:text-amber-400"
    },
    yellow: {
      icon: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400",
      border: "border-l-4 border-l-yellow-500",
      trend: "text-yellow-600 dark:text-yellow-400"
    },
    red: {
      icon: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
      border: "border-l-4 border-l-red-500",
      trend: "text-red-600 dark:text-red-400"
    },
    orange: {
      icon: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
      border: "border-l-4 border-l-orange-500",
      trend: "text-orange-600 dark:text-orange-400"
    },
  };

  const style = colorStyles[color] || colorStyles.emerald;

  return (
    <div className={`bg-card p-4 lg:p-5 rounded-xl shadow-sm ${style.border}`} data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <div className={`p-2 lg:p-3 rounded-xl ${style.icon}`}>
          <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
        </div>
        {trend && (
          <div className={`hidden sm:flex items-center text-xs font-bold px-2 py-1 rounded-full ${style.icon}`}>
            {trend}
            {!isDestructive && <ArrowUpRight className="w-3 h-3 ml-1" />}
          </div>
        )}
      </div>
      <div className="mt-3 lg:mt-4">
        <h4 className="text-xs lg:text-sm font-medium text-muted-foreground">{title}</h4>
        <h2 className="text-xl lg:text-2xl font-bold text-foreground mt-1">{value}</h2>
      </div>
    </div>
  );
}

function getTimeSlot(periodIndex: number): string {
  const slots: Record<number, string> = {
    1: '8:00-8:45',
    2: '8:45-9:30',
    3: '9:45-10:30',
    4: '10:30-11:15',
    5: '11:30-12:15',
    6: '12:15-1:00',
    7: '2:00-2:45',
    8: '2:45-3:30',
  };
  return slots[periodIndex] || `Period ${periodIndex}`;
}
