import { pgTable, text, serial, integer, boolean, timestamp, jsonb, time } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- ENUMS ---
export const USER_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CORRESPONDENT: "CORRESPONDENT",
  PRINCIPAL: "PRINCIPAL",
  VICE_PRINCIPAL: "VICE_PRINCIPAL",
  WING_ADMIN: "WING_ADMIN", // Head of Wing
  TEACHER: "TEACHER",
  PARENT: "PARENT"
} as const;

export const SCHOOL_TIERS = {
  BASIC: "BASIC",
  PREMIUM: "PREMIUM",
  ENTERPRISE: "ENTERPRISE"
} as const;

// --- TABLES ---

// 1. Schools (Tenants)
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // Unique School Code for Login
  address: text("address"),
  logoUrl: text("logo_url"),
  tier: text("tier").default(SCHOOL_TIERS.BASIC),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. Wings (KG, Primary, etc.)
export const wings = pgTable("wings", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  name: text("name").notNull(), // e.g., "Primary", "Senior Secondary"
  minGrade: integer("min_grade"), // 1
  maxGrade: integer("max_grade"), // 5
});

// 3. Users (All roles)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(), // Multi-tenancy
  wingId: integer("wing_id"), // Optional: For Wing Admin / Teachers specific to a wing
  username: text("username").notNull(),
  password: text("password").notNull(), // Hashed
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // From USER_ROLES
  email: text("email"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  // Teacher-specific fields
  employeeId: text("employee_id"), // Staff ID/Employee Code
  qualification: text("qualification"), // B.Ed, M.Ed, etc.
  canTeachCrossWing: boolean("can_teach_cross_wing").default(false), // Can substitute in other wings
  designation: text("designation"), // Senior Teacher, PGT, TGT, etc.
});

// 4. Academic Structure
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  wingId: integer("wing_id").notNull(),
  name: text("name").notNull(), // "Class 1", "Grade 10"
  gradeLevel: integer("grade_level").notNull(), // 1, 10
});

export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  name: text("name").notNull(), // "A", "B"
  classTeacherId: integer("class_teacher_id"), // Teacher ID
  roomNumber: text("room_number"),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  sectionId: integer("section_id").notNull(),
  fullName: text("full_name").notNull(),
  rollNumber: text("roll_number"),
  admissionNumber: text("admission_number"), // Unique admission/registration number
  gender: text("gender"), // Male, Female, Other
  dateOfBirth: text("date_of_birth"), // Date string for simplicity
  parentName: text("parent_name"),
  parentPhone: text("parent_phone"), // For alerts
  parentEmail: text("parent_email"),
  address: text("address"),
  photoUrl: text("photo_url"), // For Face Rec
});

// Language groups for parallel period scheduling
export const LANGUAGE_GROUPS = {
  II_LANGUAGE: "II_LANGUAGE", // Tamil, Hindi, Sanskrit, French
  III_LANGUAGE: "III_LANGUAGE",
  NONE: "NONE"
} as const;

// Stream groups for 11th/12th parallel periods
export const STREAM_GROUPS = {
  SCIENCE: "SCIENCE",
  COMMERCE: "COMMERCE",
  HUMANITIES: "HUMANITIES",
  VOCATIONAL: "VOCATIONAL",
  NONE: "NONE"
} as const;

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  wingId: integer("wing_id"), // Subject can be wing-specific
  name: text("name").notNull(), // "Mathematics"
  code: text("code"),
  periodsPerWeek: integer("periods_per_week").default(5), // How many periods per week for this subject
  periodsPerDay: integer("periods_per_day").default(1), // Max periods per day for this subject
  isLab: boolean("is_lab").default(false), // Is this a lab subject (Science, Maths, Computer)
  requiresLabRoom: boolean("requires_lab_room").default(false),
  languageGroup: text("language_group").default(LANGUAGE_GROUPS.NONE), // II_LANGUAGE, III_LANGUAGE, NONE
  streamGroup: text("stream_group").default(STREAM_GROUPS.NONE), // For 11th/12th streams
  isLightSubject: boolean("is_light_subject").default(false), // PT, Art, Music - suitable after lunch
  periodDuration: integer("period_duration"), // Override default duration (for lab periods)
});

