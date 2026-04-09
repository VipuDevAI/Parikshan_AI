import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tenants (Schools)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  logo: text("logo"),
  active: boolean("active").default(true),
  // Extended school details
  principalName: text("principal_name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  board: text("board"), // CBSE, ICSE, State Board, etc.
  affiliationNumber: text("affiliation_number"),
  establishedYear: text("established_year"),
  studentCount: integer("student_count"),
  teacherCount: integer("teacher_count"),
  // User code counter for generating unique user codes
  userCodeCounter: integer("user_code_counter").default(0),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Academic Years
export const academicYears = pgTable("academic_years", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(), // e.g., "2025-26"
  startDate: text("start_date").notNull(), // YYYY-MM-DD format
  endDate: text("end_date").notNull(),
  isActive: boolean("is_active").default(false),
  isLocked: boolean("is_locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertAcademicYearSchema = createInsertSchema(academicYears).omit({ id: true });
export type InsertAcademicYear = z.infer<typeof insertAcademicYearSchema>;
export type AcademicYear = typeof academicYears.$inferSelect;

// Grade Groups
export const gradeGroups = ["primary", "middle", "senior"] as const;
export type GradeGroup = typeof gradeGroups[number];

// Grade Configurations per academic year
export const gradeConfigs = pgTable("grade_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  academicYearId: varchar("academic_year_id").notNull(),
  grade: text("grade").notNull(), // "1" to "12"
  gradeGroup: text("grade_group").$type<GradeGroup>(), // "primary" (1-5), "middle" (6-8), "senior" (9-12)
  displayName: text("display_name"), // "Class 1", "Grade 1", etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertGradeConfigSchema = createInsertSchema(gradeConfigs).omit({ id: true });
export type InsertGradeConfig = z.infer<typeof insertGradeConfigSchema>;
export type GradeConfig = typeof gradeConfigs.$inferSelect;

// User roles - Updated with HOD, Principal, Examination Committee
export const userRoles = ["super_admin", "admin", "hod", "principal", "exam_committee", "teacher", "student", "parent"] as const;
export type UserRole = typeof userRoles[number];

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userCode: text("user_code"), // System-generated immutable code (e.g., SCH2025U000123)
  email: text("email").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<UserRole>(),
  grade: text("grade").default("V"),
  section: text("section"), // For students: A, B, C, etc.
  wingId: varchar("wing_id"), // For teachers: assigned wing
  subjects: jsonb("subjects").$type<string[]>().default([]), // For teachers: multiple subjects
  avatar: text("avatar"),
  parentOf: varchar("parent_of"),
  active: boolean("active").default(true),
  mustChangePassword: boolean("must_change_password").default(false),
  assignedQuestions: jsonb("assigned_questions").$type<Record<string, any>>().default({}),
  sessionToken: text("session_token"),
  // Soft delete fields
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
});

export const insertUserSchema = createInsertSchema(users, {
  role: z.enum(userRoles),
  assignedQuestions: z.record(z.any()).optional(),
}).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Login schema
export const loginSchema = z.object({
  schoolCode: z.string().min(1, "School code is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Question types
export const questionTypes = ["mcq", "true_false", "fill_blank", "matching", "numerical", "short_answer", "long_answer"] as const;
export type QuestionType = typeof questionTypes[number];

// Difficulty levels
export const difficultyLevels = ["easy", "medium", "hard"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

// Bloom's taxonomy levels
export const bloomLevels = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;
export type BloomLevel = typeof bloomLevels[number];

// Passages for passage-based questions
export const passages = pgTable("passages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  subject: text("subject").notNull(),
  grade: text("grade"),
  passageType: text("passage_type").default("prose"),
});

export const insertPassageSchema = createInsertSchema(passages).omit({ id: true });
export type InsertPassage = z.infer<typeof insertPassageSchema>;
export type Passage = typeof passages.$inferSelect;

// Questions
export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().$type<QuestionType>(),
  options: jsonb("options").$type<string[]>(),
  optionImages: jsonb("option_images").$type<string[]>(),
  correctAnswer: text("correct_answer"),
  explanation: text("explanation"),
  hint: text("hint"),
  imageUrl: text("image_url"),
  passageId: varchar("passage_id"),
  instructionText: text("instruction_text"),
  subject: text("subject").notNull(),
  chapter: text("chapter").notNull(),
  topic: text("topic"),
  grade: text("grade").notNull(),
  difficulty: text("difficulty").$type<DifficultyLevel>().default("medium"),
  bloomLevel: text("bloom_level").$type<BloomLevel>(),
  marks: integer("marks").default(1),
  isVerified: boolean("is_verified").default(false),
  isPractice: boolean("is_practice").default(true),
  isAssessment: boolean("is_assessment").default(false),
  createdBy: varchar("created_by"),
  uploadId: varchar("upload_id"),
  status: text("status").default("draft"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  // Soft delete fields
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
});

export const insertQuestionSchema = createInsertSchema(questions, {
  type: z.enum(questionTypes),
  options: z.array(z.string()).nullable().optional(),
  optionImages: z.array(z.string()).nullable().optional(),
  difficulty: z.enum(difficultyLevels).nullable().optional(),
  bloomLevel: z.enum(bloomLevels).nullable().optional(),
}).omit({ id: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;

// Chapter status
export const chapterStatuses = ["draft", "locked", "unlocked", "completed"] as const;
export type ChapterStatus = typeof chapterStatuses[number];

// Chapters
export const chapters = pgTable("chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  grade: text("grade").notNull(),
  orderIndex: integer("order_index").default(0),
  status: text("status").$type<ChapterStatus>().default("draft"),
  unlockDate: timestamp("unlock_date"),
  deadline: timestamp("deadline"),
  scoresRevealed: boolean("scores_revealed").default(false),
});

export const insertChapterSchema = createInsertSchema(chapters).omit({ id: true });
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chapters.$inferSelect;

// Tests
export const testTypes = ["unit_test", "review_test", "quarterly", "half_yearly", "revision", "preparatory", "annual", "mock"] as const;
export type TestType = typeof testTypes[number];

// Workflow states for approval pipeline
// State machine: DRAFT → HOD_APPROVED → ACTIVE → LOCKED → ARCHIVED
export const workflowStates = [
  "draft",
  "submitted",
  "pending_hod",
  "hod_approved",
  "hod_rejected",
  "pending_principal",
  "principal_approved",
  "principal_rejected",
  "sent_to_committee",
  "active",
  "locked",
  "archived"
] as const;
export type WorkflowState = typeof workflowStates[number];

export const tests = pgTable("tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  title: text("title").notNull(),
  type: text("type").$type<TestType>().notNull(),
  subject: text("subject").notNull(),
  grade: text("grade").notNull(),
  section: text("section"),
  chapterId: varchar("chapter_id"),
  examConfigId: varchar("exam_config_id"), // Links to adminExamConfigs
  duration: integer("duration").default(60),
  totalMarks: integer("total_marks").default(100),
  questionCount: integer("question_count").default(50),
  questionIds: jsonb("question_ids").$type<string[]>(),
  isActive: boolean("is_active").default(false),
  resultsRevealed: boolean("results_revealed").default(false),
  createdBy: varchar("created_by"),
  blueprintId: varchar("blueprint_id"),
  workflowState: text("workflow_state").$type<WorkflowState>().default("draft"),
  hodApprovedBy: varchar("hod_approved_by"),
  hodApprovedAt: timestamp("hod_approved_at"),
  hodComments: text("hod_comments"),
  principalApprovedBy: varchar("principal_approved_by"),
  principalApprovedAt: timestamp("principal_approved_at"),
  principalComments: text("principal_comments"),
  sentToCommitteeAt: timestamp("sent_to_committee_at"),
  isConfidential: boolean("is_confidential").default(false),
  printingReady: boolean("printing_ready").default(false),
  paperFormat: text("paper_format").default("A4"),
  generatedPaperUrl: text("generated_paper_url"),
  answerKeyUrl: text("answer_key_url"),
});

export const insertTestSchema = createInsertSchema(tests, {
  type: z.enum(testTypes),
  questionIds: z.array(z.string()).nullable().optional(),
  workflowState: z.enum(workflowStates).optional(),
}).omit({ id: true });
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof tests.$inferSelect;

// Question status in exam
export type QuestionStatus = "not_visited" | "answered" | "marked_review" | "unanswered";

// Exam state for session resume
export type ExamState = {
  currentIndex: number;
  answers: Record<string, string>;
  questionStatuses: Record<string, QuestionStatus>;
  markedForReview: string[];
  timeRemaining: number;
  startedAt: string;
  lastUpdated: string;
};

// Attempts
export const attemptStatuses = ["in_progress", "submitted", "absent", "marked"] as const;
export type AttemptStatus = typeof attemptStatuses[number];

export const attempts = pgTable("attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  testId: varchar("test_id").notNull(),
  studentId: varchar("student_id").notNull(),
  assignedQuestionIds: jsonb("assigned_question_ids").$type<string[]>(),
  answers: jsonb("answers").$type<Record<string, string>>(),
  questionStatuses: jsonb("question_statuses").$type<Record<string, QuestionStatus>>(),
  markedForReview: jsonb("marked_for_review").$type<string[]>(),
  score: integer("score"),
  totalMarks: integer("total_marks"),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  status: text("status").$type<AttemptStatus>().default("in_progress"),
  timeRemaining: integer("time_remaining"),
  startedAt: timestamp("started_at"),
  submittedAt: timestamp("submitted_at"),
  teacherRemarks: text("teacher_remarks"),
  manualScores: jsonb("manual_scores").$type<Record<string, number>>(),
});

const questionStatusEnum = z.enum(["not_visited", "answered", "marked_review", "unanswered"]);
export const insertAttemptSchema = createInsertSchema(attempts, {
  assignedQuestionIds: z.array(z.string()).nullable().optional(),
  answers: z.record(z.string()).nullable().optional(),
  questionStatuses: z.record(questionStatusEnum).nullable().optional(),
  markedForReview: z.array(z.string()).nullable().optional(),
  manualScores: z.record(z.number()).nullable().optional(),
}).omit({ id: true });
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type Attempt = typeof attempts.$inferSelect;

// Practice sessions
export const practiceSessions = pgTable("practice_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  studentId: varchar("student_id").notNull(),
  subject: text("subject").notNull(),
  chapter: text("chapter"),
  topic: text("topic"),
  questionsAttempted: integer("questions_attempted").default(0),
  correctAnswers: integer("correct_answers").default(0),
  status: text("status").default("active"),
});

export const insertPracticeSessionSchema = createInsertSchema(practiceSessions).omit({ id: true });
export type InsertPracticeSession = z.infer<typeof insertPracticeSessionSchema>;
export type PracticeSession = typeof practiceSessions.$inferSelect;

// Portions (Syllabus planning)
export const portions = pgTable("portions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  testType: text("test_type").$type<TestType>().notNull(),
  subject: text("subject").notNull(),
  grade: text("grade").notNull(),
  chapterIds: jsonb("chapter_ids").$type<string[]>(),
});

export const insertPortionSchema = createInsertSchema(portions).omit({ id: true });
export type InsertPortion = z.infer<typeof insertPortionSchema>;
export type Portion = typeof portions.$inferSelect;

// Exam configuration
export const examConfig = pgTable("exam_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  key: text("key").notNull(),
  value: text("value"),
});

