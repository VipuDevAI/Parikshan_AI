import { storage } from "../storage";
import type { Alert, SchoolConfig, User } from "@shared/schema";
import { USER_ROLES } from "@shared/schema";

// Alert escalation levels
type EscalationLevel = "L1" | "L2" | "L3" | "CRITICAL";

interface AlertRule {
  type: string;
  severity: string;
  escalationLevel: EscalationLevel;
  autoResolveMinutes?: number;
  notifyRoles: string[];
  escalateAfterMinutes: number;
  escalateTo: EscalationLevel;
}

interface AlertEvent {
  id: number;
  alertId: number;
  eventType: "CREATED" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED" | "COMMENTED";
  userId?: number;
  data?: Record<string, any>;
  timestamp: Date;
}

interface EscalationResult {
  escalated: boolean;
  newLevel?: EscalationLevel;
  notifiedUsers: number[];
}

// Alert rules configuration
const ALERT_RULES: AlertRule[] = [
  {
    type: "FIGHT_DETECTED",
    severity: "CRITICAL",
    escalationLevel: "CRITICAL",
    notifyRoles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL],
    escalateAfterMinutes: 2,
    escalateTo: "CRITICAL"
  },
  {
    type: "NO_TEACHER",
    severity: "HIGH",
    escalationLevel: "L2",
    notifyRoles: [USER_ROLES.WING_ADMIN, USER_ROLES.VICE_PRINCIPAL],
    escalateAfterMinutes: 5,
    escalateTo: "L3"
  },
  {
    type: "ABSENT_TEACHER",
    severity: "HIGH",
    escalationLevel: "L2",
    notifyRoles: [USER_ROLES.WING_ADMIN],
    escalateAfterMinutes: 10,
    escalateTo: "L3"
  },
  {
    type: "INATTENTIVE_STUDENTS",
    severity: "MEDIUM",
    escalationLevel: "L1",
    autoResolveMinutes: 30,
    notifyRoles: [USER_ROLES.TEACHER],
    escalateAfterMinutes: 15,
    escalateTo: "L2"
  },
  {
    type: "UNIFORM_VIOLATION",
    severity: "LOW",
    escalationLevel: "L1",
    autoResolveMinutes: 60,
    notifyRoles: [USER_ROLES.TEACHER],
    escalateAfterMinutes: 30,
    escalateTo: "L1"
  },
  {
    type: "BUNK_DETECTED",
    severity: "MEDIUM",
    escalationLevel: "L2",
    notifyRoles: [USER_ROLES.TEACHER, USER_ROLES.WING_ADMIN],
    escalateAfterMinutes: 5,
    escalateTo: "L3"
  }
];

export class AlertEngine {
  private config: SchoolConfig | null = null;
  private escalationTimers: Map<number, NodeJS.Timeout> = new Map();

  async loadConfig(schoolId: number): Promise<void> {
    this.config = (await storage.getSchoolConfig(schoolId)) || null;
  }

  // Get rule for alert type
  getRule(alertType: string): AlertRule | undefined {
    return ALERT_RULES.find(r => r.type === alertType);
  }

  // Process new alert through rule engine
  async processAlert(alert: Alert): Promise<{
    notifiedUsers: number[];
    escalationLevel: EscalationLevel;
    eventLog: AlertEvent;
  }> {
    await this.loadConfig(alert.schoolId);

    const rule = this.getRule(alert.type);
    const escalationLevel = rule?.escalationLevel || "L1";

    // Log event
    const eventLog = await this.logEvent({
      alertId: alert.id,
      eventType: "CREATED",
      data: { rule: rule?.type, level: escalationLevel }
    });

    // Get users to notify based on roles
    const notifiedUsers = await this.notifyUsers(
      alert.schoolId,
      rule?.notifyRoles || [USER_ROLES.WING_ADMIN],
      alert
    );

    // Set up escalation timer
    if (rule && rule.escalateAfterMinutes > 0) {
      this.setEscalationTimer(alert, rule);
    }

    // Set up auto-resolve timer
    if (rule?.autoResolveMinutes) {
      this.setAutoResolveTimer(alert, rule.autoResolveMinutes);
    }

    return { notifiedUsers, escalationLevel, eventLog };
  }

  // Acknowledge alert
  async acknowledge(alertId: number, userId: number): Promise<AlertEvent> {
    // Clear escalation timer
    this.clearTimer(alertId);

    // Log acknowledgment
    return this.logEvent({
      alertId,
      eventType: "ACKNOWLEDGED",
      userId,
      data: { acknowledgedAt: new Date().toISOString() }
    });
  }

