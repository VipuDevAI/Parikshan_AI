import { storage } from "../storage";
import type { SchoolConfig, Alert, User } from "@shared/schema";
import { USER_ROLES } from "@shared/schema";

// Integration types
type IntegrationType = "WHATSAPP" | "ARATTAI" | "CONNECTO" | "EMAIL" | "PUSH";

interface NotificationPayload {
  type: IntegrationType;
  recipient: string;
  message: string;
  metadata?: Record<string, any>;
}

interface DeliveryStatus {
  id: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "READ";
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

interface NotificationResult {
  messageId: string;
  status: DeliveryStatus;
  channel: IntegrationType;
}

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: [1000, 5000, 15000], // Exponential backoff
  retryableErrors: ["TIMEOUT", "RATE_LIMITED", "SERVER_ERROR"]
};

// Role-based notification routing
const NOTIFICATION_ROUTING: Record<string, IntegrationType[]> = {
  [USER_ROLES.SUPER_ADMIN]: ["EMAIL", "PUSH"],
  [USER_ROLES.CORRESPONDENT]: ["EMAIL", "WHATSAPP"],
  [USER_ROLES.PRINCIPAL]: ["WHATSAPP", "EMAIL", "PUSH"],
  [USER_ROLES.VICE_PRINCIPAL]: ["WHATSAPP", "PUSH"],
  [USER_ROLES.WING_ADMIN]: ["WHATSAPP", "PUSH"],
  [USER_ROLES.TEACHER]: ["WHATSAPP", "PUSH"],
  [USER_ROLES.PARENT]: ["WHATSAPP"]
};

export class IntegrationService {
  private config: SchoolConfig | null = null;
  private pendingDeliveries: Map<string, DeliveryStatus> = new Map();

  async loadConfig(schoolId: number): Promise<void> {
    this.config = (await storage.getSchoolConfig(schoolId)) || null;
  }

  // Get available channels for school
  getAvailableChannels(): IntegrationType[] {
    const channels: IntegrationType[] = [];
    
    if (this.config?.whatsappWebhook) channels.push("WHATSAPP");
    if (this.config?.arattaiWebhook) channels.push("ARATTAI");
    
    // Push and Email always available (built-in)
    channels.push("PUSH", "EMAIL");
    
    return channels;
  }

  // Get preferred channels for a role
  getChannelsForRole(role: string): IntegrationType[] {
    const preferred = NOTIFICATION_ROUTING[role] || ["PUSH"];
    const available = this.getAvailableChannels();
    return preferred.filter(c => available.includes(c));
  }

  // Send notification to user
  async sendToUser(
    schoolId: number,
    userId: number,
    message: string,
    metadata?: Record<string, any>
  ): Promise<NotificationResult[]> {
    await this.loadConfig(schoolId);

    const user = await storage.getUser(userId);
    if (!user) throw new Error("User not found");

    const channels = this.getChannelsForRole(user.role);
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      const recipient = this.getRecipientForChannel(user, channel);
      if (!recipient) continue;

      const result = await this.send({
        type: channel,
        recipient,
        message,
        metadata: { ...metadata, userId, schoolId }
      });

      results.push(result);
    }