// Teacher-Subject mapping (which teachers can teach which subjects)
export const teacherSubjects = pgTable("teacher_subjects", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  teacherId: integer("teacher_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  wingId: integer("wing_id"), // Teacher may only teach this subject in specific wing
  isPrimary: boolean("is_primary").default(true), // Primary vs backup subject
});

// 5. Timetable
export const timetable = pgTable("timetable", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  sectionId: integer("section_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 1=Mon, 7=Sun
  periodIndex: integer("period_index").notNull(), // 1, 2, 3...
  subjectId: integer("subject_id"), // Nullable for Free period
  teacherId: integer("teacher_id"), // Nullable for Free period
  roomId: text("room_id"),
});

// 6. Attendance & Logs
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  date: timestamp("date").notNull(),
  type: text("type").notNull(), // "TEACHER", "STUDENT"
  entityId: integer("entity_id").notNull(), // UserID or StudentID
  status: text("status").notNull(), // "PRESENT", "ABSENT", "LATE", "HALF_DAY"
  checkInTime: time("check_in_time"),
  checkOutTime: time("check_out_time"),
  verifiedBy: text("verified_by").default("AI_CAMERA"), // "AI_CAMERA", "MANUAL"
});

// 7. Alerts & AI Events
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  type: text("type").notNull(), // "ABSENT_TEACHER", "FIGHT_DETECTED", "BUNK_DETECTED"
  severity: text("severity").notNull(), // "LOW", "MEDIUM", "HIGH", "CRITICAL"
  message: text("message").notNull(),
  location: text("location"), // "Room 101"
  imageUrl: text("image_url"), // Evidence
  isResolved: boolean("is_resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// 8. Leave Requests
export const LEAVE_TYPES = {
  FULL_DAY: "FULL_DAY",
  HALF_DAY: "HALF_DAY",
  PERMISSION: "PERMISSION", // Period-wise
  ON_DUTY: "ON_DUTY",
  INCHARGE_DUTY: "INCHARGE_DUTY", // Principal assigned
  CASUAL: "CASUAL",
  SICK: "SICK",
  PERSONAL: "PERSONAL"
} as const;

export const LEAVE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
} as const;

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  teacherId: integer("teacher_id").notNull(),
  leaveType: text("leave_type").notNull(), // From LEAVE_TYPES
  status: text("status").default(LEAVE_STATUS.PENDING),
  date: timestamp("date").notNull(),
  periods: text("periods"), // JSON array of period indices for PERMISSION type
  reason: text("reason"),
  approvedBy: integer("approved_by"), // User ID who approved
  createdAt: timestamp("created_at").defaultNow(),
});

// 9. Substitutions
export const substitutions = pgTable("substitutions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  date: timestamp("date").notNull(),
  periodIndex: integer("period_index").notNull(),
  sectionId: integer("section_id").notNull(),
  originalTeacherId: integer("original_teacher_id").notNull(),
  substituteTeacherId: integer("substitute_teacher_id").notNull(),
  leaveRequestId: integer("leave_request_id"),
  subjectId: integer("subject_id"),
  score: integer("score"), // Matching score
  isNotified: boolean("is_notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// 10. Cameras / AI Devices
export const cameras = pgTable("cameras", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  name: text("name").notNull(), // "Corridor A Camera"
  type: text("type").notNull(), // "ENTRY", "CLASSROOM", "CORRIDOR"
  location: text("location").notNull(),
  roomId: text("room_id"), // Linked room for classroom cams
  sectionId: integer("section_id"), // Link to specific section for classroom cameras
  isActive: boolean("is_active").default(true),
  lastPingAt: timestamp("last_ping_at"),
  // RTSP/NVR Configuration
  rtspUrl: text("rtsp_url"), // Full RTSP URL for direct camera connection
  nvrId: integer("nvr_id"), // Link to NVR if using NVR-based setup
  channelNumber: integer("channel_number"), // NVR channel number (1-150)
  brand: text("brand"), // HIKVISION, DAHUA, CP_PLUS, AXIS, etc.
  resolution: text("resolution"), // 720p, 1080p, 4K
  streamType: text("stream_type").default("main"), // main, sub (sub for lower bandwidth)
});

// 10a. NVR Configuration for bulk camera management
export const nvrs = pgTable("nvrs", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  name: text("name").notNull(), // "Main Building NVR"
  brand: text("brand").notNull(), // HIKVISION, DAHUA, etc.
  ipAddress: text("ip_address").notNull(), // 192.168.1.100
  port: integer("port").default(554), // RTSP port
  username: text("username").notNull(),
  password: text("password").notNull(), // Encrypted in production
  totalChannels: integer("total_channels").notNull(), // 16, 32, 64, etc.
  rtspTemplate: text("rtsp_template"), // URL template with {channel} placeholder
  isActive: boolean("is_active").default(true),
  lastPingAt: timestamp("last_ping_at"),
});