  // Resolve alert
  async resolve(
    alertId: number,
    userId: number,
    resolution?: string
  ): Promise<AlertEvent> {
    // Clear all timers
    this.clearTimer(alertId);

    // Update alert status
    await storage.resolveAlert(alertId);

    // Log resolution
    return this.logEvent({
      alertId,
      eventType: "RESOLVED",
      userId,
      data: { resolution, resolvedAt: new Date().toISOString() }
    });
  }

  // Add comment to alert
  async addComment(
    alertId: number,
    userId: number,
    comment: string
  ): Promise<AlertEvent> {
    return this.logEvent({
      alertId,
      eventType: "COMMENTED",
      userId,
      data: { comment }
    });
  }

  // Escalate alert
  async escalate(alert: Alert, rule: AlertRule): Promise<EscalationResult> {
    const newLevel = rule.escalateTo;

    // Get escalation notification roles
    let escalationRoles: string[] = [];
    switch (newLevel) {
      case "L2":
        escalationRoles = [USER_ROLES.WING_ADMIN, USER_ROLES.VICE_PRINCIPAL];
        break;
      case "L3":
        escalationRoles = [USER_ROLES.VICE_PRINCIPAL, USER_ROLES.PRINCIPAL];
        break;
      case "CRITICAL":
        escalationRoles = [USER_ROLES.PRINCIPAL, USER_ROLES.CORRESPONDENT];
        break;
    }

    const notifiedUsers = await this.notifyUsers(alert.schoolId, escalationRoles, alert);

    // Log escalation
    await this.logEvent({
      alertId: alert.id,
      eventType: "ESCALATED",
      data: { 
        fromLevel: rule.escalationLevel, 
        toLevel: newLevel,
        notifiedUsers 
      }
    });

    return {
      escalated: true,
      newLevel,
      notifiedUsers
    };
  }

  // Notify users by role
  private async notifyUsers(
    schoolId: number,
    roles: string[],
    alert: Alert
  ): Promise<number[]> {
    const notifiedUserIds: number[] = [];

    for (const role of roles) {
      const users = await storage.getUsersBySchool(schoolId, role);
      for (const user of users) {
        // In production, this would send actual notifications
        // via WhatsApp, push notification, email, etc.
        notifiedUserIds.push(user.id);
        
        // Log notification (placeholder)
        console.log(`Notifying ${user.fullName} (${role}) about alert: ${alert.message}`);
      }
    }

    return notifiedUserIds;
  }

  // Set escalation timer
  private setEscalationTimer(alert: Alert, rule: AlertRule): void {
    const timer = setTimeout(async () => {
      // Check if alert is still unresolved
      const currentAlert = await storage.getAlert(alert.id);
      if (currentAlert && !currentAlert.isResolved) {
        await this.escalate(currentAlert, rule);
      }
      this.escalationTimers.delete(alert.id);
    }, rule.escalateAfterMinutes * 60 * 1000);

    this.escalationTimers.set(alert.id, timer);
  }

  // Set auto-resolve timer
  private setAutoResolveTimer(alert: Alert, minutes: number): void {
    setTimeout(async () => {
      const currentAlert = await storage.getAlert(alert.id);
      if (currentAlert && !currentAlert.isResolved) {
        await this.resolve(alert.id, 0, "AUTO_RESOLVED");
      }
    }, minutes * 60 * 1000);
  }

  // Clear timer
  private clearTimer(alertId: number): void {
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }
  }

  // Log alert event
  private async logEvent(event: Omit<AlertEvent, "id" | "timestamp">): Promise<AlertEvent> {
    // In production, this would persist to an event_logs table
    const logEntry: AlertEvent = {
      id: Date.now(),
      ...event,
      timestamp: new Date()
    };

    // Store in event log
    await storage.createAlertEvent(logEntry);

    return logEntry;
  }

  // Get alert timeline
  async getAlertTimeline(alertId: number): Promise<AlertEvent[]> {
    return storage.getAlertEvents(alertId);
  }

  // Get alert statistics
  async getStats(schoolId: number, dateRange?: { start: Date; end: Date }): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    avgResolutionMinutes: number;
    unresolvedCount: number;
  }> {
    const alerts = await storage.getAlerts(schoolId);
    const filteredAlerts = dateRange
      ? alerts.filter(a => {
          const created = new Date(a.createdAt || 0);
          return created >= dateRange.start && created <= dateRange.end;
        })
      : alerts;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let unresolvedCount = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const alert of filteredAlerts) {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      
      if (!alert.isResolved) {
        unresolvedCount++;
      } else {
        resolvedCount++;
        // Calculate resolution time if we have event logs
      }
    }

    return {
      total: filteredAlerts.length,
      byType,
      bySeverity,
      avgResolutionMinutes: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      unresolvedCount
    };
  }
}

export const alertEngine = new AlertEngine();
