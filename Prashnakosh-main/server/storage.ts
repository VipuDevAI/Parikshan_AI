/**
 * Storage Interface - PostgreSQL Only
 * 
 * This module defines the storage interface and exports the PostgreSQL implementation.
 * MemStorage has been REMOVED - PostgreSQL is the ONLY source of truth.
 * 
 * IMPORTANT: This is a school system handling sensitive student records, exam data,
 * and multi-year academic information. No in-memory storage is acceptable.
 */

import { 
  type User, type InsertUser,
  type Tenant, type InsertTenant,
  type Question, type InsertQuestion,
  type Chapter, type InsertChapter,
  type Test, type InsertTest,
  type Attempt, type InsertAttempt,
  type PracticeSession, type InsertPracticeSession,
  type Portion, type InsertPortion,
  type Passage, type InsertPassage,
  type ExamConfig, type InsertExamConfig,
  type Upload, type InsertUpload,
  type Grade, type InsertGrade,
  type Blueprint, type InsertBlueprint,
  type ActivityLog, type InsertActivityLog,
  type QuestionReview, type InsertQuestionReview,
  type ExamAuditLog, type InsertExamAuditLog,
  type StudentNotification, type InsertStudentNotification,
  type AcademicYear, type InsertAcademicYear,
  type GradeConfig, type InsertGradeConfig,
  type ExamFramework, type InsertExamFramework,
  type BlueprintPolicy, type InsertBlueprintPolicy,
  type ReferenceLibrary, type InsertReferenceLibrary,
  type PaperGenerationAudit, type InsertPaperGenerationAudit,
  type StorageUsage, type InsertStorageUsage,
  type AdminExamConfig, type InsertAdminExamConfig,
  type SchoolStorageConfig, type InsertSchoolStorageConfig,
  type SchoolWing, type InsertSchoolWing,
  type SchoolExam, type InsertSchoolExam,
  type ReferenceMaterial, type InsertReferenceMaterial,
  type WingType,
  type AuthUser,
  type QuestionStatus,
  type UserRole,
  type QuestionType,
  type DifficultyLevel,
  type BloomLevel,
  type TestType,
  type WorkflowState,
  type GradeGroup,
  calculateExamDuration
} from "@shared/schema";