// 10b. Section-Camera mapping (on/off controls per class/section)
export const sectionCameras = pgTable("section_cameras", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  sectionId: integer("section_id").notNull(),
  cameraId: integer("camera_id").notNull(),
  isEnabled: boolean("is_enabled").default(true), // On/off for this section
  enableAttendance: boolean("enable_attendance").default(true),
  enableDiscipline: boolean("enable_discipline").default(true),
});

// 10c. Face Encodings for face recognition (6k-10k per school)
export const faceEncodings = pgTable("face_encodings", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  entityType: text("entity_type").notNull(), // "TEACHER", "STUDENT"
  entityId: integer("entity_id").notNull(), // User ID or Student ID
  sectionId: integer("section_id"), // For students - for class/section organization
  encoding: text("encoding").notNull(), // Base64 encoded face embedding vector
  photoUrl: text("photo_url"), // Original photo URL
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// 11. School Configuration
export const schoolConfig = pgTable("school_config", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().unique(),
  periodsPerDay: integer("periods_per_day").default(8),
  periodDuration: integer("period_duration").default(45), // minutes
  lunchAfterPeriod: integer("lunch_after_period").default(4),
  maxSubstitutionsPerDay: integer("max_substitutions_per_day").default(3),
  leaveDeadlineHour: integer("leave_deadline_hour").default(7), // 7 AM
  leaveDeadlineMinute: integer("leave_deadline_minute").default(0),
  
  // Timetable Engine Config
  maxPeriodsPerTeacherPerDay: integer("max_periods_per_teacher_per_day").default(7),
  maxPeriodsPerTeacherPerWeek: integer("max_periods_per_teacher_per_week").default(35),
  enforceRoomConflicts: boolean("enforce_room_conflicts").default(true),
  maxConsecutivePeriods: integer("max_consecutive_periods").default(3),
  preferredLabPeriods: text("preferred_lab_periods"), // JSON array of period indices
  lightSubjectPeriods: text("light_subject_periods"), // JSON array for after-lunch periods
  
  // Substitution Engine Config
  maxConsecutiveSubstitutions: integer("max_consecutive_substitutions").default(2),
  wingPriorityOverride: boolean("wing_priority_override").default(true),
  autoGenerateSubstitutions: boolean("auto_generate_substitutions").default(false),
  excludeVPFromSubstitution: boolean("exclude_vp_from_substitution").default(true),
  excludePrincipalFromSubstitution: boolean("exclude_principal_from_substitution").default(true),
  maxTeacherPeriodsForSubstitution: integer("max_teacher_periods_for_substitution").default(7), // Exclude 7+ period teachers
  avoidBackToBackSubstitution: boolean("avoid_back_to_back_substitution").default(true),
  
  // Substitution Scoring Weights (AppScript exact weights)
  scoreWeightBase: integer("score_weight_base").default(100),
  scoreWeightSubjectMatch: integer("score_weight_subject_match").default(30),
  scoreWeightClassFamiliarity: integer("score_weight_class_familiarity").default(20),
  scoreWeightPeriodGap: integer("score_weight_period_gap").default(-15),
  scoreWeightSubstitutionLoad: integer("score_weight_substitution_load").default(-10),
  scoreWeightOverload: integer("score_weight_overload").default(-50),
  
  // AI Config
  enableFaceRecognition: boolean("enable_face_recognition").default(true),
  enableMoodDetection: boolean("enable_mood_detection").default(false),
  enableUniformCheck: boolean("enable_uniform_check").default(false),
  enableDisciplineAlerts: boolean("enable_discipline_alerts").default(true),
  
  // AI Thresholds
  attendanceConfidenceThreshold: integer("attendance_confidence_threshold").default(80),
  moodDetectionThreshold: integer("mood_detection_threshold").default(70),
  uniformViolationThreshold: integer("uniform_violation_threshold").default(75),
  crowdingThreshold: integer("crowding_threshold").default(30),
  runningThreshold: integer("running_threshold").default(5),
  fightConfidenceThreshold: integer("fight_confidence_threshold").default(85),
  
  // Integration Config
  whatsappWebhook: text("whatsapp_webhook"),
  arattaiWebhook: text("arattai_webhook"),
  enableWhatsAppNotifications: boolean("enable_whatsapp_notifications").default(false),
  enableEmailNotifications: boolean("enable_email_notifications").default(false),
  
  // Leave Policy
  maxLeavePerWing: integer("max_leave_per_wing").default(3), // Max teachers on leave per wing per day
  minAttendancePercent: integer("min_attendance_percent").default(75),
  parentNotifyBelowPercent: integer("parent_notify_below_percent").default(70),
  
  // Camera AI Webhook Security
  webhookSecret: text("webhook_secret"), // HMAC secret for camera webhook signature verification
  
  // Per-School API Keys (SaaS model - each school pays for their own usage)
  openaiApiKey: text("openai_api_key"), // School's own OpenAI API key
  openaiKeyConfiguredAt: timestamp("openai_key_configured_at"), // When key was last updated
  
  // Academic Year Configuration
  academicYear: text("academic_year").default("2024-25"), // Current academic year e.g. "2024-25"
  academicYearStartMonth: integer("academic_year_start_month").default(4), // April = 4
  academicYearEndMonth: integer("academic_year_end_month").default(3), // March = 3
});

