import { storage } from "../storage";
import type { SchoolConfig, User, LeaveRequest } from "@shared/schema";
import { LEAVE_TYPES, LEAVE_STATUS } from "@shared/schema";

interface AttendanceStatus {
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_DUTY" | "PERMISSION";
  checkInTime?: string;
  checkOutTime?: string;
  override?: string;
  reason?: string;
}

interface AttendanceRules {
  schoolStartTime: string;       // "08:00"
  lateThresholdMinutes: number;  // 15 minutes grace
  halfDayThresholdHours: number; // 4 hours = half day
  fullDayThresholdHours: number; // 6 hours = full day
}

interface AttendanceResult {
  entityId: number;
  entityType: "TEACHER" | "STUDENT";
  date: Date;
  status: AttendanceStatus;
  calculatedBy: "AI_CAMERA" | "MANUAL" | "LEAVE_SYSTEM";
}

export class AttendanceEngine {
  private config: SchoolConfig | null = null;
  private rules: AttendanceRules = {
    schoolStartTime: "08:00",
    lateThresholdMinutes: 15,
    halfDayThresholdHours: 4,
    fullDayThresholdHours: 6
  };

  async loadConfig(schoolId: number): Promise<void> {
    this.config = (await storage.getSchoolConfig(schoolId)) || null;
  }

  // Calculate attendance status based on check-in/out times
  calculateStatus(checkIn: string | null, checkOut: string | null): AttendanceStatus {
    if (!checkIn) {
      return { status: "ABSENT" };
    }

    const startTime = this.parseTime(this.rules.schoolStartTime);
    const checkInTime = this.parseTime(checkIn);
    const lateThreshold = startTime + this.rules.lateThresholdMinutes;

    // Check if late
    if (checkInTime > lateThreshold) {
      // Calculate working hours
      if (checkOut) {
        const checkOutTime = this.parseTime(checkOut);
        const hoursWorked = (checkOutTime - checkInTime) / 60;

        if (hoursWorked < this.rules.halfDayThresholdHours) {
          return { 
            status: "HALF_DAY", 
            checkInTime: checkIn, 
            checkOutTime: checkOut,
            reason: "Insufficient hours"
          };
        }
      }

      return { 
        status: "LATE", 
        checkInTime: checkIn, 
        checkOutTime: checkOut || undefined 
      };
    }

    // On time - check for half day based on checkout
    if (checkOut) {
      const checkOutTime = this.parseTime(checkOut);
      const hoursWorked = (checkOutTime - checkInTime) / 60;

      if (hoursWorked < this.rules.halfDayThresholdHours) {
        return { 
          status: "HALF_DAY", 
          checkInTime: checkIn, 
          checkOutTime: checkOut 
        };
      }
    }

    return { 
      status: "PRESENT", 
      checkInTime: checkIn, 
      checkOutTime: checkOut || undefined 
    };
  }

  // Parse time string "HH:MM" to minutes since midnight
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  // Apply leave/duty overrides to attendance
  async applyOverrides(
    schoolId: number,
    entityId: number,
    entityType: "TEACHER" | "STUDENT",
    date: Date,
    baseStatus: AttendanceStatus
  ): Promise<AttendanceResult> {
    
    // For teachers, check leave requests
    if (entityType === "TEACHER") {
      const leaves = await storage.getLeaveRequests(schoolId, date);
      const teacherLeave = leaves.find(
        l => l.teacherId === entityId && l.status === LEAVE_STATUS.APPROVED
      );

      if (teacherLeave) {
        switch (teacherLeave.leaveType) {
          case LEAVE_TYPES.FULL_DAY:
            return {
              entityId,
              entityType,
              date,
              status: { status: "ABSENT", override: "APPROVED_LEAVE", reason: teacherLeave.reason || undefined },
              calculatedBy: "LEAVE_SYSTEM"
            };

          case LEAVE_TYPES.HALF_DAY:
            return {
              entityId,
              entityType,
              date,
              status: { status: "HALF_DAY", override: "APPROVED_LEAVE", reason: teacherLeave.reason || undefined },
              calculatedBy: "LEAVE_SYSTEM"
            };

          case LEAVE_TYPES.ON_DUTY:
          case LEAVE_TYPES.INCHARGE_DUTY:
            return {
              entityId,
              entityType,
              date,
              status: { status: "ON_DUTY", override: teacherLeave.leaveType, reason: teacherLeave.reason || undefined },
              calculatedBy: "LEAVE_SYSTEM"
            };

          case LEAVE_TYPES.PERMISSION:
            // Permission doesn't override full attendance
            if (baseStatus.status === "ABSENT") {
              return {
                entityId,
                entityType,
                date,
                status: { status: "PERMISSION", override: "PERMISSION_LEAVE" },
                calculatedBy: "LEAVE_SYSTEM"
              };
            }
            break;
        }
      }
    }

    // Return base status if no overrides
    return {
      entityId,
      entityType,
      date,
      status: baseStatus,
      calculatedBy: baseStatus.checkInTime ? "AI_CAMERA" : "MANUAL"
    };
  }

  // Process camera check-in event
  async processCheckIn(
    schoolId: number,
    entityId: number,
    entityType: "TEACHER" | "STUDENT",
    timestamp: Date,
    cameraId: number
  ): Promise<AttendanceResult> {
    await this.loadConfig(schoolId);

    const timeStr = timestamp.toTimeString().substring(0, 5); // "HH:MM"
    const baseStatus = this.calculateStatus(timeStr, null);

    return this.applyOverrides(schoolId, entityId, entityType, timestamp, baseStatus);
  }

  // Process camera check-out event
  async processCheckOut(
    schoolId: number,
    entityId: number,
    entityType: "TEACHER" | "STUDENT",
    timestamp: Date,
    cameraId: number
  ): Promise<AttendanceResult> {
    await this.loadConfig(schoolId);

    // Get existing check-in
    const existing = await storage.getAttendanceByEntity(schoolId, entityId, entityType, timestamp);
    const checkInTime = existing?.checkInTime || "08:00";
    const checkOutTime = timestamp.toTimeString().substring(0, 5);

    const baseStatus = this.calculateStatus(checkInTime, checkOutTime);
    return this.applyOverrides(schoolId, entityId, entityType, timestamp, baseStatus);
  }

  // Mark attendance for INCHARGE duty
  async markInchargeDuty(
    schoolId: number,
    teacherId: number,
    date: Date,
    assignedBy: number
  ): Promise<AttendanceResult> {
    return {
      entityId: teacherId,
      entityType: "TEACHER",
      date,
      status: { 
        status: "ON_DUTY", 
        override: "INCHARGE_DUTY",
        reason: `Assigned by ${assignedBy}`
      },
      calculatedBy: "MANUAL"
    };
  }

  // Get attendance summary for a section
  async getSectionSummary(
    schoolId: number,
    sectionId: number,
    date: Date
  ): Promise<{
    total: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
  }> {
    const students = await storage.getStudentsBySection(sectionId);
    const attendance = await storage.getAttendanceBySection(schoolId, sectionId, date);

    const summary = {
      total: students.length,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0
    };

    for (const record of attendance) {
      switch (record.status) {
        case "PRESENT": summary.present++; break;
        case "ABSENT": summary.absent++; break;
        case "LATE": summary.late++; break;
        case "HALF_DAY": summary.halfDay++; break;
      }
    }

    // Count unmarked as absent
    summary.absent += summary.total - attendance.length;

    return summary;
  }
}

export const attendanceEngine = new AttendanceEngine();
