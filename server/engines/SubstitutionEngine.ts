import { storage } from "../storage";
import type { LeaveRequest, Timetable, User, SchoolConfig, Substitution, Section } from "@shared/schema";
import { LEAVE_TYPES } from "@shared/schema";

interface SubstitutionScore {
  teacherId: number;
  teacherName: string;
  totalScore: number;
  breakdown: ScoreBreakdown;
  warnings: string[];
}

interface ScoreBreakdown {
  baseScore: number;
  subjectMatch: number;
  classFamiliarity: number;
  periodGap: number;
  substitutionLoad: number;
  consecutivePenalty: number;
  teacherPreference: number;
  wingPriority: number;
}

interface GenerateOptions {
  schoolId: number;
  date: Date;
  enforceDeadline?: boolean;
  maxSubsPerTeacher?: number;
  wingId?: number; // For wing-level priority override
}

interface SubstitutionResult {
  generated: number;
  substitutions: Partial<Substitution>[];
  skipped: SkippedPeriod[];
  errors: string[];
}

interface SkippedPeriod {
  originalTeacherId: number;
  sectionId: number;
  periodIndex: number;
  reason: string;
}

export class SubstitutionEngine {
  private config: SchoolConfig | null = null;
  
  // Score weights - ALL loaded from config
  private weights = {
    base: 100,
    subjectMatch: 30,
    classFamiliarity: 20,
    periodGap: -15,
    substitutionLoad: -10,
    overload: -50,
    consecutivePenalty: -25,
    wingPriority: 15,
  };

  // Load ALL config with safe fallbacks
  async loadConfig(schoolId: number): Promise<void> {
    this.config = (await storage.getSchoolConfig(schoolId)) || null;
    
    if (!this.config) {
      throw new Error(`SchoolConfig not found for school ${schoolId}. Cannot generate substitutions without configuration.`);
    }
    
    // Load ALL scoring weights from config with safe fallbacks
    this.weights.base = this.config.scoreWeightBase ?? 100;
    this.weights.subjectMatch = this.config.scoreWeightSubjectMatch ?? 30;
    this.weights.classFamiliarity = this.config.scoreWeightClassFamiliarity ?? 20;
    this.weights.periodGap = this.config.scoreWeightPeriodGap ?? -15;
    this.weights.substitutionLoad = this.config.scoreWeightSubstitutionLoad ?? -10;
    this.weights.overload = this.config.scoreWeightOverload ?? -50;
    // Note: consecutivePenalty and wingPriority remain at initialization values
    // as they are calculated soft weights, not stored in config
  }

  // Check if leave deadline has passed
  checkDeadline(config: SchoolConfig): { passed: boolean; deadline: string } {
    const now = new Date();
    const deadlineHour = config.leaveDeadlineHour ?? 6;
    const deadlineMinute = config.leaveDeadlineMinute ?? 45;
    
    const deadline = new Date();
    deadline.setHours(deadlineHour, deadlineMinute, 0, 0);
    
    return {
      passed: now > deadline,
      deadline: `${deadlineHour}:${deadlineMinute.toString().padStart(2, "0")} AM`
    };
  }

