import { eq, and, or, inArray, desc, ilike, sql } from "drizzle-orm";
import { db } from "./db";
import {
  type User, type InsertUser,
  type Tenant, type InsertTenant,
  type Question, type InsertQuestion,
  type Chapter, type InsertChapter,
  type Test, type InsertTest,
  type Attempt, type InsertAttempt,
  type PracticeSession, type InsertPracticeSession,
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
  type GradeGroup,
  type AuthUser,
  type QuestionStatus,
  type WorkflowState,
  calculateExamDuration,
  users,
  tenants,
  questions,
  chapters,
  tests,
  attempts,
  practiceSessions,
  passages,
  examConfig,
  uploads,
  grades,
  blueprints,
  activityLogs,
  questionReviews,
  examAuditLogs,
  studentNotifications,
  academicYears,
  gradeConfigs,
  examFrameworks,
  blueprintPolicies,
  referenceLibrary,
  paperGenerationAudit,
  storageUsage,
  adminExamConfigs,
  schoolStorageConfigs,
  schoolWings,
  schoolExams,
  referenceMaterials,
} from "@shared/schema";
import { IStorage } from "./storage";
import { randomUUID } from "crypto";

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class PgStorage implements IStorage {
  async authenticateUser(email: string, password: string, schoolCode: string): Promise<{ user: AuthUser; token: string } | null> {
    if (schoolCode === "SUPERADMIN" || schoolCode === "") {
      const [superAdmin] = await db.select().from(users)
        .where(and(
          eq(users.email, email),
          eq(users.password, password),
          eq(users.role, "super_admin")
        ));
      if (superAdmin) {
        const authUser: AuthUser = {
          id: superAdmin.id,
          tenantId: superAdmin.tenantId,
          email: superAdmin.email,
          name: superAdmin.name,
          role: superAdmin.role,
          grade: superAdmin.grade || undefined,
          avatar: superAdmin.avatar,
          mustChangePassword: superAdmin.mustChangePassword || false,
          userCode: superAdmin.userCode,
        };
        return { user: authUser, token: `token-${superAdmin.id}-${Date.now()}` };
      }
    }

    const tenant = await this.getTenantByCode(schoolCode);
    if (!tenant) return null;

    const [user] = await db.select().from(users)
      .where(and(
        eq(users.email, email),
        eq(users.password, password),
        eq(users.tenantId, tenant.id)
      ));
    if (!user) return null;

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      grade: user.grade || undefined,
      avatar: user.avatar,
      mustChangePassword: user.mustChangePassword || false,
      userCode: user.userCode,
      wingId: user.wingId,
      subjects: user.subjects,
    };
    return { user: authUser, token: `token-${user.id}-${Date.now()}` };
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  async getUserByEmailAndTenant(email: string, tenantId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(and(
        ilike(users.email, email),
        eq(users.tenantId, tenantId)
      ));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getStudentsByTenant(tenantId: string): Promise<{ id: string; name: string }[]> {
    const result = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "student")));
    return result;
  }

  async getAllStudents(): Promise<{ id: string; name: string }[]> {
    const result = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "student"));
    return result;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      active: insertUser.active ?? true,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByCode(code: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.code, code));
    return tenant;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants);
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values({
      ...insertTenant,
      active: insertTenant.active ?? true,
    }).returning();
    return tenant;
  }

  async updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return updated;
  }

  async deleteTenant(id: string): Promise<boolean> {
    await db.delete(tenants).where(eq(tenants.id, id));
    return true;
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question;
  }

  async getQuestionsByIds(ids: string[]): Promise<Question[]> {
    if (ids.length === 0) return [];
    return db.select().from(questions).where(inArray(questions.id, ids));
  }

  async getQuestionsByTenant(tenantId: string): Promise<Question[]> {
    return db.select().from(questions).where(eq(questions.tenantId, tenantId));
  }

  async getPracticeQuestions(tenantId: string, subject?: string, chapter?: string): Promise<Question[]> {
    let conditions = [eq(questions.tenantId, tenantId), eq(questions.isPractice, true)];
    if (subject) conditions.push(eq(questions.subject, subject));
    if (chapter && chapter !== "all") conditions.push(eq(questions.chapter, chapter));
    return db.select().from(questions).where(and(...conditions));
  }

  async getAssessmentQuestions(tenantId: string, subject: string, grade?: string): Promise<Question[]> {
    let conditions = [
      eq(questions.tenantId, tenantId),
      eq(questions.isAssessment, true),
      eq(questions.isVerified, true),
      ilike(questions.subject, subject)
    ];
    if (grade) conditions.push(eq(questions.grade, grade));
    return db.select().from(questions).where(and(...conditions));
  }

  async getFilteredAssessmentQuestions(
    tenantId: string, 
    subject: string, 
    options: {
      grade?: string;
      chapter?: string;
      chapters?: string[];
      questionType?: string;
      objectiveOnly?: boolean;
      marks?: number;
    } = {}
  ): Promise<Question[]> {
    const OBJECTIVE_TYPES = ["mcq", "true_false", "fill_blank", "numerical", "assertion_reason", "matching"];
    
    let conditions: any[] = [
      eq(questions.tenantId, tenantId),
      eq(questions.isAssessment, true),
      eq(questions.isVerified, true),
      ilike(questions.subject, subject)
    ];
    
    if (options.grade) conditions.push(eq(questions.grade, options.grade));
    if (options.marks) conditions.push(eq(questions.marks, options.marks));
    if (options.questionType) conditions.push(eq(questions.type, options.questionType));
    
    // chapters array takes precedence over single chapter
    if (options.chapters && options.chapters.length > 0) {
      conditions.push(inArray(questions.chapter, options.chapters));
    } else if (options.chapter) {
      conditions.push(eq(questions.chapter, options.chapter));
    }
    
    let result = await db.select().from(questions).where(and(...conditions));
    
    if (options.objectiveOnly) {
      result = result.filter(q => OBJECTIVE_TYPES.includes(q.type));
    }
    
    return result;
  }

  selectQuestionsWithPassageGrouping(availableQuestions: Question[], count: number): Question[] {
    const passageGroups = new Map<string, Question[]>();
    const standaloneQuestions: Question[] = [];
    
    for (const q of availableQuestions) {
      if (q.passageId) {
        const existing = passageGroups.get(q.passageId) || [];
        existing.push(q);
        passageGroups.set(q.passageId, existing);
      } else {
        standaloneQuestions.push(q);
      }
    }
    
    const selected: Question[] = [];
    
    for (const [passageId, passageQuestions] of passageGroups) {
      if (passageQuestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * passageQuestions.length);
        selected.push(passageQuestions[randomIndex]);
      }
    }
    
    const shuffledStandalone = shuffleArray(standaloneQuestions);
    const remaining = count - selected.length;
    if (remaining > 0) {
      selected.push(...shuffledStandalone.slice(0, remaining));
    }
    
    return shuffleArray(selected).slice(0, count);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [question] = await db.insert(questions).values({
      ...insertQuestion,
      isVerified: false,
      isPractice: insertQuestion.isPractice ?? true,
      isAssessment: insertQuestion.isAssessment ?? false,
      status: "draft",
    }).returning();
    return question;
  }

  async createQuestions(insertQuestions: InsertQuestion[]): Promise<Question[]> {
    if (insertQuestions.length === 0) return [];
    const result = await db.insert(questions).values(
      insertQuestions.map(q => ({
        ...q,
        isVerified: false,
        isPractice: q.isPractice ?? true,
        isAssessment: q.isAssessment ?? false,
        status: "draft",
      }))
    ).returning();
    return result;
  }

  async updateQuestion(id: string, data: Partial<Question>): Promise<Question | undefined> {
    const [updated] = await db.update(questions).set(data).where(eq(questions.id, id)).returning();
    return updated;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    await db.delete(questions).where(eq(questions.id, id));
    return true;
  }

  async approveQuestion(id: string): Promise<Question | undefined> {
    return this.updateQuestion(id, { isVerified: true, status: "approved" });
  }

  async getPendingQuestionsForReview(tenantId: string): Promise<Question[]> {
    return db.select().from(questions).where(and(
      eq(questions.tenantId, tenantId),
      eq(questions.status, "pending_approval")
    ));
  }

  async getPassage(id: string): Promise<Passage | undefined> {
    const [passage] = await db.select().from(passages).where(eq(passages.id, id));
    return passage;
  }

  async getPassagesByTenant(tenantId: string): Promise<Passage[]> {
    return db.select().from(passages).where(eq(passages.tenantId, tenantId));
  }

  async createPassage(insertPassage: InsertPassage): Promise<Passage> {
    const [passage] = await db.insert(passages).values(insertPassage).returning();
    return passage;
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter;
  }

  async getChaptersByTenant(tenantId: string): Promise<Chapter[]> {
    return db.select().from(chapters).where(eq(chapters.tenantId, tenantId));
  }

  async createChapter(insertChapter: InsertChapter): Promise<Chapter> {
    const [chapter] = await db.insert(chapters).values({
      ...insertChapter,
      status: "draft",
      scoresRevealed: false,
    }).returning();
    return chapter;
  }

  async updateChapter(id: string, data: Partial<Chapter>): Promise<Chapter | undefined> {
    const [updated] = await db.update(chapters).set(data).where(eq(chapters.id, id)).returning();
    return updated;
  }

  async unlockChapter(id: string): Promise<Chapter | undefined> {
    return this.updateChapter(id, { status: "unlocked", unlockDate: new Date() });
  }

  async lockChapter(id: string): Promise<Chapter | undefined> {
    return this.updateChapter(id, { status: "locked" });
  }

  async setChapterDeadline(id: string, deadline: Date): Promise<Chapter | undefined> {
    return this.updateChapter(id, { deadline });
  }

  async revealChapterScores(id: string): Promise<Chapter | undefined> {
    return this.updateChapter(id, { scoresRevealed: true });
  }

  async getTest(id: string): Promise<Test | undefined> {
    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    return test;
  }

  async getTestsByTenant(tenantId: string): Promise<Test[]> {
    return db.select().from(tests).where(eq(tests.tenantId, tenantId));
  }

  async getAvailableMockTests(tenantId: string): Promise<Test[]> {
    return db.select().from(tests).where(and(
      eq(tests.tenantId, tenantId),
      eq(tests.type, "mock"),
      eq(tests.isActive, true)
    ));
  }

  async createTest(insertTest: InsertTest): Promise<Test> {
    const totalMarks = insertTest.totalMarks || 40;
    const duration = insertTest.duration || calculateExamDuration(totalMarks);
    const [test] = await db.insert(tests).values({
      ...insertTest,
      duration,
      totalMarks,
      isActive: false,
      resultsRevealed: false,
      workflowState: insertTest.workflowState || "draft",
      isConfidential: false,
      printingReady: false,
      paperFormat: "A4",
    }).returning();
    return test;
  }

  async updateTest(id: string, data: Partial<Test>): Promise<Test | undefined> {
    const [updated] = await db.update(tests).set(data).where(eq(tests.id, id)).returning();
    return updated;
  }

  async activateTest(id: string): Promise<Test | undefined> {
    return this.updateTest(id, { isActive: true });
  }

  async revealTestResults(id: string): Promise<Test | undefined> {
    return this.updateTest(id, { resultsRevealed: true });
  }

  async getAttempt(id: string): Promise<Attempt | undefined> {
    const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id));
    return attempt;
  }

  async getAttemptsByStudent(studentId: string): Promise<Attempt[]> {
    return db.select().from(attempts).where(eq(attempts.studentId, studentId));
  }

  async getAttemptsByTest(testId: string): Promise<Attempt[]> {
    return db.select().from(attempts).where(eq(attempts.testId, testId));
  }

  async getActiveAttempt(testId: string, studentId: string): Promise<Attempt | undefined> {
    const [attempt] = await db.select().from(attempts).where(and(
      eq(attempts.testId, testId),
      eq(attempts.studentId, studentId),
      eq(attempts.status, "in_progress")
    ));
    return attempt;
  }

  async createAttempt(insertAttempt: InsertAttempt): Promise<Attempt> {
    const [attempt] = await db.insert(attempts).values({
      ...insertAttempt,
      status: "in_progress",
      startedAt: new Date(),
    }).returning();
    return attempt;
  }

  async updateAttempt(id: string, data: Partial<Attempt>): Promise<Attempt | undefined> {
    const [updated] = await db.update(attempts).set(data).where(eq(attempts.id, id)).returning();
    return updated;
  }

  async getConfig(tenantId: string, key: string): Promise<string | null> {
    const [config] = await db.select().from(examConfig).where(and(
      eq(examConfig.tenantId, tenantId),
      eq(examConfig.key, key)
    ));
    return config?.value || null;
  }

  async setConfig(tenantId: string, key: string, value: string): Promise<void> {
    const [existing] = await db.select().from(examConfig).where(and(
      eq(examConfig.tenantId, tenantId),
      eq(examConfig.key, key)
    ));
    if (existing) {
      await db.update(examConfig).set({ value }).where(eq(examConfig.id, existing.id));
    } else {
      await db.insert(examConfig).values({ tenantId, key, value });
    }
  }

  async getAllConfig(tenantId: string): Promise<Record<string, string>> {
    const configs = await db.select().from(examConfig).where(eq(examConfig.tenantId, tenantId));
    return configs.reduce((acc, c) => {
      if (c.value) acc[c.key] = c.value;
      return acc;
    }, {} as Record<string, string>);
  }

  async createUpload(insertUpload: InsertUpload): Promise<Upload> {
    const [upload] = await db.insert(uploads).values(insertUpload).returning();
    return upload;
  }

  async getUploadsByTenant(tenantId: string): Promise<Upload[]> {
    return db.select().from(uploads).where(eq(uploads.tenantId, tenantId));
  }

  async deleteUpload(id: string): Promise<boolean> {
    await db.delete(uploads).where(eq(uploads.id, id));
    return true;
  }

  async startPracticeSession(tenantId: string, studentId: string, subject: string, chapter?: string): Promise<{ session: PracticeSession; questions: Question[] }> {
    const practiceQuestions = await this.getPracticeQuestions(tenantId, subject, chapter);
    const shuffled = shuffleArray(practiceQuestions).slice(0, 10);

    const [session] = await db.insert(practiceSessions).values({
      tenantId,
      studentId,
      subject,
      chapter: chapter || null,
      status: "active",
    }).returning();

    return { session, questions: shuffled };
  }

  async submitPractice(answers: Record<string, string>, questionIds: string[]): Promise<{ correct: number; total: number }> {
    const questionsData = await this.getQuestionsByIds(questionIds);
    let correct = 0;
    for (const q of questionsData) {
      if (answers[q.id] && q.correctAnswer && answers[q.id].toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
        correct++;
      }
    }
    return { correct, total: questionsData.length };
  }

  async attachPassageToQuestions(questionsData: Question[]): Promise<(Question & { passageText?: string | null })[]> {
    return Promise.all(questionsData.map(async (q) => {
      if (q.passageId) {
        const passage = await this.getPassage(q.passageId);
        return { ...q, passageText: passage?.content || null };
      }
      return { ...q, passageText: null };
    }));
  }

  async selectQuestionsForBlueprint(
    tenantId: string,
    subject: string,
    grade: string,
    sections: { name: string; marks: number; questionCount: number; questionType: string; difficulty?: string; chapters?: string[] }[]
  ): Promise<Question[]> {
    const selectedQuestions: Question[] = [];
    
    for (const section of sections) {
      const pool = await this.getFilteredAssessmentQuestions(tenantId, subject, {
        grade,
        chapters: section.chapters,
        questionType: section.questionType,
        marks: section.marks,
      });
      
      const difficultyFiltered = section.difficulty 
        ? pool.filter(q => q.difficulty === section.difficulty)
        : pool;
      
      const alreadySelectedIds = new Set(selectedQuestions.map(q => q.id));
      const available = difficultyFiltered.filter(q => !alreadySelectedIds.has(q.id));
      
      const sectionQuestions = this.selectQuestionsWithPassageGrouping(available, section.questionCount);
      selectedQuestions.push(...sectionQuestions);
    }
    
    return selectedQuestions;
  }

  async startExam(tenantId: string, testId: string, studentId: string): Promise<{ attempt: Attempt; questions: Question[]; duration: number }> {
    const test = await this.getTest(testId);
    if (!test) throw new Error("Test not found");

    const existingAttempt = await this.getActiveAttempt(testId, studentId);
    if (existingAttempt) {
      const questionsData = existingAttempt.assignedQuestionIds 
        ? await this.getQuestionsByIds(existingAttempt.assignedQuestionIds)
        : [];
      const questionsWithPassages = await this.attachPassageToQuestions(questionsData);
      return { attempt: existingAttempt, questions: questionsWithPassages as Question[], duration: test.duration || 60 };
    }

    const hasCompleted = await this.hasCompletedAttempt(testId, studentId);
    if (hasCompleted) {
      throw new Error("You have already completed this test. Re-attempts are not allowed.");
    }

    const OBJECTIVE_TYPES = ["mcq", "true_false", "fill_blank", "numerical", "assertion_reason", "matching"];
    
    let questionsData: Question[] = [];
    if (test.questionIds && test.questionIds.length > 0) {
      let preselectedQuestions = await this.getQuestionsByIds(test.questionIds);
      let objectiveQuestions = preselectedQuestions.filter(q => OBJECTIVE_TYPES.includes(q.type));
      questionsData = this.selectQuestionsWithPassageGrouping(objectiveQuestions, objectiveQuestions.length);
    } else {
      const availableQuestions = await this.getFilteredAssessmentQuestions(
        tenantId, 
        test.subject, 
        { 
          grade: test.grade, 
          objectiveOnly: true 
        }
      );
      questionsData = this.selectQuestionsWithPassageGrouping(availableQuestions, test.questionCount || 50);
    }

    const attempt = await this.createAttempt({
      tenantId,
      testId,
      studentId,
      assignedQuestionIds: questionsData.map(q => q.id),
      answers: {},
      questionStatuses: {},
      markedForReview: [],
      totalMarks: test.totalMarks,
      timeRemaining: (test.duration || 60) * 60,
    });

    const questionsWithPassages = await this.attachPassageToQuestions(questionsData);
    return { attempt, questions: shuffleArray(questionsWithPassages) as Question[], duration: test.duration || 60 };
  }

  async saveExamState(attemptId: string, answers: Record<string, string>, questionStatuses: Record<string, QuestionStatus>, markedForReview: string[], timeRemaining: number): Promise<Attempt | undefined> {
    return this.updateAttempt(attemptId, { answers, questionStatuses, markedForReview, timeRemaining });
  }

  async submitExam(attemptId: string, answers: Record<string, string>): Promise<{ score: number; total: number; percentage: number; needsManualMarking: boolean }> {
    const attempt = await this.getAttempt(attemptId);
    if (!attempt) throw new Error("Attempt not found");

    const questionsData = attempt.assignedQuestionIds
      ? await this.getQuestionsByIds(attempt.assignedQuestionIds)
      : [];

    let autoScore = 0;
    let autoTotal = 0;
    let needsManualMarking = false;

    for (const q of questionsData) {
      const marks = q.marks || 1;
      if (["short_answer", "long_answer"].includes(q.type)) {
        needsManualMarking = true;
      } else {
        autoTotal += marks;
        if (answers[q.id] && q.correctAnswer && answers[q.id].toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
          autoScore += marks;
        }
      }
    }

    const test = await this.getTest(attempt.testId);
    const totalMarks = test?.totalMarks || autoTotal;
    const percentage = totalMarks > 0 ? (autoScore / totalMarks) * 100 : 0;

    await this.updateAttempt(attemptId, {
      answers,
      score: autoScore,
      totalMarks,
      percentage: percentage.toFixed(2),
      status: needsManualMarking ? "in_progress" : "submitted",
      submittedAt: new Date(),
    });

    return { score: autoScore, total: totalMarks, percentage, needsManualMarking };
  }

  async markQuestion(attemptId: string, questionId: string, score: number): Promise<Attempt | undefined> {
    const attempt = await this.getAttempt(attemptId);
    if (!attempt) return undefined;

    const manualScores = { ...(attempt.manualScores || {}), [questionId]: score };
    return this.updateAttempt(attemptId, { manualScores });
  }

  async finalizeMarking(attemptId: string, remarks?: string): Promise<Attempt | undefined> {
    const attempt = await this.getAttempt(attemptId);
    if (!attempt) return undefined;

    const autoScore = attempt.score || 0;
    const manualScores = attempt.manualScores || {};
    const manualTotal = Object.values(manualScores).reduce((sum, s) => sum + s, 0);
    const totalScore = autoScore + manualTotal;

    const test = await this.getTest(attempt.testId);
    const totalMarks = test?.totalMarks || attempt.totalMarks || 0;
    const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;

    return this.updateAttempt(attemptId, {
      score: totalScore,
      percentage: percentage.toFixed(2),
      status: "marked",
      teacherRemarks: remarks,
    });
  }

  async getReportData(userId: string): Promise<{
    attempts: Attempt[];
    summary: { totalTests: number; averageScore: number; bestScore: number; trend: "up" | "down" | "stable" };
    topicAccuracy: { topic: string; accuracy: number; attempted: number }[];
  }> {
    const studentAttempts = await this.getAttemptsByStudent(userId);
    const submittedAttempts = studentAttempts.filter(a => a.status === "submitted" || a.status === "marked");

    const scores = submittedAttempts.map(a => parseFloat(a.percentage?.toString() || "0"));
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

    let trend: "up" | "down" | "stable" = "stable";
    if (scores.length >= 2) {
      const recentAvg = scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
      const olderAvg = scores.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 3);
      if (recentAvg > olderAvg + 5) trend = "up";
      else if (recentAvg < olderAvg - 5) trend = "down";
    }

    return {
      attempts: submittedAttempts,
      summary: { totalTests: submittedAttempts.length, averageScore, bestScore, trend },
      topicAccuracy: [],
    };
  }

  async createGrade(insertGrade: InsertGrade): Promise<Grade> {
    const [grade] = await db.insert(grades).values(insertGrade).returning();
    return grade;
  }

  async getGradesByStudent(studentId: string): Promise<Grade[]> {
    return db.select().from(grades).where(eq(grades.studentId, studentId));
  }

  async getGradesByTest(testId: string): Promise<Grade[]> {
    return db.select().from(grades).where(eq(grades.testId, testId));
  }

  async getAnalytics(tenantId: string, daysBack: number = 0): Promise<{
    totalStudents: number;
    totalQuestions: number;
    totalTests: number;
    averageScore: number;
    subjectPerformance: { subject: string; avgScore: number; attempts: number }[];
    recentActivity: { date: string; tests: number; avgScore: number }[];
  }> {
    const usersData = await this.getUsersByTenant(tenantId);
    const students = usersData.filter(u => u.role === "student");
    const questionsData = await this.getQuestionsByTenant(tenantId);
    const testsData = await this.getTestsByTenant(tenantId);
    const allAttempts = await db.select().from(attempts).where(eq(attempts.tenantId, tenantId));

    const cutoffDate = daysBack > 0 ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000) : null;
    const filteredAttempts = cutoffDate
      ? allAttempts.filter(a => a.submittedAt && new Date(a.submittedAt) >= cutoffDate)
      : allAttempts;

    const scores = filteredAttempts.map(a => parseFloat(a.percentage?.toString() || "0")).filter(s => s > 0);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const subjectMap = new Map<string, { total: number; count: number }>();
    for (const attempt of filteredAttempts) {
      const test = testsData.find(t => t.id === attempt.testId);
      if (test && attempt.percentage) {
        const prev = subjectMap.get(test.subject) || { total: 0, count: 0 };
        subjectMap.set(test.subject, { total: prev.total + parseFloat(attempt.percentage.toString()), count: prev.count + 1 });
      }
    }

    const subjectPerformance = Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      avgScore: data.total / data.count,
      attempts: data.count,
    }));

    return {
      totalStudents: students.length,
      totalQuestions: questionsData.length,
      totalTests: testsData.length,
      averageScore,
      subjectPerformance,
      recentActivity: [],
    };
  }

  async getBlueprint(id: string): Promise<Blueprint | undefined> {
    const [blueprint] = await db.select().from(blueprints).where(eq(blueprints.id, id));
    return blueprint;
  }

  async getBlueprintsByTenant(tenantId: string): Promise<Blueprint[]> {
    return db.select().from(blueprints).where(eq(blueprints.tenantId, tenantId));
  }

  async createBlueprint(insertBlueprint: InsertBlueprint): Promise<Blueprint> {
    const [blueprint] = await db.insert(blueprints).values(insertBlueprint).returning();
    return blueprint;
  }

  async updateBlueprint(id: string, data: Partial<Blueprint>): Promise<Blueprint | undefined> {
    const [updated] = await db.update(blueprints).set(data).where(eq(blueprints.id, id)).returning();
    return updated;
  }

  async approveBlueprint(id: string, approvedBy: string): Promise<Blueprint | undefined> {
    return this.updateBlueprint(id, { isApproved: true, approvedBy });
  }

  async logActivity(log: InsertActivityLog): Promise<ActivityLog> {
    const [activityLog] = await db.insert(activityLogs).values(log).returning();
    return activityLog;
  }

  async getActivityLogs(tenantId: string, entityType?: string, entityId?: string): Promise<ActivityLog[]> {
    let conditions = [eq(activityLogs.tenantId, tenantId)];
    if (entityType) conditions.push(eq(activityLogs.entityType, entityType));
    if (entityId) conditions.push(eq(activityLogs.entityId, entityId));
    return db.select().from(activityLogs).where(and(...conditions)).orderBy(desc(activityLogs.createdAt));
  }

  async createQuestionReview(review: InsertQuestionReview): Promise<QuestionReview> {
    const [questionReview] = await db.insert(questionReviews).values({
      questionId: review.questionId,
      reviewerId: review.reviewerId,
      status: review.status || "pending",
      comments: review.comments,
    }).returning();
    return questionReview;
  }

  async getQuestionReviews(questionId: string): Promise<QuestionReview[]> {
    return db.select().from(questionReviews).where(eq(questionReviews.questionId, questionId));
  }

  async getPendingQuestions(tenantId: string): Promise<Question[]> {
    return db.select().from(questions).where(and(
      eq(questions.tenantId, tenantId),
      eq(questions.status, "draft")
    ));
  }

  async approveQuestionByHOD(questionId: string, reviewerId: string, comments?: string): Promise<Question | undefined> {
    await this.createQuestionReview({ questionId, reviewerId, status: "approved", comments });
    return this.updateQuestion(questionId, { 
      isVerified: true, 
      status: "active",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: null,
    });
  }

  async rejectQuestionByHOD(questionId: string, reviewerId: string, comments: string): Promise<Question | undefined> {
    await this.createQuestionReview({ questionId, reviewerId, status: "rejected", comments });
    return this.updateQuestion(questionId, { 
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: comments,
    });
  }

  async updateTestWorkflow(testId: string, state: WorkflowState, userId: string, comments?: string): Promise<Test | undefined> {
    const updates: Partial<Test> = { workflowState: state };
    if (state === "hod_approved") {
      updates.hodApprovedBy = userId;
      updates.hodApprovedAt = new Date();
      updates.hodComments = comments;
    } else if (state === "principal_approved") {
      updates.principalApprovedBy = userId;
      updates.principalApprovedAt = new Date();
      updates.principalComments = comments;
    }
    return this.updateTest(testId, updates);
  }

  async getTestsByWorkflowState(tenantId: string, states: WorkflowState[]): Promise<Test[]> {
    return db.select().from(tests).where(and(
      eq(tests.tenantId, tenantId),
      inArray(tests.workflowState, states)
    ));
  }

  async sendTestToCommittee(testId: string): Promise<Test | undefined> {
    return this.updateTest(testId, { workflowState: "sent_to_committee", sentToCommitteeAt: new Date() });
  }

  async lockTest(testId: string): Promise<Test | undefined> {
    return this.updateTest(testId, { workflowState: "locked" });
  }

  async markTestConfidential(testId: string): Promise<Test | undefined> {
    return this.updateTest(testId, { isConfidential: true });
  }

  async markPrintingReady(testId: string): Promise<Test | undefined> {
    return this.updateTest(testId, { printingReady: true });
  }

  async generateQuestionPaper(testId: string, format: "A4" | "Legal"): Promise<{ paperUrl: string; answerKeyUrl: string }> {
    const test = await this.getTest(testId);
    if (!test) throw new Error("Test not found");

    const paperUrl = `/generated/paper-${testId}.pdf`;
    const answerKeyUrl = `/generated/key-${testId}.pdf`;

    await this.updateTest(testId, { paperFormat: format, generatedPaperUrl: paperUrl, answerKeyUrl });
    return { paperUrl, answerKeyUrl };
  }

  async deleteBlueprint(id: string): Promise<boolean> {
    await db.delete(blueprints).where(eq(blueprints.id, id));
    return true;
  }

  async updateChapterPortions(id: string, completedTopics: string[]): Promise<Chapter | undefined> {
    return this.updateChapter(id, {});
  }

  async getSubjectsByTenant(tenantId: string): Promise<{ id: string; name: string; classLevel: string }[]> {
    const questionsData = await this.getQuestionsByTenant(tenantId);
    const subjectMap = new Map<string, Set<string>>();
    for (const q of questionsData) {
      if (!subjectMap.has(q.subject)) subjectMap.set(q.subject, new Set());
      subjectMap.get(q.subject)!.add(q.grade);
    }
    return Array.from(subjectMap.entries()).map(([subject, grades]) => ({
      id: subject.toLowerCase().replace(/\s+/g, "-"),
      name: subject,
      classLevel: Array.from(grades).join(", "),
    }));
  }

  async getMakeupTestsByTenant(tenantId: string): Promise<any[]> {
    return [];
  }

  async createMakeupTest(data: any): Promise<any> {
    return data;
  }

  async getSubmissionsByTenant(tenantId: string): Promise<any[]> {
    return db.select().from(attempts).where(and(
      eq(attempts.tenantId, tenantId),
      eq(attempts.status, "submitted")
    ));
  }

  async updateSubmissionMarks(id: string, marks: Record<string, number>, feedback: Record<string, string>): Promise<any> {
    return this.updateAttempt(id, { manualScores: marks });
  }

  async completeSubmissionMarking(id: string): Promise<any> {
    return this.finalizeMarking(id);
  }

  async getResultsByUser(tenantId: string, userId?: string): Promise<any[]> {
    if (userId) {
      return this.getAttemptsByStudent(userId);
    }
    return db.select().from(attempts).where(eq(attempts.tenantId, tenantId));
  }

  async getChildrenByParent(parentId: string): Promise<any[]> {
    const parent = await this.getUser(parentId);
    if (!parent?.parentOf) return [];
    const child = await this.getUser(parent.parentOf);
    return child ? [child] : [];
  }

  async getResultsByParent(parentId: string): Promise<any[]> {
    const children = await this.getChildrenByParent(parentId);
    const results: any[] = [];
    for (const child of children) {
      const childAttempts = await this.getAttemptsByStudent(child.id);
      results.push(...childAttempts);
    }
    return results;
  }

  async getProgressByParent(parentId: string): Promise<any[]> {
    return this.getResultsByParent(parentId);
  }

  async getNotificationsByParent(parentId: string): Promise<any[]> {
    return [];
  }

  async getRiskAlertsByTenant(tenantId: string): Promise<any[]> {
    return [];
  }

  async acknowledgeRiskAlert(id: string): Promise<any> {
    return { id, acknowledged: true };
  }

  async getAllAttempts(tenantId: string): Promise<Attempt[]> {
    return db.select().from(attempts).where(eq(attempts.tenantId, tenantId));
  }

  async createRiskAlert(alert: any): Promise<any> {
    return alert;
  }

  async getUpload(id: string): Promise<Upload | undefined> {
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, id));
    return upload;
  }

  async createExamAuditLog(log: InsertExamAuditLog): Promise<ExamAuditLog> {
    const [auditLog] = await db.insert(examAuditLogs).values(log).returning();
    return auditLog;
  }

  async getExamAuditLogs(examId: string): Promise<ExamAuditLog[]> {
    return await db.select().from(examAuditLogs)
      .where(eq(examAuditLogs.examId, examId))
      .orderBy(desc(examAuditLogs.timestamp));
  }

  async getExamAuditLogsByTenant(tenantId: string): Promise<ExamAuditLog[]> {
    return await db.select().from(examAuditLogs)
      .where(eq(examAuditLogs.tenantId, tenantId))
      .orderBy(desc(examAuditLogs.timestamp));
  }

  async hasCompletedAttempt(testId: string, studentId: string): Promise<boolean> {
    const result = await db.select().from(attempts).where(
      and(
        eq(attempts.testId, testId),
        eq(attempts.studentId, studentId),
        or(eq(attempts.status, "submitted"), eq(attempts.status, "marked"))
      )
    );
    return result.length > 0;
  }

  async getStudentResultsWithDetails(studentId: string): Promise<{
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
  }[]> {
    const studentAttempts = await db.select().from(attempts).where(
      and(
        eq(attempts.studentId, studentId),
        or(eq(attempts.status, "submitted"), eq(attempts.status, "marked"))
      )
    );
    
    const results = [];
    for (const a of studentAttempts) {
      const test = await this.getTest(a.testId);
      let chapterName = null;
      if (test?.chapterId) {
        const chapter = await this.getChapter(test.chapterId);
        chapterName = chapter?.name || null;
      }
      results.push({
        attemptId: a.id,
        testId: a.testId,
        testTitle: test?.title || "Unknown Test",
        testType: test?.type || "mock",
        subject: test?.subject || "Unknown",
        chapter: chapterName,
        score: a.score,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        status: a.status || "submitted",
        submittedAt: a.submittedAt,
      });
    }
    return results.sort((a, b) => {
      if (!a.submittedAt || !b.submittedAt) return 0;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }

  async getAvailableStudentTests(tenantId: string, studentId: string): Promise<(Test & { hasCompletedAttempt: boolean; hasActiveAttempt: boolean })[]> {
    const activeTests = await db.select().from(tests).where(
      and(eq(tests.tenantId, tenantId), eq(tests.isActive, true))
    );
    
    const studentAttempts = await db.select().from(attempts).where(
      eq(attempts.studentId, studentId)
    );
    
    return activeTests.map(test => ({
      ...test,
      hasCompletedAttempt: studentAttempts.some(
        a => a.testId === test.id && (a.status === "submitted" || a.status === "marked")
      ),
      hasActiveAttempt: studentAttempts.some(
        a => a.testId === test.id && a.status === "in_progress"
      ),
    }));
  }

  async createStudentNotification(notification: InsertStudentNotification): Promise<StudentNotification> {
    const [newNotification] = await db.insert(studentNotifications).values(notification).returning();
    return newNotification;
  }

  async getStudentNotifications(studentId: string): Promise<StudentNotification[]> {
    return db.select().from(studentNotifications)
      .where(eq(studentNotifications.studentId, studentId))
      .orderBy(desc(studentNotifications.createdAt));
  }

  async markNotificationRead(notificationId: string): Promise<StudentNotification | undefined> {
    const [updated] = await db.update(studentNotifications)
      .set({ isRead: true })
      .where(eq(studentNotifications.id, notificationId))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(studentId: string): Promise<void> {
    await db.update(studentNotifications)
      .set({ isRead: true })
      .where(eq(studentNotifications.studentId, studentId));
  }

  // Principal Dashboard Analytics (read-only)
  async getPrincipalSchoolSnapshot(tenantId: string): Promise<{
    totalStudents: number;
    testsThisMonth: number;
    averageScore: number;
    atRiskCount: number;
  }> {
    // Total students
    const studentCountResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "student")));
    const totalStudents = studentCountResult[0]?.count || 0;

    // Tests this month (based on attempts submitted in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const testsThisMonthResult = await db.selectDistinct({ testId: attempts.testId })
      .from(attempts)
      .where(and(
        eq(attempts.tenantId, tenantId),
        sql`${attempts.status} IN ('submitted', 'marked')`,
        sql`${attempts.submittedAt} >= ${thirtyDaysAgo}`
      ));
    const testsThisMonth = testsThisMonthResult.length;

    // Average score from completed attempts this month
    const avgScoreResult = await db.select({ avg: sql<number>`COALESCE(AVG(${attempts.percentage}::numeric), 0)` })
      .from(attempts)
      .where(and(
        eq(attempts.tenantId, tenantId),
        sql`${attempts.status} IN ('submitted', 'marked')`,
        sql`${attempts.submittedAt} >= ${thirtyDaysAgo}`
      ));
    const averageScore = Math.round((avgScoreResult[0]?.avg || 0) * 10) / 10;

    // At-risk students: 2+ attempts below 40%
    const lowScoreAttempts = await db.select({ 
      studentId: attempts.studentId,
      count: sql<number>`count(*)::int` 
    })
      .from(attempts)
      .where(and(
        eq(attempts.tenantId, tenantId),
        sql`${attempts.status} IN ('submitted', 'marked')`,
        sql`${attempts.percentage}::numeric < 40`
      ))
      .groupBy(attempts.studentId)
      .having(sql`count(*) >= 2`);
    const atRiskCount = lowScoreAttempts.length;

    return { totalStudents, testsThisMonth, averageScore, atRiskCount };
  }

  async getPrincipalGradePerformance(tenantId: string): Promise<{
    grade: string;
    averageScore: number;
    passPercentage: number;
    totalAttempts: number;
    trend: 'up' | 'down' | 'stable';
  }[]> {
    const results = await db.select({
      grade: users.grade,
      avgScore: sql<number>`COALESCE(AVG(${attempts.percentage}::numeric), 0)`,
      totalAttempts: sql<number>`count(*)::int`,
      passedCount: sql<number>`SUM(CASE WHEN ${attempts.percentage}::numeric >= 40 THEN 1 ELSE 0 END)::int`,
    })
      .from(attempts)
      .innerJoin(users, eq(attempts.studentId, users.id))
      .where(and(
        eq(attempts.tenantId, tenantId),
        sql`${attempts.status} IN ('submitted', 'marked')`
      ))
      .groupBy(users.grade);

    return results.map(r => ({
      grade: r.grade || "Unknown",
      averageScore: Math.round((r.avgScore || 0) * 10) / 10,
      passPercentage: r.totalAttempts > 0 ? Math.round(((r.passedCount || 0) / r.totalAttempts) * 100) : 0,
      totalAttempts: r.totalAttempts,
      trend: 'stable' as const,
    })).sort((a, b) => a.grade.localeCompare(b.grade));
  }

  async getPrincipalSubjectHealth(tenantId: string, gradeFilter?: string): Promise<{
    subject: string;
    grade: string;
    averagePercentage: number;
    totalAttempts: number;
    isWeak: boolean;
  }[]> {
    let query = db.select({
      subject: tests.subject,
      grade: users.grade,
      avgPercentage: sql<number>`COALESCE(AVG(${attempts.percentage}::numeric), 0)`,
      totalAttempts: sql<number>`count(*)::int`,
    })
      .from(attempts)
      .innerJoin(tests, eq(attempts.testId, tests.id))
      .innerJoin(users, eq(attempts.studentId, users.id))
      .where(and(
        eq(attempts.tenantId, tenantId),
        sql`${attempts.status} IN ('submitted', 'marked')`,
        gradeFilter ? eq(users.grade, gradeFilter) : sql`1=1`
      ))
      .groupBy(tests.subject, users.grade);

    const results = await query;

    return results.map(r => ({
      subject: r.subject,
      grade: r.grade || "Unknown",
      averagePercentage: Math.round((r.avgPercentage || 0) * 10) / 10,
      totalAttempts: r.totalAttempts,
      isWeak: (r.avgPercentage || 0) < 50,
    })).sort((a, b) => a.averagePercentage - b.averagePercentage);
  }

  async getPrincipalAtRiskStudents(tenantId: string): Promise<{
    studentId: string;
    studentName: string;
    grade: string;
    lowScoreCount: number;
    averagePercentage: number;
    trend: 'declining' | 'stable' | 'improving';
  }[]> {
    // Get students with 2+ low scores
    const atRiskStudents = await db.select({
      studentId: attempts.studentId,
      studentName: users.name,
      grade: users.grade,
      lowScoreCount: sql<number>`SUM(CASE WHEN ${attempts.percentage}::numeric < 40 THEN 1 ELSE 0 END)::int`,
      avgPercentage: sql<number>`COALESCE(AVG(${attempts.percentage}::numeric), 0)`,
    })
      .from(attempts)
      .innerJoin(users, eq(attempts.studentId, users.id))
      .where(and(
        eq(attempts.tenantId, tenantId),
        sql`${attempts.status} IN ('submitted', 'marked')`
      ))
      .groupBy(attempts.studentId, users.name, users.grade)
      .having(sql`SUM(CASE WHEN ${attempts.percentage}::numeric < 40 THEN 1 ELSE 0 END) >= 2`);

    return atRiskStudents.map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      grade: r.grade || "Unknown",
      lowScoreCount: r.lowScoreCount,
      averagePercentage: Math.round((r.avgPercentage || 0) * 10) / 10,
      trend: 'stable' as const, // Simplified - full trend needs separate query
    })).sort((a, b) => a.averagePercentage - b.averagePercentage);
  }

  async getPrincipalRiskAlerts(tenantId: string): Promise<{
    type: 'tab_switch' | 'absence' | 'sudden_drop';
    studentId: string;
    studentName: string;
    grade: string;
    details: string;
    count: number;
    createdAt: Date | null;
  }[]> {
    const alerts: {
      type: 'tab_switch' | 'absence' | 'sudden_drop';
      studentId: string;
      studentName: string;
      grade: string;
      details: string;
      count: number;
      createdAt: Date | null;
    }[] = [];

    // Tab switch alerts (3+ occurrences)
    const tabSwitchAlerts = await db.select({
      studentId: activityLogs.userId,
      studentName: users.name,
      grade: users.grade,
      count: sql<number>`count(*)::int`,
      latestAt: sql<Date>`MAX(${activityLogs.createdAt})`,
    })
      .from(activityLogs)
      .innerJoin(users, eq(activityLogs.userId, users.id))
      .where(and(
        eq(activityLogs.tenantId, tenantId),
        eq(activityLogs.action, "tab_switch_detected")
      ))
      .groupBy(activityLogs.userId, users.name, users.grade)
      .having(sql`count(*) >= 3`);

    tabSwitchAlerts.forEach(a => {
      alerts.push({
        type: 'tab_switch',
        studentId: a.studentId,
        studentName: a.studentName,
        grade: a.grade || "Unknown",
        details: `${a.count} tab switches detected during exams`,
        count: a.count,
        createdAt: a.latestAt,
      });
    });

    // Absence alerts (2+ absences)
    const absenceAlerts = await db.select({
      studentId: attempts.studentId,
      studentName: users.name,
      grade: users.grade,
      count: sql<number>`count(*)::int`,
    })
      .from(attempts)
      .innerJoin(users, eq(attempts.studentId, users.id))
      .where(and(
        eq(attempts.tenantId, tenantId),
        eq(attempts.status, "absent")
      ))
      .groupBy(attempts.studentId, users.name, users.grade)
      .having(sql`count(*) >= 2`);

    absenceAlerts.forEach(a => {
      alerts.push({
        type: 'absence',
        studentId: a.studentId,
        studentName: a.studentName,
        grade: a.grade || "Unknown",
        details: `${a.count} exam absences recorded`,
        count: a.count,
        createdAt: null,
      });
    });

    return alerts.sort((a, b) => b.count - a.count);
  }

  // Academic Years
  async getAcademicYear(id: string): Promise<AcademicYear | undefined> {
    const [year] = await db.select().from(academicYears).where(eq(academicYears.id, id));
    return year;
  }

  async getAcademicYearsByTenant(tenantId: string): Promise<AcademicYear[]> {
    return await db.select().from(academicYears)
      .where(eq(academicYears.tenantId, tenantId))
      .orderBy(desc(academicYears.createdAt));
  }

  async getActiveAcademicYear(tenantId: string): Promise<AcademicYear | undefined> {
    const [year] = await db.select().from(academicYears)
      .where(and(
        eq(academicYears.tenantId, tenantId),
        eq(academicYears.isActive, true)
      ));
    return year;
  }

  async createAcademicYear(year: InsertAcademicYear): Promise<AcademicYear> {
    const [created] = await db.insert(academicYears).values(year).returning();
    return created;
  }

  async updateAcademicYear(id: string, data: Partial<AcademicYear>): Promise<AcademicYear | undefined> {
    const [updated] = await db.update(academicYears).set(data).where(eq(academicYears.id, id)).returning();
    return updated;
  }

  async activateAcademicYear(tenantId: string, yearId: string): Promise<AcademicYear | undefined> {
    // First deactivate all other years for this tenant
    await db.update(academicYears)
      .set({ isActive: false })
      .where(eq(academicYears.tenantId, tenantId));
    // Then activate the specified year
    const [activated] = await db.update(academicYears)
      .set({ isActive: true })
      .where(and(eq(academicYears.id, yearId), eq(academicYears.tenantId, tenantId)))
      .returning();
    return activated;
  }

  async lockAcademicYear(id: string, lockedBy: string): Promise<AcademicYear | undefined> {
    const [locked] = await db.update(academicYears)
      .set({ isLocked: true, lockedAt: new Date(), lockedBy })
      .where(eq(academicYears.id, id))
      .returning();
    return locked;
  }

  // Grade Configurations
  async getGradeConfig(id: string): Promise<GradeConfig | undefined> {
    const [config] = await db.select().from(gradeConfigs).where(eq(gradeConfigs.id, id));
    return config;
  }

  async getGradeConfigsByTenant(tenantId: string, academicYearId?: string): Promise<GradeConfig[]> {
    if (academicYearId) {
      return await db.select().from(gradeConfigs)
        .where(and(
          eq(gradeConfigs.tenantId, tenantId),
          eq(gradeConfigs.academicYearId, academicYearId)
        ))
        .orderBy(gradeConfigs.grade);
    }
    return await db.select().from(gradeConfigs)
      .where(eq(gradeConfigs.tenantId, tenantId))
      .orderBy(gradeConfigs.grade);
  }

  async createGradeConfig(config: InsertGradeConfig): Promise<GradeConfig> {
    const [created] = await db.insert(gradeConfigs).values(config).returning();
    return created;
  }

  async createGradeConfigsBulk(configs: InsertGradeConfig[]): Promise<GradeConfig[]> {
    if (configs.length === 0) return [];
    return await db.insert(gradeConfigs).values(configs).returning();
  }

  async updateGradeConfig(id: string, data: Partial<GradeConfig>): Promise<GradeConfig | undefined> {
    const [updated] = await db.update(gradeConfigs).set(data).where(eq(gradeConfigs.id, id)).returning();
    return updated;
  }

  // User Code Generation
  async generateUserCode(tenantId: string): Promise<string> {
    // Get tenant to get counter and code
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error("Tenant not found");
    
    // Increment counter
    const newCounter = (tenant.userCodeCounter || 0) + 1;
    await db.update(tenants)
      .set({ userCodeCounter: newCounter })
      .where(eq(tenants.id, tenantId));
    
    // Generate code: SCHOOLCODE + YEAR + U + 6-digit padded number
    const year = new Date().getFullYear();
    const paddedNumber = String(newCounter).padStart(6, '0');
    return `${tenant.code}${year}U${paddedNumber}`;
  }

  // Soft Delete Usage Checks
  async isQuestionInUse(questionId: string): Promise<boolean> {
    // Check if question is used in any test's questionIds
    const allTests = await db.select().from(tests);
    for (const test of allTests) {
      if (test.questionIds && test.questionIds.includes(questionId)) {
        return true;
      }
    }
    // Check if question has been answered in any attempt
    const allAttempts = await db.select().from(attempts);
    for (const attempt of allAttempts) {
      if (attempt.answers && questionId in attempt.answers) {
        return true;
      }
    }
    return false;
  }

  async isBlueprintInUse(blueprintId: string): Promise<boolean> {
    // Check if blueprint is linked to any test
    const [test] = await db.select().from(tests)
      .where(eq(tests.blueprintId, blueprintId))
      .limit(1);
    return !!test;
  }

  async isUserInUse(userId: string): Promise<boolean> {
    // Check if user has created questions
    const [question] = await db.select().from(questions)
      .where(eq(questions.createdBy, userId))
      .limit(1);
    if (question) return true;
    
    // Check if user has attempts
    const [attempt] = await db.select().from(attempts)
      .where(eq(attempts.studentId, userId))
      .limit(1);
    if (attempt) return true;
    
    // Check if user has created tests
    const [test] = await db.select().from(tests)
      .where(eq(tests.createdBy, userId))
      .limit(1);
    if (test) return true;
    
    return false;
  }

  async isUploadInUse(uploadId: string): Promise<boolean> {
    // Check if any questions reference this upload
    const [question] = await db.select().from(questions)
      .where(eq(questions.uploadId, uploadId))
      .limit(1);
    return !!question;
  }

  // Soft Delete Operations
  async softDeleteQuestion(id: string, deletedBy: string): Promise<boolean> {
    const [updated] = await db.update(questions)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy })
      .where(eq(questions.id, id))
      .returning();
    return !!updated;
  }

  async softDeleteBlueprint(id: string, deletedBy: string): Promise<boolean> {
    const [updated] = await db.update(blueprints)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy })
      .where(eq(blueprints.id, id))
      .returning();
    return !!updated;
  }

  async softDeleteUser(id: string, deletedBy: string): Promise<boolean> {
    const [updated] = await db.update(users)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy, active: false })
      .where(eq(users.id, id))
      .returning();
    return !!updated;
  }

  async softDeleteUpload(id: string, deletedBy: string): Promise<boolean> {
    const [updated] = await db.update(uploads)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy })
      .where(eq(uploads.id, id))
      .returning();
    return !!updated;
  }

  // =====================================================
  // PHASE 2+3: SUPER ADMIN GOVERNANCE
  // =====================================================

  // Exam Frameworks
  async getExamFramework(id: string): Promise<ExamFramework | undefined> {
    const [framework] = await db.select().from(examFrameworks).where(eq(examFrameworks.id, id));
    return framework;
  }

  async getExamFrameworksByTenant(tenantId: string, academicYearId?: string, gradeGroup?: GradeGroup): Promise<ExamFramework[]> {
    let conditions = [eq(examFrameworks.tenantId, tenantId)];
    if (academicYearId) conditions.push(eq(examFrameworks.academicYearId, academicYearId));
    if (gradeGroup) conditions.push(eq(examFrameworks.gradeGroup, gradeGroup));
    return db.select().from(examFrameworks).where(and(...conditions)).orderBy(examFrameworks.examOrder);
  }

  async createExamFramework(framework: InsertExamFramework): Promise<ExamFramework> {
    const [created] = await db.insert(examFrameworks).values(framework).returning();
    return created;
  }

  async updateExamFramework(id: string, data: Partial<ExamFramework>): Promise<ExamFramework | undefined> {
    const [updated] = await db.update(examFrameworks).set(data).where(eq(examFrameworks.id, id)).returning();
    return updated;
  }

  async deleteExamFramework(id: string): Promise<boolean> {
    const [deleted] = await db.delete(examFrameworks).where(eq(examFrameworks.id, id)).returning();
    return !!deleted;
  }

  // Blueprint Policies
  async getBlueprintPolicy(id: string): Promise<BlueprintPolicy | undefined> {
    const [policy] = await db.select().from(blueprintPolicies).where(eq(blueprintPolicies.id, id));
    return policy;
  }

  async getBlueprintPolicyByTenant(tenantId: string, academicYearId?: string): Promise<BlueprintPolicy | undefined> {
    let conditions = [eq(blueprintPolicies.tenantId, tenantId)];
    if (academicYearId) conditions.push(eq(blueprintPolicies.academicYearId, academicYearId));
    const [policy] = await db.select().from(blueprintPolicies).where(and(...conditions));
    return policy;
  }

  async createBlueprintPolicy(policy: InsertBlueprintPolicy): Promise<BlueprintPolicy> {
    const [created] = await db.insert(blueprintPolicies).values(policy).returning();
    return created;
  }

  async updateBlueprintPolicy(id: string, data: Partial<BlueprintPolicy>): Promise<BlueprintPolicy | undefined> {
    const [updated] = await db.update(blueprintPolicies).set({ ...data, updatedAt: new Date() }).where(eq(blueprintPolicies.id, id)).returning();
    return updated;
  }

  // Reference Library
  async getReferenceItem(id: string): Promise<ReferenceLibrary | undefined> {
    const [item] = await db.select().from(referenceLibrary).where(and(eq(referenceLibrary.id, id), eq(referenceLibrary.isDeleted, false)));
    return item;
  }

  async getReferenceLibrary(tenantId: string, grade?: string, subject?: string): Promise<ReferenceLibrary[]> {
    let conditions = [eq(referenceLibrary.tenantId, tenantId), eq(referenceLibrary.isDeleted, false)];
    if (grade) conditions.push(eq(referenceLibrary.grade, grade));
    if (subject) conditions.push(eq(referenceLibrary.subject, subject));
    return db.select().from(referenceLibrary).where(and(...conditions)).orderBy(desc(referenceLibrary.createdAt));
  }

  async getStudentReferenceMaterials(tenantId: string, grade: string, subject?: string): Promise<ReferenceLibrary[]> {
    // Student view: only active, non-deleted materials for their school and grade
    let conditions = [
      eq(referenceLibrary.tenantId, tenantId),
      eq(referenceLibrary.grade, grade),
      eq(referenceLibrary.isActive, true),
      eq(referenceLibrary.isDeleted, false)
    ];
    if (subject) conditions.push(eq(referenceLibrary.subject, subject));
    return db.select().from(referenceLibrary).where(and(...conditions)).orderBy(desc(referenceLibrary.createdAt));
  }

  async createReferenceItem(item: InsertReferenceLibrary): Promise<ReferenceLibrary> {
    const [created] = await db.insert(referenceLibrary).values(item).returning();
    return created;
  }

  async updateReferenceItem(id: string, data: Partial<ReferenceLibrary>): Promise<ReferenceLibrary | undefined> {
    const [updated] = await db.update(referenceLibrary).set(data).where(eq(referenceLibrary.id, id)).returning();
    return updated;
  }

  async softDeleteReferenceItem(id: string, deletedBy: string): Promise<boolean> {
    const [updated] = await db.update(referenceLibrary)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy, isActive: false })
      .where(eq(referenceLibrary.id, id))
      .returning();
    return !!updated;
  }

  async restoreReferenceItem(id: string): Promise<ReferenceLibrary | undefined> {
    const [restored] = await db.update(referenceLibrary)
      .set({ isDeleted: false, deletedAt: null, deletedBy: null, isActive: true })
      .where(eq(referenceLibrary.id, id))
      .returning();
    return restored;
  }

  // Paper Generation Audit
  async createPaperGenerationAudit(audit: InsertPaperGenerationAudit): Promise<PaperGenerationAudit> {
    const [created] = await db.insert(paperGenerationAudit).values(audit).returning();
    return created;
  }

  async getPaperGenerationAudit(testId: string): Promise<PaperGenerationAudit[]> {
    return db.select().from(paperGenerationAudit).where(eq(paperGenerationAudit.testId, testId)).orderBy(desc(paperGenerationAudit.generatedAt));
  }

  // Storage Usage
  async getStorageUsage(tenantId: string): Promise<StorageUsage | undefined> {
    const [usage] = await db.select().from(storageUsage).where(eq(storageUsage.tenantId, tenantId));
    return usage;
  }

  async updateStorageUsage(tenantId: string, data: Partial<StorageUsage>): Promise<StorageUsage | undefined> {
    const existing = await this.getStorageUsage(tenantId);
    if (existing) {
      const [updated] = await db.update(storageUsage).set({ ...data, lastCalculatedAt: new Date() }).where(eq(storageUsage.tenantId, tenantId)).returning();
      return updated;
    }
    const [created] = await db.insert(storageUsage).values({ tenantId, ...data } as InsertStorageUsage).returning();
    return created;
  }

  async recalculateStorageUsage(tenantId: string): Promise<StorageUsage> {
    // This would ideally calculate storage from S3, for now return/create a placeholder
    const existing = await this.getStorageUsage(tenantId);
    if (existing) {
      const [updated] = await db.update(storageUsage)
        .set({ lastCalculatedAt: new Date() })
        .where(eq(storageUsage.tenantId, tenantId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(storageUsage).values({ tenantId, totalBytes: 0, questionImageBytes: 0, uploadFileBytes: 0, referenceFileBytes: 0 }).returning();
    return created;
  }

  // =====================================================
  // SUPER ADMIN EXAM CONFIGURATION
  // =====================================================

  async getAdminExamConfig(id: string): Promise<AdminExamConfig | undefined> {
    const [config] = await db.select().from(adminExamConfigs)
      .where(and(eq(adminExamConfigs.id, id), eq(adminExamConfigs.isDeleted, false)));
    return config;
  }

  async getAdminExamConfigsByTenant(tenantId: string, wing?: WingType): Promise<AdminExamConfig[]> {
    let conditions = [eq(adminExamConfigs.tenantId, tenantId), eq(adminExamConfigs.isDeleted, false)];
    if (wing) conditions.push(eq(adminExamConfigs.wing, wing));
    return db.select().from(adminExamConfigs)
      .where(and(...conditions))
      .orderBy(adminExamConfigs.wing, adminExamConfigs.examName);
  }

  // =====================================================
  // ACTIVE EXAMS FOR BLUEPRINT AND MOCK TESTS
  // Now using school_exams as the SINGLE SOURCE OF TRUTH
  // =====================================================
  async getActiveExamsForBlueprint(tenantId: string): Promise<SchoolExam[]> {
    return db.select().from(schoolExams)
      .where(and(
        eq(schoolExams.tenantId, tenantId),
        eq(schoolExams.isDeleted, false),
        eq(schoolExams.isActive, true)
      ))
      .orderBy(schoolExams.wingId, schoolExams.examName);
  }

  async getMockTestExams(tenantId: string): Promise<SchoolExam[]> {
    return db.select().from(schoolExams)
      .where(and(
        eq(schoolExams.tenantId, tenantId),
        eq(schoolExams.isDeleted, false),
        eq(schoolExams.isActive, true),
        eq(schoolExams.allowMockTest, true)
      ))
      .orderBy(schoolExams.wingId, schoolExams.examName);
  }

  async createAdminExamConfig(config: InsertAdminExamConfig): Promise<AdminExamConfig> {
    const [created] = await db.insert(adminExamConfigs).values({
      ...config,
      isActive: config.isActive ?? true,
      isDeleted: false,
    }).returning();
    return created;
  }

  async updateAdminExamConfig(id: string, data: Partial<AdminExamConfig>): Promise<AdminExamConfig | undefined> {
    const [updated] = await db.update(adminExamConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(adminExamConfigs.id, id))
      .returning();
    return updated;
  }

  async softDeleteAdminExamConfig(id: string, deletedBy: string): Promise<boolean> {
    const [updated] = await db.update(adminExamConfigs)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy, isActive: false })
      .where(eq(adminExamConfigs.id, id))
      .returning();
    return !!updated;
  }

  async isExamConfigInUse(examConfigId: string): Promise<boolean> {
    // Check if any blueprint references this exam config
    const allBlueprints = await db.select().from(blueprints);
    for (const bp of allBlueprints) {
      if (bp.examConfigId === examConfigId) {
        return true;
      }
    }
    // Check if any test references this exam config
    const allTests = await db.select().from(tests);
    for (const test of allTests) {
      if (test.examConfigId === examConfigId) {
        return true;
      }
    }
    return false;
  }

  // School Storage Configs
  async getSchoolStorageConfig(tenantId: string): Promise<SchoolStorageConfig | undefined> {
    const [config] = await db.select().from(schoolStorageConfigs)
      .where(eq(schoolStorageConfigs.tenantId, tenantId));
    return config;
  }

  async createOrUpdateSchoolStorageConfig(tenantId: string, data: Partial<SchoolStorageConfig>): Promise<SchoolStorageConfig> {
    const existing = await this.getSchoolStorageConfig(tenantId);
    if (existing) {
      const [updated] = await db.update(schoolStorageConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schoolStorageConfigs.tenantId, tenantId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(schoolStorageConfigs)
      .values({ tenantId, ...data } as InsertSchoolStorageConfig)
      .returning();
    return created;
  }

  // =====================================================
  // SOFT DELETE TENANT (School)
  // =====================================================
  async softDeleteTenant(id: string): Promise<boolean> {
    const [updated] = await db.update(tenants)
      .set({ active: false })
      .where(eq(tenants.id, id))
      .returning();
    return !!updated;
  }

  // =====================================================
  // SCHOOL WINGS CRUD
  // =====================================================
  async getWingsByTenant(tenantId: string): Promise<SchoolWing[]> {
    return db.select().from(schoolWings)
      .where(and(
        eq(schoolWings.tenantId, tenantId),
        eq(schoolWings.isDeleted, false)
      ))
      .orderBy(schoolWings.sortOrder);
  }

  async getWing(id: string): Promise<SchoolWing | undefined> {
    const [wing] = await db.select().from(schoolWings)
      .where(and(
        eq(schoolWings.id, id),
        eq(schoolWings.isDeleted, false)
      ));
    return wing;
  }

  async createWing(wing: InsertSchoolWing): Promise<SchoolWing> {
    const [created] = await db.insert(schoolWings).values({
      ...wing,
      isActive: wing.isActive ?? true,
      isDeleted: false,
    }).returning();
    return created;
  }

  async updateWing(id: string, data: Partial<SchoolWing>): Promise<SchoolWing | undefined> {
    const [updated] = await db.update(schoolWings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schoolWings.id, id))
      .returning();
    return updated;
  }

  async softDeleteWing(id: string): Promise<boolean> {
    // Soft delete the wing
    const [updated] = await db.update(schoolWings)
      .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
      .where(eq(schoolWings.id, id))
      .returning();
    
    if (updated) {
      // Also soft-delete all exams under this wing
      await db.update(schoolExams)
        .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
        .where(eq(schoolExams.wingId, id));
    }
    
    return !!updated;
  }

  // =====================================================
  // SCHOOL EXAMS CRUD
  // =====================================================
  async getSchoolExams(tenantId: string, wingId?: string): Promise<SchoolExam[]> {
    let conditions = [
      eq(schoolExams.tenantId, tenantId),
      eq(schoolExams.isDeleted, false)
    ];
    if (wingId) {
      conditions.push(eq(schoolExams.wingId, wingId));
    }
    return db.select().from(schoolExams)
      .where(and(...conditions))
      .orderBy(schoolExams.examName);
  }

  async getSchoolExam(id: string): Promise<SchoolExam | undefined> {
    const [exam] = await db.select().from(schoolExams)
      .where(and(
        eq(schoolExams.id, id),
        eq(schoolExams.isDeleted, false)
      ));
    return exam;
  }

  async createSchoolExam(exam: InsertSchoolExam): Promise<SchoolExam> {
    const [created] = await db.insert(schoolExams).values({
      ...exam,
      isActive: exam.isActive ?? true,
      isDeleted: false,
    }).returning();
    return created;
  }

  async updateSchoolExam(id: string, data: Partial<SchoolExam>): Promise<SchoolExam | undefined> {
    const [updated] = await db.update(schoolExams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schoolExams.id, id))
      .returning();
    return updated;
  }

  async softDeleteSchoolExam(id: string): Promise<boolean> {
    const [updated] = await db.update(schoolExams)
      .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
      .where(eq(schoolExams.id, id))
      .returning();
    return !!updated;
  }

  // =====================================================
  // REFERENCE MATERIALS - Global Content Library
  // =====================================================
  async getReferenceMaterials(grade?: string, category?: string): Promise<ReferenceMaterial[]> {
    let query = db.select().from(referenceMaterials)
      .where(eq(referenceMaterials.isDeleted, false));
    
    if (grade) {
      query = db.select().from(referenceMaterials)
        .where(and(
          eq(referenceMaterials.isDeleted, false),
          eq(referenceMaterials.grade, grade)
        ));
    }
    
    if (grade && category) {
      query = db.select().from(referenceMaterials)
        .where(and(
          eq(referenceMaterials.isDeleted, false),
          eq(referenceMaterials.grade, grade),
          eq(referenceMaterials.category, category)
        ));
    } else if (category) {
      query = db.select().from(referenceMaterials)
        .where(and(
          eq(referenceMaterials.isDeleted, false),
          eq(referenceMaterials.category, category)
        ));
    }

    return await query.orderBy(desc(referenceMaterials.createdAt));
  }

  async getReferenceMaterial(id: string): Promise<ReferenceMaterial | undefined> {
    const [material] = await db.select().from(referenceMaterials)
      .where(and(
        eq(referenceMaterials.id, id),
        eq(referenceMaterials.isDeleted, false)
      ));
    return material;
  }

  async createReferenceMaterial(material: InsertReferenceMaterial): Promise<ReferenceMaterial> {
    const [created] = await db.insert(referenceMaterials)
      .values({
        ...material,
        id: randomUUID(),
      })
      .returning();
    return created;
  }

  async updateReferenceMaterial(id: string, data: Partial<ReferenceMaterial>): Promise<ReferenceMaterial | undefined> {
    const [updated] = await db.update(referenceMaterials)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(referenceMaterials.id, id))
      .returning();
    return updated;
  }

  async softDeleteReferenceMaterial(id: string): Promise<boolean> {
    const [updated] = await db.update(referenceMaterials)
      .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
      .where(eq(referenceMaterials.id, id))
      .returning();
    return !!updated;
  }
}

// =====================================================
// SEED SUPER ADMIN USER
// =====================================================
async function seedSuperAdmin() {
  try {
    // Check if super admin already exists
    const [existingSuperAdmin] = await db.select().from(users)
      .where(eq(users.email, "superadmin@safal.com"));
    
    if (!existingSuperAdmin) {
      console.log("[pg-storage] Creating Super Admin user...");
      await db.insert(users).values({
        id: "user-superadmin",
        tenantId: null,
        email: "superadmin@safal.com",
        password: "SuperAdmin@123",
        name: "Super Admin",
        role: "super_admin",
        grade: null,
        section: null,
        wingId: null,
        subjects: [],
        avatar: null,
        parentOf: null,
        active: true,
        assignedQuestions: {},
        sessionToken: null,
      });
      console.log("[pg-storage] Super Admin user created successfully");
    } else {
      console.log("[pg-storage] Super Admin user already exists");
    }
  } catch (error) {
    console.error("[pg-storage] Error seeding Super Admin:", error);
  }
}

// Seed on module load
seedSuperAdmin();

export const pgStorage = new PgStorage();
