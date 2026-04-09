import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, User, FileText, AlertCircle } from "lucide-react";
import logoImg from "@/assets/logo.png";

interface ActivityLog {
  id: string;
  tenantId: string;
  userId: string;
  userName: string | null;
  userRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  previousState: string | null;
  newState: string | null;
  comments: string | null;
  createdAt: string;
}

export default function ActivityLogsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity-logs'],
  });

  if (!user) {
    navigate("/");
    return null;
  }

  const actionColors: Record<string, string> = {
    workflow_update: "bg-coin-blue text-white",
    create: "bg-coin-green text-white",
    update: "bg-coin-orange text-white",
    delete: "bg-coin-red text-white",
    approve: "bg-coin-green text-white",
    reject: "bg-coin-red text-white",
    lock: "bg-coin-purple text-white",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
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
            <h1 className="text-xl font-bold">Activity Logs</h1>
            <p className="text-sm text-muted-foreground">Audit Trail</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <ContentCard title="Recent Activity" description="All system actions are logged here for audit purposes">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading activity logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No activity logs found</p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {logs.map((log) => (
                <Card key={log.id} className="bg-background/50" data-testid={`log-item-${log.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge className={actionColors[log.action] || "bg-muted"}>
                            {log.action.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{log.entityType}</Badge>
                          {log.userRole && (
                            <Badge variant="secondary">{log.userRole}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <User className="w-4 h-4" />
                          <span>{log.userName || 'Unknown User'}</span>
                          <span className="mx-1">|</span>
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(log.createdAt)}</span>
                        </div>
                        {(log.previousState || log.newState) && (
                          <div className="text-sm mt-2">
                            <span className="text-muted-foreground">State: </span>
                            {log.previousState && (
                              <span className="line-through text-muted-foreground mr-2">{log.previousState}</span>
                            )}
                            {log.newState && (
                              <span className="font-medium text-foreground">{log.newState}</span>
                            )}
                          </div>
                        )}
                        {log.comments && (
                          <div className="text-sm mt-2 p-2 bg-muted rounded">
                            <FileText className="w-4 h-4 inline mr-1" />
                            {log.comments}
                          </div>
                        )}
                        {log.entityId && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Entity ID: {log.entityId}
                          </div>
                        )}
                      </div>
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
