import { storage } from "../storage";
import type { Timetable, SchoolConfig, Section, User, Subject } from "@shared/schema";

// Timetable Generation Constraints - ALL from SchoolConfig
interface TimetableConstraints {
  periodsPerDay: number;
  lunchAfterPeriod: number;
  maxPeriodsPerTeacherPerDay: number;
  maxPeriodsPerTeacherPerWeek: number;
  maxConsecutivePeriods: number;
  enforceRoomConflicts: boolean;
  maxPeriodsPerWeek: Record<number, number>; // subjectId -> max PPW
  maxPeriodsPerDay: Record<number, number>; // subjectId -> max periods per day
  labSubjects: number[]; // Subject IDs that need double periods
  preferredLabPeriods: number[]; // Preferred periods for labs
  languageGroups: Record<string, number[]>; // "II_LANGUAGE" -> [subjectId1, subjectId2], "III_LANGUAGE" -> [...]
  streamGroups: Record<string, number[]>; // "SCIENCE" -> [subjectId1], "COMMERCE" -> [...], "HUMANITIES" -> [...]
  lightSubjects: number[]; // Subjects good for after-lunch
  lightSubjectPeriods: number[]; // Periods for light subjects
  teacherPreferences: Record<number, TeacherPreference>;
  // Parallel period tracking
  parallelPeriodSlots: ParallelSlot[]; // Pre-allocated slots for parallel periods
}

interface TeacherPreference {
  preferredPeriods?: number[]; // Preferred period slots
  avoidPeriods?: number[]; // Periods to avoid
  maxPeriodsPerDay?: number;
  canTakeDoublePeriod?: boolean;
}

// Pre-allocated parallel period slots for language/stream groups
interface ParallelSlot {
  groupType: "II_LANGUAGE" | "III_LANGUAGE" | "STREAM";
  groupName: string; // e.g., "SCIENCE", "COMMERCE", or "II_LANGUAGE"
  dayOfWeek: number;
  periodIndex: number;
  subjectIds: number[]; // Subjects that should run in parallel at this slot
}

interface GenerationRequest {
  schoolId: number;
  wingId?: number;
  sectionIds: number[];
  constraints?: Partial<TimetableConstraints>;
  version?: string;
}

interface GenerationResult {
  success: boolean;
  entries: Partial<Timetable>[];
  conflicts: Conflict[];
  score: number;
}

interface Conflict {
  type: "TEACHER_OVERLAP" | "ROOM_OVERLAP" | "PPW_EXCEEDED" | "NO_TEACHER" | "CONSTRAINT_VIOLATION" | "MAX_PERIODS_DAY" | "MAX_CONSECUTIVE";
  message: string;
  periodIndex: number;
  dayOfWeek: number;
  sectionId?: number;
  teacherId?: number;
  roomId?: string;
}

// Timetable slot representation
interface Slot {
  dayOfWeek: number;
  periodIndex: number;
  sectionId: number;
  subjectId: number | null;
  teacherId: number | null;
  roomId?: string;
  isLab: boolean;
  isSecondOfDouble: boolean;
}

export class TimetableEngine {
  private constraints: TimetableConstraints;
  private config: SchoolConfig | null = null;
  
  constructor() {
    // Initialize with empty constraints - MUST be loaded from config
    this.constraints = {
      periodsPerDay: 8,
      lunchAfterPeriod: 4,
      maxPeriodsPerTeacherPerDay: 7,
      maxPeriodsPerTeacherPerWeek: 35,
      maxConsecutivePeriods: 3,
      enforceRoomConflicts: true,
      maxPeriodsPerWeek: {},
      maxPeriodsPerDay: {},
      labSubjects: [],
      preferredLabPeriods: [],
      languageGroups: {},
      streamGroups: {},
      lightSubjects: [],
      lightSubjectPeriods: [],
      teacherPreferences: {},
      parallelPeriodSlots: []
    };
  }