export const insertExamConfigSchema = createInsertSchema(examConfig).omit({ id: true });
export type InsertExamConfig = z.infer<typeof insertExamConfigSchema>;
export type ExamConfig = typeof examConfig.$inferSelect;

// Upload tracking for Word/Sheets imports
export const uploads = pgTable("uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  filename: text("filename").notNull(),
  source: text("source").notNull(),
  subject: text("subject"),
  grade: text("grade"),
  questionCount: integer("question_count").default(0),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").default(sql`now()`),
  // Soft delete fields
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
});

export const insertUploadSchema = createInsertSchema(uploads).omit({ id: true });
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Upload = typeof uploads.$inferSelect;

// Grades/Results
export const grades = pgTable("grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  studentId: varchar("student_id").notNull(),
  studentName: text("student_name"),
  testId: varchar("test_id"),
  subject: text("subject").notNull(),
  grade: text("grade"),
  score: integer("score").default(0),
  totalMarks: integer("total_marks"),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  gradedAt: timestamp("graded_at").default(sql`now()`),
});

export const insertGradeSchema = createInsertSchema(grades).omit({ id: true });
export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Grade = typeof grades.$inferSelect;

// Auth session type
export type AuthUser = {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: UserRole;
  grade?: string;
  avatar: string | null;
  mustChangePassword?: boolean;
  userCode?: string | null;
  wingId?: string | null;
  subjects?: string[] | null;
};