    return results;
  }

  // Send alert notification
  async sendAlertNotification(
    alert: Alert,
    userIds: number[]
  ): Promise<NotificationResult[]> {
    await this.loadConfig(alert.schoolId);

    const results: NotificationResult[] = [];

    for (const userId of userIds) {
      const userResults = await this.sendToUser(
        alert.schoolId,
        userId,
        this.formatAlertMessage(alert),
        { alertId: alert.id, alertType: alert.type }
      );
      results.push(...userResults);
    }

    return results;
  }

  // Send substitution notification
  async sendSubstitutionNotification(
    schoolId: number,
    teacherId: number,
    substitutionDetails: {
      date: Date;
      periodIndex: number;
      sectionName: string;
      subjectName: string;
      originalTeacherName: string;
    }
  ): Promise<NotificationResult[]> {
    const message = this.formatSubstitutionMessage(substitutionDetails);
    return this.sendToUser(schoolId, teacherId, message, {
      type: "SUBSTITUTION",
      ...substitutionDetails
    });
  }

  // Send leave status notification
  async sendLeaveStatusNotification(
    schoolId: number,
    teacherId: number,
    status: "APPROVED" | "REJECTED",
    leaveDate: Date
  ): Promise<NotificationResult[]> {
    const message = status === "APPROVED"
      ? `Your leave request for ${leaveDate.toLocaleDateString()} has been approved.`
      : `Your leave request for ${leaveDate.toLocaleDateString()} has been rejected.`;

    return this.sendToUser(schoolId, teacherId, message, {
      type: "LEAVE_STATUS",
      status,
      date: leaveDate.toISOString()
    });
  }

  // Core send function with retry logic
  private async send(payload: NotificationPayload): Promise<NotificationResult> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const status: DeliveryStatus = {
      id: messageId,
      status: "PENDING",
      attempts: 0
    };

    this.pendingDeliveries.set(messageId, status);

    // Attempt delivery with retries
    let lastError: string | undefined;
    
    for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
      status.attempts = attempt + 1;
      status.lastAttempt = new Date();

      try {
        await this.deliverMessage(payload);
        status.status = "SENT";
        this.pendingDeliveries.set(messageId, status);
        
        // Log successful delivery
        await this.logDelivery(messageId, payload, status);
        
        return { messageId, status, channel: payload.type };
      } catch (error: any) {
        lastError = error.message;
        
        if (!RETRY_CONFIG.retryableErrors.some(e => lastError?.includes(e))) {
          break; // Non-retryable error
        }

        // Wait before retry
        if (attempt < RETRY_CONFIG.maxAttempts - 1) {
          await this.delay(RETRY_CONFIG.backoffMs[attempt]);
        }
      }
    }

    status.status = "FAILED";
    status.error = lastError;
    this.pendingDeliveries.set(messageId, status);
    
    await this.logDelivery(messageId, payload, status);
    
    return { messageId, status, channel: payload.type };
  }

  // Deliver message to specific channel
  private async deliverMessage(payload: NotificationPayload): Promise<void> {
    switch (payload.type) {
      case "WHATSAPP":
        await this.sendWhatsApp(payload);
        break;
      case "ARATTAI":
        await this.sendArattai(payload);
        break;
      case "PUSH":
        await this.sendPush(payload);
        break;
      case "EMAIL":
        await this.sendEmail(payload);
        break;
      default:
        throw new Error(`Unsupported channel: ${payload.type}`);
    }
  }

  // WhatsApp delivery
  private async sendWhatsApp(payload: NotificationPayload): Promise<void> {
    if (!this.config?.whatsappWebhook) {
      throw new Error("WhatsApp webhook not configured");
    }

    const response = await fetch(this.config.whatsappWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: payload.recipient,
        message: payload.message,
        ...payload.metadata
      })
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }
  }

  // Arattai delivery
  private async sendArattai(payload: NotificationPayload): Promise<void> {
    if (!this.config?.arattaiWebhook) {
      throw new Error("Arattai webhook not configured");
    }

    const response = await fetch(this.config.arattaiWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: payload.recipient,
        text: payload.message,
        metadata: payload.metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Arattai API error: ${response.status}`);
    }
  }

  // Push notification via OneSignal or fallback
  private async sendPush(payload: NotificationPayload): Promise<void> {
    const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
    const oneSignalApiKey = process.env.ONESIGNAL_API_KEY;
    
    if (oneSignalAppId && oneSignalApiKey) {
      try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${oneSignalApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            app_id: oneSignalAppId,
            include_external_user_ids: [payload.recipient],
            contents: { en: payload.message },
            headings: { en: payload.metadata?.title || "Parikshan.AI Alert" }
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OneSignal API error: ${response.status} - ${errorText}`);
        } else {
          console.log(`[PUSH-ONESIGNAL] Sent to: ${payload.recipient}`);
        }
      } catch (error) {
        console.error("[PUSH-ONESIGNAL] Failed:", error);
      }
    } else {
      console.log(`[PUSH-MOCK] To: ${payload.recipient}, Message: ${payload.message}`);
    }
  }

  // Email delivery via SendGrid or fallback
  private async sendEmail(payload: NotificationPayload): Promise<void> {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || "noreply@parikshan.ai";
    
    if (sendgridApiKey) {
      try {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: payload.recipient }] }],
            from: { email: fromEmail, name: "Parikshan.AI" },
            subject: payload.metadata?.subject || "Notification from Parikshan.AI",
            content: [{ type: "text/plain", value: payload.message }]
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SendGrid API error: ${response.status} - ${errorText}`);
        } else {
          console.log(`[EMAIL-SENDGRID] Sent to: ${payload.recipient}`);
        }
      } catch (error) {
        console.error("[EMAIL-SENDGRID] Failed:", error);
      }
    } else {
      console.log(`[EMAIL-MOCK] To: ${payload.recipient}, Message: ${payload.message}`);
    }
  }

  // Get recipient address for channel
  private getRecipientForChannel(user: User, channel: IntegrationType): string | null {
    switch (channel) {
      case "WHATSAPP":
      case "ARATTAI":
        return user.phone || null;
      case "EMAIL":
        return user.email || null;
      case "PUSH":
        return user.id.toString();
      default:
        return null;
    }
  }

  // Format alert message
  private formatAlertMessage(alert: Alert): string {
    const severity = alert.severity.toUpperCase();
    return `[${severity}] ${alert.message}${alert.location ? ` at ${alert.location}` : ""}`;
  }

  // Format substitution message
  private formatSubstitutionMessage(details: {
    date: Date;
    periodIndex: number;
    sectionName: string;
    subjectName: string;
    originalTeacherName: string;
  }): string {
    return `Substitution assigned: ${details.subjectName} for ${details.sectionName}, ` +
           `Period ${details.periodIndex} on ${details.date.toLocaleDateString()}. ` +
           `Covering for ${details.originalTeacherName}.`;
  }

  // Log delivery for tracking
  private async logDelivery(
    messageId: string,
    payload: NotificationPayload,
    status: DeliveryStatus
  ): Promise<void> {
    await storage.createNotificationLog({
      messageId,
      channel: payload.type,
      recipient: payload.recipient,
      status: status.status,
      attempts: status.attempts,
      error: status.error,
      metadata: payload.metadata
    });
  }

  // Get delivery status
  getDeliveryStatus(messageId: string): DeliveryStatus | undefined {
    return this.pendingDeliveries.get(messageId);
  }

  // Get delivery history for school
  async getDeliveryHistory(
    schoolId: number,
    options?: { limit?: number; channel?: IntegrationType }
  ): Promise<any[]> {
    return storage.getNotificationLogs(schoolId, options);
  }

  // Helper delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const integrationService = new IntegrationService();