  // Load ALL configuration from SchoolConfig with safe fallbacks
  async loadConfig(schoolId: number): Promise<void> {
    this.config = (await storage.getSchoolConfig(schoolId)) || null;
    
    if (!this.config) {
      throw new Error(`SchoolConfig not found for school ${schoolId}. Cannot generate timetable without configuration.`);
    }
    
    // Load ALL constraints from config with safe fallbacks
    this.constraints.periodsPerDay = this.config.periodsPerDay ?? 8;
    this.constraints.lunchAfterPeriod = this.config.lunchAfterPeriod ?? 4;
    this.constraints.maxPeriodsPerTeacherPerDay = this.config.maxPeriodsPerTeacherPerDay ?? 7;
    this.constraints.maxPeriodsPerTeacherPerWeek = this.config.maxPeriodsPerTeacherPerWeek ?? 35;
    this.constraints.maxConsecutivePeriods = this.config.maxConsecutivePeriods ?? 3;
    this.constraints.enforceRoomConflicts = this.config.enforceRoomConflicts ?? true;
    
    // Parse JSON arrays from config
    if (this.config.preferredLabPeriods) {
      try {
        this.constraints.preferredLabPeriods = JSON.parse(this.config.preferredLabPeriods);
      } catch { this.constraints.preferredLabPeriods = []; }
    }
    if (this.config.lightSubjectPeriods) {
      try {
        this.constraints.lightSubjectPeriods = JSON.parse(this.config.lightSubjectPeriods);
      } catch { this.constraints.lightSubjectPeriods = []; }
    }
    
    // Load subjects and auto-populate groups from subject metadata
    await this.loadSubjectGroups(schoolId);
  }

  // Load subjects from database and populate language/stream groups
  private async loadSubjectGroups(schoolId: number): Promise<void> {
    const subjects = await storage.getSubjects(schoolId);
    
    // Reset groups
    this.constraints.languageGroups = { II_LANGUAGE: [], III_LANGUAGE: [] };
    this.constraints.streamGroups = { SCIENCE: [], COMMERCE: [], HUMANITIES: [] };
    this.constraints.labSubjects = [];
    this.constraints.lightSubjects = [];
    this.constraints.maxPeriodsPerWeek = {};
    this.constraints.maxPeriodsPerDay = {};
    
    for (const subject of subjects) {
      // Populate PPW and PPD limits
      if (subject.periodsPerWeek) {
        this.constraints.maxPeriodsPerWeek[subject.id] = subject.periodsPerWeek;
      }
      if (subject.periodsPerDay) {
        this.constraints.maxPeriodsPerDay[subject.id] = subject.periodsPerDay;
      }
      
      // Populate language groups (II_LANGUAGE: Tamil/Hindi/Sanskrit/French must be parallel)
      if (subject.languageGroup === "II_LANGUAGE") {
        this.constraints.languageGroups.II_LANGUAGE.push(subject.id);
      } else if (subject.languageGroup === "III_LANGUAGE") {
        this.constraints.languageGroups.III_LANGUAGE.push(subject.id);
      }
      
      // Populate stream groups (11th/12th streams must be parallel)
      if (subject.streamGroup && subject.streamGroup !== "NONE") {
        if (!this.constraints.streamGroups[subject.streamGroup]) {
          this.constraints.streamGroups[subject.streamGroup] = [];
        }
        this.constraints.streamGroups[subject.streamGroup].push(subject.id);
      }
      
      // Lab subjects need double periods
      if (subject.isLab) {
        this.constraints.labSubjects.push(subject.id);
      }
      
      // Light subjects for after lunch
      if (subject.isLightSubject) {
        this.constraints.lightSubjects.push(subject.id);
      }
    }
  }

  // Set PPW (Periods Per Week) limits for subjects
  setPPWLimits(limits: Record<number, number>): void {
    this.constraints.maxPeriodsPerWeek = limits;
  }

  // Mark subjects as lab subjects (need double periods)
  setLabSubjects(subjectIds: number[]): void {
    this.constraints.labSubjects = subjectIds;
  }

  // Set II/III language combinations
  setLanguageGroups(groups: Record<string, number[]>): void {
    this.constraints.languageGroups = groups;
  }

