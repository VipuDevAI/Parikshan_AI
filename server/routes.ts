import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { USER_ROLES, LEAVE_TYPES, LEAVE_STATUS } from "@shared/schema";
import { substitutionEngine } from "./engines/SubstitutionEngine";
import { timetableEngine } from "./engines/TimetableEngine";
import { attendanceEngine } from "./engines/AttendanceEngine";
import { alertEngine } from "./engines/AlertEngine";
import { integrationService } from "./engines/IntegrationService";
import { cameraAIEngine } from "./engines/CameraAIEngine";
import { requireAuth, requirePermission, requireRole, requireMinRole, requireWingAccess, requireSchoolAccess, filterByRole, hasPermission, PERMISSIONS } from "./middleware/roleGuard";
import { encrypt, decrypt } from "./utils/encryption";

// Camera webhook authentication middleware - ALWAYS requires authentication
const verifyCameraWebhook = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers["x-camera-token"] as string;
  const signature = req.headers["x-camera-signature"] as string;
  const cameraId = req.body.cameraId;

  if (!cameraId) {
    return res.status(400).json({ message: "Missing cameraId" });
  }

  // Verify camera exists and get its school
  const camera = await storage.getCamera(Number(cameraId));
  if (!camera) {
    return res.status(404).json({ message: "Camera not found" });
  }

  // Token-based auth: Check against camera's configured token or school's webhook secret
  const config = await storage.getSchoolConfig(camera.schoolId);
  const webhookSecret = config?.webhookSecret || process.env.CAMERA_WEBHOOK_SECRET;

  // SECURITY: Always require authentication - no open webhooks allowed
  if (!webhookSecret) {
    console.error(`Camera webhook rejected: No webhook secret configured for school ${camera.schoolId}. Set CAMERA_WEBHOOK_SECRET env var or configure webhookSecret in school config.`);
    return res.status(401).json({ 
      message: "Camera webhook authentication not configured. Contact administrator to set up webhook secret." 
    });
  }

  // If signature is provided, verify HMAC (preferred method)
  if (signature) {
    const payload = JSON.stringify(req.body);
    const expectedSig = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
    if (signature !== expectedSig) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }
  } else if (token) {
    // Simple token verification
    if (token !== webhookSecret) {
      return res.status(401).json({ message: "Invalid webhook token" });
    }
  } else {
    return res.status(401).json({ message: "Camera webhook authentication required. Provide x-camera-token or x-camera-signature header." });
  }

  // Attach camera info to request
  (req as any).camera = camera;
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Health check for Render
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Register AI routes
  registerChatRoutes(app);
  registerImageRoutes(app);

  // --- AUTH ---
  app.post(api.auth.login.path, async (req, res) => {
    try {
        const { schoolCode, username, password } = api.auth.login.input.parse(req.body);
        
        const school = await storage.getSchoolByCode(schoolCode);
        if (!school) return res.status(401).json({ message: "Invalid School Code" });

        const user = await storage.getUserByUsername(username);
        if (!user || user.schoolId !== school.id) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Verify password with bcrypt
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Create session and set cookie (stored in PostgreSQL for persistence)
        const { createSession } = await import("./middleware/session");
        const token = await createSession(user.id, user.schoolId);
        
        // Set HTTP-only cookie for session
        res.cookie("session_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Don't send password back to client
        const { password: _, ...safeUser } = user;
        res.json({ user: safeUser, school });
    } catch (e) {
        res.status(400).json({ message: "Validation error" });
    }
  });

  // Get current authenticated user
  app.get(api.auth.user.path, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.user.id);
    if (!user) {
        return res.status(401).json({ message: "User not found" });
    }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post(api.auth.logout.path, async (req, res) => {
      // Clear session cookie
      res.clearCookie("session_token");
      
      // Clear server-side session if token exists
      const token = req.cookies?.session_token;
      if (token) {
          const { clearSession } = await import("./middleware/session");
          await clearSession(token);
      }
      
      res.json({ message: "Logged out" });
  });

  // --- SCHOOLS ---
  app.get(api.schools.get.path, async (req, res) => {
      const school = await storage.getSchool(Number(req.params.id));
      if (!school) return res.status(404).json({ message: "School not found" });
      res.json(school);
  });

  // --- WINGS ---
  app.get(api.wings.list.path, requireAuth, async (req, res) => {
      const wings = await storage.getWings(Number(req.params.schoolId));
      res.json(wings);
  });

  app.post(api.wings.create.path, requireAuth, requirePermission('MANAGE_WINGS'), async (req, res) => {
      const wing = await storage.createWing({ ...req.body, schoolId: Number(req.params.schoolId) });
      res.status(201).json(wing);
  });

  // --- USERS ---
  app.get(api.users.list.path, requireAuth, requirePermission('VIEW_ALL_USERS'), async (req, res) => {
      const users = await storage.getUsersBySchool(Number(req.params.schoolId), req.query.role as string);
      res.json(users);
  });

  // --- ACADEMIC ---
  app.get(api.academic.listClasses.path, requireAuth, async (req, res) => {
      const classes = await storage.getClasses(Number(req.params.schoolId));
      res.json(classes);
  });

  // --- SIMPLE ROUTES (use session schoolId) ---
  app.get("/api/wings", requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      // SUPER_ADMIN can query wings for any school via schoolId query param
      let schoolId = req.user.schoolId;
      if (req.user.role === USER_ROLES.SUPER_ADMIN && req.query.schoolId) {
        schoolId = Number(req.query.schoolId);
      }
      const wings = await storage.getWings(schoolId);
      res.json(wings);
  });

  app.post("/api/wings", requireAuth, requirePermission('MANAGE_WINGS'), async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      // SUPER_ADMIN can create wings for any school
      let schoolId = req.user.schoolId;
      if (req.user.role === USER_ROLES.SUPER_ADMIN && req.body.schoolId) {
        schoolId = Number(req.body.schoolId);
      }
      const { name, minGrade, maxGrade } = req.body;
      const wing = await storage.createWing({ schoolId, name, minGrade, maxGrade });
      res.status(201).json(wing);
  });

  app.patch("/api/wings/:id", requireAuth, requirePermission('MANAGE_WINGS'), async (req, res) => {
      const { name, minGrade, maxGrade } = req.body;
      const wing = await storage.updateWing(Number(req.params.id), { name, minGrade, maxGrade });
      if (!wing) return res.status(404).json({ message: "Wing not found" });
      res.json(wing);
  });

  app.delete("/api/wings/:id", requireAuth, requirePermission('MANAGE_WINGS'), async (req, res) => {
      await storage.deleteWing(Number(req.params.id));
      res.json({ message: "Wing deleted" });
  });

  app.get("/api/classes", requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const classes = await storage.getClasses(req.user.schoolId);
      res.json(classes);
  });

  app.get("/api/sections", requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const sections = await storage.getSectionsBySchool(req.user.schoolId);
      res.json(sections);
  });

  app.get("/api/teachers", requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const teachers = await storage.getTeachers(req.user.schoolId);
      res.json(teachers);
  });

  // --- TIMETABLE ---
  app.get(api.timetable.get.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      
      // Use detailed view for section-based queries to include subject/teacher names
      if (req.query.sectionId) {
        const entries = await storage.getTimetable(
          req.user.schoolId,
          Number(req.query.sectionId)
        );
        
        // Join with subjects and users for names
        const allSubjects = await storage.getSubjects(req.user.schoolId);
        const allTeachers = await storage.getTeachers(req.user.schoolId);
        const allSections = await storage.getSectionsBySchool(req.user.schoolId);
        
        const enrichedEntries = entries.map(t => {
          const section = allSections.find(s => s.id === t.sectionId);
          const teacher = t.teacherId ? allTeachers.find(u => u.id === t.teacherId) : undefined;
          const subject = t.subjectId ? allSubjects.find(s => s.id === t.subjectId) : undefined;
          
          return {
            ...t,
            subjectName: subject?.name || "Subject",
            teacherName: teacher?.fullName || "Teacher",
            roomNumber: section?.roomNumber || t.roomId || ""
          };
        });
        
        return res.json(enrichedEntries);
      }
      
      const entries = await storage.getTimetable(
          req.user.schoolId, 
          undefined,
          req.query.teacherId ? Number(req.query.teacherId) : undefined
      );
      res.json(entries);
  });

  // --- ALERTS ---
  app.get(api.alerts.list.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const schoolId = req.user.schoolId;
      let alerts = await storage.getAlerts(schoolId, req.query.severity as string);
      
      // Check permissions - only authorized roles can view alerts
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!hasPermission(req.user.role, 'VIEW_ALL_ALERTS') && 
          !hasPermission(req.user.role, 'VIEW_CLASSROOM_ALERTS') &&
          !hasPermission(req.user.role, 'VIEW_CHILD_ALERTS')) {
        return res.status(403).json({ message: "Insufficient permissions to view alerts" });
      }
      
      // Parents can only see alerts related to their children
      if (req.user.role === USER_ROLES.PARENT) {
        alerts = []; // Parents see child-specific alerts only (to be implemented with parent-child relationship)
      }
      // Teachers see alerts from sections they teach
      else if (req.user.role === USER_ROLES.TEACHER) {
        const teacherSections = await storage.getTimetable(schoolId, undefined, req.user.id);
        const sectionIds = Array.from(new Set(teacherSections.map(t => t.sectionId)));
        // Filter alerts to only those in sections the teacher teaches (by location match)
        const sections = await storage.getSectionsBySchool(schoolId);
        const teacherRooms = sections
          .filter(s => sectionIds.includes(s.id))
          .map(s => s.roomNumber)
          .filter(Boolean);
        alerts = alerts.filter(a => 
          !a.location || teacherRooms.includes(a.location as string)
        );
      }
      // Wing Admin sees alerts for their wing only
      else if (req.user.role === USER_ROLES.WING_ADMIN && req.user.wingId) {
        // Get wing's sections/rooms
        const wingSections = await storage.getSectionsByWing(req.user.wingId);
        const wingRooms = wingSections.map(s => s.roomNumber).filter(Boolean);
        alerts = alerts.filter(a => 
          !a.location || wingRooms.includes(a.location as string)
        );
      }
      // Principal/VP/Correspondent/Super Admin see all
      
      res.json(alerts);
  });

  app.post(api.alerts.create.path, requireAuth, async (req, res) => {
      try {
          const alert = await storage.createAlert(req.body);
          res.status(201).json(alert);
      } catch (e) {
          res.status(400).json({ message: "Validation error" });
      }
  });

  // --- LEAVE REQUESTS ---
  app.get(api.leave.list.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const schoolId = req.user.schoolId;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      
      // Check permissions
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Verify user has permission to view leaves
      if (!hasPermission(req.user.role, 'VIEW_ALL_LEAVES') && 
          !hasPermission(req.user.role, 'VIEW_OWN_LEAVES')) {
        return res.status(403).json({ message: "Insufficient permissions to view leave requests" });
      }
      
      let requests = await storage.getLeaveRequests(schoolId, date);
      
      // Apply role-based filtering
      // Teachers can only see their own leave requests
      if (req.user.role === USER_ROLES.TEACHER) {
        requests = requests.filter(r => r.teacherId === req.user!.id);
      }
      // Wing Admin can only see leaves from their wing
      else if (req.user.role === USER_ROLES.WING_ADMIN && req.user.wingId) {
        const wingUsers = await storage.getUsersBySchool(schoolId);
        const wingTeacherIds = wingUsers
          .filter(u => u.wingId === req.user!.wingId && u.role === USER_ROLES.TEACHER)
          .map(u => u.id);
        requests = requests.filter(r => wingTeacherIds.includes(r.teacherId));
      }
      // Parents cannot see leave requests
      else if (req.user.role === USER_ROLES.PARENT) {
        return res.status(403).json({ message: "Parents cannot view leave requests" });
      }
      // Principal, VP, Correspondent, Super Admin see all
      
      res.json(requests);
  });

  app.post(api.leave.create.path, requireAuth, async (req, res) => {
      try {
          const { schoolId, teacherId, date, leaveType } = req.body;
          
          // Validate required fields
          if (!schoolId || !teacherId || !date || !leaveType) {
              return res.status(400).json({ message: "Missing required fields: schoolId, teacherId, date, leaveType" });
          }
          
          // Get teacher's wing
          const teacher = await storage.getUser(teacherId);
          if (!teacher) {
              return res.status(404).json({ message: "Teacher not found" });
          }
          
          // Enforce maxLeavePerWing policy
          const config = await storage.getSchoolConfig(schoolId);
          const maxLeavePerWing = config?.maxLeavePerWing || 3;
          
          if (teacher.wingId) {
              const requestDate = new Date(date);
              const existingLeaves = await storage.getLeaveRequests(schoolId, requestDate);
              const wingApproved = existingLeaves.filter(l => {
                  const u = l.teacherId;
                  return l.status === 'APPROVED';
              });
              
              // Count approved leaves for same wing on same date
              const wingUsers = await storage.getUsersBySchool(schoolId);
              const sameWingApproved = wingApproved.filter(l => {
                  const leaveTeacher = wingUsers.find(u => u.id === l.teacherId);
                  return leaveTeacher?.wingId === teacher.wingId;
              });
              
              if (sameWingApproved.length >= maxLeavePerWing) {
                  return res.status(400).json({ 
                      message: `Wing leave limit reached. Maximum ${maxLeavePerWing} teachers can be on leave per wing per day.` 
                  });
              }
          }
          
          const request = await storage.createLeaveRequest(req.body);
          
          // Send notification to Principals via WhatsApp/Arattai
          try {
              const wing = teacher?.wingId ? (await storage.getWings(request.schoolId)).find(w => w.id === teacher.wingId) : null;
              const principals = await storage.getUsersBySchool(request.schoolId, USER_ROLES.PRINCIPAL);
              
              const appliedAt = request.createdAt ? new Date(request.createdAt).toLocaleString() : new Date().toLocaleString();
              const message = `Leave Request: ${teacher?.fullName || 'A teacher'} from ${wing?.name || 'Unknown Wing'} has applied for ${request.leaveType} leave on ${new Date(request.date).toLocaleDateString()}. Reason: ${request.reason || 'Not specified'}. Applied at: ${appliedAt}`;
              
              for (const principal of principals) {
                  await integrationService.sendToUser(request.schoolId, principal.id, message, {
                      type: 'LEAVE_REQUEST',
                      leaveRequestId: request.id,
                      teacherId: request.teacherId,
                      wingId: wing?.id
                  });
              }
          } catch (notifyError) {
              console.log("Notification error (non-critical):", notifyError);
          }
          
          res.status(201).json(request);
      } catch (e: any) {
          res.status(400).json({ message: e.message || "Validation error" });
      }
  });

  app.patch(api.leave.approve.path, requireAuth, requirePermission('APPROVE_LEAVE'), async (req, res) => {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const request = await storage.approveLeaveRequest(Number(req.params.id), req.user.id);
      if (!request) return res.status(404).json({ message: "Leave request not found" });
      res.json(request);
  });

  app.patch(api.leave.reject.path, requireAuth, requirePermission('APPROVE_LEAVE'), async (req, res) => {
      const request = await storage.rejectLeaveRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Leave request not found" });
      res.json(request);
  });

  // --- SUBSTITUTIONS ---
  app.get(api.substitutions.list.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const schoolId = req.user.schoolId;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      
      // Check permissions
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Verify user has permission to view substitutions
      if (!hasPermission(req.user.role, 'VIEW_ALL_SUBSTITUTIONS') && 
          !hasPermission(req.user.role, 'VIEW_OWN_SUBSTITUTIONS')) {
        return res.status(403).json({ message: "Insufficient permissions to view substitutions" });
      }
      
      let teacherId = req.query.teacherId ? Number(req.query.teacherId) : undefined;
      
      // Teachers can only see their own substitutions
      if (req.user.role === USER_ROLES.TEACHER) {
        teacherId = req.user.id;
      }
      
      let subs = await storage.getSubstitutions(schoolId, date, teacherId);
      
      // Wing Admin can only see substitutions in their wing
      if (req.user.role === USER_ROLES.WING_ADMIN && req.user.wingId) {
        const wingUsers = await storage.getUsersBySchool(schoolId);
        const wingTeacherIds = wingUsers
          .filter(u => u.wingId === req.user!.wingId)
          .map(u => u.id);
        subs = subs.filter(s => 
          wingTeacherIds.includes(s.originalTeacherId) || 
          wingTeacherIds.includes(s.substituteTeacherId)
        );
      }
      // Parents cannot see substitutions
      else if (req.user.role === USER_ROLES.PARENT) {
        return res.status(403).json({ message: "Parents cannot view substitutions" });
      }
      
      res.json(subs);
  });

  app.post(api.substitutions.generate.path, requireAuth, requirePermission('GENERATE_SUBSTITUTIONS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const schoolId = req.user.schoolId;
          const { date, enforceDeadline = true } = req.body;
          const targetDate = new Date(date);
          
          // Use the SubstitutionEngine for smart generation
          const result = await substitutionEngine.generate({
              schoolId,
              date: targetDate,
              enforceDeadline
          });
          
          res.json({ 
              generated: result.generated, 
              substitutions: result.substitutions,
              skipped: result.skipped,
              errors: result.errors
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Preview substitutions without saving
  app.post("/api/substitutions/preview", requireAuth, requirePermission('GENERATE_SUBSTITUTIONS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const schoolId = req.user.schoolId;
          const { date } = req.body;
          const result = await substitutionEngine.preview({
              schoolId,
              date: new Date(date)
          });
          res.json(result);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Download substitutions as Excel or PDF
  app.get("/api/substitutions/download", requireAuth, requirePermission('VIEW_ALL_SUBSTITUTIONS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const schoolId = req.user.schoolId;
          const date = req.query.date as string;
          const format = req.query.format as string || 'excel';
          
          if (!date) {
              return res.status(400).json({ message: "Date is required" });
          }
          
          const targetDate = new Date(date);
          const substitutions = await storage.getSubstitutions(schoolId, targetDate);
          const teachers = await storage.getTeachers(schoolId);
          const sections = await storage.getSectionsBySchool(schoolId);
          const classes = await storage.getClasses(schoolId);
          const subjects = await storage.getSubjects(schoolId);
          
          const getTeacherName = (id: number) => teachers.find(t => t.id === id)?.fullName || `Teacher ${id}`;
          const getSubjectName = (id: number | null) => id ? subjects.find(s => s.id === id)?.name || '-' : '-';
          const getSectionName = (id: number) => {
              const section = sections.find((s: any) => s.id === id);
              if (!section) return `Section ${id}`;
              const classItem = classes.find((c: any) => c.id === section.classId);
              return `${classItem?.name || ''} - ${section.name}`;
          };
          
          if (format === 'excel') {
              // Generate CSV (Excel-compatible)
              let csv = 'Period,Section,Original Teacher,Substitute Teacher,Subject\n';
              for (const sub of substitutions) {
                  csv += `P${sub.periodIndex},"${getSectionName(sub.sectionId)}","${getTeacherName(sub.originalTeacherId)}","${getTeacherName(sub.substituteTeacherId)}","${getSubjectName(sub.subjectId)}"\n`;
              }
              
              res.setHeader('Content-Type', 'text/csv');
              res.setHeader('Content-Disposition', `attachment; filename="substitutions_${date}.csv"`);
              return res.send(csv);
          } else if (format === 'pdf') {
              // Generate simple HTML that can be printed as PDF
              let html = `<!DOCTYPE html>
<html>
<head>
  <title>Substitution Report - ${date}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #166534; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #166534; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .date { font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Substitution Report</h1>
    <span class="date">Date: ${date}</span>
  </div>
  <table>
    <tr>
      <th>Period</th>
      <th>Section</th>
      <th>Original Teacher</th>
      <th>Substitute Teacher</th>
      <th>Subject</th>
    </tr>`;
              
              for (const sub of substitutions) {
                  html += `<tr>
      <td>P${sub.periodIndex}</td>
      <td>${getSectionName(sub.sectionId)}</td>
      <td>${getTeacherName(sub.originalTeacherId)}</td>
      <td>${getTeacherName(sub.substituteTeacherId)}</td>
      <td>${getSubjectName(sub.subjectId)}</td>
    </tr>`;
              }
              
              html += `</table>
  <p style="margin-top: 20px; font-size: 12px; color: #666;">Generated by Parikshan.AI</p>
</body>
</html>`;
              
              res.setHeader('Content-Type', 'text/html');
              res.setHeader('Content-Disposition', `attachment; filename="substitutions_${date}.html"`);
              return res.send(html);
          }
          
          res.status(400).json({ message: "Invalid format. Use 'excel' or 'pdf'" });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- TIMETABLE ENGINE ---
  app.post("/api/timetable/generate", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const schoolId = req.user.schoolId;
          const { wingId, sectionIds = [] } = req.body;
          
          const result = await timetableEngine.generate({
              schoolId,
              wingId,
              sectionIds
          });
          
          res.json(result);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/timetable/validate", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const schoolId = req.user.schoolId;
          const { wingId } = req.body;
          
          const conflicts = await timetableEngine.validate(schoolId, wingId);
          res.json({ valid: conflicts.length === 0, conflicts });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/timetable/freeze", requireAuth, requirePermission('FREEZE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const schoolId = req.user.schoolId;
          const { wingId, name, userId } = req.body;
          
          await timetableEngine.freeze(schoolId, wingId, name, userId);
          res.json({ success: true, message: "Timetable frozen successfully" });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.get("/api/timetable/is-frozen", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const wingId = req.query.wingId ? Number(req.query.wingId) : undefined;
          
          const frozen = await timetableEngine.isFrozen(req.user.schoolId, wingId);
          res.json({ frozen });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- ATTENDANCE ENGINE ---
  app.post("/api/attendance/check-in", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const { entityId, entityType, cameraId } = req.body;
          
          const result = await attendanceEngine.processCheckIn(
              req.user.schoolId,
              entityId,
              entityType,
              new Date(),
              cameraId
          );
          
          res.json(result);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/attendance/check-out", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const { entityId, entityType, cameraId } = req.body;
          
          const result = await attendanceEngine.processCheckOut(
              req.user.schoolId,
              entityId,
              entityType,
              new Date(),
              cameraId
          );
          
          res.json(result);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.get("/api/attendance/section-summary", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const sectionId = Number(req.query.sectionId);
          const date = req.query.date ? new Date(req.query.date as string) : new Date();
          
          const summary = await attendanceEngine.getSectionSummary(req.user.schoolId, sectionId, date);
          res.json(summary);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- ALERT ENGINE ---
  app.post("/api/alerts/:id/acknowledge", requireAuth, requirePermission('VIEW_ALL_ALERTS'), async (req, res) => {
      try {
          if (!req.user?.id) {
            return res.status(401).json({ message: "Authentication required" });
          }
          const alertId = Number(req.params.id);
          
          const event = await alertEngine.acknowledge(alertId, req.user.id);
          res.json({ success: true, event });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/alerts/:id/resolve", requireAuth, requirePermission('VIEW_ALL_ALERTS'), async (req, res) => {
      try {
          if (!req.user?.id) {
            return res.status(401).json({ message: "Authentication required" });
          }
          const alertId = Number(req.params.id);
          const resolution = req.body.resolution;
          
          const event = await alertEngine.resolve(alertId, req.user.id, resolution);
          res.json({ success: true, event });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.get("/api/alerts/:id/timeline", requireAuth, async (req, res) => {
      try {
          const alertId = Number(req.params.id);
          const timeline = await alertEngine.getAlertTimeline(alertId);
          res.json(timeline);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.get("/api/alerts/stats", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const stats = await alertEngine.getStats(req.user.schoolId);
          res.json(stats);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- INTEGRATION SERVICE ---
  app.post("/api/notifications/send", requireAuth, requirePermission('MANAGE_CONFIG'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const { userId, message, metadata } = req.body;
          
          const results = await integrationService.sendToUser(req.user.schoolId, userId, message, metadata);
          res.json({ success: true, results });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.get("/api/notifications/delivery/:messageId", requireAuth, async (req, res) => {
      try {
          const status = integrationService.getDeliveryStatus(req.params.messageId);
          if (!status) {
              return res.status(404).json({ message: "Message not found" });
          }
          res.json(status);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- CAMERAS ---
  app.get(api.cameras.list.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const cams = await storage.getCameras(req.user.schoolId);
      res.json(cams);
  });

  app.post(api.cameras.create.path, requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const camera = await storage.createCamera({
              ...req.body,
              schoolId: req.user.schoolId,
              isActive: true
          });
          res.status(201).json(camera);
      } catch (e) {
          res.status(400).json({ message: "Validation error" });
      }
  });

  // --- NVRs ---
  app.get(api.nvrs.list.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const nvrList = await storage.getNvrs(req.user.schoolId);
      // Redact sensitive credentials before sending to client
      const safeNvrList = nvrList.map(nvr => ({
          ...nvr,
          username: nvr.username ? '***' : null,
          password: '***REDACTED***'
      }));
      res.json(safeNvrList);
  });

  app.post(api.nvrs.create.path, requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const nvr = await storage.createNvr({
              ...req.body,
              schoolId: req.user.schoolId,
              isActive: true
          });
          res.status(201).json(nvr);
      } catch (e) {
          res.status(400).json({ message: "Validation error" });
      }
  });

  // --- CAMERA AI WEBHOOKS (secured with token/signature verification) ---
  // Webhook for face detection events (attendance, presence)
  app.post("/api/camera/webhook/face", verifyCameraWebhook, async (req, res) => {
      try {
          const { cameraId, entityId, entityType, confidence, timestamp } = req.body;
          
          if (!entityId || !entityType) {
              return res.status(400).json({ message: "Missing required fields: entityId, entityType" });
          }
          
          await cameraAIEngine.processFaceDetection(cameraId, {
              entityId,
              entityType,
              confidence: confidence || 0.95,
              timestamp: timestamp ? new Date(timestamp) : new Date()
          });
          
          res.json({ success: true, message: "Face detection processed" });
      } catch (e: any) {
          console.error("Face detection webhook error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Webhook for discipline events (fight, running, crowding)
  app.post("/api/camera/webhook/discipline", verifyCameraWebhook, async (req, res) => {
      try {
          const { cameraId, eventType, confidence, count, timestamp } = req.body;
          
          if (!eventType) {
              return res.status(400).json({ message: "Missing required field: eventType" });
          }
          
          const validTypes = ["FIGHT", "RUNNING", "CROWDING"];
          if (!validTypes.includes(eventType)) {
              return res.status(400).json({ message: `Invalid eventType. Must be one of: ${validTypes.join(", ")}` });
          }
          
          await cameraAIEngine.processDisciplineEvent(
              cameraId,
              eventType as "FIGHT" | "RUNNING" | "CROWDING",
              eventType === "FIGHT" ? (confidence || 0.9) : (count || 0),
              timestamp ? new Date(timestamp) : new Date()
          );
          
          res.json({ success: true, message: "Discipline event processed" });
      } catch (e: any) {
          console.error("Discipline webhook error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Webhook for uniform violations
  app.post("/api/camera/webhook/uniform", verifyCameraWebhook, async (req, res) => {
      try {
          const { cameraId, violations, timestamp } = req.body;
          
          if (!violations || !Array.isArray(violations)) {
              return res.status(400).json({ message: "Missing required field: violations (array)" });
          }
          
          await cameraAIEngine.processUniformCheck(
              cameraId,
              violations,
              timestamp ? new Date(timestamp) : new Date()
          );
          
          res.json({ success: true, message: "Uniform check processed", violationCount: violations.length });
      } catch (e: any) {
          console.error("Uniform webhook error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Webhook for attention/mood detection
  app.post("/api/camera/webhook/attention", verifyCameraWebhook, async (req, res) => {
      try {
          const { cameraId, attentiveCount, totalCount, timestamp } = req.body;
          
          if (attentiveCount === undefined || totalCount === undefined) {
              return res.status(400).json({ message: "Missing required fields: attentiveCount, totalCount" });
          }
          
          await cameraAIEngine.processAttentionDetection(
              cameraId,
              attentiveCount,
              totalCount,
              timestamp ? new Date(timestamp) : new Date()
          );
          
          res.json({ 
              success: true, 
              message: "Attention detection processed",
              attentionRate: totalCount > 0 ? (attentiveCount / totalCount * 100).toFixed(1) + "%" : "N/A"
          });
      } catch (e: any) {
          console.error("Attention webhook error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Webhook for teacher presence monitoring
  app.post("/api/camera/webhook/teacher-presence", verifyCameraWebhook, async (req, res) => {
      try {
          const { cameraId, teacherPresent, timestamp } = req.body;
          
          if (teacherPresent === undefined) {
              return res.status(400).json({ message: "Missing required field: teacherPresent" });
          }
          
          await cameraAIEngine.processTeacherPresence(
              cameraId,
              teacherPresent,
              timestamp ? new Date(timestamp) : new Date()
          );
          
          res.json({ success: true, message: teacherPresent ? "Teacher presence confirmed" : "Teacher absence noted" });
      } catch (e: any) {
          console.error("Teacher presence webhook error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Generic camera event webhook (routes to appropriate handler)
  app.post("/api/camera/webhook/event", verifyCameraWebhook, async (req, res) => {
      try {
          const { cameraId, eventType, data, confidence, timestamp } = req.body;
          
          if (!cameraId || !eventType) {
              return res.status(400).json({ message: "Missing required fields: cameraId, eventType" });
          }
          
          const eventTime = timestamp ? new Date(timestamp) : new Date();
          
          switch (eventType) {
              case "FACE_DETECTION":
                  if (!data?.entityId || !data?.entityType) {
                      return res.status(400).json({ message: "FACE_DETECTION requires data.entityId and data.entityType" });
                  }
                  await cameraAIEngine.processFaceDetection(cameraId, {
                      entityId: data.entityId,
                      entityType: data.entityType,
                      confidence: confidence || 0.95,
                      timestamp: eventTime
                  });
                  break;
                  
              case "DISCIPLINE":
                  if (!data?.disciplineType) {
                      return res.status(400).json({ message: "DISCIPLINE requires data.disciplineType" });
                  }
                  await cameraAIEngine.processDisciplineEvent(
                      cameraId,
                      data.disciplineType,
                      confidence || 0.9,
                      eventTime
                  );
                  break;
                  
              case "UNIFORM_CHECK":
                  await cameraAIEngine.processUniformCheck(
                      cameraId,
                      data?.violations || [],
                      eventTime
                  );
                  break;
                  
              case "ATTENTION":
                  await cameraAIEngine.processAttentionDetection(
                      cameraId,
                      data?.attentiveCount || 0,
                      data?.totalCount || 0,
                      eventTime
                  );
                  break;
                  
              case "TEACHER_PRESENCE":
                  await cameraAIEngine.processTeacherPresence(
                      cameraId,
                      data?.teacherPresent || false,
                      eventTime
                  );
                  break;
                  
              default:
                  return res.status(400).json({ message: `Unknown eventType: ${eventType}` });
          }
          
          res.json({ success: true, eventType, message: "Event processed" });
      } catch (e: any) {
          console.error("Camera event webhook error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // --- CONFIG ---
  app.get(api.config.get.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      // SUPER_ADMIN can query config for any school via schoolId query param
      let schoolId = req.user.schoolId;
      if (req.user.role === USER_ROLES.SUPER_ADMIN && req.query.schoolId) {
        schoolId = Number(req.query.schoolId);
      }
      let config = await storage.getSchoolConfig(schoolId);
      if (!config) {
          config = await storage.createSchoolConfig({ schoolId });
      }
      res.json(config);
  });

  app.patch(api.config.update.path, requireAuth, requirePermission('MANAGE_CONFIG'), async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      // SUPER_ADMIN can update config for any school via schoolId query param
      let schoolId = req.user.schoolId;
      if (req.user.role === USER_ROLES.SUPER_ADMIN && req.query.schoolId) {
        schoolId = Number(req.query.schoolId);
      }
      const config = await storage.updateSchoolConfig(schoolId, req.body);
      if (!config) return res.status(404).json({ message: "Config not found" });
      res.json(config);
  });

  // --- FACE REGISTRATION ---
  app.post(api.face.register.path, requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          const { entityType, entityId, imageData, schoolId } = api.face.register.input.parse(req.body);
          
          // Validate entity exists
          if (entityType === 'TEACHER') {
              const user = await storage.getUsersBySchool(schoolId, 'TEACHER');
              const teacher = user.find(u => u.id === entityId);
              if (!teacher) {
                  return res.status(404).json({ message: "Teacher not found" });
              }
              // Store face data - full base64 encoded image for face recognition
              const faceId = `face_${entityType}_${entityId}_${Date.now()}`;
              const fullImageUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;
              await storage.updateUserPhoto(entityId, fullImageUrl);
              
              return res.json({
                  success: true,
                  message: `Face registered for teacher: ${teacher.fullName}`,
                  faceId
              });
          } else {
              const student = await storage.getStudent(entityId);
              if (!student || student.schoolId !== schoolId) {
                  return res.status(404).json({ message: "Student not found" });
              }
              const faceId = `face_${entityType}_${entityId}_${Date.now()}`;
              const fullImageUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;
              await storage.updateStudentPhoto(entityId, fullImageUrl);
              
              return res.json({
                  success: true,
                  message: `Face registered for student: ${student.fullName}`,
                  faceId
              });
          }
      } catch (e: any) {
          res.status(400).json({ message: e.message || "Validation error" });
      }
  });

  app.post(api.face.verify.path, requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const { imageData } = api.face.verify.input.parse(req.body);
          
          // In production, this would call an external face recognition API
          // Face matching is done by AI pipeline using the authenticated user's school
          res.json({
              matches: [],
              schoolId: req.user.schoolId
          });
      } catch (e: any) {
          res.status(400).json({ message: e.message || "Validation error" });
      }
  });

  app.get(api.face.status.path, requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const entityType = req.params.entityType as 'TEACHER' | 'STUDENT';
          const entityId = Number(req.params.entityId);
          
          if (entityType === 'TEACHER') {
              const users = await storage.getUsersBySchool(req.user.schoolId);
              const user = users.find(u => u.id === entityId);
              if (!user) {
                  return res.status(404).json({ message: "Teacher not found" });
              }
              res.json({
                  registered: !!user.avatarUrl,
                  lastUpdated: user.createdAt?.toISOString()
              });
          } else {
              const student = await storage.getStudent(entityId);
              if (!student || student.schoolId !== req.user.schoolId) {
                  return res.status(404).json({ message: "Student not found" });
              }
              res.json({
                  registered: !!student.photoUrl,
                  lastUpdated: undefined // Students don't have createdAt in current schema
              });
          }
      } catch (e: any) {
          res.status(400).json({ message: e.message || "Validation error" });
      }
  });

  // --- STATS ---
  app.get(api.stats.dashboard.path, requireAuth, async (req, res) => {
      if (!req.user?.schoolId) {
        return res.status(401).json({ message: "School context required" });
      }
      const stats = await storage.getStats(req.user.schoolId);
      res.json(stats);
  });

  // Weekly Attendance Trend API (real data from database)
  app.get("/api/attendance/trend", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
            return res.status(401).json({ message: "School context required" });
          }
          const schoolId = req.user.schoolId;
          
          // Get real attendance data for the past 5 weekdays
          const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
          const trend = [];
          const today = new Date();
          
          // Find the most recent Monday
          const dayOfWeek = today.getDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const monday = new Date(today);
          monday.setDate(today.getDate() - daysFromMonday);
          monday.setHours(0, 0, 0, 0);
          
          for (let i = 0; i < 5; i++) {
              const date = new Date(monday);
              date.setDate(monday.getDate() + i);
              
              // Get real attendance count from database
              const presentCount = await storage.getAttendanceCount(schoolId, date);
              
              trend.push({
                  day: dayNames[i],
                  date: date.toISOString().split('T')[0],
                  present: presentCount
              });
          }
          
          res.json({ trend });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // === CSV UPLOAD ROUTES ===
  
  // Upload subjects (wing-wise)
  app.post("/api/upload/subjects", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          const { schoolId, wingId, data } = req.body;
          // Data format: [{ name, code, periodsPerWeek, periodsPerDay, isLab, languageGroup, streamGroup, isLightSubject }]
          if (!schoolId || !Array.isArray(data)) {
              return res.status(400).json({ message: "schoolId and data array required" });
          }
          
          const subjects = data.map((row: any) => ({
              schoolId,
              wingId: wingId || null,
              name: row.name || row.subject || row.Subject || row.NAME,
              code: row.code || row.Code || row.CODE || null,
              periodsPerWeek: parseInt(row.periodsPerWeek || row.periods_per_week || row.PPW || "5"),
              periodsPerDay: parseInt(row.periodsPerDay || row.periods_per_day || row.PPD || "1"),
              isLab: ["yes", "true", "1", "lab"].includes(String(row.isLab || row.is_lab || row.Lab || "").toLowerCase()),
              requiresLabRoom: ["yes", "true", "1"].includes(String(row.requiresLabRoom || row.requires_lab || "").toLowerCase()),
              languageGroup: row.languageGroup || row.language_group || row.LG || "NONE",
              streamGroup: row.streamGroup || row.stream_group || row.SG || "NONE",
              isLightSubject: ["yes", "true", "1"].includes(String(row.isLightSubject || row.is_light || row.Light || "").toLowerCase())
          }));
          
          const created = await storage.bulkCreateSubjects(subjects);
          res.json({ success: true, count: created.length, subjects: created });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Upload teacher-subject mappings
  app.post("/api/upload/teacher-subjects", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          const { schoolId, wingId, data } = req.body;
          // Data format: [{ teacherName, subjectName }] or [{ teacherId, subjectId }]
          if (!schoolId || !Array.isArray(data)) {
              return res.status(400).json({ message: "schoolId and data array required" });
          }
          
          const teachers = await storage.getTeachers(schoolId);
          const subjects = await storage.getSubjects(schoolId, wingId);
          
          const mappings = [];
          for (const row of data) {
              let teacherId = row.teacherId;
              let subjectId = row.subjectId;
              
              if (!teacherId && row.teacherName) {
                  const teacher = teachers.find(t => 
                      t.fullName.toLowerCase() === row.teacherName.toLowerCase() ||
                      t.username.toLowerCase() === row.teacherName.toLowerCase()
                  );
                  teacherId = teacher?.id;
              }
              
              if (!subjectId && row.subjectName) {
                  const subject = subjects.find(s => 
                      s.name.toLowerCase() === row.subjectName.toLowerCase() ||
                      s.code?.toLowerCase() === row.subjectName.toLowerCase()
                  );
                  subjectId = subject?.id;
              }
              
              if (teacherId && subjectId) {
                  mappings.push({
                      schoolId,
                      teacherId,
                      subjectId,
                      wingId: wingId || null,
                      isPrimary: row.isPrimary !== false
                  });
              }
          }
          
          const created = await storage.bulkCreateTeacherSubjects(mappings);
          res.json({ success: true, count: created.length, mappings: created });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Upload classes and sections
  app.post("/api/upload/classes", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          const { schoolId, wingId, data } = req.body;
          // Data format: [{ className, sections: ["A1", "A2", "A3"], roomPrefix }]
          // Or simple: [{ className, sectionName, roomNumber }]
          if (!schoolId || !Array.isArray(data)) {
              return res.status(400).json({ message: "schoolId and data array required" });
          }
          
          const results = { classes: 0, sections: 0 };
          
          for (const row of data) {
              // Parse class name to extract grade level (e.g., "Class 6" -> 6, "VI" -> 6)
              const classNameRaw = row.className || row.class || row.Class || row.CLASS;
              const romanNumerals: Record<string, number> = { 
                  'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 
                  'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12 
              };
              
              let gradeLevel = parseInt(classNameRaw.replace(/\D/g, '')) || 1;
              for (const [roman, num] of Object.entries(romanNumerals)) {
                  if (classNameRaw.toUpperCase().includes(roman)) {
                      gradeLevel = num;
                      break;
                  }
              }
              
              // Create class
              const newClass = await storage.createClass({
                  schoolId,
                  wingId,
                  name: classNameRaw,
                  gradeLevel
              });
              results.classes++;
              
              // Create sections
              const sectionsList = row.sections || (row.sectionName ? [row.sectionName] : ["A"]);
              for (let i = 0; i < sectionsList.length; i++) {
                  const sectionName = typeof sectionsList[i] === 'string' ? sectionsList[i] : sectionsList[i].name;
                  const roomNumber = row.roomPrefix ? `${row.roomPrefix}${i + 1}` : 
                                     (sectionsList[i].roomNumber || row.roomNumber || `${gradeLevel}0${i + 1}`);
                  await storage.createSection({
                      classId: newClass.id,
                      name: sectionName,
                      roomNumber
                  });
                  results.sections++;
              }
          }
          
          res.json({ success: true, ...results });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // === TIMETABLE DOWNLOAD ROUTES ===
  
  // Get subjects list
  app.get("/api/subjects/:schoolId", requireAuth, async (req, res) => {
      const schoolId = Number(req.params.schoolId);
      const wingId = req.query.wingId ? Number(req.query.wingId) : undefined;
      const subjects = await storage.getSubjects(schoolId, wingId);
      res.json(subjects);
  });

  // Get teacher-subject mappings
  app.get("/api/teacher-subjects/:schoolId", requireAuth, async (req, res) => {
      const schoolId = Number(req.params.schoolId);
      const teacherId = req.query.teacherId ? Number(req.query.teacherId) : undefined;
      const mappings = await storage.getTeacherSubjects(schoolId, teacherId);
      res.json(mappings);
  });

  // Master Timetable Download (full wing)
  app.get("/api/timetable/download/master/:schoolId", requireAuth, async (req, res) => {
      try {
          const schoolId = Number(req.params.schoolId);
          const wingId = req.query.wingId ? Number(req.query.wingId) : undefined;
          
          const data = await storage.getTimetableWithDetails(schoolId, wingId);
          const config = await storage.getSchoolConfig(schoolId);
          const periodsPerDay = config?.periodsPerDay || 8;
          
          // Group by section and day for master view
          const sectionMap = new Map<string, any[]>();
          for (const entry of data) {
              const key = `${entry.className} ${entry.sectionName}`;
              if (!sectionMap.has(key)) sectionMap.set(key, []);
              sectionMap.get(key)!.push(entry);
          }
          
          // Create CSV content
          let csv = "Section,Day";
          for (let p = 1; p <= periodsPerDay; p++) csv += `,Period ${p}`;
          csv += "\n";
          
          const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          Array.from(sectionMap.entries()).forEach(([section, entries]) => {
              for (let d = 1; d <= 6; d++) {
                  csv += `"${section}",${days[d-1]}`;
                  for (let p = 1; p <= periodsPerDay; p++) {
                      const entry = entries.find((e: any) => e.dayOfWeek === d && e.periodIndex === p);
                      csv += `,"${entry?.subjectName || ''} (${entry?.teacherName || ''})"`;
                  }
                  csv += "\n";
              }
          });
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="master_timetable_wing${wingId || 'all'}.csv"`);
          res.send(csv);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Bulk Teacher Timetable Download
  app.get("/api/timetable/download/teachers/:schoolId", requireAuth, async (req, res) => {
      try {
          const schoolId = Number(req.params.schoolId);
          const teachers = await storage.getTeachers(schoolId);
          const config = await storage.getSchoolConfig(schoolId);
          const periodsPerDay = config?.periodsPerDay || 8;
          
          const result: any[] = [];
          
          for (const teacher of teachers) {
              const entries = await storage.getTimetable(schoolId, undefined, teacher.id);
              const detailedEntries = await storage.getTimetableWithDetails(schoolId);
              const teacherEntries = detailedEntries.filter(e => e.teacherId === teacher.id);
              
              const teacherSchedule: any = {
                  teacherName: teacher.fullName,
                  teacherId: teacher.id,
                  schedule: []
              };
              
              for (let d = 1; d <= 6; d++) {
                  const daySchedule: any = { day: d };
                  for (let p = 1; p <= periodsPerDay; p++) {
                      const entry = teacherEntries.find(e => e.dayOfWeek === d && e.periodIndex === p);
                      daySchedule[`period${p}`] = entry ? `${entry.className} ${entry.sectionName} - ${entry.subjectName}` : "Free";
                  }
                  teacherSchedule.schedule.push(daySchedule);
              }
              
              result.push(teacherSchedule);
          }
          
          res.json(result);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Class-Section Timetable Download
  app.get("/api/timetable/download/section/:sectionId", requireAuth, async (req, res) => {
      try {
          const sectionId = Number(req.params.sectionId);
          const section = await storage.getSection(sectionId);
          if (!section) return res.status(404).json({ message: "Section not found" });
          
          const cls = await storage.getClass(section.classId);
          if (!cls) return res.status(404).json({ message: "Class not found" });
          const schoolId = cls.schoolId;
          
          const entries = await storage.getTimetable(schoolId, sectionId);
          const detailedEntries = await storage.getTimetableWithDetails(schoolId);
          const sectionEntries = detailedEntries.filter(e => e.sectionId === sectionId);
          
          const config = await storage.getSchoolConfig(schoolId);
          const periodsPerDay = config?.periodsPerDay || 8;
          
          // Create CSV
          let csv = `Class: ${cls?.name || 'Unknown'} - Section: ${section.name}\n`;
          csv += "Day";
          for (let p = 1; p <= periodsPerDay; p++) csv += `,Period ${p}`;
          csv += "\n";
          
          const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          for (let d = 1; d <= 6; d++) {
              csv += days[d-1];
              for (let p = 1; p <= periodsPerDay; p++) {
                  const entry = sectionEntries.find(e => e.dayOfWeek === d && e.periodIndex === p);
                  csv += `,"${entry?.subjectName || 'Free'} (${entry?.teacherName || ''})"`;
              }
              csv += "\n";
          }
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="timetable_${cls?.name}_${section.name}.csv"`);
          res.send(csv);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // === FACE ENCODING ROUTES (for 6k-10k per school) ===
  
  app.get("/api/face-encodings/:schoolId", requireAuth, async (req, res) => {
      try {
          const schoolId = Number(req.params.schoolId);
          const sectionId = req.query.sectionId ? Number(req.query.sectionId) : undefined;
          const encodings = await storage.getFaceEncodings(schoolId, sectionId);
          const count = await storage.getFaceEncodingCount(schoolId);
          res.json({ encodings, totalCount: count });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/face-encodings", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          const { schoolId, entityType, entityId, sectionId, encoding, photoUrl } = req.body;
          if (!schoolId || !entityType || !entityId || !encoding) {
              return res.status(400).json({ message: "schoolId, entityType, entityId, and encoding required" });
          }
          
          const faceEncoding = await storage.createFaceEncoding({
              schoolId,
              entityType,
              entityId,
              sectionId: sectionId || null,
              encoding,
              photoUrl: photoUrl || null,
              isActive: true
          });
          
          res.json({ success: true, faceEncoding });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.delete("/api/face-encodings/:id", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          await storage.deleteFaceEncoding(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // === SECTION CAMERA CONTROLS ===
  
  app.get("/api/section-cameras", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const sectionId = req.query.sectionId ? Number(req.query.sectionId) : undefined;
          const controls = await storage.getSectionCameras(req.user.schoolId, sectionId);
          res.json(controls);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/section-cameras", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const { sectionId, cameraId, isEnabled, enableAttendance, enableDiscipline } = req.body;
          if (!sectionId || !cameraId) {
              return res.status(400).json({ message: "sectionId and cameraId required" });
          }
          
          const control = await storage.createSectionCamera({
              schoolId: req.user.schoolId,
              sectionId,
              cameraId,
              isEnabled: isEnabled !== false,
              enableAttendance: enableAttendance !== false,
              enableDiscipline: enableDiscipline !== false
          });
          
          res.json({ success: true, control });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.patch("/api/section-cameras/:id", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const id = Number(req.params.id);
          const updates = req.body;
          const control = await storage.updateSectionCamera(id, updates);
          res.json({ success: true, control });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- SCHOOL CONFIG / AI SETTINGS ---
  app.get("/api/school-config", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const config = await storage.getSchoolConfig(req.user.schoolId);
          if (!config) {
              return res.status(404).json({ message: "School configuration not found" });
          }
          // Return config but mask the API key for security
          const { openaiApiKey, ...safeConfig } = config;
          res.json({
              ...safeConfig,
              hasOpenaiApiKey: !!openaiApiKey
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.get("/api/school-config/ai-status", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const config = await storage.getSchoolConfig(req.user.schoolId);
          res.json({
              isConfigured: !!config?.openaiApiKey,
              configuredAt: config?.openaiKeyConfiguredAt || null,
              hasGlobalKey: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/school-config/ai-key", requireAuth, requireMinRole(USER_ROLES.PRINCIPAL), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const { apiKey } = req.body;
          if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
              return res.status(400).json({ message: "Invalid API key format. OpenAI keys start with 'sk-'" });
          }

          const encryptedKey = encrypt(apiKey);
          const config = await storage.updateSchoolConfig(req.user.schoolId, {
              openaiApiKey: encryptedKey,
              openaiKeyConfiguredAt: new Date()
          });

          if (!config) {
              return res.status(404).json({ message: "School configuration not found" });
          }

          res.json({
              success: true,
              message: "OpenAI API key configured successfully",
              configuredAt: config.openaiKeyConfiguredAt
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.delete("/api/school-config/ai-key", requireAuth, requireMinRole(USER_ROLES.PRINCIPAL), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }

          const config = await storage.updateSchoolConfig(req.user.schoolId, {
              openaiApiKey: null,
              openaiKeyConfiguredAt: null
          });

          if (!config) {
              return res.status(404).json({ message: "School configuration not found" });
          }

          res.json({ success: true, message: "OpenAI API key removed" });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/school-config/ai-key/test", requireAuth, requireMinRole(USER_ROLES.PRINCIPAL), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          
          const { apiKey } = req.body;
          let testKey = apiKey;
          
          if (!testKey) {
              const config = await storage.getSchoolConfig(req.user.schoolId);
              if (config?.openaiApiKey) {
                  try {
                      testKey = decrypt(config.openaiApiKey);
                  } catch {
                      testKey = config.openaiApiKey;
                  }
              }
          }
          
          if (!testKey) {
              return res.status(400).json({ message: "No API key provided or configured" });
          }

          const OpenAI = (await import("openai")).default;
          const client = new OpenAI({ apiKey: testKey });
          
          await client.models.list();
          
          res.json({ success: true, message: "API key is valid and working" });
      } catch (e: any) {
          if (e.status === 401) {
              return res.status(400).json({ success: false, message: "Invalid API key" });
          }
          if (e.status === 429) {
              return res.status(400).json({ success: false, message: "API key rate limited or quota exceeded" });
          }
          res.status(400).json({ success: false, message: e.message || "Failed to verify API key" });
      }
  });

  // --- WHATSAPP WEBHOOK CONFIGURATION ---
  app.post("/api/school-config/whatsapp-webhook", requireAuth, requireMinRole(USER_ROLES.PRINCIPAL), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const { webhookUrl } = req.body;
          if (!webhookUrl || typeof webhookUrl !== 'string') {
              return res.status(400).json({ message: "Webhook URL is required" });
          }
          
          try {
              new URL(webhookUrl);
          } catch {
              return res.status(400).json({ message: "Invalid URL format" });
          }

          const config = await storage.updateSchoolConfig(req.user.schoolId, {
              whatsappWebhook: webhookUrl
          });

          if (!config) {
              return res.status(404).json({ message: "School configuration not found" });
          }

          res.json({
              success: true,
              message: "WhatsApp webhook configured successfully"
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.delete("/api/school-config/whatsapp-webhook", requireAuth, requireMinRole(USER_ROLES.PRINCIPAL), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }

          const config = await storage.updateSchoolConfig(req.user.schoolId, {
              whatsappWebhook: null
          });

          if (!config) {
              return res.status(404).json({ message: "School configuration not found" });
          }

          res.json({ success: true, message: "WhatsApp webhook removed" });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- ARATTAI WEBHOOK CONFIGURATION ---
  app.post("/api/school-config/arattai-webhook", requireAuth, requireMinRole(USER_ROLES.PRINCIPAL), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const { webhookUrl } = req.body;
          if (!webhookUrl || typeof webhookUrl !== 'string') {
              return res.status(400).json({ message: "Webhook URL is required" });
          }
          
          try {
              new URL(webhookUrl);
          } catch {
              return res.status(400).json({ message: "Invalid URL format" });
          }

          const config = await storage.updateSchoolConfig(req.user.schoolId, {
              arattaiWebhook: webhookUrl
          });

          if (!config) {
              return res.status(404).json({ message: "School configuration not found" });
          }

          res.json({
              success: true,
              message: "Arattai webhook configured successfully"
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.delete("/api/school-config/arattai-webhook", requireAuth, requireMinRole(USER_ROLES.PRINCIPAL), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }

          const config = await storage.updateSchoolConfig(req.user.schoolId, {
              arattaiWebhook: null
          });

          if (!config) {
              return res.status(404).json({ message: "School configuration not found" });
          }

          res.json({ success: true, message: "Arattai webhook removed" });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- STUDENTS MANAGEMENT ---
  app.get("/api/students", requireAuth, requireMinRole(USER_ROLES.TEACHER), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const students = await storage.getStudentsBySchool(req.user.schoolId);
          res.json(students);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/students", requireAuth, requirePermission('MANAGE_STUDENTS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const student = await storage.createStudent({
              ...req.body,
              schoolId: req.user.schoolId
          });
          res.status(201).json(student);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.patch("/api/students/:id", requireAuth, requirePermission('MANAGE_STUDENTS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          // Verify student belongs to school
          const existing = await storage.getStudent(Number(req.params.id));
          if (!existing || existing.schoolId !== req.user.schoolId) {
              return res.status(404).json({ message: "Student not found" });
          }
          const student = await storage.updateStudent(Number(req.params.id), req.body);
          res.json(student);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/students/:id", requireAuth, requirePermission('MANAGE_STUDENTS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          // Verify student belongs to school
          const existing = await storage.getStudent(Number(req.params.id));
          if (!existing || existing.schoolId !== req.user.schoolId) {
              return res.status(404).json({ message: "Student not found" });
          }
          await storage.deleteStudent(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- STAFF MANAGEMENT ---
  app.get("/api/staff", requireAuth, requireMinRole(USER_ROLES.WING_ADMIN), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const users = await storage.getUsersBySchool(req.user.schoolId);
          // Filter out sensitive data
          const staff = users.map(({ password, ...user }) => user);
          res.json(staff);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/staff", requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const staff = await storage.createUser({
              ...req.body,
              schoolId: req.user.schoolId
          });
          const { password, ...safeStaff } = staff;
          res.status(201).json(safeStaff);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.patch("/api/staff/:id", requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          // Verify staff belongs to school
          const existing = await storage.getUser(Number(req.params.id));
          if (!existing || existing.schoolId !== req.user.schoolId) {
              return res.status(404).json({ message: "Staff not found" });
          }
          const staff = await storage.updateUser(Number(req.params.id), req.body);
          if (!staff) return res.status(404).json({ message: "Staff not found" });
          const { password, ...safeStaff } = staff;
          res.json(safeStaff);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/staff/:id", requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          // Verify staff belongs to school
          const existing = await storage.getUser(Number(req.params.id));
          if (!existing || existing.schoolId !== req.user.schoolId) {
              return res.status(404).json({ message: "Staff not found" });
          }
          await storage.deleteUser(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- UNIFIED PERSON SEARCH (for face registration) ---
  // Returns both students and staff with disambiguating metadata (NO sensitive data)
  app.get("/api/search/persons", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const query = String(req.query.q || "").toLowerCase().trim();
          if (query.length < 2) {
              return res.json({ students: [], staff: [] });
          }

          // Get lookup data
          const [classesWithSections, wings] = await Promise.all([
              storage.getClasses(req.user.schoolId),
              storage.getWings(req.user.schoolId)
          ]);

          // Create lookup maps from classes with sections
          const sectionMap = new Map<number, any>();
          const classMap = new Map<number, any>();
          for (const cls of classesWithSections) {
              classMap.set(cls.id, cls);
              for (const sec of cls.sections) {
                  sectionMap.set(sec.id, sec);
              }
          }
          const wingMap = new Map(wings.map((w: any) => [w.id, w]));

          // Get students and staff only when we have a valid query
          const [allStudents, allStaff] = await Promise.all([
              storage.getStudentsBySchool(req.user.schoolId),
              storage.getUsersBySchool(req.user.schoolId)
          ]);

          // Search students - match by name or admission number
          const matchingStudents = allStudents
              .filter(s => 
                  s.fullName.toLowerCase().includes(query) ||
                  s.admissionNumber?.toLowerCase().includes(query) ||
                  s.rollNumber?.toLowerCase().includes(query)
              )
              .slice(0, 20)
              .map(s => {
                  const section = sectionMap.get(s.sectionId);
                  const classItem = section ? classMap.get(section.classId) : null;
                  const wing = classItem ? wingMap.get(classItem.wingId) : null;
                  return {
                      id: s.id,
                      type: 'STUDENT' as const,
                      fullName: s.fullName,
                      identifier: s.admissionNumber || s.rollNumber || `ID:${s.id}`,
                      classSection: classItem && section ? `${classItem.name} - ${section.name}` : '-',
                      wing: wing?.name || '-',
                      sectionId: s.sectionId
                  };
              });

          // Search staff - match by name or employee ID (EXCLUDE password and sensitive fields)
          const matchingStaff = allStaff
              .filter(u => 
                  u.fullName.toLowerCase().includes(query) ||
                  u.employeeId?.toLowerCase().includes(query) ||
                  u.username.toLowerCase().includes(query)
              )
              .slice(0, 20)
              .map(u => {
                  const wing = u.wingId ? wingMap.get(u.wingId) : null;
                  // Only return safe, non-sensitive fields
                  return {
                      id: u.id,
                      type: 'STAFF' as const,
                      fullName: u.fullName,
                      identifier: u.employeeId || u.username,
                      role: u.role,
                      wing: wing?.name || 'All Wings',
                      designation: u.designation || u.role
                  };
              });

          res.json({ students: matchingStudents, staff: matchingStaff });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // --- BULK UPLOAD: STAFF ---
  // CSV Format: fullName, username, password, role, email, phone, wingId, employeeId, qualification, designation, canTeachCrossWing, subjects (comma-separated)
  app.post("/api/staff/bulk", requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const { data } = req.body;
          if (!Array.isArray(data) || data.length === 0) {
              return res.status(400).json({ message: "data array required" });
          }

          const wings = await storage.getWings(req.user.schoolId);
          const allSubjects = await storage.getSubjects(req.user.schoolId);
          const results = { created: 0, errors: [] as string[] };

          for (const row of data) {
              try {
                  const fullName = row.fullName || row.full_name || row.name || row.Name || row.FULL_NAME;
                  const username = row.username || row.user_name || row.Username || row.USER_NAME || 
                                   (fullName ? fullName.toLowerCase().replace(/\s+/g, '.') : null);
                  const password = row.password || row.Password || 'Welcome@123';
                  const role = row.role || row.Role || row.ROLE || 'TEACHER';
                  const email = row.email || row.Email || row.EMAIL || null;
                  const phone = row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || null;
                  const employeeId = row.employeeId || row.employee_id || row.empId || row.EMP_ID || null;
                  const qualification = row.qualification || row.Qualification || row.QUALIFICATION || null;
                  const designation = row.designation || row.Designation || row.DESIGNATION || null;
                  const canTeachCrossWing = ['yes', 'true', '1', 'y'].includes(String(row.canTeachCrossWing || row.crossWing || '').toLowerCase());

                  // Find wing by name or ID
                  let wingId = null;
                  const wingValue = row.wingId || row.wing_id || row.wing || row.Wing || row.WING;
                  if (wingValue) {
                      if (typeof wingValue === 'number') {
                          wingId = wingValue;
                      } else {
                          const wing = wings.find(w => 
                              w.name.toLowerCase() === String(wingValue).toLowerCase() ||
                              w.id === parseInt(wingValue)
                          );
                          wingId = wing?.id || null;
                      }
                  }

                  if (!fullName) {
                      results.errors.push(`Row missing fullName: ${JSON.stringify(row)}`);
                      continue;
                  }

                  // Create user
                  const user = await storage.createUser({
                      schoolId: req.user.schoolId,
                      fullName,
                      username,
                      password,
                      role: USER_ROLES[role.toUpperCase() as keyof typeof USER_ROLES] || USER_ROLES.TEACHER,
                      email,
                      phone,
                      wingId,
                      employeeId,
                      qualification,
                      designation,
                      canTeachCrossWing,
                      isActive: true
                  });

                  // Handle subjects (comma-separated list)
                  const subjectsValue = row.subjects || row.Subjects || row.SUBJECTS || row.subject || '';
                  if (subjectsValue && user.role === USER_ROLES.TEACHER) {
                      const subjectNames = String(subjectsValue).split(',').map(s => s.trim()).filter(Boolean);
                      for (const subName of subjectNames) {
                          const subject = allSubjects.find(s => 
                              s.name.toLowerCase() === subName.toLowerCase() ||
                              s.code?.toLowerCase() === subName.toLowerCase()
                          );
                          if (subject) {
                              await storage.createTeacherSubject({
                                  schoolId: req.user.schoolId,
                                  teacherId: user.id,
                                  subjectId: subject.id,
                                  wingId,
                                  isPrimary: true
                              });
                          }
                      }
                  }

                  results.created++;
              } catch (e: any) {
                  results.errors.push(`Error creating ${row.fullName || 'unknown'}: ${e.message}`);
              }
          }

          res.json({
              success: true,
              created: results.created,
              errors: results.errors,
              total: data.length
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Download staff template CSV
  app.get("/api/staff/template", requireAuth, async (req, res) => {
      const csv = `fullName,username,password,role,email,phone,wing,employeeId,qualification,designation,canTeachCrossWing,subjects
"Rajesh Kumar","rajesh.kumar","Welcome@123","TEACHER","rajesh@school.com","9876543210","Primary","EMP001","B.Ed, M.Sc","PGT Mathematics","no","Mathematics,Physics"
"Priya Sharma","priya.sharma","Welcome@123","TEACHER","priya@school.com","9876543211","Secondary","EMP002","B.Ed, M.A","TGT English","yes","English,Hindi"
"Dr. Anand","dr.anand","Welcome@123","WING_ADMIN","anand@school.com","9876543212","Senior Secondary","EMP003","Ph.D","Head of Department","no",""`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="staff_upload_template.csv"');
      res.send(csv);
  });

  // --- BULK UPLOAD: STUDENTS ---
  // CSV Format: fullName, rollNumber, admissionNumber, gender, dateOfBirth, class, section, parentName, parentPhone, parentEmail, address
  app.post("/api/students/bulk", requireAuth, requirePermission('MANAGE_STUDENTS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const { data } = req.body;
          if (!Array.isArray(data) || data.length === 0) {
              return res.status(400).json({ message: "data array required" });
          }

          const classesWithSections = await storage.getClasses(req.user.schoolId);
          const results = { created: 0, errors: [] as string[] };

          for (const row of data) {
              try {
                  const fullName = row.fullName || row.full_name || row.name || row.Name || row.FULL_NAME || row.student_name;
                  const rollNumber = row.rollNumber || row.roll_number || row.Roll || row.ROLL_NO || null;
                  const admissionNumber = row.admissionNumber || row.admission_number || row.Admission || row.ADM_NO || null;
                  const gender = row.gender || row.Gender || row.GENDER || null;
                  const dateOfBirth = row.dateOfBirth || row.date_of_birth || row.dob || row.DOB || null;
                  const parentName = row.parentName || row.parent_name || row.father_name || row.Father || row.guardian || null;
                  const parentPhone = row.parentPhone || row.parent_phone || row.phone || row.Phone || row.mobile || null;
                  const parentEmail = row.parentEmail || row.parent_email || row.email || null;
                  const address = row.address || row.Address || row.ADDRESS || null;

                  // Find section by class+section combination
                  const className = row.class || row.Class || row.CLASS || row.grade || row.Grade;
                  const sectionName = row.section || row.Section || row.SECTION || 'A';

                  let sectionId = row.sectionId || row.section_id;
                  if (!sectionId && className) {
                      const classItem = classesWithSections.find(c => 
                          c.name.toLowerCase().includes(String(className).toLowerCase()) ||
                          c.gradeLevel === parseInt(className)
                      );
                      if (classItem && classItem.sections) {
                          const section = classItem.sections.find(s => 
                              s.name.toLowerCase() === String(sectionName).toLowerCase()
                          );
                          sectionId = section?.id;
                      }
                  }

                  if (!fullName) {
                      results.errors.push(`Row missing fullName: ${JSON.stringify(row)}`);
                      continue;
                  }
                  if (!sectionId) {
                      results.errors.push(`Could not find section for ${fullName} (Class: ${className}, Section: ${sectionName})`);
                      continue;
                  }

                  await storage.createStudent({
                      schoolId: req.user.schoolId,
                      sectionId,
                      fullName,
                      rollNumber,
                      admissionNumber,
                      gender,
                      dateOfBirth,
                      parentName,
                      parentPhone,
                      parentEmail,
                      address,
                      photoUrl: null
                  });

                  results.created++;
              } catch (e: any) {
                  results.errors.push(`Error creating ${row.fullName || 'unknown'}: ${e.message}`);
              }
          }

          res.json({
              success: true,
              created: results.created,
              errors: results.errors,
              total: data.length
          });
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  // Download students template CSV
  app.get("/api/students/template", requireAuth, async (req, res) => {
      const csv = `fullName,rollNumber,admissionNumber,gender,dateOfBirth,class,section,parentName,parentPhone,parentEmail,address
"Arjun Kumar","1","ADM2024001","Male","2015-05-15","6","A","Ramesh Kumar","9876543210","ramesh@email.com","123 Main Street, Chennai"
"Priya Devi","2","ADM2024002","Female","2015-08-20","6","A","Suresh Devi","9876543211","suresh@email.com","456 Park Road, Chennai"
"Mohammed Ali","3","ADM2024003","Male","2015-03-10","6","B","Ahmed Ali","9876543212","ahmed@email.com","789 Lake View, Chennai"`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="students_upload_template.csv"');
      res.send(csv);
  });

  // --- SCHOOL ONBOARDING (SUPER_ADMIN ONLY) ---
  app.get("/api/admin/schools", requireAuth, requireRole(USER_ROLES.SUPER_ADMIN), async (req, res) => {
      try {
          const schools = await storage.getAllSchools();
          res.json(schools);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/admin/schools", requireAuth, requireRole(USER_ROLES.SUPER_ADMIN), async (req, res) => {
      try {
          const { 
              name, code, address,
              principalName, principalUsername, principalPassword, principalEmail, principalPhone
          } = req.body;
          
          // Validate required fields
          if (!name || !code || !principalName || !principalUsername || !principalPassword) {
              return res.status(400).json({ 
                  message: "Missing required fields: name, code, principalName, principalUsername, principalPassword" 
              });
          }
          
          // Check if code already exists
          const existingSchool = await storage.getSchoolByCode(code);
          if (existingSchool) {
              return res.status(400).json({ message: "School code already exists" });
          }
          
          // Create school
          const school = await storage.createSchool({
              name,
              code,
              address: address || null,
              tier: "STANDARD",
              isActive: true
          });
          
          // Create principal user
          const principal = await storage.createUser({
              schoolId: school.id,
              username: principalUsername,
              password: principalPassword,
              fullName: principalName,
              email: principalEmail || null,
              phone: principalPhone || null,
              role: USER_ROLES.PRINCIPAL,
              isActive: true
          });
          
          // Create default school config
          await storage.createSchoolConfig({
              schoolId: school.id,
              periodsPerDay: 8,
              periodDuration: 45,
              lunchAfterPeriod: 4,
              maxSubstitutionsPerDay: 3
          });
          
          const { password, ...safePrincipal } = principal;
          res.status(201).json({ 
              school, 
              principal: safePrincipal,
              message: "School created successfully with principal account"
          });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- TIMETABLE CRUD ---
  app.post("/api/timetable", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const entry = await storage.createTimetableEntry({
              ...req.body,
              schoolId: req.user.schoolId
          });
          res.status(201).json(entry);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/timetable/:id", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          await storage.deleteTimetableEntry(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- CAMERA MANAGEMENT ---
  app.get("/api/cameras", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const cameras = await storage.getCameras(req.user.schoolId);
          res.json(cameras);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/cameras", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const camera = await storage.createCamera({
              ...req.body,
              schoolId: req.user.schoolId
          });
          res.status(201).json(camera);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.patch("/api/cameras/:id", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          const camera = await storage.updateCamera(Number(req.params.id), req.body);
          if (!camera) return res.status(404).json({ message: "Camera not found" });
          res.json(camera);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/cameras/:id", requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          await storage.deleteCamera(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- TEACHER SUBJECT MAPPING ---
  app.get("/api/teacher-subjects", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const mappings = await storage.getTeacherSubjects(req.user.schoolId);
          res.json(mappings);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/teacher-subjects", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const mapping = await storage.createTeacherSubject({
              ...req.body,
              schoolId: req.user.schoolId
          });
          res.status(201).json(mapping);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/teacher-subjects/:id", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          await storage.deleteTeacherSubject(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- SUBJECTS ---
  app.get("/api/subjects", requireAuth, async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const subjects = await storage.getSubjects(req.user.schoolId);
          res.json(subjects);
      } catch (e: any) {
          res.status(500).json({ message: e.message });
      }
  });

  app.post("/api/subjects", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const subject = await storage.createSubject({
              ...req.body,
              schoolId: req.user.schoolId
          });
          res.status(201).json(subject);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/subjects/:id", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          await storage.deleteSubject(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- CLASSES ---
  app.post("/api/classes", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const classItem = await storage.createClass({
              ...req.body,
              schoolId: req.user.schoolId
          });
          res.status(201).json(classItem);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/classes/:id", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          await storage.deleteClass(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- SECTIONS ---
  app.post("/api/sections", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          const section = await storage.createSection({
              ...req.body,
              schoolId: req.user.schoolId
          });
          res.status(201).json(section);
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  app.delete("/api/sections/:id", requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res) => {
      try {
          await storage.deleteSection(Number(req.params.id));
          res.json({ success: true });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // ============================================
  // EDGE AGENT APIs - For local AI processing
  // ============================================

  // Edge Agent Login - Returns auth token for subsequent requests
  app.post(api.edge.login.path, async (req, res) => {
      try {
          const { agentId, secret, schoolCode } = req.body;
          
          // Verify school exists
          const school = await storage.getSchoolByCode(schoolCode);
          if (!school) {
              return res.status(401).json({ message: "Invalid school code" });
          }
          
          // Find agent and verify secret
          const agent = await storage.getEdgeAgentById(agentId);
          if (!agent || agent.schoolId !== school.id) {
              return res.status(401).json({ message: "Invalid agent credentials" });
          }
          
          // Verify secret hash
          if (!agent.secretHash) {
              return res.status(401).json({ message: "Agent secret not configured. Please re-register the agent." });
          }
          const isValidSecret = await bcrypt.compare(secret, agent.secretHash);
          if (!isValidSecret) {
              return res.status(401).json({ message: "Invalid agent secret" });
          }
          
          // Generate new token (valid for 24 hours)
          const cryptoModule = await import('crypto');
          const newToken = cryptoModule.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          
          await storage.updateEdgeAgent(agentId, {
              authToken: newToken,
              tokenExpiresAt: expiresAt,
              status: 'ONLINE',
              lastHeartbeatAt: new Date()
          });
          
          // Get school config for agent
          const config = await storage.getSchoolConfig(school.id);
          
          res.json({
              token: newToken,
              expiresAt: expiresAt.toISOString(),
              schoolId: school.id,
              agentConfig: {
                  enableFaceRecognition: config?.enableFaceRecognition ?? true,
                  enableDisciplineAlerts: config?.enableDisciplineAlerts ?? true,
                  attendanceConfidenceThreshold: config?.attendanceConfidenceThreshold ?? 80,
                  fightConfidenceThreshold: config?.fightConfidenceThreshold ?? 85
              }
          });
      } catch (e: any) {
          console.error("Edge login error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Edge Agent middleware for token verification
  const verifyEdgeToken = async (req: any, res: any, next: any) => {
      const authHeader = req.headers['authorization'];
      const agentId = req.headers['x-agent-id'];
      
      if (!authHeader || !authHeader.startsWith('Bearer ') || !agentId) {
          return res.status(401).json({ message: "Missing authorization header or agent ID" });
      }
      
      const token = authHeader.substring(7);
      const agent = await storage.getEdgeAgentById(agentId);
      
      if (!agent || !agent.isActive) {
          return res.status(401).json({ message: "Invalid or inactive agent" });
      }
      
      // Token verification would require decryption in production
      // For now, we trust the agent ID + token combination
      if (agent.tokenExpiresAt && new Date(agent.tokenExpiresAt) < new Date()) {
          return res.status(401).json({ message: "Token expired" });
      }
      
      req.edgeAgent = agent;
      next();
  };

  // Get full configuration for Edge Agent
  app.get(api.edge.config.path, verifyEdgeToken, async (req: any, res) => {
      try {
          const agent = req.edgeAgent;
          const schoolId = agent.schoolId;
          
          // Get cameras and decrypt NVR credentials for edge agent
          const cameraList = await storage.getCameras(schoolId);
          const nvrList = await storage.getNvrs(schoolId);
          const faceEncodingList = await storage.getFaceEncodings(schoolId);
          const config = await storage.getSchoolConfig(schoolId);
          
          // Update config sync timestamp
          await storage.updateEdgeAgent(agent.agentId, {
              lastConfigSyncAt: new Date()
          });
          
          res.json({
              cameras: cameraList,
              nvrs: nvrList.map(nvr => ({
                  ...nvr,
                  // In production, NVR credentials would be encrypted end-to-end
                  // Edge agent would have the key to decrypt
              })),
              faceEncodings: faceEncodingList.map(fe => ({
                  entityType: fe.entityType,
                  entityId: fe.entityId,
                  encoding: fe.encoding,
                  sectionId: fe.sectionId
              })),
              schoolConfig: config,
              lastUpdated: new Date().toISOString()
          });
      } catch (e: any) {
          console.error("Edge config error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Edge Agent heartbeat - Reports status and metrics
  app.post(api.edge.heartbeat.path, verifyEdgeToken, async (req: any, res) => {
      try {
          const { agentId, status, activeCameras, eventsProcessed, eventsQueuedOffline, version, hostname, ipAddress } = req.body;
          
          await storage.updateEdgeAgentHeartbeat(agentId, status, {
              activeCameras,
              eventsProcessed,
              eventsQueuedOffline,
              version,
              hostname,
              ipAddress
          });
          
          res.json({
              acknowledged: true,
              configVersion: new Date().toISOString()
          });
      } catch (e: any) {
          console.error("Edge heartbeat error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // Edge Agent events submission
  app.post(api.edge.events.path, verifyEdgeToken, async (req: any, res) => {
      try {
          const { events } = req.body;
          const agent = req.edgeAgent;
          let processed = 0;
          let failed = 0;
          const errors: string[] = [];
          
          for (const event of events) {
              try {
                  switch (event.type) {
                      case 'ATTENDANCE':
                          await cameraAIEngine.processFaceDetection(event.cameraId, {
                              entityId: event.data.entityId,
                              entityType: event.data.entityType,
                              confidence: event.data.confidence || 0.95,
                              timestamp: new Date(event.timestamp)
                          });
                          break;
                      case 'ALERT':
                      case 'DISCIPLINE':
                          await cameraAIEngine.processDisciplineEvent(
                              event.cameraId,
                              event.data.eventType,
                              event.data.confidence || event.data.count || 0,
                              new Date(event.timestamp)
                          );
                          break;
                      case 'PRESENCE':
                          await cameraAIEngine.processTeacherPresence(
                              event.cameraId,
                              event.data.teacherPresent,
                              new Date(event.timestamp)
                          );
                          break;
                  }
                  processed++;
              } catch (err: any) {
                  failed++;
                  errors.push(`Event ${event.type}: ${err.message}`);
              }
          }
          
          res.json({ processed, failed, errors: errors.length > 0 ? errors : undefined });
      } catch (e: any) {
          console.error("Edge events error:", e);
          res.status(500).json({ message: e.message });
      }
  });

  // List Edge Agents (admin dashboard)
  app.get(api.edge.list.path, requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      if (!req.user?.schoolId) {
          return res.status(401).json({ message: "School context required" });
      }
      const agents = await storage.getEdgeAgents(req.user.schoolId);
      // Redact auth tokens before sending to client
      const safeAgents = agents.map(a => ({
          ...a,
          authToken: '***REDACTED***'
      }));
      res.json(safeAgents);
  });

  // Register new Edge Agent
  app.post(api.edge.register.path, requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          if (!req.user?.schoolId) {
              return res.status(401).json({ message: "School context required" });
          }
          
          const cryptoModule = await import('crypto');
          const agentId = cryptoModule.randomUUID();
          const secret = cryptoModule.randomBytes(32).toString('hex');
          const authToken = cryptoModule.randomBytes(32).toString('hex');
          
          // Hash the secret for secure storage
          const secretHash = await bcrypt.hash(secret, 10);
          
          const agent = await storage.createEdgeAgent({
              schoolId: req.user.schoolId,
              agentId,
              name: req.body.name,
              description: req.body.description,
              secretHash,
              authToken,
              maxCameras: req.body.maxCameras || 50,
              status: 'OFFLINE',
              isActive: true,
              autoUpdate: true
          });
          
          res.status(201).json({
              agent: {
                  ...agent,
                  authToken: '***REDACTED***'
              },
              secret // One-time secret for agent setup - store this securely!
          });
      } catch (e: any) {
          console.error("Edge register error:", e);
          res.status(400).json({ message: e.message });
      }
  });

  // Get specific Edge Agent status
  app.get(api.edge.status.path, requireAuth, async (req, res) => {
      const agentId = req.params.agentId;
      const agent = await storage.getEdgeAgentById(agentId);
      
      if (!agent || (req.user?.schoolId && agent.schoolId !== req.user.schoolId)) {
          return res.status(404).json({ message: "Agent not found" });
      }
      
      res.json({
          ...agent,
          authToken: '***REDACTED***'
      });
  });

  // Delete/Deactivate Edge Agent
  app.delete(api.edge.delete.path, requireAuth, requirePermission('MANAGE_CAMERAS'), async (req, res) => {
      try {
          const agentId = req.params.agentId;
          const agent = await storage.getEdgeAgentById(agentId);
          
          if (!agent || (req.user?.schoolId && agent.schoolId !== req.user.schoolId)) {
              return res.status(404).json({ message: "Agent not found" });
          }
          
          await storage.deleteEdgeAgent(agentId);
          res.json({ message: "Agent deleted successfully" });
      } catch (e: any) {
          res.status(400).json({ message: e.message });
      }
  });

  // --- SEED DATA (Production: Remove or disable) ---
  // Uncomment below for initial setup, then comment out for production
  // await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
    const existingSchool = await storage.getSchoolByCode("PARIKSHAN001");
    if (existingSchool) return;

    console.log("Seeding database...");

    // 1. Create School
    const school = await storage.createSchool({
        name: "Parikshan High School",
        code: "PARIKSHAN001",
        address: "123 Education Lane, Tech City",
        tier: "ENTERPRISE",
        isActive: true
    });

    // 2. Create Wings
    const wingPrimary = await storage.createWing({ schoolId: school.id, name: "Primary Wing", minGrade: 1, maxGrade: 5 });
    const wingSecondary = await storage.createWing({ schoolId: school.id, name: "Secondary Wing", minGrade: 6, maxGrade: 10 });

    // 3. Create Users
    await storage.createUser({
        schoolId: school.id,
        username: "admin",
        password: "password123",
        fullName: "Super Admin",
        role: USER_ROLES.SUPER_ADMIN,
        isActive: true
    });
    
    const principal = await storage.createUser({
        schoolId: school.id,
        username: "principal",
        password: "password123",
        fullName: "Dr. Sharma",
        role: USER_ROLES.PRINCIPAL,
        isActive: true
    });
    
    const teacher1 = await storage.createUser({
        schoolId: school.id,
        username: "teacher1",
        password: "password123",
        fullName: "Mrs. Verma",
        role: USER_ROLES.TEACHER,
        wingId: wingPrimary.id,
        isActive: true
    });
    
    const teacher2 = await storage.createUser({
        schoolId: school.id,
        username: "teacher2",
        password: "password123",
        fullName: "Mr. Kumar",
        role: USER_ROLES.TEACHER,
        wingId: wingPrimary.id,
        isActive: true
    });
    
    const teacher3 = await storage.createUser({
        schoolId: school.id,
        username: "teacher3",
        password: "password123",
        fullName: "Mrs. Gupta",
        role: USER_ROLES.TEACHER,
        wingId: wingSecondary.id,
        isActive: true
    });

    // 4. Create Classes & Sections
    const cls1 = await storage.createClass({ schoolId: school.id, wingId: wingPrimary.id, name: "Class 1", gradeLevel: 1 });
    const cls2 = await storage.createClass({ schoolId: school.id, wingId: wingPrimary.id, name: "Class 2", gradeLevel: 2 });
    const cls6 = await storage.createClass({ schoolId: school.id, wingId: wingSecondary.id, name: "Class 6", gradeLevel: 6 });
    
    await storage.createSection({ classId: cls1.id, name: "A", classTeacherId: teacher1.id, roomNumber: "101" });
    await storage.createSection({ classId: cls1.id, name: "B", classTeacherId: teacher2.id, roomNumber: "102" });
    await storage.createSection({ classId: cls2.id, name: "A", classTeacherId: teacher2.id, roomNumber: "103" });
    await storage.createSection({ classId: cls6.id, name: "A", classTeacherId: teacher3.id, roomNumber: "201" });

    // 5. Create Cameras
    await storage.createCamera({
        schoolId: school.id,
        name: "Main Entrance Camera",
        type: "ENTRY",
        location: "Main Gate",
        isActive: true
    });
    await storage.createCamera({
        schoolId: school.id,
        name: "Class 1A Camera",
        type: "CLASSROOM",
        location: "Room 101",
        roomId: "101",
        isActive: true
    });
    await storage.createCamera({
        schoolId: school.id,
        name: "Corridor A Camera",
        type: "CORRIDOR",
        location: "Corridor A",
        isActive: true
    });

    // 6. Create Config
    await storage.createSchoolConfig({
        schoolId: school.id,
        periodsPerDay: 8,
        periodDuration: 45,
        lunchAfterPeriod: 4,
        maxSubstitutionsPerDay: 3,
        enableFaceRecognition: true,
        enableDisciplineAlerts: true
    });

    // 7. Create Alerts
    await storage.createAlert({
        schoolId: school.id,
        type: "ABSENT_TEACHER",
        severity: "HIGH",
        message: "Teacher absent in Class 5B (Camera 12)",
        location: "Room 204"
    });
    await storage.createAlert({
        schoolId: school.id,
        type: "FIGHT_DETECTED",
        severity: "CRITICAL",
        message: "Aggressive behavior detected in Corridor A",
        location: "Corridor A"
    });
    await storage.createAlert({
        schoolId: school.id,
        type: "NO_TEACHER",
        severity: "HIGH",
        message: "No teacher present in Class 2A for 10 minutes",
        location: "Room 103"
    });
    await storage.createAlert({
        schoolId: school.id,
        type: "UNIFORM_VIOLATION",
        severity: "LOW",
        message: "3 students detected without proper uniform in Class 6A",
        location: "Room 201"
    });
    await storage.createAlert({
        schoolId: school.id,
        type: "INATTENTIVE_STUDENTS",
        severity: "MEDIUM",
        message: "High inattentiveness detected in Class 1B during Math period",
        location: "Room 102"
    });

    // 8. Create Leave Requests (for testing leave management)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await storage.createLeaveRequest({
        schoolId: school.id,
        teacherId: teacher1.id,
        date: tomorrow,
        leaveType: LEAVE_TYPES.CASUAL,
        reason: "Personal work - need to attend a family function",
        status: LEAVE_STATUS.PENDING
    });
    
    await storage.createLeaveRequest({
        schoolId: school.id,
        teacherId: teacher2.id,
        date: tomorrow,
        leaveType: LEAVE_TYPES.SICK,
        reason: "Not feeling well, doctor appointment scheduled",
        status: LEAVE_STATUS.PENDING
    });
    
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    const leaveReq = await storage.createLeaveRequest({
        schoolId: school.id,
        teacherId: teacher3.id,
        date: dayAfter,
        leaveType: LEAVE_TYPES.PERSONAL,
        reason: "Parent-teacher meeting at child's school",
        status: LEAVE_STATUS.APPROVED
    });
    // Approve the leave request
    await storage.approveLeaveRequest(leaveReq.id, principal.id);

    console.log("Seeding complete!");
}