export interface IStorage {
  // Auth
  authenticateUser(email: string, password: string, schoolCode: string): Promise<{ user: AuthUser; token: string } | null>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  getUserByEmailAndTenant(email: string, tenantId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getStudentsByTenant(tenantId: string): Promise<{ id: string; name: string }[]>;
  getAllStudents(): Promise<{ id: string; name: string }[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByCode(code: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<boolean>;
  
  // Questions
  getQuestion(id: string): Promise<Question | undefined>;
  getQuestionsByIds(ids: string[]): Promise<Question[]>;
  getQuestionsByTenant(tenantId: string): Promise<Question[]>;
  getPracticeQuestions(tenantId: string, subject?: string, chapter?: string): Promise<Question[]>;
  getAssessmentQuestions(tenantId: string, subject: string, grade?: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  createQuestions(questions: InsertQuestion[]): Promise<Question[]>;
  updateQuestion(id: string, data: Partial<Question>): Promise<Question | undefined>;
  deleteQuestion(id: string): Promise<boolean>;
  approveQuestion(id: string): Promise<Question | undefined>;
  
  // Passages
  getPassage(id: string): Promise<Passage | undefined>;
  getPassagesByTenant(tenantId: string): Promise<Passage[]>;
  createPassage(passage: InsertPassage): Promise<Passage>;
  
  // Chapters
  getChapter(id: string): Promise<Chapter | undefined>;
  getChaptersByTenant(tenantId: string): Promise<Chapter[]>;
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  updateChapter(id: string, data: Partial<Chapter>): Promise<Chapter | undefined>;
  unlockChapter(id: string): Promise<Chapter | undefined>;
  lockChapter(id: string): Promise<Chapter | undefined>;
  setChapterDeadline(id: string, deadline: Date): Promise<Chapter | undefined>;
  revealChapterScores(id: string): Promise<Chapter | undefined>;
  
  // Tests
  getTest(id: string): Promise<Test | undefined>;
  getTestsByTenant(tenantId: string): Promise<Test[]>;
  getAvailableMockTests(tenantId: string): Promise<Test[]>;
  createTest(test: InsertTest): Promise<Test>;
  updateTest(id: string, data: Partial<Test>): Promise<Test | undefined>;
  activateTest(id: string): Promise<Test | undefined>;
  revealTestResults(id: string): Promise<Test | undefined>;
  
  // Attempts
  getAttempt(id: string): Promise<Attempt | undefined>;
  getAttemptsByStudent(studentId: string): Promise<Attempt[]>;
  getAttemptsByTest(testId: string): Promise<Attempt[]>;
  getActiveAttempt(testId: string, studentId: string): Promise<Attempt | undefined>;
  createAttempt(attempt: InsertAttempt): Promise<Attempt>;
  updateAttempt(id: string, data: Partial<Attempt>): Promise<Attempt | undefined>;
  
  // Exam Config
  getConfig(tenantId: string, key: string): Promise<string | null>;
  setConfig(tenantId: string, key: string, value: string): Promise<void>;
  getAllConfig(tenantId: string): Promise<Record<string, string>>;
  
  // Uploads
  createUpload(upload: InsertUpload): Promise<Upload>;
  getUploadsByTenant(tenantId: string): Promise<Upload[]>;
  deleteUpload(id: string): Promise<boolean>;
  
  // Practice
  startPracticeSession(tenantId: string, studentId: string, subject: string, chapter?: string): Promise<{ session: PracticeSession; questions: Question[] }>;
  submitPractice(answers: Record<string, string>, questionIds: string[]): Promise<{ correct: number; total: number }>;
  
  // Exam Engine
  startExam(tenantId: string, testId: string, studentId: string): Promise<{ attempt: Attempt; questions: Question[]; duration: number }>;
  saveExamState(attemptId: string, answers: Record<string, string>, questionStatuses: Record<string, QuestionStatus>, markedForReview: string[], timeRemaining: number): Promise<Attempt | undefined>;
  submitExam(attemptId: string, answers: Record<string, string>): Promise<{ score: number; total: number; percentage: number; needsManualMarking: boolean }>;
  
  // Manual Marking
  markQuestion(attemptId: string, questionId: string, score: number): Promise<Attempt | undefined>;
  finalizeMarking(attemptId: string, remarks?: string): Promise<Attempt | undefined>;
  
  // Reports
  getReportData(userId: string): Promise<{
    attempts: Attempt[];
    summary: { totalTests: number; averageScore: number; bestScore: number; trend: "up" | "down" | "stable" };
    topicAccuracy: { topic: string; accuracy: number; attempted: number }[];
  }>;
  
  // Grades
  createGrade(grade: InsertGrade): Promise<Grade>;
  getGradesByStudent(studentId: string): Promise<Grade[]>;
  getGradesByTest(testId: string): Promise<Grade[]>;
  
  // Analytics
  getAnalytics(tenantId: string, daysBack?: number): Promise<{
    totalStudents: number;
    totalQuestions: number;
    totalTests: number;
    averageScore: number;
    subjectPerformance: { subject: string; avgScore: number; attempts: number }[];
    recentActivity: { date: string; tests: number; avgScore: number }[];
  }>;
  
  // Blueprints
  getBlueprint(id: string): Promise<Blueprint | undefined>;
  getBlueprintsByTenant(tenantId: string): Promise<Blueprint[]>;
  createBlueprint(blueprint: InsertBlueprint): Promise<Blueprint>;
  updateBlueprint(id: string, data: Partial<Blueprint>): Promise<Blueprint | undefined>;
  approveBlueprint(id: string, approvedBy: string): Promise<Blueprint | undefined>;
  
  // Activity Logs
  logActivity(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(tenantId: string, entityType?: string, entityId?: string): Promise<ActivityLog[]>;
  
  // Question Reviews (HOD)
  createQuestionReview(review: InsertQuestionReview): Promise<QuestionReview>;
  getQuestionReviews(questionId: string): Promise<QuestionReview[]>;
  getPendingQuestions(tenantId: string): Promise<Question[]>;
  getPendingQuestionsForReview(tenantId: string): Promise<Question[]>;
  approveQuestionByHOD(questionId: string, reviewerId: string, comments?: string): Promise<Question | undefined>;
  rejectQuestionByHOD(questionId: string, reviewerId: string, comments: string): Promise<Question | undefined>;
  
  // Workflow Management
  updateTestWorkflow(testId: string, state: WorkflowState, userId: string, comments?: string): Promise<Test | undefined>;
  getTestsByWorkflowState(tenantId: string, states: WorkflowState[]): Promise<Test[]>;
  sendTestToCommittee(testId: string): Promise<Test | undefined>;
  lockTest(testId: string): Promise<Test | undefined>;
  markTestConfidential(testId: string): Promise<Test | undefined>;
  markPrintingReady(testId: string): Promise<Test | undefined>;
  
  // Paper Generation
  generateQuestionPaper(testId: string, format: "A4" | "Legal"): Promise<{ paperUrl: string; answerKeyUrl: string }>;
  
  // Blueprint-based Question Selection
  selectQuestionsForBlueprint(
    tenantId: string,
    subject: string,
    grade: string,
    sections: { name: string; marks: number; questionCount: number; questionType: string; difficulty?: string; chapters?: string[] }[]
  ): Promise<Question[]>;
  
  // Additional Methods for New Pages
  deleteBlueprint(id: string): Promise<boolean>;
  updateChapterPortions(id: string, completedTopics: string[]): Promise<Chapter | undefined>;
  getSubjectsByTenant(tenantId: string): Promise<{ id: string; name: string; classLevel: string }[]>;
  getMakeupTestsByTenant(tenantId: string): Promise<any[]>;
  createMakeupTest(data: any): Promise<any>;
  getSubmissionsByTenant(tenantId: string): Promise<any[]>;
  updateSubmissionMarks(id: string, marks: Record<string, number>, feedback: Record<string, string>): Promise<any>;
  completeSubmissionMarking(id: string): Promise<any>;
  getResultsByUser(tenantId: string, userId?: string): Promise<any[]>;
  getChildrenByParent(parentId: string): Promise<any[]>;
  getResultsByParent(parentId: string): Promise<any[]>;
  getProgressByParent(parentId: string): Promise<any[]>;
  getNotificationsByParent(parentId: string): Promise<any[]>;
  getRiskAlertsByTenant(tenantId: string): Promise<any[]>;
  acknowledgeRiskAlert(id: string): Promise<any>;
  getAllAttempts(tenantId: string): Promise<Attempt[]>;
  createRiskAlert(alert: any): Promise<any>;
  
  // Exam Audit Logs
  createExamAuditLog(log: InsertExamAuditLog): Promise<ExamAuditLog>;
  getExamAuditLogs(examId: string): Promise<ExamAuditLog[]>;
  getExamAuditLogsByTenant(tenantId: string): Promise<ExamAuditLog[]>;
  
  // Student Dashboard - Results & Attempt Lock
  hasCompletedAttempt(testId: string, studentId: string): Promise<boolean>;
  getStudentResultsWithDetails(studentId: string): Promise<{
    attemptId: string;
    testId: string;
    testTitle: string;
    testType: string;
    subject: string;
    chapter: string | null;
    score: number | null;
    totalMarks: number | null;
    percentage: string | null;
    status: string;
    submittedAt: Date | null;
  }[]>;
  getAvailableStudentTests(tenantId: string, studentId: string): Promise<(Test & { hasCompletedAttempt: boolean; hasActiveAttempt: boolean })[]>;
  
  // Student Notifications
  createStudentNotification(notification: InsertStudentNotification): Promise<StudentNotification>;
  getStudentNotifications(studentId: string): Promise<StudentNotification[]>;
  markNotificationRead(notificationId: string): Promise<StudentNotification | undefined>;
  markAllNotificationsRead(studentId: string): Promise<void>;
  
  // Principal Dashboard Analytics (read-only)
  getPrincipalSchoolSnapshot(tenantId: string): Promise<{
    totalStudents: number;
    testsThisMonth: number;
    averageScore: number;
    atRiskCount: number;
  }>;
  getPrincipalGradePerformance(tenantId: string): Promise<{
    grade: string;
    averageScore: number;
    passPercentage: number;
    totalAttempts: number;
    trend: 'up' | 'down' | 'stable';
  }[]>;
  getPrincipalSubjectHealth(tenantId: string, grade?: string): Promise<{
    subject: string;
    grade: string;
    averagePercentage: number;
    totalAttempts: number;
    isWeak: boolean;
  }[]>;
  getPrincipalAtRiskStudents(tenantId: string): Promise<{
    studentId: string;
    studentName: string;
    grade: string;
    lowScoreCount: number;
    averagePercentage: number;
    trend: 'declining' | 'stable' | 'improving';
  }[]>;
  getPrincipalRiskAlerts(tenantId: string): Promise<{
    type: 'tab_switch' | 'absence' | 'sudden_drop';
    studentId: string;
    studentName: string;
    grade: string;
    details: string;
    count: number;
    createdAt: Date | null;
  }[]>;
  
  // Academic Years
  getAcademicYear(id: string): Promise<AcademicYear | undefined>;
  getAcademicYearsByTenant(tenantId: string): Promise<AcademicYear[]>;
  getActiveAcademicYear(tenantId: string): Promise<AcademicYear | undefined>;
  createAcademicYear(year: InsertAcademicYear): Promise<AcademicYear>;
  updateAcademicYear(id: string, data: Partial<AcademicYear>): Promise<AcademicYear | undefined>;
  activateAcademicYear(tenantId: string, yearId: string): Promise<AcademicYear | undefined>;
  lockAcademicYear(id: string, lockedBy: string): Promise<AcademicYear | undefined>;
  
  // Grade Configurations
  getGradeConfig(id: string): Promise<GradeConfig | undefined>;
  getGradeConfigsByTenant(tenantId: string, academicYearId?: string): Promise<GradeConfig[]>;
  createGradeConfig(config: InsertGradeConfig): Promise<GradeConfig>;
  createGradeConfigsBulk(configs: InsertGradeConfig[]): Promise<GradeConfig[]>;
  updateGradeConfig(id: string, data: Partial<GradeConfig>): Promise<GradeConfig | undefined>;
  
  // User Code Generation
  generateUserCode(tenantId: string): Promise<string>;
  
  // Soft Delete Usage Checks
  isQuestionInUse(questionId: string): Promise<boolean>;
  isBlueprintInUse(blueprintId: string): Promise<boolean>;
  isUserInUse(userId: string): Promise<boolean>;
  isUploadInUse(uploadId: string): Promise<boolean>;
  
  // Soft Delete Operations (replaces hard delete)
  softDeleteQuestion(id: string, deletedBy: string): Promise<boolean>;
  softDeleteBlueprint(id: string, deletedBy: string): Promise<boolean>;
  softDeleteUser(id: string, deletedBy: string): Promise<boolean>;
  softDeleteUpload(id: string, deletedBy: string): Promise<boolean>;
  
  // Tenant soft delete
  softDeleteTenant(id: string): Promise<boolean>;
  
  // =====================================================
  // SCHOOL WINGS (Super Admin configured)
  // =====================================================
  getWingsByTenant(tenantId: string): Promise<SchoolWing[]>;
  getWing(id: string): Promise<SchoolWing | undefined>;
  createWing(wing: InsertSchoolWing): Promise<SchoolWing>;
  updateWing(id: string, data: Partial<SchoolWing>): Promise<SchoolWing | undefined>;
  softDeleteWing(id: string): Promise<boolean>;
  
  // =====================================================
  // SCHOOL EXAMS (Super Admin configured - SINGLE SOURCE OF TRUTH)
  // These exams are consumed by HOD Blueprint, Student Mock Tests, Principal Analytics
  // =====================================================
  getSchoolExams(tenantId: string, wingId?: string): Promise<SchoolExam[]>;
  getSchoolExam(id: string): Promise<SchoolExam | undefined>;
  createSchoolExam(exam: InsertSchoolExam): Promise<SchoolExam>;
  updateSchoolExam(id: string, data: Partial<SchoolExam>): Promise<SchoolExam | undefined>;
  softDeleteSchoolExam(id: string): Promise<boolean>;
  
  // =====================================================
  // REFERENCE MATERIALS (Global for Class 10 & 12)
  // =====================================================
  getReferenceMaterials(grade?: string, category?: string): Promise<ReferenceMaterial[]>;
  getReferenceMaterial(id: string): Promise<ReferenceMaterial | undefined>;
  createReferenceMaterial(material: InsertReferenceMaterial): Promise<ReferenceMaterial>;
  updateReferenceMaterial(id: string, data: Partial<ReferenceMaterial>): Promise<ReferenceMaterial | undefined>;
  softDeleteReferenceMaterial(id: string): Promise<boolean>;
  
  // =====================================================
  // SUPER ADMIN GOVERNANCE
  // =====================================================
  
  // Exam Frameworks
  getExamFramework(id: string): Promise<ExamFramework | undefined>;
  getExamFrameworksByTenant(tenantId: string, academicYearId?: string, gradeGroup?: GradeGroup): Promise<ExamFramework[]>;
  createExamFramework(framework: InsertExamFramework): Promise<ExamFramework>;
  updateExamFramework(id: string, data: Partial<ExamFramework>): Promise<ExamFramework | undefined>;
  deleteExamFramework(id: string): Promise<boolean>;
  
  // Blueprint Policies
  getBlueprintPolicy(id: string): Promise<BlueprintPolicy | undefined>;
  getBlueprintPolicyByTenant(tenantId: string, academicYearId?: string): Promise<BlueprintPolicy | undefined>;
  createBlueprintPolicy(policy: InsertBlueprintPolicy): Promise<BlueprintPolicy>;
  updateBlueprintPolicy(id: string, data: Partial<BlueprintPolicy>): Promise<BlueprintPolicy | undefined>;
  
  // Reference Library
  getReferenceItem(id: string): Promise<ReferenceLibrary | undefined>;
  getReferenceLibrary(tenantId: string, grade?: string, subject?: string): Promise<ReferenceLibrary[]>;
  getStudentReferenceMaterials(tenantId: string, grade: string, subject?: string): Promise<ReferenceLibrary[]>;
  createReferenceItem(item: InsertReferenceLibrary): Promise<ReferenceLibrary>;
  updateReferenceItem(id: string, data: Partial<ReferenceLibrary>): Promise<ReferenceLibrary | undefined>;
  softDeleteReferenceItem(id: string, deletedBy: string): Promise<boolean>;
  restoreReferenceItem(id: string): Promise<ReferenceLibrary | undefined>;
  
  // Paper Generation Audit
  createPaperGenerationAudit(audit: InsertPaperGenerationAudit): Promise<PaperGenerationAudit>;
  getPaperGenerationAudit(testId: string): Promise<PaperGenerationAudit[]>;
  
  // Storage Usage
  getStorageUsage(tenantId: string): Promise<StorageUsage | undefined>;
  updateStorageUsage(tenantId: string, data: Partial<StorageUsage>): Promise<StorageUsage | undefined>;
  recalculateStorageUsage(tenantId: string): Promise<StorageUsage>;
  
  // =====================================================
  // ADMIN EXAM CONFIGURATION (Legacy - kept for backward compatibility)
  // getActiveExamsForBlueprint and getMockTestExams now use SchoolExams
  // =====================================================
  getAdminExamConfig(id: string): Promise<AdminExamConfig | undefined>;
  getAdminExamConfigsByTenant(tenantId: string, wing?: WingType): Promise<AdminExamConfig[]>;
  getActiveExamsForBlueprint(tenantId: string): Promise<SchoolExam[]>;  // NOW USES SCHOOL_EXAMS
  getMockTestExams(tenantId: string): Promise<SchoolExam[]>;  // NOW USES SCHOOL_EXAMS
  createAdminExamConfig(config: InsertAdminExamConfig): Promise<AdminExamConfig>;
  updateAdminExamConfig(id: string, data: Partial<AdminExamConfig>): Promise<AdminExamConfig | undefined>;
  softDeleteAdminExamConfig(id: string, deletedBy: string): Promise<boolean>;
  isExamConfigInUse(examConfigId: string): Promise<boolean>;
  
  // School Storage Configs
  getSchoolStorageConfig(tenantId: string): Promise<SchoolStorageConfig | undefined>;
  createOrUpdateSchoolStorageConfig(tenantId: string, data: Partial<SchoolStorageConfig>): Promise<SchoolStorageConfig>;
}

// =====================================================
// POSTGRESQL STORAGE - THE ONLY SOURCE OF TRUTH
// =====================================================
// Import and export PgStorage directly - no fallback, no in-memory
import { pgStorage } from "./pg-storage";

console.log("[storage] Using PostgreSQL storage (PgStorage) - the only source of truth");
export const storage: IStorage = pgStorage;