  // Set 11th/12th stream groups for parallel scheduling
  setStreamGroups(groups: Record<string, number[]>): void {
    this.constraints.streamGroups = groups;
  }

  // Set light subjects for after-lunch
  setLightSubjects(subjectIds: number[]): void {
    this.constraints.lightSubjects = subjectIds;
  }

  // Generate SOFT parallel period recommendations for languages and streams
  // This provides preferred slots but doesn't block other subjects
  generateParallelSlots(daysPerWeek: number = 6): void {
    this.constraints.parallelPeriodSlots = [];
    
    // For II_LANGUAGE: Use minimum PPW to avoid over-reservation
    const iiLanguageSubjects = this.constraints.languageGroups.II_LANGUAGE || [];
    if (iiLanguageSubjects.length > 1) {
      const ppwValues = iiLanguageSubjects.map(id => this.constraints.maxPeriodsPerWeek[id] || 3);
      const minPPW = Math.min(...ppwValues);
      
      // Distribute across the week - avoid first and last periods
      for (let i = 0; i < minPPW; i++) {
        const day = (i % daysPerWeek) + 1;
        const period = 2 + Math.floor(i / daysPerWeek); // Start from period 2
        this.constraints.parallelPeriodSlots.push({
          groupType: "II_LANGUAGE",
          groupName: "II_LANGUAGE",
          dayOfWeek: day,
          periodIndex: period,
          subjectIds: iiLanguageSubjects
        });
      }
    }
    
    // For III_LANGUAGE: Same logic with minimum PPW
    const iiiLanguageSubjects = this.constraints.languageGroups.III_LANGUAGE || [];
    if (iiiLanguageSubjects.length > 1) {
      const ppwValues = iiiLanguageSubjects.map(id => this.constraints.maxPeriodsPerWeek[id] || 2);
      const minPPW = Math.min(...ppwValues);
      
      for (let i = 0; i < minPPW; i++) {
        const day = (i % daysPerWeek) + 1;
        const period = 3 + Math.floor(i / daysPerWeek); // Start from period 3
        this.constraints.parallelPeriodSlots.push({
          groupType: "III_LANGUAGE",
          groupName: "III_LANGUAGE",
          dayOfWeek: day,
          periodIndex: period,
          subjectIds: iiiLanguageSubjects
        });
      }
    }
    
    // For STREAMS (11th/12th): Science/Commerce/Humanities run in parallel
    // Collect all stream subjects for parallel scheduling
    const allStreamSubjects: number[] = [];
    for (const subjectIds of Object.values(this.constraints.streamGroups)) {
      allStreamSubjects.push(...subjectIds);
    }
    
    if (allStreamSubjects.length > 0) {
      const ppwValues = allStreamSubjects.map(id => this.constraints.maxPeriodsPerWeek[id] || 4);
      const minPPW = Math.min(...ppwValues);
      
      for (let i = 0; i < minPPW; i++) {
        const day = (i % daysPerWeek) + 1;
        const period = 4 + Math.floor(i / daysPerWeek); // Start from period 4
        this.constraints.parallelPeriodSlots.push({
          groupType: "STREAM",
          groupName: "ALL_STREAMS",
          dayOfWeek: day,
          periodIndex: period,
          subjectIds: allStreamSubjects
        });
      }
    }
  }

  // Check if a subject should be scheduled in a parallel slot at given day/period
  private getParallelSlotForSubject(subjectId: number, day: number, period: number): ParallelSlot | null {
    return this.constraints.parallelPeriodSlots.find(
      slot => slot.dayOfWeek === day && 
              slot.periodIndex === period && 
              slot.subjectIds.includes(subjectId)
    ) || null;
  }

  // Check if the slot is reserved for a parallel group that doesn't include this subject
  private isSlotReservedForOtherParallelGroup(subjectId: number, day: number, period: number): boolean {
    const slot = this.constraints.parallelPeriodSlots.find(
      s => s.dayOfWeek === day && s.periodIndex === period
    );
    if (!slot) return false;
    return !slot.subjectIds.includes(subjectId);
  }

