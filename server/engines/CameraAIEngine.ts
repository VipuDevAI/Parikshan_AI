import { storage } from "../storage";
import type { Camera, SchoolConfig, Alert } from "@shared/schema";
import { attendanceEngine } from "./AttendanceEngine";

// Camera types and their rules
type CameraType = "ENTRY" | "CLASSROOM" | "CORRIDOR" | "PLAYGROUND" | "CANTEEN";

interface CameraRule {
  type: CameraType;
  features: string[];
  alertThresholds: Record<string, number>;
}

interface DetectionEvent {
  cameraId: number;
  timestamp: Date;
  eventType: string;
  data: Record<string, any>;
  confidence: number;
}

interface FaceDetection {
  entityId: number;
  entityType: "TEACHER" | "STUDENT";
  confidence: number;
  timestamp: Date;
}

// Camera rules per type
const CAMERA_RULES: Record<CameraType, CameraRule> = {
  ENTRY: {
    type: "ENTRY",
    features: ["face_recognition", "attendance"],
    alertThresholds: {
      unknown_person: 0.8,
      tailgating: 0.9
    }
  },
  CLASSROOM: {
    type: "CLASSROOM",
    features: ["teacher_presence", "student_attention", "uniform_check", "head_count"],
    alertThresholds: {
      no_teacher: 600,        // 10 minutes in seconds
      low_attention: 0.5,     // 50% inattentive
      uniform_violation: 3    // 3 or more violations
    }
  },
  CORRIDOR: {
    type: "CORRIDOR",
    features: ["crowd_detection", "fight_detection", "running_detection"],
    alertThresholds: {
      crowd: 20,              // 20+ people
      fight: 0.85,            // 85% confidence
      running: 5              // 5+ running
    }
  },
  PLAYGROUND: {
    type: "PLAYGROUND",
    features: ["student_count", "injury_detection", "boundary_check"],
    alertThresholds: {
      injury: 0.9,
      out_of_boundary: 1
    }
  },
  CANTEEN: {
    type: "CANTEEN",
    features: ["queue_length", "crowd_density"],
    alertThresholds: {
      long_queue: 30,         // 30+ people
      overcrowding: 100
    }
  }
};

export class CameraAIEngine {
  private config: SchoolConfig | null = null;
  private noTeacherTimers: Map<number, NodeJS.Timeout> = new Map();
  private pendingAlerts: Map<string, DetectionEvent> = new Map();

  async loadConfig(schoolId: number): Promise<void> {
    this.config = (await storage.getSchoolConfig(schoolId)) || null;
  }

  // Get rules for a camera type
  getRules(cameraType: CameraType): CameraRule {
    return CAMERA_RULES[cameraType] || CAMERA_RULES.CLASSROOM;
  }

  // Process face detection from camera
  async processFaceDetection(
    cameraId: number,
    detection: FaceDetection
  ): Promise<void> {
    const camera = await storage.getCamera(cameraId);
    if (!camera) return;

    await this.loadConfig(camera.schoolId);

    // ENTRY cameras trigger attendance
    if (camera.type === "ENTRY") {
      await attendanceEngine.processCheckIn(
        camera.schoolId,
        detection.entityId,
        detection.entityType,
        detection.timestamp,
        cameraId
      );
    }

    // CLASSROOM cameras track teacher presence
    if (camera.type === "CLASSROOM" && detection.entityType === "TEACHER") {
      this.clearNoTeacherTimer(cameraId);
    }
  }

  // Start no-teacher timer for classroom (only if not already running)
  startNoTeacherTimer(camera: Camera, periodStartTime: Date): void {
    if (camera.type !== "CLASSROOM") return;

    // Only start timer if one isn't already running for this camera
    if (this.noTeacherTimers.has(camera.id)) {
      return;
    }

    const rules = this.getRules("CLASSROOM");
    const threshold = rules.alertThresholds.no_teacher * 1000; // Convert to ms

    const timer = setTimeout(async () => {
      // Check if teacher still not present
      const alert = await this.createAlert(camera.schoolId, {
        type: "NO_TEACHER",
        severity: "HIGH",
        message: `No teacher detected in ${camera.location} for ${rules.alertThresholds.no_teacher / 60} minutes`,
        location: camera.location,
        cameraId: camera.id
      });
      
      this.noTeacherTimers.delete(camera.id);
    }, threshold);

    this.noTeacherTimers.set(camera.id, timer);
  }

  // Clear no-teacher timer
  clearNoTeacherTimer(cameraId: number): void {
    const timer = this.noTeacherTimers.get(cameraId);
    if (timer) {
      clearTimeout(timer);
      this.noTeacherTimers.delete(cameraId);
    }
  }