// API response types
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Timer calculation helper
export function calculateExamDuration(totalMarks: number): number {
  if (totalMarks <= 40) return 90;
  if (totalMarks <= 80) return 180;
  return Math.ceil(totalMarks * 2.25);
}

// Blueprints for exam paper structure
export const blueprints = pgTable("blueprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  academicYearId: varchar("academic_year_id"), // Link to academic year for governance
  examFrameworkId: varchar("exam_framework_id"), // Link to specific exam type (legacy)
  examConfigId: varchar("exam_config_id"), // Link to admin exam config
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  grade: text("grade").notNull(),
  totalMarks: integer("total_marks").notNull(),
  sections: jsonb("sections").$type<BlueprintSection[]>(),
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  isApproved: boolean("is_approved").default(false),
  // Lock governance fields
  isLocked: boolean("is_locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
  createdAt: timestamp("created_at").default(sql`now()`),
  // Soft delete fields
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
});

export type BlueprintSection = {
  name: string;
  marks: number;
  questionCount: number;
  questionType: QuestionType;
  difficulty?: DifficultyLevel;
  chapters?: string[];
  instructions?: string;
};

export const insertBlueprintSchema = createInsertSchema(blueprints).omit({ id: true });
export type InsertBlueprint = z.infer<typeof insertBlueprintSchema>;
export type Blueprint = typeof blueprints.$inferSelect;