  // Check if a subject is in any language group (II or III)
  private isInAnyLanguageGroup(subjectId: number): boolean {
    const iiLang = this.constraints.languageGroups.II_LANGUAGE || [];
    const iiiLang = this.constraints.languageGroups.III_LANGUAGE || [];
    return iiLang.includes(subjectId) || iiiLang.includes(subjectId);
  }

  // Check if a subject is in any stream group
  private isInAnyStreamGroup(subjectId: number): boolean {
    for (const subjectIds of Object.values(this.constraints.streamGroups)) {
      if (subjectIds.includes(subjectId)) return true;
    }
    return false;
  }

  // Check if any of the section's subjects are in a parallel group for this slot
  private sectionHasParallelSubjectsForSlot(sectionSubjectIds: number[], day: number, period: number): boolean {
    const slot = this.constraints.parallelPeriodSlots.find(
      s => s.dayOfWeek === day && s.periodIndex === period
    );
    if (!slot) return false;
    
    // Check if any of the section's subjects are in this parallel slot
    return sectionSubjectIds.some(id => slot.subjectIds.includes(id));
  }

  // Set teacher preferences
  setTeacherPreference(teacherId: number, pref: TeacherPreference): void {
    this.constraints.teacherPreferences[teacherId] = pref;
  }

  // Generate timetable for a wing or section(s)
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    await this.loadConfig(request.schoolId);
    
    // Generate parallel period slots for languages and streams
    this.generateParallelSlots(6);
    
    // Check if timetable is frozen for specific wing or school-wide
    if (request.wingId) {
      const wingFrozen = await this.isFrozenForWing(request.schoolId, request.wingId);
      if (wingFrozen) {
        return {
          success: false,
          entries: [],
          conflicts: [{
            type: "CONSTRAINT_VIOLATION",
            message: `Cannot generate timetable - wing timetable is frozen. Please unfreeze first.`,
            periodIndex: 0,
            dayOfWeek: 0
          }],
          score: 0
        };
      }
    } else {
      const schoolWideFrozen = await storage.getActiveMasterTimetable(request.schoolId, undefined);
      if (schoolWideFrozen && !schoolWideFrozen.wingId) {
        return {
          success: false,
          entries: [],
          conflicts: [{
            type: "CONSTRAINT_VIOLATION",
            message: "Cannot generate timetable - school-wide timetable is frozen. Please unfreeze first.",
            periodIndex: 0,
            dayOfWeek: 0
          }],
          score: 0
        };
      }
    }
    
    // Merge provided constraints
    if (request.constraints) {
      this.constraints = { ...this.constraints, ...request.constraints };
    }
    
    const entries: Partial<Timetable>[] = [];
    const conflicts: Conflict[] = [];
    
    // Get sections to generate for
    let sections: Section[] = [];
    if (request.sectionIds.length > 0) {
      for (const sectionId of request.sectionIds) {
        const section = await storage.getSection(sectionId);
        if (section) sections.push(section);
      }
    } else if (request.wingId) {
      sections = await storage.getSectionsByWing(request.wingId);
    }
    
    // Get all teachers
    const teachers = await storage.getTeachers(request.schoolId);
    
    // Track teacher assignments per slot
    const teacherSlots: Map<string, number> = new Map(); // "day-period-teacherId" -> count
    
    // Track room assignments per slot (for room conflict detection)
    const roomSlots: Map<string, number> = new Map(); // "day-period-roomId" -> sectionId
    
    // Track subject counts per section per week
    const sectionSubjectCounts: Map<string, number> = new Map(); // "sectionId-subjectId" -> count
    
    // Track subject counts per section per day (for max periods per day limit)
    const sectionSubjectDayCounts: Map<string, number> = new Map(); // "sectionId-subjectId-day" -> count
    
    // Track teacher periods per day
    const teacherPeriodsPerDay: Map<string, number> = new Map(); // "teacherId-day" -> count
    
