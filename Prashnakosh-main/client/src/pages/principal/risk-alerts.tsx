import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { PageLayout, PageHeader, PageContent, ContentCard, PageFooter } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertTriangle, Check, Clock, Eye, FileText, Shield, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@/assets/logo.png";

interface RiskAlert {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  entityName: string;
  createdAt: string;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export default function RiskAlertsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: alerts = [], isLoading } = useQuery<RiskAlert[]>({
    queryKey: ['/api/risk-alerts'],
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("PATCH", `/api/risk-alerts/${alertId}/acknowledge`, {});
    },
    onSuccess: () => {
      toast({
        title: "Alert Acknowledged",
        description: "The alert has been acknowledged and marked as reviewed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/risk-alerts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge alert",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    navigate("/");
    return null;
  }

  if (!["admin", "principal"].includes(user.role)) {
    return (
      <PageLayout>
        <PageContent>
          <ContentCard title="Access Denied">
            <p className="text-muted-foreground">Only principals can access risk alerts.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </ContentCard>
        </PageContent>
      </PageLayout>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const severityColors: Record<string, string> = {
    low: "bg-coin-blue text-white",
    medium: "bg-coin-orange text-white",
    high: "bg-coin-red text-white",
    critical: "bg-red-900 text-white",
  };

  const severityIcons: Record<string, any> = {
    low: Shield,
    medium: AlertTriangle,
    high: AlertTriangle,
    critical: XCircle,
  };

  const activeAlerts = alerts.filter(a => a.status === "active");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved");

  const alertTypes: Record<string, string> = {
    paper_leak_risk: "Paper Leak Risk",
    unauthorized_access: "Unauthorized Access",
    approval_delay: "Approval Delay",
    blueprint_violation: "Blueprint Violation",
    question_quality: "Question Quality",
    missing_deadline: "Missing Deadline",
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
            <h1 className="text-xl font-bold">Risk Alerts</h1>
            <p className="text-sm text-muted-foreground">Security & Compliance Monitoring</p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 mx-auto text-coin-red mb-2" />
                <p className="text-2xl font-bold">{activeAlerts.filter(a => a.severity === "critical" || a.severity === "high").length}</p>
                <p className="text-sm text-muted-foreground">Critical/High</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 mx-auto text-coin-orange mb-2" />
                <p className="text-2xl font-bold">{activeAlerts.filter(a => a.severity === "medium").length}</p>
                <p className="text-sm text-muted-foreground">Medium</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="w-8 h-8 mx-auto text-coin-blue mb-2" />
                <p className="text-2xl font-bold">{activeAlerts.filter(a => a.severity === "low").length}</p>
                <p className="text-sm text-muted-foreground">Low</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Check className="w-8 h-8 mx-auto text-coin-green mb-2" />
                <p className="text-2xl font-bold">{resolvedAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              Active Alerts ({activeAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved ({resolvedAlerts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <ContentCard>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading alerts...</div>
              ) : activeAlerts.length === 0 ? (
                <div className="py-12 text-center">
                  <Shield className="w-16 h-16 mx-auto text-coin-green mb-4" />
                  <h3 className="text-lg font-medium">No Active Alerts</h3>
                  <p className="text-muted-foreground mt-2">All systems are operating normally</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeAlerts
                    .sort((a, b) => {
                      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                      return severityOrder[a.severity] - severityOrder[b.severity];
                    })
                    .map((alert) => {
                      const SeverityIcon = severityIcons[alert.severity];
                      return (
                        <Card key={alert.id} className={alert.severity === "critical" ? "border-red-500" : ""}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-md ${severityColors[alert.severity]}`}>
                                  <SeverityIcon className="w-5 h-5" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">{alert.title}</CardTitle>
                                  <CardDescription>{alertTypes[alert.type] || alert.type}</CardDescription>
                                </div>
                              </div>
                              <Badge className={severityColors[alert.severity]}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                              <div className="flex items-center gap-1">
                                <FileText className="w-4 h-4" />
                                <span>{alert.entityName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{formatDate(alert.createdAt)}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                data-testid={`button-view-${alert.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                                disabled={acknowledgeAlertMutation.isPending}
                                className="bg-coin-green hover:bg-coin-green/90"
                                data-testid={`button-acknowledge-${alert.id}`}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Acknowledge
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </ContentCard>
          </TabsContent>

          <TabsContent value="resolved">
            <ContentCard>
              {resolvedAlerts.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">No resolved alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {resolvedAlerts.map((alert) => (
                    <Card key={alert.id} className="opacity-75">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{alert.title}</CardTitle>
                            <CardDescription>{alertTypes[alert.type] || alert.type}</CardDescription>
                          </div>
                          <Badge variant="secondary">Resolved</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Resolved on {alert.resolvedAt ? formatDate(alert.resolvedAt) : "N/A"}
                        </div>
                      </CardContent>
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