// Activity logs for audit trail
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name"),
  userRole: text("user_role"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  details: jsonb("details").$type<Record<string, any>>(),
  previousState: text("previous_state"),
  newState: text("new_state"),
  comments: text("comments"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Question approval status for HOD review
export const questionApprovalStatuses = ["pending", "approved", "rejected"] as const;
export type QuestionApprovalStatus = typeof questionApprovalStatuses[number];

// Question review table
export const questionReviews = pgTable("question_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull(),
  reviewerId: varchar("reviewer_id").notNull(),
  status: text("status").$type<QuestionApprovalStatus>().default("pending"),
  comments: text("comments"),
  reviewedAt: timestamp("reviewed_at").default(sql`now()`),
});

export const insertQuestionReviewSchema = createInsertSchema(questionReviews).omit({ id: true });
export type InsertQuestionReview = z.infer<typeof insertQuestionReviewSchema>;
export type QuestionReview = typeof questionReviews.$inferSelect;

// All subjects list
export const allSubjects = [
  "Tamil", "English", "Hindi", "Sanskrit", "French",
  "Mathematics", "Science", "Physics", "Chemistry", "Biology",
  "Computer Science", "AI",
  "Economics", "Commerce", "Business Studies", "History", "Geography", "Civics",
  "EVS", "Social Science"
] as const;
export type Subject = typeof allSubjects[number];

// Exam Audit Logs - tracks state changes for governance
export const examAuditLogs = pgTable("exam_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  fromState: text("from_state").$type<WorkflowState | null>(),
  toState: text("to_state").$type<WorkflowState>().notNull(),
  actorId: varchar("actor_id").notNull(),
  actorRole: text("actor_role").$type<UserRole>().notNull(),
  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
  comments: text("comments"),
});