  // Generate substitutions for approved leaves on a date
  async generate(options: GenerateOptions): Promise<SubstitutionResult> {
    await this.loadConfig(options.schoolId);
    
    const result: SubstitutionResult = {
      generated: 0,
      substitutions: [],
      skipped: [],
      errors: []
    };

    // Check deadline if enforcing
    if (options.enforceDeadline && this.config) {
      const deadline = this.checkDeadline(this.config);
      if (deadline.passed) {
        result.errors.push(`Leave deadline (${deadline.deadline}) has passed. No new leaves can be processed.`);
      }
    }

    // Get max subs from config - NO fallback defaults
    const maxSubs = options.maxSubsPerTeacher || this.config!.maxSubstitutionsPerDay!;
    const maxConsecutive = this.config!.maxConsecutiveSubstitutions!;
    const wingPriorityEnabled = this.config!.wingPriorityOverride!;
    
    // Get approved leaves for the date
    const leaves = await storage.getLeaveRequests(options.schoolId, options.date);
    const approvedLeaves = leaves.filter(l => l.status === "APPROVED");
    
    if (approvedLeaves.length === 0) {
      return result;
    }

    // Get all teachers
    const allTeachers = await storage.getTeachers(options.schoolId);
    
    // Get teachers on duty today (ON_DUTY or INCHARGE_DUTY leaves)
    const onDutyLeaves = leaves.filter(l => 
      l.leaveType === LEAVE_TYPES.ON_DUTY || 
      l.leaveType === LEAVE_TYPES.INCHARGE_DUTY
    );
    const onDutyTeacherIds = new Set(onDutyLeaves.map(l => l.teacherId));
    
    // Track substitution counts per teacher
    const substitutionCounts: Map<number, number> = new Map();
    
    // Track substitution periods per teacher for consecutive check
    const substitutionPeriods: Map<number, number[]> = new Map();
    
    // Load existing substitutions for today
    const existingSubs = await storage.getSubstitutions(options.schoolId, options.date);
    for (const sub of existingSubs) {
      substitutionCounts.set(
        sub.substituteTeacherId,
        (substitutionCounts.get(sub.substituteTeacherId) || 0) + 1
      );
      if (!substitutionPeriods.has(sub.substituteTeacherId)) {
        substitutionPeriods.set(sub.substituteTeacherId, []);
      }
      substitutionPeriods.get(sub.substituteTeacherId)!.push(sub.periodIndex);
    }

    // Process each leave
    for (const leave of approvedLeaves) {
      const periodsToSubstitute = await this.getPeriodsToSubstitute(leave, options.date);
      
      // Get wing for this teacher if wing priority is enabled
      let teacherWingId: number | undefined;
      if (wingPriorityEnabled) {
        const teacher = allTeachers.find(t => t.id === leave.teacherId);
        teacherWingId = teacher?.wingId || undefined;
      }
      
      for (const period of periodsToSubstitute) {
        // Score all available teachers
        const scores = await this.scoreTeachers(
          allTeachers,
          period,
          leave,
          substitutionCounts,
          substitutionPeriods,
          onDutyTeacherIds,
          maxSubs,
          maxConsecutive,
          options.schoolId,
          options.date,
          teacherWingId,
          wingPriorityEnabled
        );
        
        // Get best available teacher
        const bestMatch = scores
          .filter(s => s.totalScore > 0 && s.warnings.length === 0)
          .sort((a, b) => b.totalScore - a.totalScore)[0];
        
        if (bestMatch) {
          const sub: Partial<Substitution> = {
            schoolId: options.schoolId,
            date: options.date,
            periodIndex: period.periodIndex,
            sectionId: period.sectionId,
            originalTeacherId: leave.teacherId,
            substituteTeacherId: bestMatch.teacherId,
            leaveRequestId: leave.id,
            subjectId: period.subjectId || undefined,
            score: bestMatch.totalScore,
            isNotified: false
          };
          
          result.substitutions.push(sub);
          result.generated++;
          
          // Update counts
          substitutionCounts.set(
            bestMatch.teacherId,
            (substitutionCounts.get(bestMatch.teacherId) || 0) + 1
          );
          
          // Update periods for consecutive tracking
          if (!substitutionPeriods.has(bestMatch.teacherId)) {
            substitutionPeriods.set(bestMatch.teacherId, []);
          }
          substitutionPeriods.get(bestMatch.teacherId)!.push(period.periodIndex);
        } else {
          result.skipped.push({
            originalTeacherId: leave.teacherId,
            sectionId: period.sectionId,
            periodIndex: period.periodIndex,
            reason: scores.length === 0 
              ? "No teachers available" 
              : `Best candidate disqualified: ${scores[0]?.warnings.join(", ")}`
          });
        }
      }
    }

    // Save generated substitutions
    for (const sub of result.substitutions) {
      await storage.createSubstitution(sub as any);
    }

    return result;
  }

