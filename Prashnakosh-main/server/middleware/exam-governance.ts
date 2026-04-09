import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { WorkflowState, UserRole } from "@shared/schema";

const VALID_TRANSITIONS: Record<WorkflowState, { to: WorkflowState[]; roles: UserRole[] }> = {
  draft: { 
    to: ["submitted", "pending_hod", "hod_approved"], 
    roles: ["teacher", "hod", "admin", "super_admin"] 
  },
  submitted: { 
    to: ["pending_hod"], 
    roles: ["teacher", "hod", "admin", "super_admin"] 
  },
  pending_hod: { 
    to: ["hod_approved", "hod_rejected"], 
    roles: ["hod", "admin", "super_admin"] 
  },
  hod_approved: { 
    to: ["active", "pending_principal", "sent_to_committee", "locked"], 
    roles: ["hod", "admin", "super_admin", "exam_committee"] 
  },
  hod_rejected: { 
    to: ["draft"], 
    roles: ["teacher", "admin", "super_admin"] 
  },
  pending_principal: { 
    to: ["principal_approved", "principal_rejected"], 
    roles: ["principal", "admin", "super_admin"] 
  },
  principal_approved: { 
    to: ["active", "sent_to_committee", "locked"], 
    roles: ["principal", "hod", "admin", "super_admin", "exam_committee"] 
  },
  principal_rejected: { 
    to: ["draft", "pending_hod"], 
    roles: ["teacher", "hod", "admin", "super_admin"] 
  },
  sent_to_committee: { 
    to: ["active", "locked"], 
    roles: ["exam_committee", "hod", "admin", "super_admin"] 
  },
  active: { 
    to: ["locked"], 
    roles: ["exam_committee", "hod", "admin", "super_admin"] 
  },
  locked: { 
    to: ["archived"], 
    roles: ["admin", "super_admin"] 
  },
  archived: { 
    to: [], 
    roles: [] 
  },
};

const EDITABLE_STATES: WorkflowState[] = ["draft", "submitted", "hod_rejected", "principal_rejected"];

// Allow draft for HOD preview, and all approved states for actual download
const DOWNLOAD_STATES: WorkflowState[] = ["draft", "submitted", "pending_hod", "hod_approved", "pending_principal", "principal_approved", "sent_to_committee", "active", "locked", "archived"];

const ATTEMPT_ALLOWED_STATES: WorkflowState[] = ["active"];

export function canEditTest(state: WorkflowState | null | undefined): boolean {
  if (!state) return true;
  return EDITABLE_STATES.includes(state);
}

export function canActivateTest(state: WorkflowState | null | undefined): boolean {
  if (!state) return false;
  return ["hod_approved", "principal_approved", "sent_to_committee"].includes(state);
}

export function canDownloadPaper(state: WorkflowState | null | undefined): boolean {
  if (!state) return false;
  return DOWNLOAD_STATES.includes(state);
}

export function canStartAttempt(state: WorkflowState | null | undefined, isActive: boolean | null | undefined): boolean {
  if (!isActive) return false;
  if (!state) return false;
  return ATTEMPT_ALLOWED_STATES.includes(state) && isActive;
}

export function canTransitionTo(
  fromState: WorkflowState | null | undefined, 
  toState: WorkflowState, 
  role: UserRole
): { valid: boolean; reason?: string } {
  const from = fromState || "draft";
  const transition = VALID_TRANSITIONS[from];
  
  if (!transition) {
    return { valid: false, reason: `Unknown state: ${from}` };
  }
  
  if (!transition.to.includes(toState)) {
    return { valid: false, reason: `Cannot transition from ${from} to ${toState}` };
  }
  
  if (!transition.roles.includes(role) && role !== "super_admin") {
    return { valid: false, reason: `Role ${role} cannot perform this transition` };
  }
  
  return { valid: true };
}

export function requireEditableState() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const testId = req.params.id || req.body.testId;
    if (!testId) {
      return next();
    }
    
    try {
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      
      if (!canEditTest(test.workflowState)) {
        return res.status(403).json({ 
          error: `Test cannot be edited in ${test.workflowState} state. Only editable in: ${EDITABLE_STATES.join(", ")}` 
        });
      }
      
      (req as any).test = test;
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

export function requireDownloadableState() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const testId = req.params.id;
    if (!testId) {
      return res.status(400).json({ error: "Test ID required" });
    }
    
    try {
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      
      if (!canDownloadPaper(test.workflowState)) {
        return res.status(403).json({ 
          error: `Paper download only allowed in ${DOWNLOAD_STATES.join(", ")} states. Current: ${test.workflowState}` 
        });
      }
      
      (req as any).test = test;
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

export function requireAttemptAllowedState() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const testId = req.body.testId || req.params.testId;
    if (!testId) {
      return res.status(400).json({ error: "Test ID required" });
    }
    
    try {
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      
      if (!canStartAttempt(test.workflowState, test.isActive)) {
        return res.status(403).json({ 
          error: `Exam attempts only allowed when test is active. Current state: ${test.workflowState}, isActive: ${test.isActive}` 
        });
      }
      
      (req as any).test = test;
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

export function requireActivatableState() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const testId = req.params.id;
    if (!testId) {
      return res.status(400).json({ error: "Test ID required" });
    }
    
    try {
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      
      if (!canActivateTest(test.workflowState)) {
        return res.status(403).json({ 
          error: `Test cannot be activated from ${test.workflowState} state. Must be HOD/Principal approved or sent to committee first.` 
        });
      }
      
      (req as any).test = test;
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

export async function logStateChange(
  examId: string,
  tenantId: string,
  fromState: WorkflowState | null,
  toState: WorkflowState,
  actorId: string,
  actorRole: UserRole,
  comments?: string
): Promise<void> {
  await storage.createExamAuditLog({
    examId,
    tenantId,
    fromState,
    toState,
    actorId,
    actorRole,
    comments: comments || null,
  });
}

export { VALID_TRANSITIONS, EDITABLE_STATES, DOWNLOAD_STATES, ATTEMPT_ALLOWED_STATES };