export const insertExamAuditLogSchema = createInsertSchema(examAuditLogs).omit({ id: true });
export type InsertExamAuditLog = z.infer<typeof insertExamAuditLogSchema>;
export type ExamAuditLog = typeof examAuditLogs.$inferSelect;

// Student notifications
export const notificationTypes = ["test_unlocked", "exam_submitted", "result_published"] as const;
export type NotificationType = typeof notificationTypes[number];

export const studentNotifications = pgTable("student_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  studentId: varchar("student_id").notNull(),
  type: text("type").$type<NotificationType>().notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  testId: varchar("test_id"),
  attemptId: varchar("attempt_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertStudentNotificationSchema = createInsertSchema(studentNotifications).omit({ id: true });
export type InsertStudentNotification = z.infer<typeof insertStudentNotificationSchema>;
export type StudentNotification = typeof studentNotifications.$inferSelect;

// =====================================================
// PHASE 2+3: SUPER ADMIN GOVERNANCE TABLES
// =====================================================

// Exam Types
export const examTypes = ["online", "offline"] as const;
export type ExamType = typeof examTypes[number];

// Exam Categories - Academic structure levels
export const examCategories = ["lesson", "chapter", "unit", "term", "annual"] as const;
export type ExamCategory = typeof examCategories[number];

// Exam Framework - Defines exam structure per school/year/gradeGroup
export const examFrameworks = pgTable("exam_frameworks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  academicYearId: varchar("academic_year_id").notNull(),
  gradeGroup: text("grade_group").$type<GradeGroup>().notNull(), // primary, middle, senior
  applicableGrades: jsonb("applicable_grades").$type<string[]>(), // Specific grades like ["6", "7", "8"]
  examName: text("exam_name").notNull(), // "Unit Test 1", "Quarterly", etc.
  examCategory: text("exam_category").$type<ExamCategory>().default("unit"), // lesson, chapter, unit, term, annual
  examOrder: integer("exam_order").default(1), // Display order
  examType: text("exam_type").$type<ExamType>().default("offline"), // online or offline
  durationMinutes: integer("duration_minutes").default(60),
  maxMarks: integer("max_marks").default(40),
  startDate: timestamp("start_date"), // Exam window start
  endDate: timestamp("end_date"), // Exam window end
  isVisible: boolean("is_visible").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by"),
});

export const insertExamFrameworkSchema = createInsertSchema(examFrameworks).omit({ id: true });
export type InsertExamFramework = z.infer<typeof insertExamFrameworkSchema>;
export type ExamFramework = typeof examFrameworks.$inferSelect;

// Blueprint Policy Modes
export const blueprintModes = ["academic_year", "exam_specific"] as const;
export type BlueprintMode = typeof blueprintModes[number];

// Blueprint Policies - Controls blueprint behavior per school
export const blueprintPolicies = pgTable("blueprint_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  academicYearId: varchar("academic_year_id").notNull(),
  isBlueprintMandatory: boolean("is_blueprint_mandatory").default(true),
  blueprintMode: text("blueprint_mode").$type<BlueprintMode>().default("academic_year"),
  allowEditAfterLock: boolean("allow_edit_after_lock").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  updatedBy: varchar("updated_by"),
});

export const insertBlueprintPolicySchema = createInsertSchema(blueprintPolicies).omit({ id: true });
export type InsertBlueprintPolicy = z.infer<typeof insertBlueprintPolicySchema>;
export type BlueprintPolicy = typeof blueprintPolicies.$inferSelect;

// Reference Library Types
export const referenceTypes = ["question_paper", "notes", "model_answer", "study_material"] as const;
export type ReferenceType = typeof referenceTypes[number];