// 12. Master Timetable (Frozen version)
export const masterTimetable = pgTable("master_timetable", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  wingId: integer("wing_id"),
  name: text("name").notNull(), // "2024-25 Timetable"
  isActive: boolean("is_active").default(true),
  frozenAt: timestamp("frozen_at"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 13. Edge Agents - AI processing agents deployed on school servers
export const EDGE_AGENT_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  DEGRADED: "DEGRADED", // Partial functionality
  UPDATING: "UPDATING",
  ERROR: "ERROR"
} as const;

export const edgeAgents = pgTable("edge_agents", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  agentId: text("agent_id").notNull().unique(), // Unique agent identifier (UUID)
  name: text("name").notNull(), // "Main Building Edge Server"
  description: text("description"),
  
  // Authentication
  secretHash: text("secret_hash"), // Bcrypt hash of agent secret for login verification
  authToken: text("auth_token").notNull(), // Encrypted token for API auth
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Status & Health
  status: text("status").default(EDGE_AGENT_STATUS.OFFLINE),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  lastConfigSyncAt: timestamp("last_config_sync_at"),
  
  // Version & Capabilities
  version: text("version"), // "1.0.0"
  capabilities: text("capabilities"), // JSON array: ["face_detection", "attendance", "discipline"]
  
  // Hardware Info (reported by agent)
  hostname: text("hostname"),
  ipAddress: text("ip_address"),
  cpuCores: integer("cpu_cores"),
  memoryGb: integer("memory_gb"),
  gpuModel: text("gpu_model"), // For AI acceleration
  
  // Performance Metrics
  activeCameras: integer("active_cameras").default(0),
  maxCameras: integer("max_cameras").default(50), // Based on hardware
  eventsProcessed: integer("events_processed").default(0),
  eventsQueuedOffline: integer("events_queued_offline").default(0),
  
  // Configuration
  isActive: boolean("is_active").default(true),
  autoUpdate: boolean("auto_update").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// 14. Edge Agent Event Queue - For offline resilience
export const edgeEventQueue = pgTable("edge_event_queue", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(), // Reference to edge agent
  schoolId: integer("school_id").notNull(),
  
  // Event Details
  eventType: text("event_type").notNull(), // "ATTENDANCE", "ALERT", "PRESENCE"
  eventData: jsonb("event_data").notNull(), // Full event payload
  
  // Processing Status
  status: text("status").default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(5),
  lastError: text("last_error"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// --- RELATIONS ---
export const schoolsRelations = relations(schools, ({ many }) => ({
  wings: many(wings),
  users: many(users),
}));

export const wingsRelations = relations(wings, ({ one, many }) => ({
  school: one(schools, { fields: [wings.schoolId], references: [schools.id] }),
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  wing: one(wings, { fields: [classes.wingId], references: [wings.id] }),
  sections: many(sections),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  class: one(classes, { fields: [sections.classId], references: [classes.id] }),
  students: many(students),
  timetable: many(timetable),
}));

export const usersRelations = relations(users, ({ one }) => ({
  school: one(schools, { fields: [users.schoolId], references: [schools.id] }),
}));

// --- ZOD SCHEMAS ---
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertWingSchema = createInsertSchema(wings).omit({ id: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export const insertSectionSchema = createInsertSchema(sections).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export const insertTimetableSchema = createInsertSchema(timetable).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true, isResolved: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true, approvedBy: true });
export const insertSubstitutionSchema = createInsertSchema(substitutions).omit({ id: true, createdAt: true });
export const insertCameraSchema = createInsertSchema(cameras).omit({ id: true });
export const insertNvrSchema = createInsertSchema(nvrs).omit({ id: true });
export const insertSchoolConfigSchema = createInsertSchema(schoolConfig).omit({ id: true });
export const insertEdgeAgentSchema = createInsertSchema(edgeAgents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEdgeEventQueueSchema = createInsertSchema(edgeEventQueue).omit({ id: true, createdAt: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertTeacherSubjectSchema = createInsertSchema(teacherSubjects).omit({ id: true });
export const insertSectionCameraSchema = createInsertSchema(sectionCameras).omit({ id: true });
export const insertFaceEncodingSchema = createInsertSchema(faceEncodings).omit({ id: true, createdAt: true });

// --- TYPES ---
export type User = typeof users.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Wing = typeof wings.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Timetable = typeof timetable.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type Substitution = typeof substitutions.$inferSelect;
export type Camera = typeof cameras.$inferSelect;
export type Nvr = typeof nvrs.$inferSelect;
export type SchoolConfig = typeof schoolConfig.$inferSelect;
export type MasterTimetable = typeof masterTimetable.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type TeacherSubject = typeof teacherSubjects.$inferSelect;
export type SectionCamera = typeof sectionCameras.$inferSelect;
export type FaceEncoding = typeof faceEncodings.$inferSelect;
export type EdgeAgent = typeof edgeAgents.$inferSelect;
export type EdgeEventQueue = typeof edgeEventQueue.$inferSelect;

export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type InsertTeacherSubject = z.infer<typeof insertTeacherSubjectSchema>;
export type InsertSectionCamera = z.infer<typeof insertSectionCameraSchema>;
export type InsertFaceEncoding = z.infer<typeof insertFaceEncodingSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type InsertSubstitution = z.infer<typeof insertSubstitutionSchema>;
export type InsertCamera = z.infer<typeof insertCameraSchema>;
export type InsertNvr = z.infer<typeof insertNvrSchema>;
export type InsertSchoolConfig = z.infer<typeof insertSchoolConfigSchema>;
export type InsertEdgeAgent = z.infer<typeof insertEdgeAgentSchema>;
export type InsertEdgeEventQueue = z.infer<typeof insertEdgeEventQueueSchema>;
export * from "./models/chat";