    // Track teacher consecutive periods
    const teacherConsecutive: Map<string, number[]> = new Map(); // "teacherId-day" -> [periods]
    
    // Generate for each section
    for (const section of sections) {
      const classInfo = await storage.getClass(section.classId);
      if (!classInfo) continue;
      
      const subjectTeachers = await storage.getSubjectTeachersForClass(classInfo.id);
      
      // Generate for each day (Mon-Sat)
      for (let day = 1; day <= 6; day++) {
        for (let period = 1; period <= this.constraints.periodsPerDay; period++) {
          const result = this.findBestAssignment(
            section.id,
            section.roomNumber || undefined,
            day,
            period,
            subjectTeachers,
            teacherSlots,
            roomSlots,
            sectionSubjectCounts,
            sectionSubjectDayCounts,
            teacherPeriodsPerDay,
            teacherConsecutive,
            conflicts
          );
          
          if (result) {
            entries.push({
              schoolId: request.schoolId,
              sectionId: section.id,
              dayOfWeek: day,
              periodIndex: period,
              subjectId: result.subjectId,
              teacherId: result.teacherId,
              roomId: section.roomNumber || undefined
            });
            
            // Update tracking
            const slotKey = `${day}-${period}-${result.teacherId}`;
            teacherSlots.set(slotKey, (teacherSlots.get(slotKey) || 0) + 1);
            
            if (section.roomNumber) {
              const roomKey = `${day}-${period}-${section.roomNumber}`;
              roomSlots.set(roomKey, section.id);
            }
            
            const countKey = `${section.id}-${result.subjectId}`;
            sectionSubjectCounts.set(countKey, (sectionSubjectCounts.get(countKey) || 0) + 1);
            
            // Track subject periods per day (for max periods per day limit)
            const dayCountKey = `${section.id}-${result.subjectId}-${day}`;
            sectionSubjectDayCounts.set(dayCountKey, (sectionSubjectDayCounts.get(dayCountKey) || 0) + 1);
            
            // Track teacher periods per day
            const dayKey = `${result.teacherId}-${day}`;
            teacherPeriodsPerDay.set(dayKey, (teacherPeriodsPerDay.get(dayKey) || 0) + 1);
            
            // Track consecutive periods
            const consKey = `${result.teacherId}-${day}`;
            if (!teacherConsecutive.has(consKey)) {
              teacherConsecutive.set(consKey, []);
            }
            teacherConsecutive.get(consKey)!.push(period);
          }
        }
      }
    }
    
    // Calculate score using exact AppScript weights from config
    const score = this.calculateScore(entries, conflicts);
    