  // Process attention detection
  async processAttentionDetection(
    cameraId: number,
    attentiveCount: number,
    totalCount: number,
    timestamp: Date
  ): Promise<void> {
    const camera = await storage.getCamera(cameraId);
    if (!camera || camera.type !== "CLASSROOM") return;

    await this.loadConfig(camera.schoolId);
    if (!this.config?.enableMoodDetection) return;

    const rules = this.getRules("CLASSROOM");
    const attentionRate = totalCount > 0 ? attentiveCount / totalCount : 1;

    if (attentionRate < rules.alertThresholds.low_attention) {
      const inattentiveCount = totalCount - attentiveCount;
      await this.createAlert(camera.schoolId, {
        type: "INATTENTIVE_STUDENTS",
        severity: "MEDIUM",
        message: `${inattentiveCount} students appear inattentive in ${camera.location}`,
        location: camera.location,
        cameraId: camera.id
      });
    }
  }

  // Process uniform check
  async processUniformCheck(
    cameraId: number,
    violations: Array<{ studentId: number; issue: string }>,
    timestamp: Date
  ): Promise<void> {
    const camera = await storage.getCamera(cameraId);
    if (!camera) return;

    await this.loadConfig(camera.schoolId);
    if (!this.config?.enableUniformCheck) return;

    const rules = this.getRules("CLASSROOM");
    if (violations.length >= rules.alertThresholds.uniform_violation) {
      await this.createAlert(camera.schoolId, {
        type: "UNIFORM_VIOLATION",
        severity: "LOW",
        message: `${violations.length} students with uniform violations in ${camera.location}`,
        location: camera.location,
        cameraId: camera.id
      });
    }
  }

  // Process fight/discipline detection
  async processDisciplineEvent(
    cameraId: number,
    eventType: "FIGHT" | "RUNNING" | "CROWDING",
    confidence: number,
    timestamp: Date
  ): Promise<void> {
    const camera = await storage.getCamera(cameraId);
    if (!camera) return;

    await this.loadConfig(camera.schoolId);
    if (!this.config?.enableDisciplineAlerts) return;

    const rules = this.getRules(camera.type as CameraType);
    
    if (eventType === "FIGHT" && confidence >= rules.alertThresholds.fight) {
      await this.createAlert(camera.schoolId, {
        type: "FIGHT_DETECTED",
        severity: "CRITICAL",
        message: `Aggressive behavior detected in ${camera.location}`,
        location: camera.location,
        cameraId: camera.id
      });
    }
    
    if (eventType === "RUNNING" && confidence >= (rules.alertThresholds.running || 0.8)) {
      await this.createAlert(camera.schoolId, {
        type: "RUNNING_DETECTED",
        severity: "MEDIUM",
        message: `Students running in ${camera.location}`,
        location: camera.location,
        cameraId: camera.id
      });
    }
    
    if (eventType === "CROWDING" && confidence >= (rules.alertThresholds.crowd || 0.8)) {
      await this.createAlert(camera.schoolId, {
        type: "CROWDING_DETECTED",
        severity: "MEDIUM",
        message: `Crowding detected in ${camera.location}`,
        location: camera.location,
        cameraId: camera.id
      });
    }
  }

  // Process teacher presence in classroom
  async processTeacherPresence(
    cameraId: number,
    teacherPresent: boolean,
    timestamp: Date
  ): Promise<void> {
    const camera = await storage.getCamera(cameraId);
    if (!camera || camera.type !== "CLASSROOM") return;

    await this.loadConfig(camera.schoolId);

    if (teacherPresent) {
      this.clearNoTeacherTimer(cameraId);
    } else {
      this.startNoTeacherTimer(camera, timestamp);
    }
  }

  // Register face for recognition
  async registerFace(
    schoolId: number,
    entityId: number,
    entityType: "TEACHER" | "STUDENT",
    imageData: string // Base64 encoded
  ): Promise<{ success: boolean; faceId?: string; error?: string }> {
    // Store face encoding (placeholder - would integrate with ML service)
    const faceId = `face_${entityType}_${entityId}_${Date.now()}`;
    
    // In production, this would:
    // 1. Send image to face recognition service
    // 2. Extract face embeddings
    // 3. Store in vector database
    
    await storage.updateFaceRegistration(entityType, entityId, faceId);
    
    return { success: true, faceId };
  }

  // Create alert
  private async createAlert(
    schoolId: number,
    data: {
      type: string;
      severity: string;
      message: string;
      location?: string;
      cameraId?: number;
      imageUrl?: string;
    }
  ): Promise<Alert> {
    return storage.createAlert({
      schoolId,
      type: data.type,
      severity: data.severity,
      message: data.message,
      location: data.location,
      imageUrl: data.imageUrl
    });
  }

  // Get camera status summary
  async getCameraStatus(schoolId: number): Promise<{
    total: number;
    active: number;
    offline: number;
    alerts: number;
  }> {
    const cameras = await storage.getCameras(schoolId);
    const now = Date.now();
    const offlineThreshold = 5 * 60 * 1000; // 5 minutes

    let active = 0;
    let offline = 0;

    for (const cam of cameras) {
      if (!cam.isActive) {
        offline++;
      } else if (cam.lastPingAt && now - new Date(cam.lastPingAt).getTime() > offlineThreshold) {
        offline++;
      } else {
        active++;
      }
    }

    const alerts = await storage.getUnresolvedAlertCount(schoolId);

    return {
      total: cameras.length,
      active,
      offline,
      alerts
    };
  }
}

export const cameraAIEngine = new CameraAIEngine();
