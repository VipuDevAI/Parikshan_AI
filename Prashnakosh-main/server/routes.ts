import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import multer from "multer";
import mammoth from "mammoth";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer, PageBreak, BorderStyle } from "docx";
import type { Attempt, AuthUser, WorkflowState, UserRole } from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth";
import { requireTenant, getTenantId, requireTenantId, TenantRequest } from "./middleware/tenant";
import { uploadExamFile, getSignedDownloadUrl, deleteExamFile, initS3, isS3Configured, canUpload, canDownload } from "./services/s3-storage";
import { 
  requireEditableState, 
  requireDownloadableState, 
  requireAttemptAllowedState, 
  requireActivatableState,
  canTransitionTo,
  logStateChange 
} from "./middleware/exam-governance";

const upload = multer({ storage: multer.memoryStorage() });

if (process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  initS3({
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_S3_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { schoolCode, email, password } = req.body;
      if (!schoolCode || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const result = await storage.authenticateUser(email, password, schoolCode);
      if (!result) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tenant routes - super_admin only
  app.get("/api/tenants", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tenants", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTenantByCode(req.body.code);
      if (existing) {
        return res.status(400).json({ error: "School code already exists" });
      }
      const tenant = await storage.createTenant(req.body);
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/tenants/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const tenant = await storage.updateTenant(req.params.id, req.body);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/tenants/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteTenant(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin schools endpoint (alias for tenants - used by super admin dashboard)
  app.get("/api/admin/schools", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const schools = tenants.map(t => ({
        id: t.id,
        name: t.name,
        code: t.code,
        principal: t.principalName || "",
        board: t.board || "",
        city: t.city || "",
        status: t.active ? "Active" : "Inactive"
      }));
      res.json(schools);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User routes - protected with auth and tenant isolation
  app.get("/api/users", requireAuth, requireTenant, async (req, res) => {
    try {
      // Super_admin can view all users; regular users see tenant-scoped data
      if (req.user?.role === "super_admin") {
        const users = await storage.getAllUsers();
        return res.json(users);
      }
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const users = await storage.getUsersByTenant(tenantId);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/students", requireAuth, requireTenant, async (req, res) => {
    try {
      // Super_admin can view all students; regular users see tenant-scoped data
      if (req.user?.role === "super_admin") {
        const students = await storage.getAllStudents();
        return res.json(students);
      }
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const students = await storage.getStudentsByTenant(tenantId);
      res.json(students);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      // Regular admin: use authenticated tenant context
      // Super_admin: must specify target tenant and have that tenant validated
      let tenantId: string | undefined;
      if (req.user?.role === "super_admin") {
        tenantId = req.body.tenantId;
        if (tenantId) {
          // Validate that the target tenant exists
          const targetTenant = await storage.getTenant(tenantId);
          if (!targetTenant) {
            return res.status(400).json({ error: "Invalid tenant ID" });
          }
        } else {
          return res.status(400).json({ error: "Super admin must specify target tenant" });
        }
      } else {
        tenantId = req.tenantId;
      }
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required for user creation" });
      }
      const user = await storage.createUser({
        ...req.body,
        tenantId,
        active: true,
      });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const existingUser = await storage.getUser(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (req.user?.role !== "super_admin" && existingUser.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const user = await storage.updateUser(req.params.id, req.body);
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const existingUser = await storage.getUser(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (req.user?.role !== "super_admin" && existingUser.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Question routes - protected with auth and tenant isolation
  app.get("/api/questions", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const questions = await storage.getQuestionsByTenant(tenantId);
      res.json(questions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/questions", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const question = await storage.createQuestion({
        ...req.body,
        tenantId,
      });
      res.json(question);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/questions/:id/approve", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const question = await storage.approveQuestion(req.params.id);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }
      if (req.user?.role !== "super_admin" && question.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(question);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/questions/:id", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getQuestion(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Question not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const question = await storage.updateQuestion(req.params.id, req.body);
      res.json(question);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/questions/:id", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getQuestion(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Question not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteQuestion(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Wings routes - tenant scoped for HOD/teachers
  app.get("/api/wings", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const wings = await storage.getWingsByTenant(tenantId);
      res.json(wings.filter(w => w.isActive));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Chapter routes - protected with auth and tenant isolation
  app.get("/api/chapters", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const chapters = await storage.getChaptersByTenant(tenantId);
      res.json(chapters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create chapter
  app.post("/api/chapters", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { name, subject, grade, isLocked } = req.body;
      const chapter = await storage.createChapter({
        tenantId,
        name,
        subject,
        grade,
        status: isLocked ? "locked" : "draft",
      });
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chapters/:id/unlock", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const chapter = await storage.unlockChapter(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      if (req.user?.role !== "super_admin" && chapter.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chapters/:id/lock", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const chapter = await storage.lockChapter(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      if (req.user?.role !== "super_admin" && chapter.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chapters/:id/deadline", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const { deadline } = req.body;
      const chapter = await storage.setChapterDeadline(req.params.id, new Date(deadline));
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      if (req.user?.role !== "super_admin" && chapter.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chapters/:id/reveal", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const chapter = await storage.revealChapterScores(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      if (req.user?.role !== "super_admin" && chapter.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Practice routes - protected with auth and tenant isolation
  app.post("/api/practice/start", requireAuth, requireTenant, async (req, res) => {
    try {
      const { subject, chapter } = req.body;
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const studentId = req.user!.id;
      
      const result = await storage.startPracticeSession(tenantId, studentId, subject, chapter);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/practice/submit", requireAuth, requireTenant, async (req, res) => {
    try {
      const { answers, questionIds } = req.body;
      // Validate all questions belong to user's tenant
      if (req.user?.role !== "super_admin" && Array.isArray(questionIds)) {
        for (const qId of questionIds) {
          const q = await storage.getQuestion(qId);
          if (q && q.tenantId !== req.tenantId) {
            return res.status(403).json({ error: "Access denied to question" });
          }
        }
      }
      const result = await storage.submitPractice(answers, questionIds);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock exam routes - protected with auth and tenant isolation
  app.get("/api/mock/available", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const tests = await storage.getAvailableMockTests(tenantId);
      res.json(tests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mock/start", requireAuth, requireTenant, async (req, res) => {
    try {
      const { testId } = req.body;
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const studentId = req.user!.id;
      
      const result = await storage.startExam(tenantId, testId, studentId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mock/submit", requireAuth, requireTenant, async (req, res) => {
    try {
      const { testId, answers } = req.body;
      const studentId = req.user!.id;
      const attempts = await storage.getAttemptsByStudent(studentId);
      const attempt = attempts.find(a => a.testId === testId && a.status === "in_progress");
      
      if (!attempt) {
        return res.status(404).json({ error: "No active attempt found" });
      }

      if (attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const result = await storage.submitExam(attempt.id, answers);
      
      // Create exam_submitted notification
      try {
        const test = await storage.getTest(attempt.testId);
        await storage.createStudentNotification({
          tenantId: attempt.tenantId,
          studentId: attempt.studentId,
          type: "exam_submitted",
          title: "Exam Submitted",
          message: `Your ${test?.title || "exam"} has been submitted. Score: ${result.score}/${result.total} (${result.percentage.toFixed(1)}%)`,
          testId: attempt.testId,
          attemptId: attempt.id,
        });
      } catch (notifError) {
        console.error("Failed to create exam_submitted notification:", notifError);
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Student Dashboard Routes
  app.get("/api/student/tests", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const studentId = req.user!.id;
      const tests = await storage.getAvailableStudentTests(tenantId, studentId);
      res.json(tests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/student/results", requireAuth, requireTenant, async (req, res) => {
    try {
      const studentId = req.user!.id;
      const results = await storage.getStudentResultsWithDetails(studentId);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/student/notifications", requireAuth, requireTenant, async (req, res) => {
    try {
      const studentId = req.user!.id;
      const notifications = await storage.getStudentNotifications(studentId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/student/notifications/:id/read", requireAuth, requireTenant, async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/student/notifications/read-all", requireAuth, requireTenant, async (req, res) => {
    try {
      const studentId = req.user!.id;
      await storage.markAllNotificationsRead(studentId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Student Reference Materials - Grade 10/12 only
  app.get("/api/student/reference-materials", requireAuth, requireTenant, async (req, res) => {
    try {
      const user = req.user!;
      
      // Enforce grade check - ONLY Class 10 and 12 students can access
      if (user.role !== "student") {
        return res.status(403).json({ error: "Reference materials are available only for students" });
      }
      
      const studentGrade = (user as any).grade;
      if (studentGrade !== "10" && studentGrade !== "12") {
        return res.status(403).json({ error: "Reference materials are available only for Class 10 and 12" });
      }
      
      const tenantId = req.tenantId!;
      const subject = req.query.subject as string | undefined;
      
      // Get reference materials for student's school and grade only
      const materials = await storage.getStudentReferenceMaterials(tenantId, studentGrade, subject);
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRINCIPAL DASHBOARD ROUTES (read-only analytics) ============
  // Principal role check middleware
  const requirePrincipal = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || (req.user.role !== "principal" && req.user.role !== "super_admin")) {
      return res.status(403).json({ error: "Principal access required" });
    }
    next();
  };

  // School Snapshot - aggregated metrics
  app.get("/api/principal/snapshot", requireAuth, requireTenant, requirePrincipal, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const snapshot = await storage.getPrincipalSchoolSnapshot(tenantId);
      res.json(snapshot);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Grade-wise Performance
  app.get("/api/principal/grade-performance", requireAuth, requireTenant, requirePrincipal, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const performance = await storage.getPrincipalGradePerformance(tenantId);
      res.json(performance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Subject-wise Health (per grade)
  app.get("/api/principal/subject-health", requireAuth, requireTenant, requirePrincipal, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const grade = req.query.grade as string | undefined;
      const health = await storage.getPrincipalSubjectHealth(tenantId, grade);
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // At-Risk Students
  app.get("/api/principal/at-risk-students", requireAuth, requireTenant, requirePrincipal, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const students = await storage.getPrincipalAtRiskStudents(tenantId);
      res.json(students);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Risk Alerts (tab switches, absences, sudden drops)
  app.get("/api/principal/risk-alerts", requireAuth, requireTenant, requirePrincipal, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const alerts = await storage.getPrincipalRiskAlerts(tenantId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reports routes - protected with auth
  app.get("/api/reports", requireAuth, requireTenant, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = await storage.getReportData(userId);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/reports/pdf/:attemptId", requireAuth, requireTenant, async (req, res) => {
    try {
      const attempt = await storage.getAttempt(req.params.attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      if (req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (req.user?.role === "student" && attempt.studentId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const test = await storage.getTest(attempt.testId);
      const student = await storage.getUser(attempt.studentId);
      const questions = await storage.getQuestionsByIds(attempt.assignedQuestionIds || []);

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=report-${req.params.attemptId}.pdf`);
      doc.pipe(res);

      doc.fontSize(24).font("Helvetica-Bold").text("Question Bank", { align: "center" });
      doc.fontSize(18).text("Exam Report", { align: "center" });
      doc.moveDown(2);

      doc.fontSize(12).font("Helvetica");
      doc.text(`Student: ${student?.name || "Unknown"}`);
      doc.text(`Test: ${test?.title || "Unknown"}`);
      doc.text(`Subject: ${test?.subject || "Unknown"}`);
      doc.text(`Date: ${attempt.submittedAt?.toLocaleDateString() || "N/A"}`);
      doc.moveDown();

      doc.fontSize(16).font("Helvetica-Bold").text("Results Summary");
      doc.fontSize(12).font("Helvetica");
      doc.text(`Score: ${attempt.score || 0} / ${attempt.totalMarks || 0}`);
      doc.text(`Percentage: ${Number(attempt.percentage || 0).toFixed(1)}%`);
      doc.moveDown(2);

      doc.fontSize(16).font("Helvetica-Bold").text("Question Details");
      doc.moveDown();

      let qNum = 1;
      for (const q of questions) {
        const userAnswer = attempt.answers?.[q.id] || "Not answered";
        const isCorrect = userAnswer.toLowerCase().trim() === (q.correctAnswer || "").toLowerCase().trim();

        doc.fontSize(11).font("Helvetica-Bold");
        doc.text(`Q${qNum}. ${q.content}`);
        doc.fontSize(10).font("Helvetica");
        doc.text(`Your Answer: ${userAnswer}`);
        doc.text(`Correct Answer: ${q.correctAnswer || "N/A"}`);
        doc.text(`Status: ${isCorrect ? "Correct" : "Incorrect"}`);
        doc.moveDown();
        qNum++;

        if (doc.y > 700) {
          doc.addPage();
        }
      }

      doc.moveDown(2);
      doc.fontSize(10).text("Powered by SmartGenEduX 2025", { align: "center" });

      doc.end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Notifications - protected
  app.post("/api/notifications/send", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      res.json({ success: true, message: "Notification sent" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tests routes - protected with auth and tenant isolation
  app.get("/api/tests", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const tests = await storage.getTestsByTenant(tenantId);
      res.json(tests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/generate", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const test = await storage.createTest({
        ...req.body,
        tenantId,
      });
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/activate", requireAuth, requireTenant, requireRole("hod", "exam_committee", "admin", "super_admin"), requireActivatableState(), async (req, res) => {
    try {
      const existing = (req as any).test;
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const previousState = existing.workflowState;
      const test = await storage.activateTest(req.params.id);
      await storage.updateTest(req.params.id, { workflowState: "active" });
      await logStateChange(
        req.params.id,
        existing.tenantId,
        previousState,
        "active",
        req.user!.id,
        req.user!.role as UserRole,
        "Test activated"
      );
      
      // Create notifications for all students in the tenant with matching grade
      try {
        const students = await storage.getUsersByTenant(existing.tenantId);
        const targetStudents = students.filter(
          u => u.role === "student" && (!existing.grade || u.grade === existing.grade)
        );
        for (const student of targetStudents) {
          await storage.createStudentNotification({
            tenantId: existing.tenantId,
            studentId: student.id,
            type: "test_unlocked",
            title: "New Test Available",
            message: `${existing.title} (${existing.type}) is now available for you to attempt.`,
            testId: req.params.id,
          });
        }
      } catch (notifError) {
        console.error("Failed to create test_unlocked notifications:", notifError);
      }
      
      res.json({ ...test, workflowState: "active" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/reveal-results", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const test = await storage.revealTestResults(req.params.id);
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Exam Engine Routes - protected with auth, tenant isolation, and state checks
  app.post("/api/exam/start", requireAuth, requireTenant, requireAttemptAllowedState(), async (req, res) => {
    try {
      const { testId } = req.body;
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const studentId = req.user!.id;
      const result = await storage.startExam(tenantId, testId, studentId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/exam/save-state", requireAuth, requireTenant, async (req, res) => {
    try {
      const { attemptId, answers, questionStatuses, markedForReview, timeRemaining } = req.body;
      const attempt = await storage.getAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      if (req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (attempt.studentId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await storage.saveExamState(attemptId, answers, questionStatuses, markedForReview, timeRemaining);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/exam/submit", requireAuth, requireTenant, async (req, res) => {
    try {
      const { attemptId, answers } = req.body;
      const attempt = await storage.getAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      if (req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (attempt.studentId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await storage.submitExam(attemptId, answers);
      
      // Create exam_submitted notification
      try {
        const test = await storage.getTest(attempt.testId);
        await storage.createStudentNotification({
          tenantId: attempt.tenantId,
          studentId: attempt.studentId,
          type: "exam_submitted",
          title: "Exam Submitted",
          message: `Your ${test?.title || "exam"} has been submitted. Score: ${result.score}/${result.total} (${result.percentage.toFixed(1)}%)`,
          testId: attempt.testId,
          attemptId: attemptId,
        });
      } catch (notifError) {
        console.error("Failed to create exam_submitted notification:", notifError);
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/exam/attempt/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const attempt = await storage.getAttempt(req.params.id);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      if (req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(attempt);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/exam/active/:testId/:studentId", requireAuth, requireTenant, async (req, res) => {
    try {
      if (req.user!.id !== req.params.studentId && !["teacher", "hod", "admin", "super_admin"].includes(req.user!.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const attempt = await storage.getActiveAttempt(req.params.testId, req.params.studentId);
      if (attempt && req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(attempt || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Exam Config Routes - protected with auth and tenant isolation
  app.get("/api/config", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const config = await storage.getAllConfig(tenantId);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/config", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { key, value } = req.body;
      await storage.setConfig(tenantId, key, value);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manual Marking Routes - protected with auth and tenant isolation
  app.post("/api/marking/question", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const { attemptId, questionId, score } = req.body;
      const attempt = await storage.getAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      if (req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await storage.markQuestion(attemptId, questionId, score);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/marking/finalize", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const { attemptId, remarks } = req.body;
      const attempt = await storage.getAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      if (req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await storage.finalizeMarking(attemptId, remarks);
      
      // Create result_published notification
      if (result) {
        try {
          const test = await storage.getTest(result.testId);
          await storage.createStudentNotification({
            tenantId: result.tenantId,
            studentId: result.studentId,
            type: "result_published",
            title: "Result Published",
            message: `Your result for ${test?.title || "exam"} is now available. Final Score: ${result.score}/${result.totalMarks}`,
            testId: result.testId,
            attemptId: attemptId,
          });
        } catch (notifError) {
          console.error("Failed to create result_published notification:", notifError);
        }
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get attempts for marking - protected with auth and tenant isolation
  app.get("/api/attempts/pending-marking", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const tests = await storage.getTestsByTenant(tenantId);
      const pendingAttempts = [];
      
      for (const test of tests) {
        const attempts = await storage.getAttemptsByTest(test.id);
        const pending = attempts.filter(a => a.status === "submitted");
        pendingAttempts.push(...pending.map(a => ({ ...a, testTitle: test.title, subject: test.subject })));
      }
      
      res.json(pendingAttempts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Analytics Routes - protected with auth and tenant isolation
  app.get("/api/analytics", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const timeRange = req.query.timeRange as string || "all";
      
      let daysBack = 0;
      switch (timeRange) {
        case "7d": daysBack = 7; break;
        case "30d": daysBack = 30; break;
        case "90d": daysBack = 90; break;
        default: daysBack = 0;
      }
      
      const analytics = await storage.getAnalytics(tenantId, daysBack);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CSV Export - protected with auth and tenant isolation
  app.get("/api/export/results/:testId", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const test = await storage.getTest(req.params.testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && test.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const attempts = await storage.getAttemptsByTest(req.params.testId);
      const rows = ["Student ID,Student Name,Score,Total,Percentage,Status,Submitted At"];
      
      for (const attempt of attempts) {
        const user = await storage.getUser(attempt.studentId);
        rows.push([
          attempt.studentId,
          user?.name || "Unknown",
          attempt.score || 0,
          attempt.totalMarks || 0,
          attempt.percentage || 0,
          attempt.status,
          attempt.submittedAt?.toISOString() || ""
        ].join(","));
      }
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${test.title.replace(/\s+/g, "_")}_results.csv`);
      res.send(rows.join("\n"));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/export/questions", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const questions = await storage.getQuestionsByTenant(tenantId);
      
      const rows = ["ID,Subject,Chapter,Topic,Type,Content,Correct Answer,Marks,Difficulty"];
      for (const q of questions) {
        rows.push([
          q.id,
          q.subject,
          q.chapter,
          q.topic || "",
          q.type,
          `"${q.content.replace(/"/g, '""')}"`,
          q.correctAnswer || "",
          q.marks || 1,
          q.difficulty || "medium"
        ].join(","));
      }
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=questions.csv");
      res.send(rows.join("\n"));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Uploads tracking - protected with auth and tenant isolation
  app.get("/api/uploads", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const uploads = await storage.getUploadsByTenant(tenantId);
      res.json(uploads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/uploads/:id", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const upload = await storage.getUpload(req.params.id);
      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }
      if (req.user?.role !== "super_admin" && upload.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteUpload(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk question creation - protected with auth and tenant isolation
  app.post("/api/questions/bulk", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const { questions, uploadId } = req.body;
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      
      const questionsWithTenant = questions.map((q: any) => ({
        ...q,
        tenantId,
        uploadId: uploadId || null,
      }));
      
      const created = await storage.createQuestions(questionsWithTenant);
      res.json({ success: true, count: created.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Passages - protected with auth and tenant isolation
  app.get("/api/passages", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const passages = await storage.getPassagesByTenant(tenantId);
      res.json(passages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/passages", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const passage = await storage.createPassage({
        ...req.body,
        tenantId,
      });
      res.json(passage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/passages/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const passage = await storage.getPassage(req.params.id);
      if (!passage) {
        return res.status(404).json({ error: "Passage not found" });
      }
      if (req.user?.role !== "super_admin" && passage.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(passage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get questions for a specific test (with passage info) - protected
  app.get("/api/exam/questions/:attemptId", requireAuth, requireTenant, async (req, res) => {
    try {
      const attempt = await storage.getAttempt(req.params.attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      if (req.user?.role !== "super_admin" && attempt.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const questions = await storage.getQuestionsByIds(attempt.assignedQuestionIds || []);
      
      // Add passage content if needed
      const questionsWithPassages = await Promise.all(questions.map(async (q) => {
        if (q.passageId) {
          const passage = await storage.getPassage(q.passageId);
          return { ...q, passageText: passage?.content || null };
        }
        return { ...q, passageText: null };
      }));
      
      res.json(questionsWithPassages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Grades - protected
  app.get("/api/grades/student/:studentId", requireAuth, requireTenant, async (req, res) => {
    try {
      if (req.user!.id !== req.params.studentId && !["teacher", "hod", "admin", "super_admin", "parent"].includes(req.user!.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const grades = await storage.getGradesByStudent(req.params.studentId);
      res.json(grades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/grades/test/:testId", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const test = await storage.getTest(req.params.testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && test.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const grades = await storage.getGradesByTest(req.params.testId);
      res.json(grades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Word (.docx) upload for bulk question import - protected with auth and tenant isolation
  app.post("/api/upload/word", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), upload.single("file"), async (req: Request, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const subject = req.body.subject || "General";
      const chapter = req.body.chapter || "";
      const grade = req.body.grade || "10";

      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = result.value;

      const questions = parseQuestionsFromText(text, subject, chapter, grade, tenantId);

      if (questions.length === 0) {
        return res.status(400).json({ error: "No questions found in document" });
      }

      const uploadRecord = await storage.createUpload({
        tenantId,
        filename: req.file.originalname || "upload.docx",
        source: "word",
        subject,
        grade,
        questionCount: questions.length,
        uploadedBy: req.body.uploadedBy || null,
      });

      const questionsWithUpload = questions.map(q => ({
        ...q,
        uploadId: uploadRecord.id,
      }));

      const created = await storage.createQuestions(questionsWithUpload);

      res.json({
        success: true,
        uploadId: uploadRecord.id,
        questionsCreated: created.length,
        questions: created,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Teacher Question Upload Endpoints ============

  // Teacher Word Upload - Preview (parse but don't save)
  app.post("/api/teacher/upload/word/preview", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), upload.single("file"), async (req: Request, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const subject = req.body.subject || "";
      const chapter = req.body.chapter || "";
      const grade = req.body.grade || "";

      if (!subject || !grade) {
        return res.status(400).json({ error: "Subject and grade are required" });
      }

      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "Document appears to be empty or contains only images/formatting" });
      }

      const parseResult = parseQuestionsFromTextWithPreview(text, subject, chapter, grade, tenantId);

      res.json({
        success: true,
        preview: {
          questions: parseResult.questions.map((q, idx) => ({
            index: idx + 1,
            type: q.type,
            content: q.content.substring(0, 200) + (q.content.length > 200 ? "..." : ""),
            options: q.options,
            correctAnswer: q.correctAnswer,
            marks: q.marks,
            difficulty: q.difficulty,
          })),
          totalParsed: parseResult.questions.length,
          skippedContent: parseResult.skippedContent,
          warnings: parseResult.warnings,
        },
        metadata: {
          subject,
          chapter,
          grade,
          filename: req.file.originalname,
        },
        rawQuestions: parseResult.questions,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Teacher Word Upload - Confirm and save
  app.post("/api/teacher/upload/word/confirm", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req: Request, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const user = req.user as AuthUser;

      const { questions, metadata } = req.body;

      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "No questions to save" });
      }

      if (!metadata?.subject || !metadata?.grade) {
        return res.status(400).json({ error: "Metadata with subject and grade required" });
      }

      const validQuestions: any[] = [];
      const validationErrors: string[] = [];

      questions.forEach((q: any, idx: number) => {
        if (!q.content || q.content.length < 10) {
          validationErrors.push(`Question ${idx + 1}: Content too short`);
          return;
        }
        if (q.type === "mcq") {
          if (!q.options || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
            validationErrors.push(`Question ${idx + 1}: MCQ requires 2-6 options`);
            return;
          }
          if (!q.correctAnswer) {
            validationErrors.push(`Question ${idx + 1}: MCQ requires correct answer`);
            return;
          }
        }
        if ((q.type === "assertion_reason") && !q.correctAnswer) {
          validationErrors.push(`Question ${idx + 1}: Assertion-Reason requires correct answer`);
          return;
        }
        validQuestions.push(q);
      });

      if (validQuestions.length === 0) {
        return res.status(400).json({ 
          error: "No valid questions to save", 
          validationErrors 
        });
      }

      const uploadRecord = await storage.createUpload({
        tenantId,
        filename: metadata.filename || "word_upload.docx",
        source: "word",
        subject: metadata.subject,
        grade: metadata.grade,
        questionCount: questions.length,
        uploadedBy: user.id,
      });

      const questionsToSave = validQuestions.map((q: any) => ({
        ...q,
        tenantId,
        uploadId: uploadRecord.id,
        status: "pending_approval",
        createdBy: user.id,
      }));

      const created = await storage.createQuestions(questionsToSave);

      res.json({
        success: true,
        uploadId: uploadRecord.id,
        questionsCreated: created.length,
        skippedCount: questions.length - validQuestions.length,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
        message: `${created.length} questions submitted for HOD approval`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Teacher Manual Question Entry
  app.post("/api/teacher/questions", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req: Request, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const user = req.user as AuthUser;

      const { content, type, subject, chapter, grade, options, correctAnswer, marks, difficulty, imageUrl, passageId } = req.body;

      if (!content || content.length < 10) {
        return res.status(400).json({ error: "Question content is required (minimum 10 characters)" });
      }
      if (!type) {
        return res.status(400).json({ error: "Question type is required" });
      }
      if (!subject) {
        return res.status(400).json({ error: "Subject is required" });
      }
      if (!grade) {
        return res.status(400).json({ error: "Grade is required" });
      }
      if (!marks || marks < 1 || marks > 10) {
        return res.status(400).json({ error: "Marks must be between 1 and 10" });
      }
      if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
        return res.status(400).json({ error: "Difficulty must be easy, medium, or hard" });
      }

      if (type === "mcq" || type === "assertion_reason") {
        if (!correctAnswer) {
          return res.status(400).json({ error: "Correct answer is required for MCQ/Assertion-Reason questions" });
        }
      }

      if (type === "mcq") {
        if (!options || !Array.isArray(options) || options.length < 2 || options.length > 6) {
          return res.status(400).json({ error: "MCQ requires 2-6 options" });
        }
        if (options.some((o: string) => !o || o.trim().length === 0)) {
          return res.status(400).json({ error: "All MCQ options must be non-empty" });
        }
      }

      const questionData = {
        tenantId,
        content,
        type,
        subject,
        chapter: chapter || null,
        grade,
        topic: null,
        options: type === "mcq" ? options : null,
        correctAnswer: correctAnswer || null,
        marks: marks || 1,
        difficulty: difficulty || "medium",
        pool: "assessment",
        status: "pending_approval",
        imageUrl: imageUrl || null,
        passageId: passageId || null,
        uploadId: null,
        createdBy: user.id,
      };

      const created = await storage.createQuestion(questionData);

      res.json({
        success: true,
        question: created,
        message: "Question submitted for HOD approval",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Teacher - Get my submitted questions
  app.get("/api/teacher/questions", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req: Request, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const user = req.user as AuthUser;

      const allQuestions = await storage.getQuestionsByTenant(tenantId);
      
      const myQuestions = allQuestions.filter((q: any) => 
        q.createdBy === user.id
      );

      const sortedQuestions = myQuestions.sort((a: any, b: any) => {
        const statusOrder: Record<string, number> = { pending_approval: 0, active: 1, rejected: 2 };
        return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
      });

      res.json(sortedQuestions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Teacher - Upload image for question (S3)
  app.post("/api/teacher/upload/image", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), upload.single("image"), async (req: Request, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const user = req.user as AuthUser;

      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Only JPG, PNG, GIF, and WebP images are allowed" });
      }

      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: "Image size must be less than 5MB" });
      }

      if (!isS3Configured()) {
        return res.status(503).json({ error: "Image upload service not configured. Please contact administrator." });
      }

      const filename = `question-images/${Date.now()}-${req.file.originalname}`;
      const uploadResult = await uploadExamFile(
        tenantId,
        "question-upload",
        filename,
        req.file.buffer,
        req.file.mimetype,
        user.role as any,
        tenantId
      );

      if ("error" in uploadResult) {
        return res.status(500).json({ error: uploadResult.error });
      }

      res.json({
        success: true,
        imageUrl: uploadResult.key,
        message: "Image uploaded successfully",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Sheets / CSV import endpoint - protected with auth and tenant isolation
  app.post("/api/upload/csv", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const subject = req.body.subject || "General";
      const chapter = req.body.chapter || "";
      const grade = req.body.grade || "10";

      const csvContent = req.file.buffer.toString("utf-8");
      const questions = parseCSVQuestions(csvContent, subject, chapter, grade, tenantId);

      if (questions.length === 0) {
        return res.status(400).json({ error: "No valid questions found in CSV" });
      }

      const uploadRecord = await storage.createUpload({
        tenantId,
        filename: req.file.originalname || "upload.csv",
        source: "google_sheets",
        subject,
        grade,
        questionCount: questions.length,
        uploadedBy: req.body.uploadedBy || null,
      });

      const questionsWithUpload = questions.map(q => ({
        ...q,
        uploadId: uploadRecord.id,
      }));

      const created = await storage.createQuestions(questionsWithUpload);

      res.json({
        success: true,
        uploadId: uploadRecord.id,
        questionsCreated: created.length,
        questions: created,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Sheets URL import (public sheets only) - protected with auth and tenant isolation
  app.post("/api/upload/sheets", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { sheetUrl, subject = "General", chapter = "", grade = "10" } = req.body;

      if (!sheetUrl) {
        return res.status(400).json({ error: "Sheet URL is required" });
      }

      // Extract sheet ID from URL
      const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch) {
        return res.status(400).json({ error: "Invalid Google Sheets URL" });
      }

      const sheetId = sheetIdMatch[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

      // Fetch the CSV content
      const response = await fetch(csvUrl);
      if (!response.ok) {
        return res.status(400).json({ error: "Could not fetch sheet. Make sure it's publicly accessible." });
      }

      const csvContent = await response.text();
      const questions = parseCSVQuestions(csvContent, subject, chapter, grade, tenantId);

      if (questions.length === 0) {
        return res.status(400).json({ error: "No valid questions found in sheet" });
      }

      const uploadRecord = await storage.createUpload({
        tenantId,
        filename: `sheets-${sheetId}.csv`,
        source: "google_sheets",
        subject,
        grade,
        questionCount: questions.length,
        uploadedBy: req.body.uploadedBy || null,
      });

      const questionsWithUpload = questions.map(q => ({
        ...q,
        uploadId: uploadRecord.id,
      }));

      const created = await storage.createQuestions(questionsWithUpload);

      res.json({
        success: true,
        uploadId: uploadRecord.id,
        questionsCreated: created.length,
        questions: created,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Template download for bulk question upload
  app.get("/api/upload/template", requireAuth, requireTenant, async (req, res) => {
    try {
      const format = req.query.format as string || "csv";
      
      const headers = [
        "Question",
        "Option A",
        "Option B", 
        "Option C",
        "Option D",
        "Answer",
        "Type",
        "Difficulty",
        "Marks",
        "Topic",
        "Chapter",
        "Subject"
      ];
      
      const exampleRows = [
        ["What is 2+2?", "3", "4", "5", "6", "B", "mcq", "easy", "1", "Addition", "Arithmetic", "Mathematics"],
        ["The sun rises in the east.", "", "", "", "", "True", "true_false", "easy", "1", "Solar System", "Space", "Science"],
        ["Capital of France is ___", "", "", "", "", "Paris", "fill_blank", "medium", "2", "Capitals", "Europe", "Geography"],
      ];
      
      if (format === "csv") {
        const csvContent = [headers.join(","), ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=question_upload_template.csv");
        res.send(csvContent);
      } else {
        res.json({
          headers,
          exampleRows,
          instructions: {
            Question: "Required. The question content/text.",
            "Option A-D": "For MCQ questions. Leave empty for other question types.",
            Answer: "Required. For MCQ use A/B/C/D, for true_false use True/False, for fill_blank the exact answer.",
            Type: "mcq, true_false, fill_blank, numerical, short_answer, long_answer, matching, assertion_reason",
            Difficulty: "easy, medium, hard",
            Marks: "Number of marks for the question (default: 1)",
            Topic: "Optional. Topic within the chapter.",
            Chapter: "Optional. Chapter name.",
            Subject: "Optional. Subject name (can be set during upload).",
          },
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate bulk upload without saving
  app.post("/api/upload/validate", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      
      const subject = req.body.subject || "General";
      const chapter = req.body.chapter || "";
      const grade = req.body.grade || "10";
      
      let questions: any[] = [];
      const filename = req.file.originalname?.toLowerCase() || "";
      
      if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
        // Handle Excel files
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        questions = parseCSVQuestions(csvContent, subject, chapter, grade, tenantId);
      } else {
        // Handle CSV files
        const csvContent = req.file.buffer.toString("utf-8");
        questions = parseCSVQuestions(csvContent, subject, chapter, grade, tenantId);
      }
      
      const validationErrors: { row: number; field: string; message: string }[] = [];
      const validQuestions: any[] = [];
      
      const VALID_TYPES = ["mcq", "true_false", "fill_blank", "numerical", "short_answer", "long_answer", "matching", "assertion_reason"];
      const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
      
      questions.forEach((q, idx) => {
        const rowNum = idx + 2;
        const errors: string[] = [];
        
        if (!q.content || q.content.trim().length < 5) {
          validationErrors.push({ row: rowNum, field: "Question", message: "Question content too short or missing" });
          errors.push("content");
        }
        
        if (!VALID_TYPES.includes(q.type)) {
          validationErrors.push({ row: rowNum, field: "Type", message: `Invalid type: ${q.type}. Must be one of: ${VALID_TYPES.join(", ")}` });
          errors.push("type");
        }
        
        if (!VALID_DIFFICULTIES.includes(q.difficulty)) {
          validationErrors.push({ row: rowNum, field: "Difficulty", message: `Invalid difficulty: ${q.difficulty}. Must be one of: ${VALID_DIFFICULTIES.join(", ")}` });
          errors.push("difficulty");
        }
        
        if (q.type === "mcq" && (!q.options || q.options.length < 2)) {
          validationErrors.push({ row: rowNum, field: "Options", message: "MCQ questions require at least 2 options" });
          errors.push("options");
        }
        
        if (q.type === "mcq" && q.correctAnswer && !["A", "B", "C", "D", "a", "b", "c", "d"].includes(q.correctAnswer)) {
          validationErrors.push({ row: rowNum, field: "Answer", message: "MCQ answer must be A, B, C, or D" });
          errors.push("answer");
        }
        
        if (!q.correctAnswer || q.correctAnswer.trim() === "") {
          validationErrors.push({ row: rowNum, field: "Answer", message: "Answer is required" });
          errors.push("answer");
        }
        
        if (errors.length === 0) {
          validQuestions.push(q);
        }
      });
      
      res.json({
        totalRows: questions.length,
        validQuestions: validQuestions.length,
        invalidQuestions: questions.length - validQuestions.length,
        errors: validationErrors,
        preview: validQuestions.slice(0, 5).map(q => ({
          content: q.content.substring(0, 80) + (q.content.length > 80 ? "..." : ""),
          type: q.type,
          difficulty: q.difficulty,
          marks: q.marks,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Register additional route modules
  registerBlueprintRoutes(app);
  registerActivityLogRoutes(app);
  registerWorkflowRoutes(app);
  registerPaperGenerationRoutes(app);

  // =====================================================
  // PARSER SERVICE PROXY - Routes to Python FastAPI service
  // =====================================================
  app.all("/api/parser/*", async (req, res) => {
    try {
      const parserUrl = `http://localhost:8002${req.originalUrl}`;
      
      // For multipart form data, we need to forward the raw request
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        const FormData = (await import('form-data')).default;
        const fetch = (await import('node-fetch')).default;
        
        // Collect all form data from the request
        const formData = new FormData();
        
        // Parse multipart data using multer middleware already applied or raw body
        // Since this is a proxy, we forward raw body
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const rawBody = Buffer.concat(chunks);
            
            // Forward the raw request to parser service
            const proxyRes = await fetch(parserUrl, {
              method: req.method,
              headers: {
                'content-type': req.headers['content-type'] || '',
                'content-length': rawBody.length.toString(),
              },
              body: rawBody,
            });
            
            const contentType = proxyRes.headers.get('content-type');
            if (contentType) {
              res.setHeader('Content-Type', contentType);
            }
            res.status(proxyRes.status);
            
            const data = await proxyRes.json();
            res.json(data);
          } catch (err: any) {
            res.status(500).json({ error: `Parser proxy error: ${err.message}` });
          }
        });
      } else {
        // For non-multipart requests (GET, JSON POST)
        const fetch = (await import('node-fetch')).default;
        const proxyRes = await fetch(parserUrl, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });
        
        const contentType = proxyRes.headers.get('content-type');
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
        res.status(proxyRes.status);
        
        const data = await proxyRes.json();
        res.json(data);
      }
    } catch (error: any) {
      res.status(500).json({ error: `Parser service error: ${error.message}` });
    }
  });

  return httpServer;
}

interface ParsedQuestionResult {
  questions: any[];
  skippedContent: { lineNumber: number; content: string; reason: string }[];
  warnings: string[];
}

function parseQuestionsFromTextWithPreview(
  text: string, 
  subject: string, 
  chapter: string, 
  grade: string, 
  tenantId: string
): ParsedQuestionResult {
  const questions: any[] = [];
  const skippedContent: { lineNumber: number; content: string; reason: string }[] = [];
  const warnings: string[] = [];
  const lines = text.split("\n").map(l => l.trim());
  const nonEmptyLines = lines.map((l, i) => ({ line: l, originalIndex: i + 1 })).filter(l => l.line);

  let currentQuestion: any = null;
  let currentQuestionStartLine = 0;
  let options: string[] = [];
  let assertionText: string | null = null;
  let reasonText: string | null = null;
  let hasMarks = false;

  const skipPatterns = [
    { pattern: /\[image\]/i, reason: "Contains image reference" },
    { pattern: /\[diagram\]/i, reason: "Contains diagram reference" },
    { pattern: /\[figure\]/i, reason: "Contains figure reference" },
    { pattern: /\[map\]/i, reason: "Contains map reference" },
    { pattern: /\[chart\]/i, reason: "Contains chart reference" },
    { pattern: /\[graph\]/i, reason: "Contains graph reference" },
    { pattern: /^passage\s*:/i, reason: "Passage content (use manual entry)" },
    { pattern: /^poem\s*:/i, reason: "Poem content (use manual entry)" },
    { pattern: /^comprehension\s*:/i, reason: "Comprehension content (use manual entry)" },
    { pattern: /^read the (following )?passage/i, reason: "Passage-based question (use manual entry)" },
    { pattern: /^read the (following )?poem/i, reason: "Poem-based question (use manual entry)" },
  ];

  function finalizeQuestion() {
    if (!currentQuestion || !currentQuestion.content) return;
    
    if (currentQuestion.content.length < 10) {
      skippedContent.push({
        lineNumber: currentQuestionStartLine,
        content: currentQuestion.content,
        reason: "Question text too short (minimum 10 characters)"
      });
      return;
    }

    if (assertionText && reasonText) {
      currentQuestion.type = "assertion_reason";
      currentQuestion.content = `Assertion: ${assertionText}\nReason: ${reasonText}`;
      if (!currentQuestion.correctAnswer) {
        warnings.push(`Q at line ${currentQuestionStartLine}: Assertion-Reason question missing Answer`);
      }
    } else if (options.length >= 2) {
      currentQuestion.type = "mcq";
      currentQuestion.options = options;
      if (!currentQuestion.correctAnswer) {
        warnings.push(`Q at line ${currentQuestionStartLine}: MCQ missing Answer`);
      }
    } else {
      const marks = currentQuestion.marks || 1;
      if (marks >= 4) {
        currentQuestion.type = "long_answer";
      } else if (marks >= 2) {
        currentQuestion.type = "short_answer";
      } else {
        currentQuestion.type = "short_answer";
        if (!hasMarks) {
          warnings.push(`Q at line ${currentQuestionStartLine}: Non-MCQ question missing Marks (defaulting to 1 mark short answer)`);
        }
      }
    }

    questions.push(currentQuestion);
  }

  for (let i = 0; i < nonEmptyLines.length; i++) {
    const { line, originalIndex } = nonEmptyLines[i];

    const skipMatch = skipPatterns.find(p => p.pattern.test(line));
    if (skipMatch) {
      if (currentQuestion) {
        finalizeQuestion();
        currentQuestion = null;
        options = [];
        assertionText = null;
        reasonText = null;
        hasMarks = false;
      }
      skippedContent.push({
        lineNumber: originalIndex,
        content: line.substring(0, 100) + (line.length > 100 ? "..." : ""),
        reason: skipMatch.reason
      });
      continue;
    }

    const qMatch = line.match(/^(?:Q\d+[\.\):\s]|Question\s*\d*[\.\):\s]|\d+[\.\)]\s)/i);
    if (qMatch) {
      finalizeQuestion();

      currentQuestion = {
        tenantId,
        subject,
        chapter,
        grade,
        topic: null,
        content: line.replace(qMatch[0], "").trim(),
        type: "short_answer",
        options: null,
        correctAnswer: null,
        difficulty: "medium",
        marks: 1,
        pool: "assessment",
        status: "pending_approval",
        imageUrl: null,
        passageId: null,
        uploadId: null,
      };
      currentQuestionStartLine = originalIndex;
      options = [];
      assertionText = null;
      reasonText = null;
      hasMarks = false;
      continue;
    }

    const assertionMatch = line.match(/^assertion\s*[:]\s*(.+)/i);
    if (assertionMatch && currentQuestion) {
      assertionText = assertionMatch[1].trim();
      continue;
    }

    const reasonMatch = line.match(/^reason\s*[:]\s*(.+)/i);
    if (reasonMatch && currentQuestion) {
      reasonText = reasonMatch[1].trim();
      continue;
    }

    const optMatch = line.match(/^(?:[A-D][\.\):\s]|[a-d][\.\):\s])/i);
    if (optMatch && currentQuestion) {
      options.push(line.replace(optMatch[0], "").trim());
      continue;
    }

    const ansMatch = line.match(/^(?:Answer|Ans|Correct Answer)\s*[:]\s*(.+)/i);
    if (ansMatch && currentQuestion) {
      currentQuestion.correctAnswer = ansMatch[1].trim();
      continue;
    }

    const marksMatch = line.match(/^(?:Marks|Points)\s*[:]\s*(\d+)/i);
    if (marksMatch && currentQuestion) {
      const marksValue = parseInt(marksMatch[1], 10);
      if (marksValue >= 1 && marksValue <= 10) {
        currentQuestion.marks = marksValue;
        hasMarks = true;
      }
      continue;
    }

    const difficultyMatch = line.match(/^difficulty\s*[:]\s*(easy|medium|hard)/i);
    if (difficultyMatch && currentQuestion) {
      currentQuestion.difficulty = difficultyMatch[1].toLowerCase();
      continue;
    }

    if (currentQuestion) {
      currentQuestion.content += " " + line;
    }
  }

  finalizeQuestion();

  return { questions, skippedContent, warnings };
}

function parseQuestionsFromText(text: string, subject: string, chapter: string, grade: string, tenantId: string): any[] {
  const result = parseQuestionsFromTextWithPreview(text, subject, chapter, grade, tenantId);
  return result.questions;
}

function parseCSVQuestions(csvContent: string, subject: string, chapter: string, grade: string, tenantId: string): any[] {
  const questions: any[] = [];
  
  // Parse CSV properly handling multi-line quoted fields
  const rows = parseCSVContent(csvContent);
  
  if (rows.length < 2) {
    return questions;
  }

  // Parse header row to identify columns
  const headers = rows[0].map(h => h.toLowerCase().trim());
  
  const colMap = {
    question: headers.findIndex(h => h.includes("question") || h.includes("content")),
    optionA: headers.findIndex(h => h === "a" || h.includes("option a") || h.includes("option_a")),
    optionB: headers.findIndex(h => h === "b" || h.includes("option b") || h.includes("option_b")),
    optionC: headers.findIndex(h => h === "c" || h.includes("option c") || h.includes("option_c")),
    optionD: headers.findIndex(h => h === "d" || h.includes("option d") || h.includes("option_d")),
    answer: headers.findIndex(h => h.includes("answer") || h.includes("correct")),
    type: headers.findIndex(h => h.includes("type")),
    difficulty: headers.findIndex(h => h.includes("difficulty") || h.includes("level")),
    marks: headers.findIndex(h => h.includes("mark") || h.includes("point") || h.includes("score")),
    topic: headers.findIndex(h => h.includes("topic")),
    chapter: headers.findIndex(h => h.includes("chapter")),
    subject: headers.findIndex(h => h.includes("subject")),
  };

  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every(cell => !cell.trim())) continue;

    const questionContent = colMap.question >= 0 ? row[colMap.question] : row[0];
    if (!questionContent || questionContent.trim() === "") continue;

    const options: string[] = [];
    if (colMap.optionA >= 0 && row[colMap.optionA]) options.push(row[colMap.optionA]);
    if (colMap.optionB >= 0 && row[colMap.optionB]) options.push(row[colMap.optionB]);
    if (colMap.optionC >= 0 && row[colMap.optionC]) options.push(row[colMap.optionC]);
    if (colMap.optionD >= 0 && row[colMap.optionD]) options.push(row[colMap.optionD]);

    const answer = colMap.answer >= 0 ? row[colMap.answer] : null;
    const questionType = options.length >= 2 ? "mcq" : (colMap.type >= 0 ? row[colMap.type] || "short_answer" : "short_answer");
    const difficulty = colMap.difficulty >= 0 ? row[colMap.difficulty] || "medium" : "medium";
    const marks = colMap.marks >= 0 ? parseInt(row[colMap.marks]) || 1 : 1;
    const rowTopic = colMap.topic >= 0 ? row[colMap.topic] : null;
    const rowChapter = colMap.chapter >= 0 ? row[colMap.chapter] || chapter : chapter;
    const rowSubject = colMap.subject >= 0 ? row[colMap.subject] || subject : subject;

    questions.push({
      tenantId,
      subject: rowSubject,
      chapter: rowChapter,
      grade,
      topic: rowTopic,
      content: questionContent.trim(),
      type: questionType.toLowerCase(),
      options: options.length > 0 ? options : null,
      correctAnswer: answer,
      difficulty: difficulty.toLowerCase(),
      marks,
      pool: "assessment",
      status: "active",
      imageUrl: null,
      passageId: null,
      uploadId: null,
    });
  }

  return questions;
}

// ========================
// BLUEPRINT ROUTES - protected with auth and tenant isolation
// ========================
export function registerBlueprintRoutes(app: Express) {
  app.get("/api/blueprints", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const blueprints = await storage.getBlueprintsByTenant(tenantId);
      res.json(blueprints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/blueprints/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const blueprint = await storage.getBlueprint(req.params.id);
      if (!blueprint) {
        return res.status(404).json({ error: "Blueprint not found" });
      }
      if (req.user?.role !== "super_admin" && blueprint.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(blueprint);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/blueprints", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const blueprint = await storage.createBlueprint({
        ...req.body,
        tenantId,
      });
      res.json(blueprint);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/blueprints/:id", requireAuth, requireTenant, requireRole("hod", "exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getBlueprint(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Blueprint not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const blueprint = await storage.updateBlueprint(req.params.id, req.body);
      res.json(blueprint);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/blueprints/:id/approve", requireAuth, requireTenant, requireRole("hod", "exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getBlueprint(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Blueprint not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { approvedBy } = req.body;
      const blueprint = await storage.approveBlueprint(req.params.id, approvedBy);
      res.json(blueprint);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ========================
// ACTIVITY LOG ROUTES - protected with auth and tenant isolation
// ========================
export function registerActivityLogRoutes(app: Express) {
  app.get("/api/activity-logs", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const logs = await storage.getActivityLogs(tenantId, entityType, entityId);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/activity-logs", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const log = await storage.logActivity({
        ...req.body,
        tenantId,
      });
      res.json(log);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ========================
// WORKFLOW ROUTES - protected with auth and tenant isolation
// ========================
export function registerWorkflowRoutes(app: Express) {
  app.get("/api/tests/workflow/:state", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const states = req.params.state.split(",") as any[];
      const tests = await storage.getTestsByWorkflowState(tenantId, states);
      res.json(tests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/questions/pending", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const questions = await storage.getPendingQuestions(tenantId);
      res.json(questions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/workflow", requireAuth, requireTenant, requireRole("teacher", "hod", "principal", "exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { state, userId, comments } = req.body;
      const transitionCheck = canTransitionTo(existing.workflowState, state as WorkflowState, req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const previousState = existing.workflowState;
      const test = await storage.updateTestWorkflow(req.params.id, state, userId, comments);
      await logStateChange(
        req.params.id,
        existing.tenantId,
        previousState,
        state as WorkflowState,
        req.user!.id,
        req.user!.role as UserRole,
        comments
      );
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/submit-to-hod", requireAuth, requireTenant, requireRole("teacher", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "pending_hod", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const { userId } = req.body;
      const previousState = existing.workflowState;
      const test = await storage.updateTestWorkflow(req.params.id, "pending_hod", userId, "Submitted for HOD review");
      await logStateChange(req.params.id, existing.tenantId, previousState, "pending_hod", req.user!.id, req.user!.role as UserRole, "Submitted for HOD review");
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/hod-approve", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "hod_approved", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const { userId, comments } = req.body;
      const previousState = existing.workflowState;
      const test = await storage.updateTestWorkflow(req.params.id, "hod_approved", userId, comments);
      await logStateChange(req.params.id, existing.tenantId, previousState, "hod_approved", req.user!.id, req.user!.role as UserRole, comments);
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/hod-reject", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { userId, comments } = req.body;
      if (!comments) {
        return res.status(400).json({ error: "Rejection comments are required" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "hod_rejected", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const previousState = existing.workflowState;
      const test = await storage.updateTestWorkflow(req.params.id, "hod_rejected", userId, comments);
      await logStateChange(req.params.id, existing.tenantId, previousState, "hod_rejected", req.user!.id, req.user!.role as UserRole, comments);
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/submit-to-principal", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "pending_principal", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const { userId } = req.body;
      const previousState = existing.workflowState;
      const test = await storage.updateTestWorkflow(req.params.id, "pending_principal", userId, "Submitted for Principal approval");
      await logStateChange(req.params.id, existing.tenantId, previousState, "pending_principal", req.user!.id, req.user!.role as UserRole, "Submitted for Principal approval");
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/principal-approve", requireAuth, requireTenant, requireRole("principal", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "principal_approved", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const { userId, comments } = req.body;
      const previousState = existing.workflowState;
      const test = await storage.updateTestWorkflow(req.params.id, "principal_approved", userId, comments);
      await logStateChange(req.params.id, existing.tenantId, previousState, "principal_approved", req.user!.id, req.user!.role as UserRole, comments);
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/principal-reject", requireAuth, requireTenant, requireRole("principal", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { userId, comments } = req.body;
      if (!comments) {
        return res.status(400).json({ error: "Rejection comments are required" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "principal_rejected", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const previousState = existing.workflowState;
      const test = await storage.updateTestWorkflow(req.params.id, "principal_rejected", userId, comments);
      await logStateChange(req.params.id, existing.tenantId, previousState, "principal_rejected", req.user!.id, req.user!.role as UserRole, comments);
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/send-to-committee", requireAuth, requireTenant, requireRole("hod", "principal", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "sent_to_committee", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const previousState = existing.workflowState;
      const test = await storage.sendTestToCommittee(req.params.id);
      await logStateChange(req.params.id, existing.tenantId, previousState, "sent_to_committee", req.user!.id, req.user!.role as UserRole, "Sent to examination committee");
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/lock", requireAuth, requireTenant, requireRole("exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const transitionCheck = canTransitionTo(existing.workflowState, "locked", req.user!.role as UserRole);
      if (!transitionCheck.valid) {
        return res.status(403).json({ error: transitionCheck.reason });
      }
      const previousState = existing.workflowState;
      const test = await storage.lockTest(req.params.id);
      await logStateChange(req.params.id, existing.tenantId, previousState, "locked", req.user!.id, req.user!.role as UserRole, "Test locked for printing");
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/mark-confidential", requireAuth, requireTenant, requireRole("exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const test = await storage.markTestConfidential(req.params.id);
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/printing-ready", requireAuth, requireTenant, requireRole("exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const test = await storage.markPrintingReady(req.params.id);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      res.json(test);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/hod/questions/pending", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const questions = await storage.getPendingQuestionsForReview(tenantId);
      res.json(questions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/questions/:id/hod-approve", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getQuestion(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Question not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { reviewerId, comments } = req.body;
      const question = await storage.approveQuestionByHOD(req.params.id, reviewerId, comments);
      res.json(question);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/questions/:id/hod-reject", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getQuestion(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Question not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { reviewerId, comments } = req.body;
      if (!comments) {
        return res.status(400).json({ error: "Rejection comments are required" });
      }
      const question = await storage.rejectQuestionByHOD(req.params.id, reviewerId, comments);
      res.json(question);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ========================
// QUESTION PAPER GENERATION ROUTES
// ========================
export function registerPaperGenerationRoutes(app: Express) {
  app.post("/api/tests/:id/generate-paper", requireAuth, requireTenant, requireRole("teacher", "hod", "exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getTest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Auto-apply blueprint selection if test has blueprintId and no questions yet
      if (existing.blueprintId && (!existing.questionIds || existing.questionIds.length === 0)) {
        const blueprint = await storage.getBlueprint(existing.blueprintId);
        if (blueprint && blueprint.sections) {
          const sections = blueprint.sections as { name: string; marks: number; questionCount: number; questionType: string; difficulty?: string; chapters?: string[] }[];
          const selectedQuestions = await storage.selectQuestionsForBlueprint(
            existing.tenantId,
            existing.subject,
            existing.grade,
            sections
          );
          const questionIds = selectedQuestions.map(q => q.id);
          const totalMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
          await storage.updateTest(req.params.id, { questionIds, totalMarks, questionCount: questionIds.length });
        }
      }
      
      const { format } = req.body;
      const result = await storage.generateQuestionPaper(req.params.id, format || "A4");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests/:id/select-by-blueprint", requireAuth, requireTenant, requireRole("teacher", "hod", "exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      if (req.user?.role !== "super_admin" && test.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!test.blueprintId) {
        return res.status(400).json({ error: "Test has no blueprint assigned" });
      }
      
      const blueprint = await storage.getBlueprint(test.blueprintId);
      if (!blueprint || !blueprint.sections) {
        return res.status(404).json({ error: "Blueprint not found or has no sections" });
      }
      
      const sections = blueprint.sections as { name: string; marks: number; questionCount: number; questionType: string; difficulty?: string; chapters?: string[] }[];
      const selectedQuestions = await storage.selectQuestionsForBlueprint(
        test.tenantId,
        test.subject,
        test.grade,
        sections
      );
      
      const questionIds = selectedQuestions.map(q => q.id);
      const totalMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
      
      const updatedTest = await storage.updateTest(req.params.id, {
        questionIds,
        totalMarks,
        questionCount: questionIds.length,
      });
      
      res.json({
        test: updatedTest,
        selectedQuestions: selectedQuestions.length,
        totalMarks,
        sectionBreakdown: sections.map(s => ({
          name: s.name,
          requested: s.questionCount,
          marks: s.marks,
          type: s.questionType,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function seededShuffle<T>(array: T[], seed: number): T[] {
    const result = [...array];
    let currentSeed = seed;
    const random = () => {
      currentSeed = (currentSeed * 1103515245 + 12345) % 2147483648;
      return currentSeed / 2147483648;
    };
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) + 1;
  }

  app.get("/api/tests/:id/paper-pdf", requireAuth, requireTenant, requireRole("hod", "exam_committee", "admin", "super_admin"), requireDownloadableState(), async (req, res) => {
    try {
      const test = (req as any).test;
      if (req.user?.role !== "super_admin" && test.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const setNumber = parseInt(req.query.set as string) || 1;
      const setLabel = setNumber > 1 ? ` - Set ${setNumber}` : "";
      const shuffleSeed = hashString(`${test.id}-set-${setNumber}`);
      const customLogoUrl = req.query.logoUrl as string | undefined;

      // Fetch school/tenant info for logo and name
      const tenant = await storage.getTenant(test.tenantId);
      const schoolName = tenant?.name || "Question Bank";
      const schoolLogoUrl = customLogoUrl || tenant?.logo;

      const questions = [];
      for (const qId of test.questionIds || []) {
        const q = await storage.getQuestion(qId);
        if (q) questions.push(q);
      }

      const shuffledQuestions = seededShuffle(questions, shuffleSeed);

      const passageGroups = new Map<string, { passage: any; questions: typeof questions }>();
      const standaloneQuestions: typeof questions = [];
      
      for (const q of shuffledQuestions) {
        if (q.passageId) {
          if (!passageGroups.has(q.passageId)) {
            const passage = await storage.getPassage(q.passageId);
            passageGroups.set(q.passageId, { passage, questions: [] });
          }
          passageGroups.get(q.passageId)!.questions.push(q);
        } else {
          standaloneQuestions.push(q);
        }
      }

      const doc = new PDFDocument({ size: req.query.format === "Legal" ? "LEGAL" : "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_set${setNumber}_paper.pdf"`);
      doc.pipe(res);

      // Add school logo if available
      if (schoolLogoUrl) {
        try {
          const axios = require("axios");
          const logoResponse = await axios.get(schoolLogoUrl, { responseType: "arraybuffer", timeout: 5000 });
          const logoBuffer = Buffer.from(logoResponse.data);
          doc.image(logoBuffer, doc.page.width / 2 - 40, doc.y, { width: 80, height: 80 });
          doc.moveDown(5);
        } catch (logoErr) {
          console.log("Could not load logo:", logoErr);
        }
      }

      doc.fontSize(16).font("Helvetica-Bold").text(schoolName, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(14).text(test.title + setLabel, { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(`Subject: ${test.subject} | Grade: ${test.grade} | Total Marks: ${test.totalMarks} | Duration: ${test.duration} min`, { align: "center" });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(11).text("Instructions:", { underline: true });
      doc.fontSize(10).text("1. Read all questions carefully before answering.");
      doc.text("2. Answers must be written neatly.");
      doc.text("3. No electronic devices allowed.");
      doc.moveDown();

      let questionNum = 1;
      
      for (const [passageId, group] of passageGroups) {
        if (group.passage) {
          doc.fontSize(11).font("Helvetica-Bold").text("PASSAGE:", { underline: true });
          doc.font("Helvetica-Oblique").fontSize(10).text(group.passage.content || "");
          doc.moveDown();
          doc.font("Helvetica-Bold").fontSize(10).text("Questions based on the above passage:");
          doc.moveDown(0.5);
        }
        
        for (const q of group.questions) {
          doc.fontSize(11).font("Helvetica-Bold").text(`Q${questionNum}. ${q.content}`, { continued: false });
          doc.font("Helvetica").fontSize(9).text(`[${q.marks} mark(s)] - ${q.difficulty}`, { align: "right" });
          
          if (q.type === "mcq" && q.options) {
            const opts = q.options as string[];
            opts.forEach((opt, i) => {
              doc.fontSize(10).text(`   ${String.fromCharCode(65 + i)}) ${opt}`);
            });
          }
          doc.moveDown();
          questionNum++;
        }
        doc.moveDown();
      }
      
      for (const q of standaloneQuestions) {
        doc.fontSize(11).font("Helvetica-Bold").text(`Q${questionNum}. ${q.content}`, { continued: false });
        doc.font("Helvetica").fontSize(9).text(`[${q.marks} mark(s)] - ${q.difficulty}`, { align: "right" });
        
        if (q.type === "mcq" && q.options) {
          const opts = q.options as string[];
          opts.forEach((opt, i) => {
            doc.fontSize(10).text(`   ${String.fromCharCode(65 + i)}) ${opt}`);
          });
        }
        doc.moveDown();
        questionNum++;
      }

      doc.moveDown(2);
      doc.fontSize(8).text("--- End of Question Paper ---", { align: "center" });
      doc.moveDown();
      doc.text("Powered by SmartGenEduX 2025", { align: "center" });

      doc.end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tests/:id/answer-key-pdf", requireAuth, requireTenant, requireRole("hod", "exam_committee", "admin", "super_admin"), requireDownloadableState(), async (req, res) => {
    try {
      const test = (req as any).test;
      if (req.user?.role !== "super_admin" && test.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const setNumber = parseInt(req.query.set as string) || 1;
      const setLabel = setNumber > 1 ? ` - Set ${setNumber}` : "";
      const shuffleSeed = hashString(`${test.id}-set-${setNumber}`);
      const customLogoUrl = req.query.logoUrl as string | undefined;

      // Fetch school/tenant info for logo and name
      const tenant = await storage.getTenant(test.tenantId);
      const schoolName = tenant?.name || "Question Bank";
      const schoolLogoUrl = customLogoUrl || tenant?.logo;

      const questions = [];
      for (const qId of test.questionIds || []) {
        const q = await storage.getQuestion(qId);
        if (q) questions.push(q);
      }

      const shuffledQuestions = seededShuffle(questions, shuffleSeed);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_set${setNumber}_answer_key.pdf"`);
      doc.pipe(res);

      // Add school logo if available
      if (schoolLogoUrl) {
        try {
          const axios = require("axios");
          const logoResponse = await axios.get(schoolLogoUrl, { responseType: "arraybuffer", timeout: 5000 });
          const logoBuffer = Buffer.from(logoResponse.data);
          doc.image(logoBuffer, doc.page.width / 2 - 30, doc.y, { width: 60, height: 60 });
          doc.moveDown(4);
        } catch (logoErr) {
          console.log("Could not load logo for answer key:", logoErr);
        }
      }

      doc.fontSize(16).font("Helvetica-Bold").text(`${schoolName} - ANSWER KEY`, { align: "center" });
      doc.fontSize(12).fillColor("red").text("CONFIDENTIAL", { align: "center" });
      doc.fillColor("black").moveDown(0.5);
      doc.fontSize(14).text(test.title + setLabel, { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(`Subject: ${test.subject} | Grade: ${test.grade}`, { align: "center" });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown();

      let questionNum = 1;
      for (const q of shuffledQuestions) {
        doc.fontSize(10).font("Helvetica-Bold").text(`Q${questionNum}. `, { continued: true });
        doc.font("Helvetica").text(q.content.substring(0, 80) + (q.content.length > 80 ? "..." : ""));
        doc.fontSize(11).fillColor("green").text(`   Answer: ${q.correctAnswer || "N/A"}`);
        if (q.explanation) {
          doc.fontSize(9).fillColor("gray").text(`   Explanation: ${q.explanation}`);
        }
        doc.fillColor("black").moveDown(0.5);
        questionNum++;
      }

      doc.moveDown(2);
      doc.fontSize(8).text("--- End of Answer Key ---", { align: "center" });
      doc.moveDown();
      doc.text("CONFIDENTIAL - For Examiner Use Only", { align: "center" });
      doc.text("Powered by SmartGenEduX 2025", { align: "center" });

      doc.end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ DOCX Export Routes ============
  app.get("/api/tests/:id/paper-docx", requireAuth, requireTenant, requireRole("hod", "exam_committee", "admin", "super_admin"), requireDownloadableState(), async (req, res) => {
    try {
      const test = (req as any).test;
      if (req.user?.role !== "super_admin" && test.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const setNumber = parseInt(req.query.set as string) || 1;
      const setLabel = setNumber > 1 ? ` - Set ${setNumber}` : "";
      const shuffleSeed = hashString(`${test.id}-set-${setNumber}`);

      const tenant = await storage.getTenant(test.tenantId);
      const questions = [];
      for (const qId of test.questionIds || []) {
        const q = await storage.getQuestion(qId);
        if (q) questions.push(q);
      }

      const shuffledQuestions = seededShuffle(questions, shuffleSeed);

      const passageGroups = new Map<string, { passage: any; questions: typeof questions }>();
      const standaloneQuestions: typeof questions = [];
      
      for (const q of shuffledQuestions) {
        if (q.passageId) {
          if (!passageGroups.has(q.passageId)) {
            const passage = await storage.getPassage(q.passageId);
            passageGroups.set(q.passageId, { passage, questions: [] });
          }
          passageGroups.get(q.passageId)!.questions.push(q);
        } else {
          standaloneQuestions.push(q);
        }
      }

      const schoolName = tenant?.name || "Question Bank";
      const schoolAddress = (tenant as any)?.address || "";

      const docChildren: any[] = [
        new Paragraph({
          text: schoolName,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: schoolAddress,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: test.title + setLabel,
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Subject: ${test.subject} | Grade: ${test.grade} | Total Marks: ${test.totalMarks} | Duration: ${test.duration} min`, size: 22 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Instructions:", bold: true })],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({ text: "1. Read all questions carefully before answering." }),
        new Paragraph({ text: "2. Answers must be written neatly." }),
        new Paragraph({ text: "3. No electronic devices allowed." }),
        new Paragraph({ text: "", spacing: { after: 300 } }),
      ];

      let questionNum = 1;
      
      for (const [passageId, group] of passageGroups) {
        if (group.passage) {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: "PASSAGE:", bold: true, underline: {} })],
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              children: [new TextRun({ text: group.passage.content || "", italics: true })],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "Questions based on the above passage:", bold: true })],
              spacing: { after: 100 },
            })
          );
        }
        
        for (const q of group.questions) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Q${questionNum}. ${q.content}`, bold: true }),
                new TextRun({ text: `  [${q.marks} mark(s)]`, italics: true }),
              ],
              spacing: { before: 200, after: 100 },
            })
          );

          if (q.type === "mcq" && q.options) {
            const opts = q.options as string[];
            opts.forEach((opt, i) => {
              docChildren.push(
                new Paragraph({ text: `   ${String.fromCharCode(65 + i)}) ${opt}` })
              );
            });
          }

          docChildren.push(new Paragraph({ text: "", spacing: { after: 150 } }));
          questionNum++;
        }
      }
      
      for (const q of standaloneQuestions) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Q${questionNum}. ${q.content}`, bold: true }),
              new TextRun({ text: `  [${q.marks} mark(s)]`, italics: true }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );

        if (q.type === "mcq" && q.options) {
          const opts = q.options as string[];
          opts.forEach((opt, i) => {
            docChildren.push(
              new Paragraph({ text: `   ${String.fromCharCode(65 + i)}) ${opt}` })
            );
          });
        }

        docChildren.push(new Paragraph({ text: "", spacing: { after: 150 } }));
        questionNum++;
      }

      docChildren.push(
        new Paragraph({
          text: "--- End of Question Paper ---",
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        }),
        new Paragraph({
          text: "Powered by SmartGenEduX 2025",
          alignment: AlignmentType.CENTER,
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          headers: {
            default: new Header({
              children: [new Paragraph({ text: schoolName, alignment: AlignmentType.CENTER })],
            }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({ text: "Powered by SmartGenEduX 2025", alignment: AlignmentType.CENTER })],
            }),
          },
          children: docChildren,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_paper.docx"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tests/:id/answer-key-docx", requireAuth, requireTenant, requireRole("hod", "exam_committee", "admin", "super_admin"), requireDownloadableState(), async (req, res) => {
    try {
      const test = (req as any).test;
      if (req.user?.role !== "super_admin" && test.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const setNumber = parseInt(req.query.set as string) || 1;
      const setLabel = setNumber > 1 ? ` - Set ${setNumber}` : "";
      const shuffleSeed = hashString(`${test.id}-set-${setNumber}`);

      const tenant = await storage.getTenant(test.tenantId);
      const questions = [];
      for (const qId of test.questionIds || []) {
        const q = await storage.getQuestion(qId);
        if (q) questions.push(q);
      }

      const shuffledQuestions = seededShuffle(questions, shuffleSeed);

      const schoolName = tenant?.name || "Question Bank";

      const docChildren: any[] = [
        new Paragraph({
          text: "ANSWER KEY - CONFIDENTIAL",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: test.title + setLabel,
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Subject: ${test.subject} | Grade: ${test.grade}`, size: 22 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      ];

      let questionNum = 1;
      for (const q of shuffledQuestions) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Q${questionNum}. `, bold: true }),
              new TextRun({ text: q.content.substring(0, 100) + (q.content.length > 100 ? "..." : "") }),
            ],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `   Answer: ${q.correctAnswer || "N/A"}`, bold: true, color: "228B22" }),
            ],
          })
        );

        if (q.explanation) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `   Explanation: ${q.explanation}`, italics: true, color: "666666" }),
              ],
            })
          );
        }
        questionNum++;
      }

      docChildren.push(
        new Paragraph({
          text: "--- End of Answer Key ---",
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        }),
        new Paragraph({
          text: "CONFIDENTIAL - For Examiner Use Only",
          alignment: AlignmentType.CENTER,
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          headers: {
            default: new Header({
              children: [new Paragraph({ text: `${schoolName} - CONFIDENTIAL`, alignment: AlignmentType.CENTER })],
            }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({ text: "Powered by SmartGenEduX 2025", alignment: AlignmentType.CENTER })],
            }),
          },
          children: docChildren,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_answer_key.docx"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CSV Export Routes - protected with auth and tenant isolation ============
  app.get("/api/export/analytics-csv", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const attempts = await storage.getAllAttempts(tenantId);
      const users = await storage.getUsersByTenant(tenantId);
      const tests = await storage.getTestsByTenant(tenantId);

      const userMap = new Map(users.map(u => [u.id, u]));
      const testMap = new Map(tests.map(t => [t.id, t]));

      let csv = "Student Name,Student Email,Class,Section,Test Title,Subject,Score,Total Marks,Percentage,Date Completed\n";

      for (const attempt of attempts) {
        const student = userMap.get(attempt.studentId) as any;
        const test = testMap.get(attempt.testId);
        const att = attempt as any;
        if (student && test && att.completedAt) {
          const totalMarks = test.totalMarks || 0;
          const percentage = totalMarks > 0 ? ((attempt.score || 0) / totalMarks * 100).toFixed(1) : "0";
          csv += `"${student.name}","${student.email}","${student.classId || ''}","${student.section || ''}","${test.title}","${test.subject}","${attempt.score || 0}","${totalMarks}","${percentage}%","${new Date(att.completedAt).toLocaleDateString()}"\n`;
        }
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=analytics_report.csv");
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/export/class-results-csv", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const classId = req.query.classId as string;
      const attempts = await storage.getAllAttempts(tenantId);
      const users = await storage.getUsersByTenant(tenantId);
      const tests = await storage.getTestsByTenant(tenantId);

      const students = users.filter(u => u.role === "student" && (!classId || (u as any).classId === classId));
      const studentIds = new Set(students.map(s => s.id));
      const relevantAttempts = attempts.filter((a: Attempt) => studentIds.has(a.studentId));

      const testMap = new Map(tests.map(t => [t.id, t]));
      const studentMap = new Map(students.map(s => [s.id, s]));

      let csv = "Class,Section,Student Name,Email,Tests Taken,Average Score,Total Marks Earned\n";

      const studentStats = new Map<string, { tests: number; totalScore: number; totalMarks: number }>();

      for (const attempt of relevantAttempts) {
        const test = testMap.get(attempt.testId);
        const att = attempt as any;
        if (test && att.completedAt) {
          const stats = studentStats.get(attempt.studentId) || { tests: 0, totalScore: 0, totalMarks: 0 };
          stats.tests++;
          stats.totalScore += attempt.score || 0;
          stats.totalMarks += test.totalMarks || 0;
          studentStats.set(attempt.studentId, stats);
        }
      }

      for (const student of students) {
        const s = student as any;
        const stats = studentStats.get(student.id) || { tests: 0, totalScore: 0, totalMarks: 0 };
        const avgScore = stats.tests > 0 ? (stats.totalScore / stats.totalMarks * 100).toFixed(1) : "0";
        csv += `"${s.classId || ''}","${s.section || ''}","${student.name}","${student.email}","${stats.tests}","${avgScore}%","${stats.totalScore}"\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=class_results.csv");
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Tab Switch / Focus Warning Log - protected with auth and tenant isolation ============
  app.post("/api/exam/log-tab-switch", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { attemptId } = req.body;
      const studentId = req.user!.id;
      
      await storage.logActivity({
        tenantId,
        userId: studentId,
        entityType: "attempt",
        action: "tab_switch_detected",
        entityId: attemptId,
      });

      const existingAlerts = await storage.getRiskAlertsByTenant(tenantId);
      const studentSwitches = existingAlerts.filter(a => 
        a.studentId === studentId && 
        a.type === "tab_switch" &&
        new Date(a.createdAt).getTime() > Date.now() - 3600000
      );

      if (studentSwitches.length >= 2) {
        await storage.createRiskAlert({
          id: `risk-${Date.now()}`,
          tenantId,
          studentId,
          type: "multiple_tab_switches",
          severity: "high",
          message: "Multiple tab switches detected during exam - potential cheating",
          resolved: false,
          createdAt: new Date(),
        });
      } else {
        await storage.createRiskAlert({
          id: `risk-${Date.now()}`,
          tenantId,
          studentId,
          type: "tab_switch",
          severity: "medium",
          message: "Tab switch detected during exam",
          resolved: false,
          createdAt: new Date(),
        });
      }

      res.json({ success: true, warning: "Tab switch logged" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Blueprint Routes - protected (duplicate of registerBlueprintRoutes) ============
  app.get("/api/blueprints-v2", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const blueprints = await storage.getBlueprintsByTenant(tenantId);
      res.json(blueprints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/blueprints-v2", requireAuth, requireTenant, requireRole("hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { totalMarks, sections, ...rest } = req.body;
      const duration = totalMarks === 40 ? 90 : totalMarks === 80 ? 180 : 120;
      const blueprint = await storage.createBlueprint({
        ...rest,
        totalMarks,
        sections,
        duration,
        tenantId,
      });
      res.json(blueprint);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/blueprints/:id", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getBlueprint(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Blueprint not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteBlueprint(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Blueprint Lock/Unlock - Super Admin ============
  app.post("/api/blueprints/:id/lock", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getBlueprint(id);
      if (!existing) {
        return res.status(404).json({ error: "Blueprint not found" });
      }
      if (existing.isLocked) {
        return res.status(400).json({ error: "Blueprint is already locked" });
      }
      const updated = await storage.updateBlueprint(id, {
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: req.user!.id,
      });
      await storage.logActivity({
        tenantId: existing.tenantId,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        entityType: "blueprint",
        action: "lock",
        entityId: id,
        details: { blueprintName: existing.name },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/blueprints/:id/unlock", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getBlueprint(id);
      if (!existing) {
        return res.status(404).json({ error: "Blueprint not found" });
      }
      if (!existing.isLocked) {
        return res.status(400).json({ error: "Blueprint is not locked" });
      }
      const updated = await storage.updateBlueprint(id, {
        isLocked: false,
        lockedAt: null,
        lockedBy: null,
      });
      await storage.logActivity({
        tenantId: existing.tenantId,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        entityType: "blueprint",
        action: "unlock",
        entityId: id,
        details: { blueprintName: existing.name },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Bulk User Upload - protected ============
  app.post("/api/users/bulk", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { users } = req.body;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: "No users provided" });
      }
      let created = 0;
      const errors: any[] = [];
      for (const userData of users) {
        try {
          await storage.createUser({
            ...userData,
            tenantId,
            active: true,
          });
          created++;
        } catch (err: any) {
          errors.push({ user: userData.username, error: err.message });
        }
      }
      res.json({ created, errors, total: users.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Portions Routes - protected ============
  app.patch("/api/chapters/:id/portions", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getChapter(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { completedTopics } = req.body;
      const chapter = await storage.updateChapterPortions(req.params.id, completedTopics);
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Subjects Routes - protected with auth and tenant isolation ============
  app.get("/api/subjects", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const subjects = await storage.getSubjectsByTenant(tenantId);
      res.json(subjects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Students Routes - protected with auth and tenant isolation ============
  app.get("/api/students", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const students = await storage.getStudentsByTenant(tenantId);
      res.json(students);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Makeup Tests Routes - protected with auth and tenant isolation ============
  app.get("/api/makeup-tests", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const makeupTests = await storage.getMakeupTestsByTenant(tenantId);
      res.json(makeupTests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/makeup-tests", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const makeupTest = await storage.createMakeupTest({
        ...req.body,
        tenantId,
      });
      res.json(makeupTest);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Submissions Routes - protected with auth and tenant isolation ============
  app.get("/api/submissions", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const submissions = await storage.getSubmissionsByTenant(tenantId);
      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/submissions/:id/marks", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { marks, feedback } = req.body;
      const submission = await storage.updateSubmissionMarks(req.params.id, marks, feedback);
      res.json(submission);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/submissions/:id/complete", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), async (req, res) => {
    try {
      const existing = await storage.getSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (req.user?.role !== "super_admin" && existing.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const submission = await storage.completeSubmissionMarking(req.params.id);
      res.json(submission);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Results Routes - protected with auth and tenant isolation ============
  app.get("/api/results", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const userId = req.query.userId as string || req.user!.id;
      const results = await storage.getResultsByUser(tenantId, userId);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Parent Routes - protected ============
  app.get("/api/parent/children", requireAuth, requireTenant, requireRole("parent", "admin", "super_admin"), async (req, res) => {
    try {
      const parentId = req.user!.role === "parent" ? req.user!.id : req.query.parentId as string;
      const children = await storage.getChildrenByParent(parentId);
      res.json(children);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/parent/results", requireAuth, requireTenant, requireRole("parent", "admin", "super_admin"), async (req, res) => {
    try {
      const parentId = req.user!.role === "parent" ? req.user!.id : req.query.parentId as string;
      const results = await storage.getResultsByParent(parentId);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/parent/progress", requireAuth, requireTenant, requireRole("parent", "admin", "super_admin"), async (req, res) => {
    try {
      const parentId = req.user!.role === "parent" ? req.user!.id : req.query.parentId as string;
      const progress = await storage.getProgressByParent(parentId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/parent/notifications", requireAuth, requireTenant, requireRole("parent", "admin", "super_admin"), async (req, res) => {
    try {
      const parentId = req.user!.role === "parent" ? req.user!.id : req.query.parentId as string;
      const notifications = await storage.getNotificationsByParent(parentId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/parent/activity-timeline", requireAuth, requireTenant, requireRole("parent", "admin", "super_admin"), async (req, res) => {
    try {
      const parentId = req.user!.role === "parent" ? req.user!.id : req.query.parentId as string;
      if (!parentId) {
        return res.json([]);
      }
      
      const children = await storage.getChildrenByParent(parentId);
      if (!children || children.length === 0) {
        return res.json([]);
      }
      
      const activities: any[] = [];
      
      const attemptPromises = children.map(async (child: any) => {
        try {
          const attempts = await storage.getAttemptsByStudent(child.id);
          return { child, attempts: attempts || [] };
        } catch {
          return { child, attempts: [] };
        }
      });
      
      const childAttempts = await Promise.all(attemptPromises);
      
      for (const { child, attempts } of childAttempts) {
        for (const attempt of attempts) {
          try {
            const test = await storage.getTest(attempt.testId);
            const att = attempt as any;
            if (test && att.completedAt) {
              activities.push({
                id: `activity-${attempt.id}`,
                type: "test_completed",
                title: `Completed: ${test.title}`,
                description: `${child?.name || 'Student'} scored ${attempt.score || 0}/${test.totalMarks || 0} in ${test.subject}`,
                timestamp: att.completedAt,
                icon: "award",
                childName: child?.name || 'Student',
              });
            } else if (test && att.startedAt) {
              activities.push({
                id: `activity-start-${attempt.id}`,
                type: "test_started",
                title: `Started: ${test.title}`,
                description: `${child?.name || 'Student'} started ${test.subject} test`,
                timestamp: att.startedAt,
                icon: "play",
                childName: child?.name || 'Student',
              });
            }
          } catch {
            continue;
          }
        }
      }
      
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(activities.slice(0, 20));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Risk Alerts Routes - protected with auth and tenant isolation ============
  app.get("/api/risk-alerts", requireAuth, requireTenant, requireRole("teacher", "hod", "principal", "exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const alerts = await storage.getRiskAlertsByTenant(tenantId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/risk-alerts/:id/acknowledge", requireAuth, requireTenant, requireRole("teacher", "hod", "principal", "admin", "super_admin"), async (req, res) => {
    try {
      const alert = await storage.acknowledgeRiskAlert(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ S3 Storage Routes - protected with role-based access control ============
  app.post("/api/storage/upload", requireAuth, requireTenant, requireRole("teacher", "hod", "admin", "super_admin"), upload.single("file"), async (req: Request, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { examId, fileType } = req.body;
      if (!examId) {
        return res.status(400).json({ error: "Exam ID is required" });
      }
      
      const s3Storage = await import("./services/s3-storage");
      const result = await s3Storage.default.uploadFile({
        tenantId,
        examId,
        file: req.file.buffer,
        fileName: req.file.originalname,
        fileType: fileType || "question_paper",
        uploadedBy: req.user!.id,
      });
      
      res.json({ success: true, fileKey: result.key, location: result.location });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/storage/download/:examId/:fileKey", requireAuth, requireTenant, requireRole("exam_committee", "admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { examId, fileKey } = req.params;
      
      const s3Storage = await import("./services/s3-storage");
      const signedUrl = await s3Storage.default.getSignedDownloadUrl({
        tenantId,
        examId,
        fileKey,
        expiresIn: 300,
      });
      
      res.json({ downloadUrl: signedUrl, expiresIn: 300 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/storage/:examId/:fileKey", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { examId, fileKey } = req.params;
      
      const s3Storage = await import("./services/s3-storage");
      await s3Storage.default.deleteFile({
        tenantId,
        examId,
        fileKey,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/storage/files/:examId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { examId } = req.params;
      
      const s3Storage = await import("./services/s3-storage");
      const files = await s3Storage.default.listFiles({
        tenantId,
        examId,
      });
      
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Academic Years API =============
  app.get("/api/admin/academic-years", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      // Super Admin can pass tenantId as query param
      let tenantId = req.query.tenantId as string;
      if (!tenantId && req.user?.role !== "super_admin") {
        tenantId = (req as any).tenantId;
      }
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const years = await storage.getAcademicYearsByTenant(tenantId);
      res.json(years);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/academic-years/active", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const year = await storage.getActiveAcademicYear(tenantId);
      res.json(year || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/academic-years", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      // Super Admin can pass tenantId in body
      let tenantId = req.body.tenantId;
      if (!tenantId && req.user?.role !== "super_admin") {
        tenantId = (req as any).tenantId;
      }
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const { name, startDate, endDate, isActive } = req.body;
      
      if (!name || !startDate || !endDate) {
        return res.status(400).json({ error: "Name, startDate, and endDate are required" });
      }
      
      const year = await storage.createAcademicYear({
        id: randomUUID(),
        tenantId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false,
        isLocked: false,
      });
      res.status(201).json(year);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/academic-years/:id", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const existing = await storage.getAcademicYear(id);
      if (!existing) {
        return res.status(404).json({ error: "Academic year not found" });
      }
      if (existing.isLocked) {
        return res.status(400).json({ error: "Cannot modify a locked academic year" });
      }
      
      const { name, startDate, endDate, isActive } = req.body;
      const updated = await storage.updateAcademicYear(id, {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/academic-years/:id/activate", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const existing = await storage.getAcademicYear(id);
      if (!existing) {
        return res.status(404).json({ error: "Academic year not found" });
      }
      
      const year = await storage.activateAcademicYear(existing.tenantId, id);
      if (!year) {
        return res.status(404).json({ error: "Academic year not found" });
      }
      res.json(year);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/academic-years/:id/lock", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      
      const existing = await storage.getAcademicYear(id);
      if (!existing) {
        return res.status(404).json({ error: "Academic year not found" });
      }
      
      const locked = await storage.lockAcademicYear(id, user.id);
      res.json(locked);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Grade Configurations API =============
  app.get("/api/admin/grade-configs", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { academicYearId } = req.query;
      const configs = await storage.getGradeConfigsByTenant(tenantId, academicYearId as string);
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/grade-configs", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { academicYearId, grade, displayName, gradeGroup, isActive } = req.body;
      
      if (!academicYearId || !grade) {
        return res.status(400).json({ error: "academicYearId and grade are required" });
      }
      
      const config = await storage.createGradeConfig({
        id: randomUUID(),
        tenantId,
        academicYearId,
        grade,
        displayName: displayName || grade,
        gradeGroup: gradeGroup || null,
        isActive: isActive !== false,
      });
      res.status(201).json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/grade-configs/bulk", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { academicYearId, grades } = req.body;
      
      if (!academicYearId || !grades || !Array.isArray(grades)) {
        return res.status(400).json({ error: "academicYearId and grades array are required" });
      }
      
      const configs = grades.map((g: any) => ({
        id: randomUUID(),
        tenantId,
        academicYearId,
        grade: g.grade,
        displayName: g.displayName || g.grade,
        gradeGroup: g.gradeGroup || null,
        isActive: g.isActive !== false,
      }));
      
      const created = await storage.createGradeConfigsBulk(configs);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/grade-configs/:id", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      
      const existing = await storage.getGradeConfig(id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Grade config not found" });
      }
      
      const { displayName, gradeGroup, isActive } = req.body;
      const updated = await storage.updateGradeConfig(id, {
        ...(displayName !== undefined && { displayName }),
        ...(gradeGroup !== undefined && { gradeGroup }),
        ...(isActive !== undefined && { isActive }),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= User Credential Generation API =============
  app.post("/api/admin/users/:id/generate-code", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      
      const user = await storage.getUser(id);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.userCode) {
        return res.status(400).json({ error: "User already has a code assigned", code: user.userCode });
      }
      
      const code = await storage.generateUserCode(tenantId);
      await storage.updateUser(id, { userCode: code });
      res.json({ code });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/bulk-generate-codes", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { userIds } = req.body;
      
      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: "userIds array is required" });
      }
      
      const results: { userId: string; code?: string; error?: string }[] = [];
      for (const userId of userIds) {
        const user = await storage.getUser(userId);
        if (!user || user.tenantId !== tenantId) {
          results.push({ userId, error: "User not found" });
          continue;
        }
        if (user.userCode) {
          results.push({ userId, code: user.userCode, error: "Already has code" });
          continue;
        }
        const code = await storage.generateUserCode(tenantId);
        await storage.updateUser(userId, { userCode: code });
        results.push({ userId, code });
      }
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Password Change Enforcement API =============
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { currentPassword, newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      
      const fullUser = await storage.getUser(user.id);
      if (!fullUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // For non-forced password changes, currentPassword is REQUIRED
      if (!fullUser.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: "Current password is required" });
        }
        // Verify current password
        const bcrypt = await import("bcryptjs");
        const valid = await bcrypt.compare(currentPassword, fullUser.password);
        if (!valid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }
      
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { 
        password: hashedPassword, 
        mustChangePassword: false 
      });
      
      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const { temporaryPassword } = req.body;
      
      const user = await storage.getUser(id);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(temporaryPassword || "changeme123", 10);
      await storage.updateUser(id, { 
        password: hashedPassword, 
        mustChangePassword: true 
      });
      
      res.json({ message: "Password reset successfully. User must change password on next login." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Soft Delete API =============
  app.delete("/api/admin/questions/:id/soft", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const user = req.user as any;
      
      const question = await storage.getQuestion(id);
      if (!question || question.tenantId !== tenantId) {
        return res.status(404).json({ error: "Question not found" });
      }
      
      const inUse = await storage.isQuestionInUse(id);
      if (inUse) {
        return res.status(400).json({ error: "Cannot delete: question is used in tests or has been answered" });
      }
      
      await storage.softDeleteQuestion(id, user.id);
      res.json({ message: "Question soft deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/blueprints/:id/soft", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const user = req.user as any;
      
      const blueprint = await storage.getBlueprint(id);
      if (!blueprint || blueprint.tenantId !== tenantId) {
        return res.status(404).json({ error: "Blueprint not found" });
      }
      
      const inUse = await storage.isBlueprintInUse(id);
      if (inUse) {
        return res.status(400).json({ error: "Cannot delete: blueprint is linked to tests" });
      }
      
      await storage.softDeleteBlueprint(id, user.id);
      res.json({ message: "Blueprint soft deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/users/:id/soft", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const user = req.user as any;
      
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const inUse = await storage.isUserInUse(id);
      if (inUse) {
        return res.status(400).json({ error: "Cannot delete: user has created content or attempts" });
      }
      
      await storage.softDeleteUser(id, user.id);
      res.json({ message: "User soft deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/uploads/:id/soft", requireAuth, requireTenant, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const user = req.user as any;
      
      const upload = await storage.getUpload(id);
      if (!upload || upload.tenantId !== tenantId) {
        return res.status(404).json({ error: "Upload not found" });
      }
      
      const inUse = await storage.isUploadInUse(id);
      if (inUse) {
        return res.status(400).json({ error: "Cannot delete: upload has associated questions" });
      }
      
      await storage.softDeleteUpload(id, user.id);
      res.json({ message: "Upload soft deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // PHASE 2+3: SUPER ADMIN GOVERNANCE API
  // =====================================================

  // ============= Exam Framework Configuration API =============
  app.get("/api/admin/exam-frameworks", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, academicYearId, gradeGroup } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const frameworks = await storage.getExamFrameworksByTenant(
        tenantId as string, 
        academicYearId as string, 
        gradeGroup as any
      );
      res.json(frameworks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/exam-frameworks", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { tenantId, academicYearId, gradeGroup, applicableGrades, examName, examCategory, examOrder, examType, durationMinutes, maxMarks, startDate, endDate, isVisible } = req.body;
      
      if (!tenantId || !academicYearId || !gradeGroup || !examName) {
        return res.status(400).json({ error: "tenantId, academicYearId, gradeGroup, and examName are required" });
      }
      
      const framework = await storage.createExamFramework({
        tenantId,
        academicYearId,
        gradeGroup,
        applicableGrades: applicableGrades || null,
        examName,
        examCategory: examCategory || "unit",
        examOrder: examOrder || 1,
        examType: examType || "offline",
        durationMinutes: durationMinutes || 60,
        maxMarks: maxMarks || 40,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isVisible: isVisible !== false,
        isActive: true,
        createdBy: user.id,
      });
      res.status(201).json(framework);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/exam-frameworks/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getExamFramework(id);
      if (!existing) {
        return res.status(404).json({ error: "Exam framework not found" });
      }
      
      const { examName, examCategory, examOrder, examType, durationMinutes, maxMarks, startDate, endDate, isVisible, isActive, applicableGrades } = req.body;
      const updated = await storage.updateExamFramework(id, {
        ...(examName !== undefined && { examName }),
        ...(examCategory !== undefined && { examCategory }),
        ...(examOrder !== undefined && { examOrder }),
        ...(examType !== undefined && { examType }),
        ...(durationMinutes !== undefined && { durationMinutes }),
        ...(maxMarks !== undefined && { maxMarks }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isVisible !== undefined && { isVisible }),
        ...(isActive !== undefined && { isActive }),
        ...(applicableGrades !== undefined && { applicableGrades }),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/exam-frameworks/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getExamFramework(id);
      if (!existing) {
        return res.status(404).json({ error: "Exam framework not found" });
      }
      await storage.deleteExamFramework(id);
      res.json({ message: "Exam framework deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Blueprint Policy API =============
  app.get("/api/admin/blueprint-policies", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, academicYearId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const policy = await storage.getBlueprintPolicyByTenant(tenantId as string, academicYearId as string);
      res.json(policy || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/blueprint-policies", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { tenantId, academicYearId, isBlueprintMandatory, blueprintMode, allowEditAfterLock } = req.body;
      
      if (!tenantId || !academicYearId) {
        return res.status(400).json({ error: "tenantId and academicYearId are required" });
      }
      
      // Check if policy exists, update it instead
      const existing = await storage.getBlueprintPolicyByTenant(tenantId, academicYearId);
      if (existing) {
        const updated = await storage.updateBlueprintPolicy(existing.id, {
          isBlueprintMandatory,
          blueprintMode,
          allowEditAfterLock,
          updatedBy: user.id,
        });
        return res.json(updated);
      }
      
      const policy = await storage.createBlueprintPolicy({
        tenantId,
        academicYearId,
        isBlueprintMandatory: isBlueprintMandatory !== false,
        blueprintMode: blueprintMode || "academic_year",
        allowEditAfterLock: allowEditAfterLock === true,
      });
      res.status(201).json(policy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Reference Library API (Grade 10 & 12 Only) =============
  app.get("/api/admin/reference-library", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, grade, subject } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const items = await storage.getReferenceLibrary(tenantId as string, grade as string, subject as string);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/reference-library", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { tenantId, academicYearId, grade, subject, title, description, referenceType, fileUrl, fileName, fileSize, year } = req.body;
      
      if (!tenantId || !grade || !subject || !title || !referenceType || !fileUrl) {
        return res.status(400).json({ error: "tenantId, grade, subject, title, referenceType, and fileUrl are required" });
      }
      
      // Only allow Grade 10 and 12
      if (grade !== "10" && grade !== "12") {
        return res.status(400).json({ error: "Reference library is only available for Grade 10 and 12" });
      }
      
      const item = await storage.createReferenceItem({
        tenantId,
        academicYearId,
        grade,
        subject,
        title,
        description,
        referenceType,
        fileUrl,
        fileName,
        fileSize,
        year,
        createdBy: user.id,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/reference-library/:id/soft", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      
      const item = await storage.getReferenceItem(id);
      if (!item) {
        return res.status(404).json({ error: "Reference item not found" });
      }
      
      await storage.softDeleteReferenceItem(id, user.id);
      res.json({ message: "Reference item disabled" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/reference-library/:id/restore", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const restored = await storage.restoreReferenceItem(id);
      if (!restored) {
        return res.status(404).json({ error: "Reference item not found" });
      }
      res.json(restored);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Storage Governance API =============
  app.get("/api/admin/storage-usage", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const usage = await storage.getStorageUsage(tenantId as string);
      res.json(usage || { tenantId, totalBytes: 0, questionImageBytes: 0, uploadFileBytes: 0, referenceFileBytes: 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/storage-usage/recalculate", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const usage = await storage.recalculateStorageUsage(tenantId);
      res.json(usage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= User Bulk Upload API =============
  app.get("/api/admin/upload/template", requireAuth, requireRole("super_admin", "admin"), async (req, res) => {
    try {
      const { role } = req.query;
      
      let headers: string[];
      let example: string[];
      
      if (role === "student") {
        headers = ["name", "email", "grade", "section"];
        example = ["John Doe", "john.doe@school.com", "10", "A"];
      } else if (role === "parent") {
        headers = ["name", "email", "phone", "student_email"];
        example = ["Parent Name", "parent@email.com", "9876543210", "john.doe@school.com"];
      } else {
        // Default to teacher
        headers = ["name", "email", "subject", "grades"];
        example = ["Jane Teacher", "jane@school.com", "Mathematics", "9,10,11"];
      }
      
      const csvContent = [headers.join(","), example.join(",")].join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${role || "teacher"}_upload_template.csv`);
      res.send(csvContent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/bulk-upload", requireAuth, requireRole("super_admin", "admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const { tenantId, users: usersData, role } = req.body;
      
      const targetTenantId = user.role === "super_admin" ? tenantId : user.tenantId;
      if (!targetTenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      
      if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
        return res.status(400).json({ error: "users array is required" });
      }
      
      const validRoles = ["teacher", "student", "parent", "hod"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be teacher, student, parent, or hod" });
      }
      
      const bcrypt = await import("bcryptjs");
      const results = { created: 0, skipped: 0, errors: [] as string[] };
      
      for (const userData of usersData) {
        try {
          // Check for duplicate
          const existingUsers = await storage.getUsersByTenant(targetTenantId);
          const exists = existingUsers.some(u => u.email === userData.email);
          
          if (exists) {
            results.skipped++;
            results.errors.push(`Skipped: ${userData.email} already exists`);
            continue;
          }
          
          const tempPassword = "changeme123";
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          const userCode = await storage.generateUserCode(targetTenantId);
          
          await storage.createUser({
            tenantId: targetTenantId,
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            role: role as any,
            grade: userData.grade || undefined,
            userCode,
            mustChangePassword: true,
            active: true,
          });
          results.created++;
        } catch (err: any) {
          results.errors.push(`Error for ${userData.email}: ${err.message}`);
        }
      }
      
      res.json({ 
        message: `Created ${results.created} users, skipped ${results.skipped}`,
        ...results 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= Paper Generation Audit API =============
  app.get("/api/admin/paper-audit/:testId", requireAuth, requireRole("super_admin", "admin", "exam_committee"), async (req, res) => {
    try {
      const { testId } = req.params;
      const audit = await storage.getPaperGenerationAudit(testId);
      res.json(audit);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= SUPER ADMIN EXAM CONFIGURATION API =============
  
  // Get all exam configs for a school (with optional wing filter)
  app.get("/api/admin/exam-configs", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, wing } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const configs = await storage.getAdminExamConfigsByTenant(
        tenantId as string, 
        wing as any
      );
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single exam config
  app.get("/api/admin/exam-configs/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const config = await storage.getAdminExamConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Exam configuration not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create exam config
  app.post("/api/admin/exam-configs", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const config = await storage.createAdminExamConfig({
        ...req.body,
        createdBy: user.id,
      });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update exam config
  app.patch("/api/admin/exam-configs/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const config = await storage.updateAdminExamConfig(req.params.id, {
        ...req.body,
        updatedBy: user.id,
      });
      if (!config) {
        return res.status(404).json({ error: "Exam configuration not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Soft delete exam config
  app.delete("/api/admin/exam-configs/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      
      // Check if exam is in use
      const inUse = await storage.isExamConfigInUse(req.params.id);
      if (inUse) {
        return res.status(400).json({ 
          error: "This exam is already in use and cannot be deleted.",
          inUse: true
        });
      }
      
      const deleted = await storage.softDeleteAdminExamConfig(req.params.id, user.id);
      if (!deleted) {
        return res.status(404).json({ error: "Exam configuration not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get active exams for HOD blueprint dropdown
  app.get("/api/exams/for-blueprint", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const configs = await storage.getActiveExamsForBlueprint(tenantId);
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get mock test exams for student
  app.get("/api/exams/mock-tests", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const configs = await storage.getMockTestExams(tenantId);
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= SCHOOL STORAGE CONFIGURATION API =============
  
  // Get storage config for a school
  app.get("/api/admin/storage-configs", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const config = await storage.getSchoolStorageConfig(tenantId as string);
      res.json(config || { tenantId, isConfigured: false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create or update storage config
  app.post("/api/admin/storage-configs", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { tenantId, ...data } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const config = await storage.createOrUpdateSchoolStorageConfig(tenantId, {
        ...data,
        updatedBy: user.id,
        isConfigured: !!(data.s3BucketName && data.s3FolderPath),
      });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all storage configs (for overview)
  app.get("/api/admin/all-storage-configs", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const configs = await Promise.all(
        tenants.map(async (tenant) => {
          const storageConfig = await storage.getSchoolStorageConfig(tenant.id);
          const usageData = await storage.getStorageUsage(tenant.id);
          return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantCode: tenant.code,
            ...storageConfig,
            usage: usageData,
          };
        })
      );
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // NEW SUPER ADMIN APIs (Fresh Implementation)
  // =====================================================

  // --- Schools CRUD ---
  app.get("/api/superadmin/schools", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const schools = tenants.filter(t => !t.isDeleted).map(t => ({
        id: t.id,
        name: t.name,
        code: t.code,
        address: t.address || "",
        phone: t.phone || "",
        principalName: t.principalName || "",
        principalEmail: t.principalEmail || "",
        principalPhone: t.principalPhone || "",
        active: t.active ?? true,
        createdAt: t.createdAt,
      }));
      res.json(schools);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/superadmin/schools", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { name, code, address, phone, principalName, principalEmail, principalPhone } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }
      // Check if code already exists
      const existing = await storage.getTenantByCode(code);
      if (existing) {
        return res.status(400).json({ error: "School code already exists" });
      }
      const tenant = await storage.createTenant({
        name,
        code,
        address,
        phone,
        principalName,
        principalEmail,
        principalPhone,
        active: true,
      });
      res.status(201).json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/superadmin/schools/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, phone, principalName, principalEmail, principalPhone, active } = req.body;
      const updated = await storage.updateTenant(id, {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(principalName !== undefined && { principalName }),
        ...(principalEmail !== undefined && { principalEmail }),
        ...(principalPhone !== undefined && { principalPhone }),
        ...(active !== undefined && { active }),
      });
      if (!updated) {
        return res.status(404).json({ error: "School not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/superadmin/schools/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.softDeleteTenant(id);
      if (!deleted) {
        return res.status(404).json({ error: "School not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Wings CRUD ---
  app.get("/api/superadmin/wings", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { schoolId } = req.query;
      if (!schoolId) {
        return res.status(400).json({ error: "schoolId is required" });
      }
      const wings = await storage.getWingsByTenant(schoolId as string);
      res.json(wings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/superadmin/wings", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, name, displayName, grades } = req.body;
      if (!tenantId || !name || !displayName) {
        return res.status(400).json({ error: "tenantId, name, and displayName are required" });
      }
      const wing = await storage.createWing({
        tenantId,
        name,
        displayName,
        grades: grades || [],
        sortOrder: 0,
        isActive: true,
      });
      res.status(201).json(wing);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/superadmin/wings/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, displayName, grades, isActive, sortOrder } = req.body;
      const updated = await storage.updateWing(id, {
        ...(name && { name }),
        ...(displayName && { displayName }),
        ...(grades && { grades }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      });
      if (!updated) {
        return res.status(404).json({ error: "Wing not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/superadmin/wings/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.softDeleteWing(id);
      if (!deleted) {
        return res.status(404).json({ error: "Wing not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- School Exams CRUD ---
  app.get("/api/superadmin/exams", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { schoolId, wingId } = req.query;
      if (!schoolId) {
        return res.status(400).json({ error: "schoolId is required" });
      }
      const exams = await storage.getSchoolExams(schoolId as string, wingId as string | undefined);
      res.json(exams);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/superadmin/exams", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = req.user as AuthUser;
      const { tenantId, wingId, examName, academicYear, totalMarks, durationMinutes, examDate, subjects, questionPaperSets, watermarkText, logoUrl, pageSize, allowMockTest } = req.body;
      if (!tenantId || !wingId || !examName || !academicYear) {
        return res.status(400).json({ error: "tenantId, wingId, examName, and academicYear are required" });
      }
      const exam = await storage.createSchoolExam({
        tenantId,
        wingId,
        examName,
        academicYear,
        totalMarks: totalMarks || 100,
        durationMinutes: durationMinutes || 60,
        examDate: examDate ? new Date(examDate) : null,
        subjects: subjects || [],
        questionPaperSets: questionPaperSets || 1,
        watermarkText: watermarkText || null,
        logoUrl: logoUrl || null,
        pageSize: pageSize || "A4",
        allowMockTest: allowMockTest || false,
        isActive: true,
        createdBy: user.id,
      });
      res.status(201).json(exam);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/superadmin/exams/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      if (updates.examDate) {
        updates.examDate = new Date(updates.examDate);
      }
      const updated = await storage.updateSchoolExam(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Exam not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/superadmin/exams/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.softDeleteSchoolExam(id);
      if (!deleted) {
        return res.status(404).json({ error: "Exam not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Storage Configuration ---
  app.get("/api/superadmin/storage", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { schoolId } = req.query;
      if (!schoolId) {
        return res.status(400).json({ error: "schoolId is required" });
      }
      const config = await storage.getSchoolStorageConfig(schoolId as string);
      res.json(config || { tenantId: schoolId, isConfigured: false, maxStorageBytes: 5 * 1024 * 1024 * 1024 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/superadmin/storage/all", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const configs = await Promise.all(
        tenants.filter(t => !t.isDeleted).map(async (tenant) => {
          const config = await storage.getSchoolStorageConfig(tenant.id);
          return {
            tenantId: tenant.id,
            schoolName: tenant.name,
            schoolCode: tenant.code,
            s3BucketName: config?.s3BucketName || null,
            s3FolderPath: config?.s3FolderPath || null,
            maxStorageBytes: config?.maxStorageBytes || 5 * 1024 * 1024 * 1024,
            isConfigured: config?.isConfigured || false,
          };
        })
      );
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/superadmin/storage", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const user = req.user as AuthUser;
      const { tenantId, s3BucketName, s3FolderPath, maxStorageBytes } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const config = await storage.createOrUpdateSchoolStorageConfig(tenantId, {
        s3BucketName,
        s3FolderPath,
        maxStorageBytes: maxStorageBytes || 5 * 1024 * 1024 * 1024,
        isConfigured: !!(s3BucketName || s3FolderPath),
        updatedBy: user.id,
      });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Mock Tests for Students (uses schoolExams) ---
  app.get("/api/student/mock-exams", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const exams = await storage.getSchoolExams(tenantId);
      // Return only active exams
      res.json(exams.filter(e => e.isActive));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // SUPER ADMIN - USERS MANAGEMENT
  // =====================================================

  // Get users for a school
  app.get("/api/superadmin/users", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const schoolId = req.query.schoolId as string;
      if (!schoolId) {
        return res.status(400).json({ error: "schoolId is required" });
      }
      const users = await storage.getUsersByTenant(schoolId);
      // Filter out super_admin users
      res.json(users.filter(u => u.role !== "super_admin"));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new user for a school
  app.post("/api/superadmin/users", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, email, name, password, role, grade, section, wingId, subjects } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      if (!email || !name || !password) {
        return res.status(400).json({ error: "email, name, and password are required" });
      }
      if (!role || !["principal", "hod", "teacher", "student", "parent"].includes(role)) {
        return res.status(400).json({ error: "Valid role is required (principal, hod, teacher, student, parent)" });
      }

      // Validate teacher requirements
      if (role === "teacher") {
        if (!wingId) {
          return res.status(400).json({ error: "Wing is required for teachers" });
        }
        if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
          return res.status(400).json({ error: "At least one subject is required for teachers" });
        }
      }

      // Validate student requirements
      if (role === "student" && !grade) {
        return res.status(400).json({ error: "Class is required for students" });
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmailAndTenant(email, tenantId);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists in this school" });
      }

      // Get tenant to create user code
      const tenant = await storage.getTenant(tenantId);
      const schoolCode = tenant?.code || "SCH";

      const user = await storage.createUser({
        tenantId,
        email,
        name,
        password, // Note: In production, hash this!
        role,
        grade: role === "student" ? grade : null,
        section: role === "student" ? section || null : null,
        wingId: role === "teacher" ? wingId : null,
        subjects: role === "teacher" ? subjects : [],
        userCode: `${schoolCode}-${role.toUpperCase().substring(0, 3)}-${Date.now().toString(36).toUpperCase()}`,
      });

      res.status(201).json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a user
  app.patch("/api/superadmin/users/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, password, role, grade, active } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (password) updateData.password = password; // In production, hash this!
      if (role !== undefined) updateData.role = role;
      if (grade !== undefined) updateData.grade = grade;
      if (active !== undefined) updateData.active = active;

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete (soft delete) a user
  app.delete("/api/superadmin/users/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user as AuthUser;
      const success = await storage.softDeleteUser(id, currentUser.id);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk upload users
  app.post("/api/superadmin/users/bulk", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, role, users: usersData, wingMapping } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      if (!role || !["teacher", "student"].includes(role)) {
        return res.status(400).json({ error: "role must be 'teacher' or 'student'" });
      }
      if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
        return res.status(400).json({ error: "users array is required" });
      }

      const tenant = await storage.getTenant(tenantId);
      const schoolCode = tenant?.code || "SCH";

      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const userData of usersData) {
        try {
          const { name, email, password } = userData;
          
          if (!name || !email || !password) {
            errors.push(`Row skipped: Missing required fields for ${email || name || "unknown"}`);
            failed++;
            continue;
          }

          // Check if email already exists
          const existingUser = await storage.getUserByEmailAndTenant(email, tenantId);
          if (existingUser) {
            errors.push(`${email}: User already exists`);
            failed++;
            continue;
          }

          // Handle teacher-specific fields
          let wingId = null;
          let subjects: string[] = [];
          if (role === "teacher") {
            const wingName = userData.wing?.trim().toLowerCase();
            if (!wingName) {
              errors.push(`${email}: Wing is required for teachers`);
              failed++;
              continue;
            }
            wingId = wingMapping?.[wingName];
            if (!wingId) {
              errors.push(`${email}: Invalid wing "${userData.wing}"`);
              failed++;
              continue;
            }
            // Parse subjects (comma-separated)
            const subjectsStr = userData.subjects?.trim();
            if (!subjectsStr) {
              errors.push(`${email}: Subjects are required for teachers`);
              failed++;
              continue;
            }
            subjects = subjectsStr.split(",").map((s: string) => s.trim()).filter((s: string) => s);
            if (subjects.length === 0) {
              errors.push(`${email}: At least one subject is required`);
              failed++;
              continue;
            }
          }

          // Handle student-specific fields
          let grade = null;
          let section = null;
          if (role === "student") {
            grade = userData.class?.toString().trim() || userData.grade?.toString().trim();
            if (!grade) {
              errors.push(`${email}: Class is required for students`);
              failed++;
              continue;
            }
            section = userData.section?.trim() || null;
          }

          await storage.createUser({
            tenantId,
            email,
            name,
            password,
            role,
            grade,
            section,
            wingId,
            subjects,
            userCode: `${schoolCode}-${role.toUpperCase().substring(0, 3)}-${Date.now().toString(36).toUpperCase()}`,
          });
          created++;
        } catch (err: any) {
          errors.push(`${userData.email || "unknown"}: ${err.message}`);
          failed++;
        }
      }

      res.json({ created, failed, errors: errors.slice(0, 20) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // SUPER ADMIN - REFERENCE MATERIALS (Global for Class 10 & 12)
  // =====================================================

  // Get all reference materials (Super Admin)
  app.get("/api/superadmin/reference-materials", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { grade, category } = req.query;
      const materials = await storage.getReferenceMaterials(
        grade as string | undefined,
        category as string | undefined
      );
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a reference material entry (file metadata - actual S3 upload handled separately)
  app.post("/api/superadmin/reference-materials", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { title, description, grade, subject, category, academicYear, fileName, fileSize, mimeType } = req.body;
      
      // Enforce Class 10 & 12 only
      if (!grade || !["10", "12"].includes(grade)) {
        return res.status(400).json({ error: "Reference materials are only allowed for Class 10 and 12" });
      }
      
      if (!title || !fileName) {
        return res.status(400).json({ error: "Title and file name are required" });
      }
      
      if (!category || !["question_paper", "reference_notes", "answer_key", "syllabus"].includes(category)) {
        return res.status(400).json({ error: "Valid category is required (question_paper, reference_notes, answer_key, syllabus)" });
      }

      const currentUser = req.user as AuthUser;
      const material = await storage.createReferenceMaterial({
        title,
        description,
        grade,
        subject,
        category,
        academicYear,
        fileName,
        fileSize: fileSize || 0,
        mimeType,
        createdBy: currentUser.id,
        // S3 fields will be updated when S3 is configured
        s3Key: `global/reference/grade-${grade}/${category}/${Date.now()}-${fileName}`,
      });

      res.status(201).json(material);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a reference material
  app.patch("/api/superadmin/reference-materials/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const material = await storage.updateReferenceMaterial(id, req.body);
      if (!material) {
        return res.status(404).json({ error: "Reference material not found" });
      }
      res.json(material);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a reference material (soft delete)
  app.delete("/api/superadmin/reference-materials/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.softDeleteReferenceMaterial(id);
      if (!success) {
        return res.status(404).json({ error: "Reference material not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // STUDENT - GET REFERENCE MATERIALS (Class 10 & 12 only, Read-only)
  // =====================================================
  app.get("/api/student/reference-materials", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as AuthUser;
      
      // Only students can access
      if (currentUser.role !== "student") {
        return res.status(403).json({ error: "Only students can access reference materials" });
      }
      
      // Enforce Class 10 & 12 only
      const studentGrade = currentUser.grade;
      if (!studentGrade || !["10", "12"].includes(studentGrade)) {
        return res.status(403).json({ error: "Reference materials are only available for Class 10 and 12 students" });
      }

      const materials = await storage.getReferenceMaterials(studentGrade);
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // SUPER ADMIN - PLATFORM STATS (Real data only)
  // =====================================================
  app.get("/api/superadmin/stats", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const schools = await storage.getTenants();
      const activeSchools = schools.filter(s => s.active);
      
      // Get total users across all schools
      let totalUsers = 0;
      let totalTeachers = 0;
      let totalStudents = 0;
      
      for (const school of activeSchools) {
        const users = await storage.getUsersByTenant(school.id);
        totalUsers += users.filter(u => u.role !== "super_admin" && u.active !== false).length;
        totalTeachers += users.filter(u => u.role === "teacher" && u.active !== false).length;
        totalStudents += users.filter(u => u.role === "student" && u.active !== false).length;
      }

      res.json({
        totalSchools: activeSchools.length,
        totalUsers,
        totalTeachers,
        totalStudents,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

function parseCSVContent(csvContent: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];
    
    if (char === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      if (char === '\r') i++;
    } else if (char === '\r' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  
  currentRow.push(currentCell.trim());
  if (currentRow.some(cell => cell !== "")) {
    rows.push(currentRow);
  }
  
  return rows;
}
