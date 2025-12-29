import { db } from "./db";
import bcrypt from "bcrypt";
import { encrypt } from "./utils/encryption";
import { 
    users, schools, wings, classes, sections, students, timetable, attendance, alerts,
    leaveRequests, substitutions, cameras, nvrs, schoolConfig, masterTimetable, subjects,
    teacherSubjects, sectionCameras, faceEncodings, edgeAgents, edgeEventQueue,
    type User, type InsertUser,
    type School, type InsertSchool,
    type Wing,
    type Class,
    type Section,
    type Student,
    type Timetable,
    type Alert, type InsertAlert,
    type LeaveRequest, type InsertLeaveRequest,
    type Substitution, type InsertSubstitution,
    type Camera, type InsertCamera,
    type Nvr, type InsertNvr,
    type SchoolConfig, type InsertSchoolConfig,
    type MasterTimetable,
    type Subject, type InsertSubject,
    type TeacherSubject, type InsertTeacherSubject,
    type SectionCamera, type InsertSectionCamera,
    type FaceEncoding, type InsertFaceEncoding,
    type EdgeAgent, type InsertEdgeAgent,
    type EdgeEventQueue, type InsertEdgeEventQueue,
    LEAVE_STATUS, USER_ROLES
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, or } from "drizzle-orm";

const SALT_ROUNDS = 10;

type InsertWing = Omit<Wing, "id">;
type InsertTimetable = Omit<Timetable, "id">;

export interface IStorage {
    // Schools
    getSchool(id: number): Promise<School | undefined>;
    getSchoolByCode(code: string): Promise<School | undefined>;
    createSchool(school: InsertSchool): Promise<School>;

    // Users
    getUser(id: number): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    getUsersBySchool(schoolId: number, role?: string): Promise<User[]>;
    createUser(user: InsertUser): Promise<User>;
    getTeachers(schoolId: number): Promise<User[]>;
    updateUserPhoto(id: number, photoUrl: string): Promise<User | undefined>;

    // Students
    getStudent(id: number): Promise<Student | undefined>;
    updateStudentPhoto(id: number, photoUrl: string): Promise<Student | undefined>;

    // Wings
    getWings(schoolId: number): Promise<Wing[]>;
    createWing(wing: InsertWing): Promise<Wing>;

    // Academic
    getClasses(schoolId: number): Promise<(Class & { sections: Section[] })[]>;
    createClass(data: any): Promise<Class>;
    deleteClass(id: number): Promise<void>;
    createSection(data: any): Promise<Section>;
    deleteSection(id: number): Promise<void>;
    getSectionsBySchool(schoolId: number): Promise<Section[]>;
    getSectionsByWing(wingId: number): Promise<Section[]>;
    deleteSubject(id: number): Promise<void>;

    // Timetable
    getTimetable(schoolId: number, sectionId?: number, teacherId?: number): Promise<Timetable[]>;
    createTimetableEntry(entry: InsertTimetable): Promise<Timetable>;

    // Alerts
    getAlerts(schoolId: number, severity?: string): Promise<Alert[]>;
    createAlert(alert: InsertAlert): Promise<Alert>;
    resolveAlert(id: number): Promise<Alert | undefined>;

    // Leave Requests
    getLeaveRequests(schoolId: number, date?: Date): Promise<LeaveRequest[]>;
    createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
    approveLeaveRequest(id: number, approvedBy: number): Promise<LeaveRequest | undefined>;
    rejectLeaveRequest(id: number): Promise<LeaveRequest | undefined>;

    // Substitutions
    getSubstitutions(schoolId: number, date?: Date, teacherId?: number): Promise<Substitution[]>;
    createSubstitution(sub: InsertSubstitution): Promise<Substitution>;
    getTeacherSubstitutionCount(teacherId: number, date: Date): Promise<number>;

    // Cameras
    getCameras(schoolId: number): Promise<Camera[]>;
    createCamera(camera: InsertCamera): Promise<Camera>;

    // NVRs
    getNvrs(schoolId: number): Promise<Nvr[]>;
    createNvr(nvr: InsertNvr): Promise<Nvr>;