// Reference Library - Previous papers, notes for Grade 10/12
export const referenceLibrary = pgTable("reference_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  academicYearId: varchar("academic_year_id"),
  grade: text("grade").notNull(), // "10" or "12" only
  subject: text("subject").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  referenceType: text("reference_type").$type<ReferenceType>().notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  year: text("year"), // e.g., "2024", "2023" for previous papers
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by"),
});

export const insertReferenceLibrarySchema = createInsertSchema(referenceLibrary).omit({ id: true });
export type InsertReferenceLibrary = z.infer<typeof insertReferenceLibrarySchema>;
export type ReferenceLibrary = typeof referenceLibrary.$inferSelect;

// Paper Generation Audit - Tracks paper generation actions
export const paperGenerationAudit = pgTable("paper_generation_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  testId: varchar("test_id").notNull(),
  setNumber: integer("set_number").notNull(), // 1, 2, or 3
  action: text("action").notNull(), // "generated", "downloaded_pdf", "downloaded_docx", "downloaded_answer_key"
  generatedBy: varchar("generated_by").notNull(),
  userRole: text("user_role").$type<UserRole>().notNull(),
  generatedAt: timestamp("generated_at").default(sql`now()`).notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
});

export const insertPaperGenerationAuditSchema = createInsertSchema(paperGenerationAudit).omit({ id: true });
export type InsertPaperGenerationAudit = z.infer<typeof insertPaperGenerationAuditSchema>;
export type PaperGenerationAudit = typeof paperGenerationAudit.$inferSelect;

// Storage Usage Tracking per school
export const storageUsage = pgTable("storage_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().unique(),
  totalBytes: integer("total_bytes").default(0),
  questionImageBytes: integer("question_image_bytes").default(0),
  uploadFileBytes: integer("upload_file_bytes").default(0),
  referenceFileBytes: integer("reference_file_bytes").default(0),
  lastCalculatedAt: timestamp("last_calculated_at").default(sql`now()`),
});

export const insertStorageUsageSchema = createInsertSchema(storageUsage).omit({ id: true });
export type InsertStorageUsage = z.infer<typeof insertStorageUsageSchema>;
export type StorageUsage = typeof storageUsage.$inferSelect;

// =====================================================
// SUPER ADMIN EXAM CONFIGURATION
// =====================================================

// Wing Types - School structure
export const wingTypes = ["primary", "middle", "secondary", "senior_secondary"] as const;
export type WingType = typeof wingTypes[number];

// Wing Grade Mappings
export const wingGradeMapping: Record<WingType, string[]> = {
  primary: ["1", "2", "3", "4", "5"],
  middle: ["6", "7", "8"],
  secondary: ["9", "10"],
  senior_secondary: ["11", "12"],
};

// =====================================================
// SUPER ADMIN - WINGS TABLE (Dynamic per school)
// =====================================================
export const schoolWings = pgTable("school_wings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  grades: jsonb("grades").$type<string[]>().default([]),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertSchoolWingSchema = createInsertSchema(schoolWings).omit({ id: true });
export type InsertSchoolWing = z.infer<typeof insertSchoolWingSchema>;
export type SchoolWing = typeof schoolWings.$inferSelect;

// =====================================================
// SUPER ADMIN - EXAMS TABLE (Under wings)
// This is the SINGLE SOURCE OF TRUTH for exams
// Used by: HOD Blueprint, Student Mock Tests, Principal Analytics
// =====================================================
export const schoolExams = pgTable("school_exams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  wingId: varchar("wing_id").notNull(),
  examName: text("exam_name").notNull(),
  academicYear: text("academic_year").notNull(),
  totalMarks: integer("total_marks").notNull().default(100),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  examDate: timestamp("exam_date"),
  subjects: jsonb("subjects").$type<string[]>().default([]),
  questionPaperSets: integer("question_paper_sets").default(1),
  watermarkText: text("watermark_text"),
  logoUrl: text("logo_url"),
  pageSize: text("page_size").default("A4"),
  allowMockTest: boolean("allow_mock_test").default(false), // When true, students can take this as mock test
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  createdBy: varchar("created_by"),
});