    return {
      success: conflicts.length === 0,
      entries,
      conflicts,
      score
    };
  }

  // Find best subject-teacher assignment for a slot with ALL constraints
  private findBestAssignment(
    sectionId: number,
    roomId: string | undefined,
    day: number,
    period: number,
    subjectTeachers: Array<{ subjectId: number; teacherId: number }>,
    teacherSlots: Map<string, number>,
    roomSlots: Map<string, number>,
    sectionSubjectCounts: Map<string, number>,
    sectionSubjectDayCounts: Map<string, number>,
    teacherPeriodsPerDay: Map<string, number>,
    teacherConsecutive: Map<string, number[]>,
    conflicts: Conflict[]
  ): { subjectId: number; teacherId: number } | null {
    
    let bestScore = -1;
    let bestAssignment: { subjectId: number; teacherId: number } | null = null;
    
    for (const st of subjectTeachers) {
      let score = 100;
      
      // SOFT PARALLEL PERIOD SCORING: Prefer language/stream subjects in their designated slots
      // This encourages but doesn't force parallel scheduling
      const parallelSlot = this.getParallelSlotForSubject(st.subjectId, day, period);
      if (parallelSlot) {
        score += 40; // Strong preference for scheduling in designated parallel slots
      }
      
      // Check if this subject is part of any language/stream group
      const isLanguageSubject = this.isInAnyLanguageGroup(st.subjectId);
      const isStreamSubject = this.isInAnyStreamGroup(st.subjectId);
      
      // SOFT CONSTRAINT: Language/stream subjects prefer their parallel slots
      // but can be scheduled elsewhere if needed (to handle different PPW requirements)
      if (isLanguageSubject || isStreamSubject) {
        if (!parallelSlot) {
          // Can still schedule outside parallel slots, but with penalty
          score -= 20;
        }
      }
      
      // Check periods per day limit for this subject using the proper day count map
      const subjectDayKey = `${sectionId}-${st.subjectId}-${day}`;
      const subjectDayCount = sectionSubjectDayCounts.get(subjectDayKey) || 0;
      const maxPPD = this.constraints.maxPeriodsPerDay[st.subjectId] || 2;
      if (subjectDayCount >= maxPPD) {
        continue; // Already reached max periods per day for this subject
      }
      
      // HARD CONSTRAINT 1: Check if teacher is already assigned this period
      const slotKey = `${day}-${period}-${st.teacherId}`;
      if (teacherSlots.has(slotKey)) {
        continue; // Teacher busy
      }
      
      // HARD CONSTRAINT 2: Check max periods per teacher per day
      const dayKey = `${st.teacherId}-${day}`;
      const currentDayPeriods = teacherPeriodsPerDay.get(dayKey) || 0;
      if (currentDayPeriods >= this.constraints.maxPeriodsPerTeacherPerDay) {
        if (subjectTeachers.indexOf(st) === subjectTeachers.length - 1 && !bestAssignment) {
          conflicts.push({
            type: "MAX_PERIODS_DAY",
            message: `Teacher ${st.teacherId} has reached maximum ${this.constraints.maxPeriodsPerTeacherPerDay} periods per day`,
            periodIndex: period,
            dayOfWeek: day,
            sectionId,
            teacherId: st.teacherId
          });
        }
        continue;
      }
      
      // HARD CONSTRAINT 3: Check PPW limits
      const countKey = `${sectionId}-${st.subjectId}`;
      const currentCount = sectionSubjectCounts.get(countKey) || 0;
      const maxPPW = this.constraints.maxPeriodsPerWeek[st.subjectId] || 6;
      if (currentCount >= maxPPW) {
        if (subjectTeachers.indexOf(st) === subjectTeachers.length - 1 && !bestAssignment) {
          conflicts.push({
            type: "PPW_EXCEEDED",
            message: `Subject ${st.subjectId} has reached maximum ${maxPPW} periods per week for section ${sectionId}`,
            periodIndex: period,
            dayOfWeek: day,
            sectionId
          });
        }
        continue;
      }
      
      // HARD CONSTRAINT 4: Check room conflicts (if enabled)
      if (this.constraints.enforceRoomConflicts && roomId) {
        const roomKey = `${day}-${period}-${roomId}`;
        if (roomSlots.has(roomKey) && roomSlots.get(roomKey) !== sectionId) {
          conflicts.push({
            type: "ROOM_OVERLAP",
            message: `Room ${roomId} already assigned for day ${day}, period ${period}`,
            periodIndex: period,
            dayOfWeek: day,
            sectionId,
            roomId
          });
          continue;
        }
      }
      
      // HARD CONSTRAINT 5: Check consecutive periods limit
      const consKey = `${st.teacherId}-${day}`;
      const teacherPeriods = teacherConsecutive.get(consKey) || [];
      const consecutiveCount = this.countConsecutive(teacherPeriods, period);
      if (consecutiveCount >= this.constraints.maxConsecutivePeriods) {
        if (subjectTeachers.indexOf(st) === subjectTeachers.length - 1 && !bestAssignment) {
          conflicts.push({
            type: "MAX_CONSECUTIVE",
            message: `Teacher ${st.teacherId} would exceed ${this.constraints.maxConsecutivePeriods} consecutive periods`,
            periodIndex: period,
            dayOfWeek: day,
            sectionId,
            teacherId: st.teacherId
          });
        }
        continue;
      }
      
      // SOFT SCORING: Prefer light subjects after lunch
      if (period === this.constraints.lunchAfterPeriod + 1 || 
          this.constraints.lightSubjectPeriods.includes(period)) {
        if (this.constraints.lightSubjects.includes(st.subjectId)) {
          score += 20;
        }
      }
      
      // SOFT SCORING: Prefer lab subjects in preferred periods
      if (this.constraints.labSubjects.includes(st.subjectId)) {
        if (this.constraints.preferredLabPeriods.includes(period)) {
          score += 15;
        }
      }
      
      // SOFT SCORING: Check teacher preferences
      const pref = this.constraints.teacherPreferences[st.teacherId];
      if (pref) {
        if (pref.preferredPeriods?.includes(period)) {
          score += 15;
        }
        if (pref.avoidPeriods?.includes(period)) {
          score -= 30;
        }
      }
      
      // SOFT SCORING: Favor spreading subjects across the week
      if (currentCount === 0) {
        score += 10;
      }
      
      // SOFT SCORING: Penalty for consecutive periods
      if (consecutiveCount > 0) {
        score -= consecutiveCount * 5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestAssignment = { subjectId: st.subjectId, teacherId: st.teacherId };
      }
    }
    
    if (!bestAssignment) {
      conflicts.push({
        type: "NO_TEACHER",
        message: `No available teacher for section ${sectionId} on day ${day}, period ${period}`,
        periodIndex: period,
        dayOfWeek: day,
        sectionId
      });
    }
    
    return bestAssignment;
  }

  // Count consecutive periods including the new one
  private countConsecutive(existingPeriods: number[], newPeriod: number): number {
    if (existingPeriods.length === 0) return 0;
    
    let count = 0;
    const sorted = [...existingPeriods].sort((a, b) => a - b);
    
    // Check backwards from newPeriod
    for (let p = newPeriod - 1; p >= 1; p--) {
      if (sorted.includes(p)) {
        count++;
      } else {
        break;
      }
    }
    
    // Check forwards from newPeriod
    for (let p = newPeriod + 1; p <= this.constraints.periodsPerDay; p++) {
      if (sorted.includes(p)) {
        count++;
      } else {
        break;
      }
    }
    
    return count;
  }

  // Calculate overall timetable quality score using exact AppScript weights
  private calculateScore(entries: Partial<Timetable>[], conflicts: Conflict[]): number {
    let score = 100;
    
    // Deduct for conflicts (weighted by type)
    for (const conflict of conflicts) {
      switch (conflict.type) {
        case "TEACHER_OVERLAP":
        case "ROOM_OVERLAP":
          score -= 10;
          break;
        case "PPW_EXCEEDED":
        case "MAX_PERIODS_DAY":
        case "MAX_CONSECUTIVE":
          score -= 8;
          break;
        case "NO_TEACHER":
          score -= 5;
          break;
        default:
          score -= 3;
      }
    }
    
    // Bonus for filling all slots
    const filledSlots = entries.length;
    score += Math.min(filledSlots / 10, 10);
    
    return Math.max(0, Math.min(100, score));
  }

  // Validate existing timetable
  async validate(schoolId: number, wingId?: number): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    await this.loadConfig(schoolId);
    
    const entries = await storage.getTimetable(schoolId);
    const teacherSlots: Map<string, Timetable[]> = new Map();
    const roomSlots: Map<string, Timetable[]> = new Map();
    const teacherPeriodsPerDay: Map<string, number> = new Map();
    
    for (const entry of entries) {
      // Check teacher overlap
      const teacherSlotKey = `${entry.dayOfWeek}-${entry.periodIndex}-${entry.teacherId}`;
      if (!teacherSlots.has(teacherSlotKey)) {
        teacherSlots.set(teacherSlotKey, []);
      }
      const existingTeacher = teacherSlots.get(teacherSlotKey)!;
      if (existingTeacher.length > 0 && entry.teacherId) {
        conflicts.push({
          type: "TEACHER_OVERLAP",
          message: `Teacher ${entry.teacherId} assigned to multiple sections at day ${entry.dayOfWeek}, period ${entry.periodIndex}`,
          periodIndex: entry.periodIndex,
          dayOfWeek: entry.dayOfWeek,
          teacherId: entry.teacherId || undefined
        });
      }
      existingTeacher.push(entry);
      
      // Check room overlap
      if (this.constraints.enforceRoomConflicts && entry.roomId) {
        const roomSlotKey = `${entry.dayOfWeek}-${entry.periodIndex}-${entry.roomId}`;
        if (!roomSlots.has(roomSlotKey)) {
          roomSlots.set(roomSlotKey, []);
        }
        const existingRoom = roomSlots.get(roomSlotKey)!;
        if (existingRoom.length > 0) {
          conflicts.push({
            type: "ROOM_OVERLAP",
            message: `Room ${entry.roomId} assigned to multiple sections at day ${entry.dayOfWeek}, period ${entry.periodIndex}`,
            periodIndex: entry.periodIndex,
            dayOfWeek: entry.dayOfWeek,
            roomId: entry.roomId
          });
        }
        existingRoom.push(entry);
      }
      
      // Check max periods per day per teacher
      if (entry.teacherId) {
        const dayKey = `${entry.teacherId}-${entry.dayOfWeek}`;
        const count = (teacherPeriodsPerDay.get(dayKey) || 0) + 1;
        teacherPeriodsPerDay.set(dayKey, count);
        
        if (count > this.constraints.maxPeriodsPerTeacherPerDay) {
          conflicts.push({
            type: "MAX_PERIODS_DAY",
            message: `Teacher ${entry.teacherId} exceeds ${this.constraints.maxPeriodsPerTeacherPerDay} periods on day ${entry.dayOfWeek}`,
            periodIndex: entry.periodIndex,
            dayOfWeek: entry.dayOfWeek,
            teacherId: entry.teacherId
          });
        }
      }
    }
    
    return conflicts;
  }

  // Freeze timetable as master
  async freeze(schoolId: number, wingId: number | undefined, name: string, userId: number): Promise<boolean> {
    const conflicts = await this.validate(schoolId, wingId);
    if (conflicts.length > 0) {
      throw new Error(`Cannot freeze timetable with ${conflicts.length} conflicts`);
    }
    
    await storage.createMasterTimetable({
      schoolId,
      wingId,
      name,
      isActive: true,
      frozenAt: new Date(),
      createdBy: userId
    });
    
    return true;
  }

  // Check if timetable is frozen
  async isFrozen(schoolId: number, wingId?: number): Promise<boolean> {
    const master = await storage.getActiveMasterTimetable(schoolId, wingId);
    return master !== null;
  }

  // Unfreeze timetable to allow modifications
  async unfreeze(schoolId: number, wingId: number | undefined, userId: number): Promise<boolean> {
    const master = await storage.getActiveMasterTimetable(schoolId, wingId);
    if (!master) {
      return false;
    }
    
    await storage.deactivateMasterTimetable(master.id);
    return true;
  }

  // Get PPW statistics for a section
  async getPPWStats(schoolId: number, sectionId: number): Promise<Record<number, { current: number; max: number }>> {
    await this.loadConfig(schoolId);
    
    const entries = await storage.getTimetable(schoolId, sectionId);
    const stats: Record<number, { current: number; max: number }> = {};
    
    for (const entry of entries) {
      if (entry.subjectId) {
        if (!stats[entry.subjectId]) {
          stats[entry.subjectId] = { 
            current: 0, 
            max: this.constraints.maxPeriodsPerWeek[entry.subjectId] || 6 
          };
        }
        stats[entry.subjectId].current++;
      }
    }
    
    return stats;
  }

  // Check if specific wing timetable is frozen
  async isFrozenForWing(schoolId: number, wingId: number): Promise<boolean> {
    const wingMaster = await storage.getActiveMasterTimetable(schoolId, wingId);
    if (wingMaster) return true;
    
    const schoolWideMaster = await storage.getSchoolWideMasterTimetable(schoolId);
    return schoolWideMaster !== undefined;
  }
}

// Singleton instance
export const timetableEngine = new TimetableEngine();