    // Config
    getSchoolConfig(schoolId: number): Promise<SchoolConfig | undefined>;
    createSchoolConfig(config: InsertSchoolConfig): Promise<SchoolConfig>;
    updateSchoolConfig(schoolId: number, updates: Partial<InsertSchoolConfig>): Promise<SchoolConfig | undefined>;

    // Edge Agents
    getEdgeAgents(schoolId: number): Promise<EdgeAgent[]>;
    getEdgeAgentById(agentId: string): Promise<EdgeAgent | undefined>;
    createEdgeAgent(agent: InsertEdgeAgent): Promise<EdgeAgent>;
    updateEdgeAgent(agentId: string, updates: Partial<InsertEdgeAgent>): Promise<EdgeAgent | undefined>;
    deleteEdgeAgent(agentId: string): Promise<void>;
    updateEdgeAgentHeartbeat(agentId: string, status: string, metrics?: any): Promise<EdgeAgent | undefined>;

    // Face Encodings (for Edge Agent config sync)
    getFaceEncodings(schoolId: number): Promise<FaceEncoding[]>;

    // Stats
    getStats(schoolId: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
    // Schools
    async getSchool(id: number): Promise<School | undefined> {
        const [school] = await db.select().from(schools).where(eq(schools.id, id));
        return school;
    }
    async getSchoolByCode(code: string): Promise<School | undefined> {
        const [school] = await db.select().from(schools).where(eq(schools.code, code));
        return school;
    }
    async createSchool(school: InsertSchool): Promise<School> {
        const [newSchool] = await db.insert(schools).values(school).returning();
        return newSchool;
    }

    // Users
    async getUser(id: number): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    }
    async getUserByUsername(username: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
    }
    async getUsersBySchool(schoolId: number, role?: string): Promise<User[]> {
        if (role) {
            return db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.role, role)));
        }
        return db.select().from(users).where(eq(users.schoolId, schoolId));
    }
    async createUser(user: InsertUser): Promise<User> {
        // Hash password with bcrypt before storing
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        const [newUser] = await db.insert(users).values({
            ...user,
            password: hashedPassword
        }).returning();
        return newUser;
    }
    async getTeachers(schoolId: number): Promise<User[]> {
        return db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.role, USER_ROLES.TEACHER)));
    }
    async updateUserPhoto(id: number, photoUrl: string): Promise<User | undefined> {
        const [updated] = await db.update(users).set({ avatarUrl: photoUrl }).where(eq(users.id, id)).returning();
        return updated;
    }

    // Students
    async getStudent(id: number): Promise<Student | undefined> {
        const [student] = await db.select().from(students).where(eq(students.id, id));
        return student;
    }
    async updateStudentPhoto(id: number, photoUrl: string): Promise<Student | undefined> {
        const [updated] = await db.update(students).set({ photoUrl }).where(eq(students.id, id)).returning();
        return updated;
    }

    // Wings
    async getWings(schoolId: number): Promise<Wing[]> {
        return db.select().from(wings).where(eq(wings.schoolId, schoolId));
    }
    async createWing(wing: InsertWing): Promise<Wing> {
        const [newWing] = await db.insert(wings).values(wing).returning();
        return newWing;
    }

    // Academic
    async getClasses(schoolId: number): Promise<(Class & { sections: Section[] })[]> {
        const classList = await db.select().from(classes).where(eq(classes.schoolId, schoolId));
        const result = [];
        for (const cls of classList) {
            const clsSections = await db.select().from(sections).where(eq(sections.classId, cls.id));
            result.push({ ...cls, sections: clsSections });
        }
        return result;
    }
    async createClass(data: any): Promise<Class> {
        const [newClass] = await db.insert(classes).values(data).returning();
        return newClass;
    }
    async deleteClass(id: number): Promise<void> {
        await db.delete(classes).where(eq(classes.id, id));
    }
    async createSection(data: any): Promise<Section> {
        const [newSection] = await db.insert(sections).values(data).returning();
        return newSection;
    }
    async deleteSection(id: number): Promise<void> {
        await db.delete(sections).where(eq(sections.id, id));
    }
    async deleteSubject(id: number): Promise<void> {
        await db.delete(subjects).where(eq(subjects.id, id));
    }

    // Timetable
    async getTimetable(schoolId: number, sectionId?: number, teacherId?: number): Promise<Timetable[]> {
        if (sectionId) {
            return db.select().from(timetable).where(and(eq(timetable.schoolId, schoolId), eq(timetable.sectionId, sectionId)));
        }
        if (teacherId) {
            return db.select().from(timetable).where(and(eq(timetable.schoolId, schoolId), eq(timetable.teacherId, teacherId)));
        }
        return db.select().from(timetable).where(eq(timetable.schoolId, schoolId));
    }
    async createTimetableEntry(entry: InsertTimetable): Promise<Timetable> {
        const [entryResult] = await db.insert(timetable).values(entry).returning();
        return entryResult;
    }

    // Alerts
    async getAlerts(schoolId: number, severity?: string): Promise<Alert[]> {
        if (severity) {
            return db.select().from(alerts).where(and(eq(alerts.schoolId, schoolId), eq(alerts.severity, severity))).orderBy(desc(alerts.createdAt));
        }
        return db.select().from(alerts).where(eq(alerts.schoolId, schoolId)).orderBy(desc(alerts.createdAt));
    }
    async createAlert(alert: InsertAlert): Promise<Alert> {
        const [newAlert] = await db.insert(alerts).values(alert).returning();
        return newAlert;
    }
    async resolveAlert(id: number): Promise<Alert | undefined> {
        const [updated] = await db.update(alerts).set({ isResolved: true }).where(eq(alerts.id, id)).returning();
        return updated;
    }

    // Leave Requests
    async getLeaveRequests(schoolId: number, date?: Date): Promise<LeaveRequest[]> {
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            return db.select().from(leaveRequests)
                .where(and(
                    eq(leaveRequests.schoolId, schoolId),
                    gte(leaveRequests.date, startOfDay),
                    lte(leaveRequests.date, endOfDay)
                ))
                .orderBy(desc(leaveRequests.createdAt));
        }
        return db.select().from(leaveRequests).where(eq(leaveRequests.schoolId, schoolId)).orderBy(desc(leaveRequests.createdAt));
    }
    async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
        const [newRequest] = await db.insert(leaveRequests).values(request).returning();
        return newRequest;
    }
    async approveLeaveRequest(id: number, approvedBy: number): Promise<LeaveRequest | undefined> {
        const [updated] = await db.update(leaveRequests)
            .set({ status: LEAVE_STATUS.APPROVED, approvedBy })
            .where(eq(leaveRequests.id, id))
            .returning();
        return updated;
    }
    async rejectLeaveRequest(id: number): Promise<LeaveRequest | undefined> {
        const [updated] = await db.update(leaveRequests)
            .set({ status: LEAVE_STATUS.REJECTED })
            .where(eq(leaveRequests.id, id))
            .returning();
        return updated;
    }

    // Substitutions
    async getSubstitutions(schoolId: number, date?: Date, teacherId?: number): Promise<Substitution[]> {
        let conditions = [eq(substitutions.schoolId, schoolId)];
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            conditions.push(gte(substitutions.date, startOfDay));
            conditions.push(lte(substitutions.date, endOfDay));
        }
        if (teacherId) {
            conditions.push(eq(substitutions.substituteTeacherId, teacherId));
        }
        return db.select().from(substitutions).where(and(...conditions)).orderBy(substitutions.periodIndex);
    }
    async createSubstitution(sub: InsertSubstitution): Promise<Substitution> {
        const [newSub] = await db.insert(substitutions).values(sub).returning();
        return newSub;
    }
    async getTeacherSubstitutionCount(teacherId: number, date: Date): Promise<number> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        const [result] = await db.select({ count: sql<number>`count(*)` })
            .from(substitutions)
            .where(and(
                eq(substitutions.substituteTeacherId, teacherId),
                gte(substitutions.date, startOfDay),
                lte(substitutions.date, endOfDay)
            ));
        return Number(result?.count || 0);
    }

    // Cameras
    async getCameras(schoolId: number): Promise<Camera[]> {
        return db.select().from(cameras).where(eq(cameras.schoolId, schoolId));
    }
    async createCamera(camera: InsertCamera): Promise<Camera> {
        const [newCamera] = await db.insert(cameras).values(camera).returning();
        return newCamera;
    }

    // NVRs
    async getNvrs(schoolId: number): Promise<Nvr[]> {
        return db.select().from(nvrs).where(eq(nvrs.schoolId, schoolId));
    }
    async createNvr(nvr: InsertNvr): Promise<Nvr> {
        // Encrypt sensitive credentials before storing
        const secureNvr = {
            ...nvr,
            password: nvr.password ? encrypt(nvr.password) : null,
            username: nvr.username ? encrypt(nvr.username) : null
        };
        const [newNvr] = await db.insert(nvrs).values(secureNvr).returning();
        return newNvr;
    }

    // Config
    async getSchoolConfig(schoolId: number): Promise<SchoolConfig | undefined> {
        const [config] = await db.select().from(schoolConfig).where(eq(schoolConfig.schoolId, schoolId));
        return config;
    }
    async createSchoolConfig(config: InsertSchoolConfig): Promise<SchoolConfig> {
        const [newConfig] = await db.insert(schoolConfig).values(config).returning();
        return newConfig;
    }
    async updateSchoolConfig(schoolId: number, updates: Partial<InsertSchoolConfig>): Promise<SchoolConfig | undefined> {
        const [updated] = await db.update(schoolConfig).set(updates).where(eq(schoolConfig.schoolId, schoolId)).returning();
        return updated;
    }

    // Stats
    async getStats(schoolId: number): Promise<any> {
        const [studentCount] = await db.select({ count: sql<number>`count(*)` }).from(students).where(eq(students.schoolId, schoolId));
        const [teacherCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.schoolId, schoolId), eq(users.role, USER_ROLES.TEACHER)));
        const [alertsCount] = await db.select({ count: sql<number>`count(*)` }).from(alerts).where(eq(alerts.schoolId, schoolId));
        const [pendingLeaves] = await db.select({ count: sql<number>`count(*)` }).from(leaveRequests).where(and(eq(leaveRequests.schoolId, schoolId), eq(leaveRequests.status, LEAVE_STATUS.PENDING)));
        
        // Get real attendance count for today from database
        const today = new Date();
        const presentToday = await this.getAttendanceCount(schoolId, today);
        
        return {
            totalStudents: Number(studentCount?.count || 0),
            totalTeachers: Number(teacherCount?.count || 0),
            presentToday,
            alertsToday: Number(alertsCount?.count || 0),
            pendingLeaves: Number(pendingLeaves?.count || 0)
        };
    }

    // Get attendance count for a specific date (real database query)
    async getAttendanceCount(schoolId: number, date: Date): Promise<number> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const [result] = await db.select({ count: sql<number>`count(DISTINCT entity_id)` })
            .from(attendance)
            .where(and(
                eq(attendance.schoolId, schoolId),
                gte(attendance.checkInTime, startOfDay),
                lte(attendance.checkInTime, endOfDay),
                eq(attendance.status, 'PRESENT')
            ));
        
        return Number(result?.count || 0);
    }

    // Edge Agents
    async getEdgeAgents(schoolId: number): Promise<EdgeAgent[]> {
        return db.select().from(edgeAgents).where(eq(edgeAgents.schoolId, schoolId));
    }
    
    async getEdgeAgentById(agentId: string): Promise<EdgeAgent | undefined> {
        const [agent] = await db.select().from(edgeAgents).where(eq(edgeAgents.agentId, agentId));
        return agent;
    }
    
    async createEdgeAgent(agent: InsertEdgeAgent): Promise<EdgeAgent> {
        // Encrypt auth token before storing
        const secureAgent = {
            ...agent,
            authToken: agent.authToken ? encrypt(agent.authToken) : agent.authToken
        };
        const [newAgent] = await db.insert(edgeAgents).values(secureAgent).returning();
        return newAgent;
    }
    
    async updateEdgeAgent(agentId: string, updates: Partial<InsertEdgeAgent>): Promise<EdgeAgent | undefined> {
        const [updated] = await db.update(edgeAgents).set({
            ...updates,
            updatedAt: new Date()
        }).where(eq(edgeAgents.agentId, agentId)).returning();
        return updated;
    }
    
    async deleteEdgeAgent(agentId: string): Promise<void> {
        await db.delete(edgeAgents).where(eq(edgeAgents.agentId, agentId));
    }
    
    async updateEdgeAgentHeartbeat(agentId: string, status: string, metrics?: any): Promise<EdgeAgent | undefined> {
        const updateData: any = {
            status,
            lastHeartbeatAt: new Date(),
            updatedAt: new Date()
        };
        if (metrics) {
            if (metrics.activeCameras !== undefined) updateData.activeCameras = metrics.activeCameras;
            if (metrics.eventsProcessed !== undefined) updateData.eventsProcessed = metrics.eventsProcessed;
            if (metrics.eventsQueuedOffline !== undefined) updateData.eventsQueuedOffline = metrics.eventsQueuedOffline;
            if (metrics.version) updateData.version = metrics.version;
            if (metrics.hostname) updateData.hostname = metrics.hostname;
            if (metrics.ipAddress) updateData.ipAddress = metrics.ipAddress;
        }
        const [updated] = await db.update(edgeAgents).set(updateData).where(eq(edgeAgents.agentId, agentId)).returning();
        return updated;
    }

    // === ADDITIONAL METHODS FOR ENGINES ===

    // Section methods
    async getSection(id: number): Promise<Section | undefined> {
        const [section] = await db.select().from(sections).where(eq(sections.id, id));
        return section;
    }

    async getSectionsByWing(wingId: number): Promise<Section[]> {
        const wingClasses = await db.select().from(classes).where(eq(classes.wingId, wingId));
        const classIds = wingClasses.map(c => c.id);
        if (classIds.length === 0) return [];
        const result = await db.select().from(sections).where(
            or(...classIds.map(id => eq(sections.classId, id)))
        );
        return result || [];
    }

    async getSectionsBySchool(schoolId: number): Promise<Section[]> {
        const schoolClasses = await db.select().from(classes).where(eq(classes.schoolId, schoolId));
        const classIds = schoolClasses.map(c => c.id);
        if (classIds.length === 0) return [];
        const result = await db.select().from(sections).where(
            or(...classIds.map(id => eq(sections.classId, id)))
        );
        return result || [];
    }

    async getClass(id: number): Promise<Class | undefined> {
        const [cls] = await db.select().from(classes).where(eq(classes.id, id));
        return cls;
    }

    // Subject methods - now using teacherSubjects table
    async getSubjectTeachersForClass(classId: number): Promise<Array<{ subjectId: number; teacherId: number }>> {
        const classSections = await db.select().from(sections).where(eq(sections.classId, classId));
        const result: Array<{ subjectId: number; teacherId: number }> = [];
        
        for (const section of classSections) {
            const entries = await db.select().from(timetable).where(eq(timetable.sectionId, section.id));
            for (const entry of entries) {
                if (entry.subjectId && entry.teacherId) {
                    const exists = result.some(r => r.subjectId === entry.subjectId && r.teacherId === entry.teacherId);
                    if (!exists) {
                        result.push({ subjectId: entry.subjectId, teacherId: entry.teacherId });
                    }
                }
            }
        }
        return result;
    }

    async getTeacherSubjectIds(teacherId: number): Promise<number[]> {
        const entries = await db.select().from(teacherSubjects).where(eq(teacherSubjects.teacherId, teacherId));
        return entries.map(e => e.subjectId);
    }

    async hasTeacherTaughtSection(teacherId: number, sectionId: number): Promise<boolean> {
        const entries = await db.select().from(timetable).where(
            and(eq(timetable.teacherId, teacherId), eq(timetable.sectionId, sectionId))
        );
        return entries.length > 0;
    }

    // Master Timetable methods
    async createMasterTimetable(data: any): Promise<MasterTimetable> {
        const [result] = await db.insert(masterTimetable).values(data).returning();
        return result;
    }

    async getActiveMasterTimetable(schoolId: number, wingId?: number): Promise<MasterTimetable | undefined> {
        if (wingId) {
            const [result] = await db.select().from(masterTimetable).where(
                and(eq(masterTimetable.schoolId, schoolId), eq(masterTimetable.wingId, wingId), eq(masterTimetable.isActive, true))
            );
            return result;
        }
        const [result] = await db.select().from(masterTimetable).where(
            and(eq(masterTimetable.schoolId, schoolId), eq(masterTimetable.isActive, true))
        );
        return result;
    }

    async deactivateMasterTimetable(id: number): Promise<void> {
        await db.update(masterTimetable).set({ isActive: false }).where(eq(masterTimetable.id, id));
    }

    async getSchoolWideMasterTimetable(schoolId: number): Promise<MasterTimetable | undefined> {
        const [result] = await db.select().from(masterTimetable).where(
            and(
                eq(masterTimetable.schoolId, schoolId), 
                eq(masterTimetable.isActive, true),
                sql`${masterTimetable.wingId} IS NULL`
            )
        );
        return result;
    }

    // Attendance methods
    async getAttendanceByEntity(schoolId: number, entityId: number, entityType: string, date: Date): Promise<any | undefined> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const [result] = await db.select().from(attendance).where(
            and(
                eq(attendance.schoolId, schoolId),
                eq(attendance.entityId, entityId),
                eq(attendance.type, entityType),
                gte(attendance.date, startOfDay),
                lte(attendance.date, endOfDay)
            )
        );
        return result;
    }

    async getAttendanceBySection(schoolId: number, sectionId: number, date: Date): Promise<any[]> {
        const sectionStudents = await db.select().from(students).where(eq(students.sectionId, sectionId));
        const studentIds = sectionStudents.map(s => s.id);
        if (studentIds.length === 0) return [];
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        return db.select().from(attendance).where(
            and(
                eq(attendance.schoolId, schoolId),
                eq(attendance.type, "STUDENT"),
                gte(attendance.date, startOfDay),
                lte(attendance.date, endOfDay)
            )
        );
    }

    async getStudentsBySection(sectionId: number): Promise<Student[]> {
        return db.select().from(students).where(eq(students.sectionId, sectionId));
    }

    // Camera methods
    async getCamera(id: number): Promise<Camera | undefined> {
        const [cam] = await db.select().from(cameras).where(eq(cameras.id, id));
        return cam;
    }

    async updateFaceRegistration(entityType: string, entityId: number, faceId: string): Promise<void> {
        // Store face ID - in production this would update a face_encodings table
        if (entityType === "STUDENT") {
            await db.update(students).set({ photoUrl: faceId }).where(eq(students.id, entityId));
        } else if (entityType === "TEACHER") {
            await db.update(users).set({ avatarUrl: faceId }).where(eq(users.id, entityId));
        }
    }

    async getUnresolvedAlertCount(schoolId: number): Promise<number> {
        const [result] = await db.select({ count: sql<number>`count(*)` }).from(alerts).where(
            and(eq(alerts.schoolId, schoolId), eq(alerts.isResolved, false))
        );
        return Number(result?.count || 0);
    }

    // Alert methods
    async getAlert(id: number): Promise<Alert | undefined> {
        const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
        return alert;
    }

    // In-memory event logs (for demo - in production use DB table)
    private alertEvents: Map<number, any[]> = new Map();

    async createAlertEvent(event: any): Promise<void> {
        const events = this.alertEvents.get(event.alertId) || [];
        events.push(event);
        this.alertEvents.set(event.alertId, events);
    }

    async getAlertEvents(alertId: number): Promise<any[]> {
        return this.alertEvents.get(alertId) || [];
    }

    // In-memory notification logs (for demo - in production use DB table)
    private notificationLogs: any[] = [];

    async createNotificationLog(log: any): Promise<void> {
        this.notificationLogs.push({ ...log, createdAt: new Date() });
    }

    async getNotificationLogs(schoolId: number, options?: { limit?: number; channel?: string }): Promise<any[]> {
        let logs = this.notificationLogs.filter(l => l.metadata?.schoolId === schoolId);
        if (options?.channel) {
            logs = logs.filter(l => l.channel === options.channel);
        }
        if (options?.limit) {
            logs = logs.slice(-options.limit);
        }
        return logs;
    }

    // === SUBJECTS ===
    async getSubjects(schoolId: number, wingId?: number): Promise<Subject[]> {
        if (wingId) {
            return db.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.wingId, wingId)));
        }
        return db.select().from(subjects).where(eq(subjects.schoolId, schoolId));
    }

    async createSubject(data: InsertSubject): Promise<Subject> {
        const [subject] = await db.insert(subjects).values(data).returning();
        return subject;
    }

    async bulkCreateSubjects(data: InsertSubject[]): Promise<Subject[]> {
        if (data.length === 0) return [];
        const result = await db.insert(subjects).values(data).returning();
        return result;
    }

    async deleteSubjectsBySchool(schoolId: number): Promise<void> {
        await db.delete(subjects).where(eq(subjects.schoolId, schoolId));
    }

    // === TEACHER SUBJECTS ===
    async getTeacherSubjects(schoolId: number, teacherId?: number): Promise<TeacherSubject[]> {
        if (teacherId) {
            return db.select().from(teacherSubjects).where(and(eq(teacherSubjects.schoolId, schoolId), eq(teacherSubjects.teacherId, teacherId)));
        }
        return db.select().from(teacherSubjects).where(eq(teacherSubjects.schoolId, schoolId));
    }

    async createTeacherSubject(data: InsertTeacherSubject): Promise<TeacherSubject> {
        const [ts] = await db.insert(teacherSubjects).values(data).returning();
        return ts;
    }

    async bulkCreateTeacherSubjects(data: InsertTeacherSubject[]): Promise<TeacherSubject[]> {
        if (data.length === 0) return [];
        const result = await db.insert(teacherSubjects).values(data).returning();
        return result;
    }

    async deleteTeacherSubjectsBySchool(schoolId: number): Promise<void> {
        await db.delete(teacherSubjects).where(eq(teacherSubjects.schoolId, schoolId));
    }

    // === FACE ENCODINGS ===
    async getFaceEncodings(schoolId: number, sectionId?: number): Promise<FaceEncoding[]> {
        if (sectionId) {
            return db.select().from(faceEncodings).where(and(eq(faceEncodings.schoolId, schoolId), eq(faceEncodings.sectionId, sectionId)));
        }
        return db.select().from(faceEncodings).where(eq(faceEncodings.schoolId, schoolId));
    }

    async getFaceEncodingCount(schoolId: number): Promise<number> {
        const [result] = await db.select({ count: sql<number>`count(*)` }).from(faceEncodings).where(eq(faceEncodings.schoolId, schoolId));
        return Number(result?.count || 0);
    }

    async createFaceEncoding(data: InsertFaceEncoding): Promise<FaceEncoding> {
        const [encoding] = await db.insert(faceEncodings).values(data).returning();
        return encoding;
    }

    async bulkCreateFaceEncodings(data: InsertFaceEncoding[]): Promise<FaceEncoding[]> {
        if (data.length === 0) return [];
        const result = await db.insert(faceEncodings).values(data).returning();
        return result;
    }

    async deleteFaceEncoding(id: number): Promise<void> {
        await db.delete(faceEncodings).where(eq(faceEncodings.id, id));
    }

    // === SECTION CAMERAS ===
    async getSectionCameras(schoolId: number, sectionId?: number): Promise<SectionCamera[]> {
        if (sectionId) {
            return db.select().from(sectionCameras).where(and(eq(sectionCameras.schoolId, schoolId), eq(sectionCameras.sectionId, sectionId)));
        }
        return db.select().from(sectionCameras).where(eq(sectionCameras.schoolId, schoolId));
    }

    async createSectionCamera(data: InsertSectionCamera): Promise<SectionCamera> {
        const [sc] = await db.insert(sectionCameras).values(data).returning();
        return sc;
    }

    async updateSectionCamera(id: number, updates: Partial<InsertSectionCamera>): Promise<SectionCamera | undefined> {
        const [updated] = await db.update(sectionCameras).set(updates).where(eq(sectionCameras.id, id)).returning();
        return updated;
    }

    // === BULK TIMETABLE OPERATIONS ===
    async deleteTimetableBySchool(schoolId: number): Promise<void> {
        await db.delete(timetable).where(eq(timetable.schoolId, schoolId));
    }

    async bulkCreateTimetable(entries: Omit<Timetable, 'id'>[]): Promise<Timetable[]> {
        if (entries.length === 0) return [];
        const result = await db.insert(timetable).values(entries).returning();
        return result;
    }

    // === BULK CLASS/SECTION OPERATIONS ===
    async bulkCreateClasses(data: Omit<Class, 'id'>[]): Promise<Class[]> {
        if (data.length === 0) return [];
        const result = await db.insert(classes).values(data).returning();
        return result;
    }

    async bulkCreateSections(data: Omit<Section, 'id'>[]): Promise<Section[]> {
        if (data.length === 0) return [];
        const result = await db.insert(sections).values(data).returning();
        return result;
    }

    async bulkCreateUsers(data: InsertUser[]): Promise<User[]> {
        if (data.length === 0) return [];
        const result = await db.insert(users).values(data).returning();
        return result;
    }

    async bulkCreateStudents(data: Omit<Student, 'id'>[]): Promise<Student[]> {
        if (data.length === 0) return [];
        const result = await db.insert(students).values(data).returning();
        return result;
    }

    // === STUDENTS BY SCHOOL ===
    async getStudentsBySchool(schoolId: number): Promise<Student[]> {
        return db.select().from(students).where(eq(students.schoolId, schoolId));
    }

    async createStudent(data: Omit<Student, 'id'>): Promise<Student> {
        const [student] = await db.insert(students).values(data).returning();
        return student;
    }

    async updateStudent(id: number, updates: Partial<Omit<Student, 'id'>>): Promise<Student | undefined> {
        const [updated] = await db.update(students).set(updates).where(eq(students.id, id)).returning();
        return updated;
    }

    async deleteStudent(id: number): Promise<void> {
        await db.delete(students).where(eq(students.id, id));
    }

    // === USER UPDATE/DELETE ===
    async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
        // Hash password if provided
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
        }
        const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
        return updated;
    }

    async deleteUser(id: number): Promise<void> {
        await db.delete(users).where(eq(users.id, id));
    }

    // === SCHOOL MANAGEMENT ===
    async getAllSchools(): Promise<School[]> {
        return db.select().from(schools);
    }

    // === TIMETABLE DELETE ===
    async deleteTimetableEntry(id: number): Promise<void> {
        await db.delete(timetable).where(eq(timetable.id, id));
    }

    // === CAMERA UPDATE/DELETE ===
    async updateCamera(id: number, updates: Partial<InsertCamera>): Promise<Camera | undefined> {
        const [updated] = await db.update(cameras).set(updates).where(eq(cameras.id, id)).returning();
        return updated;
    }

    async deleteCamera(id: number): Promise<void> {
        await db.delete(cameras).where(eq(cameras.id, id));
    }

    // === TEACHER SUBJECT DELETE ===
    async deleteTeacherSubject(id: number): Promise<void> {
        await db.delete(teacherSubjects).where(eq(teacherSubjects.id, id));
    }

    // Get timetable with joined data for exports
    async getTimetableWithDetails(schoolId: number, wingId?: number): Promise<any[]> {
        const timetableEntries = await this.getTimetable(schoolId);
        const allSections = await this.getSectionsBySchool(schoolId);
        const allClasses = await this.getClasses(schoolId);
        const allTeachers = await this.getTeachers(schoolId);
        const allSubjects = await this.getSubjects(schoolId);
        
        let filteredSections = allSections;
        if (wingId) {
            const wingClasses = allClasses.filter(c => c.wingId === wingId);
            const wingClassIds = wingClasses.map(c => c.id);
            filteredSections = allSections.filter(s => wingClassIds.includes(s.classId));
        }
        const sectionIds = new Set(filteredSections.map(s => s.id));
        
        return timetableEntries
            .filter(t => sectionIds.has(t.sectionId))
            .map(t => {
                const section = allSections.find(s => s.id === t.sectionId);
                const cls = section ? allClasses.find(c => c.id === section.classId) : undefined;
                const teacher = t.teacherId ? allTeachers.find(u => u.id === t.teacherId) : undefined;
                const subject = t.subjectId ? allSubjects.find(s => s.id === t.subjectId) : undefined;
                
                return {
                    ...t,
                    sectionName: section?.name,
                    className: cls?.name,
                    roomNumber: section?.roomNumber,
                    teacherName: teacher?.fullName,
                    subjectName: subject?.name
                };
            });
    }
}

export const storage = new DatabaseStorage();