export const insertSchoolExamSchema = createInsertSchema(schoolExams).omit({ id: true });
export type InsertSchoolExam = z.infer<typeof insertSchoolExamSchema>;
export type SchoolExam = typeof schoolExams.$inferSelect;

// Admin Exam Config Types (legacy - keeping for compatibility)
export const adminExamTypes = ["unit", "term", "annual", "practice"] as const;
export type AdminExamType = typeof adminExamTypes[number];

// Admin Exam Configuration - Super Admin creates exams per school/wing
export const adminExamConfigs = pgTable("admin_exam_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  wing: text("wing").$type<WingType>().notNull(),
  examName: text("exam_name").notNull(),
  academicYearId: varchar("academic_year_id").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  totalMarks: integer("total_marks").notNull().default(100),
  examType: text("exam_type").$type<AdminExamType>().notNull().default("unit"),
  allowMockTest: boolean("allow_mock_test").default(false),
  watermarkText: text("watermark_text"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by"),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  updatedBy: varchar("updated_by"),
});

export const insertAdminExamConfigSchema = createInsertSchema(adminExamConfigs).omit({ id: true });
export type InsertAdminExamConfig = z.infer<typeof insertAdminExamConfigSchema>;
export type AdminExamConfig = typeof adminExamConfigs.$inferSelect;

// School Storage Configuration - S3 bucket/folder mapping per school
export const schoolStorageConfigs = pgTable("school_storage_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().unique(),
  s3BucketName: text("s3_bucket_name"),
  s3FolderPath: text("s3_folder_path"),
  maxStorageBytes: bigint("max_storage_bytes", { mode: "number" }).default(107374182400), // 100GB default
  usedStorageBytes: bigint("used_storage_bytes", { mode: "number" }).default(0),
  isConfigured: boolean("is_configured").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  updatedBy: varchar("updated_by"),
});

export const insertSchoolStorageConfigSchema = createInsertSchema(schoolStorageConfigs).omit({ id: true });
export type InsertSchoolStorageConfig = z.infer<typeof insertSchoolStorageConfigSchema>;
export type SchoolStorageConfig = typeof schoolStorageConfigs.$inferSelect;

// Global Reference Materials - For Class 10 & 12 students only
export const referenceMaterials = pgTable("reference_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  grade: text("grade").notNull(), // "10" or "12" only
  subject: text("subject"),
  category: text("category").notNull(), // "question_paper", "reference_notes", "answer_key", "syllabus"
  academicYear: text("academic_year"), // e.g., "2023-24", "2022-23"
  fileUrl: text("file_url"), // S3 URL when configured
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).default(0),
  mimeType: text("mime_type"),
  s3Key: text("s3_key"), // S3 object key for future retrieval
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by"),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertReferenceMaterialSchema = createInsertSchema(referenceMaterials).omit({ id: true });
export type InsertReferenceMaterial = z.infer<typeof insertReferenceMaterialSchema>;
export type ReferenceMaterial = typeof referenceMaterials.$inferSelect;

// File Metadata - Track all uploaded files (school-specific and global)
export const fileMetadata = pgTable("file_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"), // null for global files
  fileType: text("file_type").notNull(), // "logo", "watermark", "question_paper", "answer_key", "diagram", "reference"
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).default(0),
  mimeType: text("mime_type"),
  s3Bucket: text("s3_bucket"),
  s3Key: text("s3_key"),
  s3Url: text("s3_url"),
  isUploaded: boolean("is_uploaded").default(false), // true when actually in S3
  linkedEntityType: text("linked_entity_type"), // "exam", "blueprint", "question", "reference_material"
  linkedEntityId: varchar("linked_entity_id"),
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by"),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertFileMetadataSchema = createInsertSchema(fileMetadata).omit({ id: true });
export type InsertFileMetadata = z.infer<typeof insertFileMetadataSchema>;
export type FileMetadata = typeof fileMetadata.$inferSelect;