  // Get periods that need substitution based on leave type
  private async getPeriodsToSubstitute(
    leave: LeaveRequest, 
    date: Date
  ): Promise<Timetable[]> {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    
    const timetable = await storage.getTimetable(leave.schoolId, undefined, leave.teacherId);
    let periods = timetable.filter(t => t.dayOfWeek === dayOfWeek);
    
    if (leave.leaveType === LEAVE_TYPES.PERMISSION && leave.periods) {
      const permissionPeriods = JSON.parse(leave.periods) as number[];
      periods = periods.filter(p => permissionPeriods.includes(p.periodIndex));
    }
    
    if (leave.leaveType === LEAVE_TYPES.HALF_DAY) {
      const lunchPeriod = this.config?.lunchAfterPeriod || 4;
      periods = periods.filter(p => p.periodIndex <= lunchPeriod);
    }
    
    return periods;
  }

  // Score all teachers for a period with ALL constraints
  private async scoreTeachers(
    teachers: User[],
    period: Timetable,
    leave: LeaveRequest,
    substitutionCounts: Map<number, number>,
    substitutionPeriods: Map<number, number[]>,
    onDutyTeacherIds: Set<number>,
    maxSubs: number,
    maxConsecutive: number,
    schoolId: number,
    date: Date,
    targetWingId: number | undefined,
    wingPriorityEnabled: boolean
  ): Promise<SubstitutionScore[]> {
    const scores: SubstitutionScore[] = [];
    
    // Get section info for class teacher check
    const section = await storage.getSection(period.sectionId);
    
    for (const teacher of teachers) {
      // Skip the absent teacher
      if (teacher.id === leave.teacherId) continue;
      
      const breakdown: ScoreBreakdown = {
        baseScore: this.weights.base,
        subjectMatch: 0,
        classFamiliarity: 0,
        periodGap: 0,
        substitutionLoad: 0,
        consecutivePenalty: 0,
        teacherPreference: 0,
        wingPriority: 0
      };
      
      const warnings: string[] = [];
      
      // HARD STOP: Exclude VP if configured
      const excludeVP = this.config?.excludeVPFromSubstitution ?? true;
      if (excludeVP && teacher.role === "VICE_PRINCIPAL") {
        warnings.push("Vice Principal excluded from substitutions (config)");
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // HARD STOP: Exclude Principal if configured
      const excludePrincipal = this.config?.excludePrincipalFromSubstitution ?? true;
      if (excludePrincipal && teacher.role === "PRINCIPAL") {
        warnings.push("Principal excluded from substitutions (config)");
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // HARD STOP: Check if teacher is on duty
      if (onDutyTeacherIds.has(teacher.id)) {
        warnings.push("Teacher is on duty");
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // HARD STOP: Check if teacher is already assigned this period
      const teacherTimetable = await storage.getTimetable(schoolId, undefined, teacher.id);
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
      const hasClass = teacherTimetable.some(
        t => t.dayOfWeek === dayOfWeek && t.periodIndex === period.periodIndex
      );
      
      if (hasClass) {
        warnings.push("Teacher has scheduled class");
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // HARD STOP: Check already has substitution this period
      const teacherSubPeriods = substitutionPeriods.get(teacher.id) || [];
      if (teacherSubPeriods.includes(period.periodIndex)) {
        warnings.push("Already has substitution this period");
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // HARD STOP: Check substitution count cap
      const subCount = substitutionCounts.get(teacher.id) || 0;
      if (subCount >= maxSubs) {
        warnings.push(`Already has ${subCount} substitutions today (max: ${maxSubs})`);
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      breakdown.substitutionLoad = subCount * this.weights.substitutionLoad;
      
      // HARD STOP: Check period limit from config (default 7 unless necessary)
      const maxTeacherPeriods = this.config?.maxTeacherPeriodsForSubstitution ?? 7;
      const regularPeriods = teacherTimetable.filter(t => t.dayOfWeek === dayOfWeek).length;
      const totalPeriods = regularPeriods + subCount;
      if (totalPeriods >= maxTeacherPeriods) {
        warnings.push(`Hard stop: Would exceed ${maxTeacherPeriods} periods (currently ${totalPeriods}, would be ${totalPeriods + 1})`);
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // HARD STOP: Check consecutive substitutions
      const wouldBeConsecutive = this.countConsecutiveSubstitutions(teacherSubPeriods, period.periodIndex);
      if (wouldBeConsecutive >= maxConsecutive) {
        warnings.push(`Would exceed ${maxConsecutive} consecutive substitutions`);
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // Apply consecutive penalty (soft constraint - reduces score)
      if (wouldBeConsecutive > 0) {
        breakdown.consecutivePenalty = this.weights.consecutivePenalty * wouldBeConsecutive;
      }
      
      // HARD STOP: Back-to-back prevention if configured
      const avoidBackToBack = this.config?.avoidBackToBackSubstitution ?? true;
      if (avoidBackToBack && teacherSubPeriods.includes(period.periodIndex - 1)) {
        warnings.push("Would cause back-to-back substitution (previous period was also substitution)");
        scores.push({
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          totalScore: 0,
          breakdown,
          warnings
        });
        continue;
      }
      
      // Priority 1: Subject match bonus (highest priority for same subject teacher)
      if (period.subjectId) {
        const teacherSubjectIds = await storage.getTeacherSubjectIds(teacher.id);
        if (teacherSubjectIds.includes(period.subjectId)) {
          breakdown.subjectMatch = this.weights.subjectMatch;
        }
      }
      
      // Priority 2: Class familiarity bonus (same class-going teacher)
      const hasHistoryWithSection = await storage.hasTeacherTaughtSection(
        teacher.id, 
        period.sectionId
      );
      if (hasHistoryWithSection) {
        breakdown.classFamiliarity = this.weights.classFamiliarity;
      }
      
      // Priority 3: Class teacher bonus (class teacher of the section)
      if (section && section.classTeacherId === teacher.id) {
        breakdown.teacherPreference = 15; // Additional bonus for being class teacher
      }
      
      // Period gap penalty (avoid continuous periods with regular classes)
      const adjacentPeriods = teacherTimetable.filter(
        t => t.dayOfWeek === dayOfWeek && 
             Math.abs(t.periodIndex - period.periodIndex) === 1
      );
      if (adjacentPeriods.length > 0) {
        breakdown.periodGap = this.weights.periodGap * adjacentPeriods.length;
      }
      
      // Wing priority override - prefer teachers from same wing
      if (wingPriorityEnabled && targetWingId && teacher.wingId === targetWingId) {
        breakdown.wingPriority = this.weights.wingPriority;
      }
      
      // Calculate total score
      const totalScore = 
        breakdown.baseScore +
        breakdown.subjectMatch +
        breakdown.classFamiliarity +
        breakdown.periodGap +
        breakdown.substitutionLoad +
        breakdown.consecutivePenalty +
        breakdown.teacherPreference +
        breakdown.wingPriority;
      
      scores.push({
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        totalScore: Math.max(0, totalScore),
        breakdown,
        warnings
      });
    }
    
    return scores;
  }

  // Count how many consecutive substitutions would result from adding this period
  private countConsecutiveSubstitutions(existingPeriods: number[], newPeriod: number): number {
    if (existingPeriods.length === 0) return 0;
    
    let count = 0;
    const sorted = [...existingPeriods].sort((a, b) => a - b);
    
    // Check backwards
    for (let p = newPeriod - 1; p >= 1; p--) {
      if (sorted.includes(p)) {
        count++;
      } else {
        break;
      }
    }
    
    // Check forwards
    for (let p = newPeriod + 1; p <= 8; p++) {
      if (sorted.includes(p)) {
        count++;
      } else {
        break;
      }
    }
    
    return count;
  }

  // Preview substitution suggestions without saving
  async preview(options: GenerateOptions): Promise<SubstitutionResult> {
    await this.loadConfig(options.schoolId);
    
    const result: SubstitutionResult = {
      generated: 0,
      substitutions: [],
      skipped: [],
      errors: []
    };

    const maxSubs = options.maxSubsPerTeacher || this.config!.maxSubstitutionsPerDay!;
    const maxConsecutive = this.config!.maxConsecutiveSubstitutions!;
    const wingPriorityEnabled = this.config!.wingPriorityOverride!;
    
    const leaves = await storage.getLeaveRequests(options.schoolId, options.date);
    const approvedLeaves = leaves.filter(l => l.status === "APPROVED");
    
    if (approvedLeaves.length === 0) {
      return result;
    }

    const allTeachers = await storage.getTeachers(options.schoolId);
    const onDutyLeaves = leaves.filter(l => 
      l.leaveType === LEAVE_TYPES.ON_DUTY || 
      l.leaveType === LEAVE_TYPES.INCHARGE_DUTY
    );
    const onDutyTeacherIds = new Set(onDutyLeaves.map(l => l.teacherId));
    
    const substitutionCounts: Map<number, number> = new Map();
    const substitutionPeriods: Map<number, number[]> = new Map();
    
    const existingSubs = await storage.getSubstitutions(options.schoolId, options.date);
    for (const sub of existingSubs) {
      substitutionCounts.set(
        sub.substituteTeacherId,
        (substitutionCounts.get(sub.substituteTeacherId) || 0) + 1
      );
      if (!substitutionPeriods.has(sub.substituteTeacherId)) {
        substitutionPeriods.set(sub.substituteTeacherId, []);
      }
      substitutionPeriods.get(sub.substituteTeacherId)!.push(sub.periodIndex);
    }

    for (const leave of approvedLeaves) {
      const periodsToSubstitute = await this.getPeriodsToSubstitute(leave, options.date);
      
      let teacherWingId: number | undefined;
      if (wingPriorityEnabled) {
        const teacher = allTeachers.find(t => t.id === leave.teacherId);
        teacherWingId = teacher?.wingId || undefined;
      }
      
      for (const period of periodsToSubstitute) {
        const scores = await this.scoreTeachers(
          allTeachers,
          period,
          leave,
          substitutionCounts,
          substitutionPeriods,
          onDutyTeacherIds,
          maxSubs,
          maxConsecutive,
          options.schoolId,
          options.date,
          teacherWingId,
          wingPriorityEnabled
        );
        
        const bestMatch = scores
          .filter(s => s.totalScore > 0 && s.warnings.length === 0)
          .sort((a, b) => b.totalScore - a.totalScore)[0];
        
        if (bestMatch) {
          result.substitutions.push({
            schoolId: options.schoolId,
            date: options.date,
            periodIndex: period.periodIndex,
            sectionId: period.sectionId,
            originalTeacherId: leave.teacherId,
            substituteTeacherId: bestMatch.teacherId,
            leaveRequestId: leave.id,
            subjectId: period.subjectId || undefined,
            score: bestMatch.totalScore
          });
          result.generated++;
          
          substitutionCounts.set(
            bestMatch.teacherId,
            (substitutionCounts.get(bestMatch.teacherId) || 0) + 1
          );
          
          if (!substitutionPeriods.has(bestMatch.teacherId)) {
            substitutionPeriods.set(bestMatch.teacherId, []);
          }
          substitutionPeriods.get(bestMatch.teacherId)!.push(period.periodIndex);
        } else {
          result.skipped.push({
            originalTeacherId: leave.teacherId,
            sectionId: period.sectionId,
            periodIndex: period.periodIndex,
            reason: "No suitable teacher found"
          });
        }
      }
    }

    return result;
  }
}

export const substitutionEngine = new SubstitutionEngine();
