import { Request, Response, NextFunction } from "express";
import { USER_ROLES } from "@shared/schema";

// Role hierarchy - higher roles can access lower role functions
const ROLE_HIERARCHY: Record<string, number> = {
  [USER_ROLES.SUPER_ADMIN]: 100,
  [USER_ROLES.CORRESPONDENT]: 90,
  [USER_ROLES.PRINCIPAL]: 80,
  [USER_ROLES.VICE_PRINCIPAL]: 70,
  [USER_ROLES.WING_ADMIN]: 60,
  [USER_ROLES.TEACHER]: 40,
  [USER_ROLES.PARENT]: 10,
};

// Permission matrix - what each role can do
export const PERMISSIONS = {
  // School Management
  MANAGE_SCHOOL: [USER_ROLES.SUPER_ADMIN],
  VIEW_ALL_SCHOOLS: [USER_ROLES.SUPER_ADMIN],
  
  // Wing Management
  MANAGE_WINGS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL],
  VIEW_ALL_WINGS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL],
  
  // User Management
  MANAGE_USERS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL],
  VIEW_ALL_USERS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  
  // Timetable
  MANAGE_TIMETABLE: [USER_ROLES.SUPER_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  FREEZE_TIMETABLE: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL],
  VIEW_ALL_TIMETABLE: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_OWN_TIMETABLE: [USER_ROLES.TEACHER],
  
  // Substitutions
  GENERATE_SUBSTITUTIONS: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_ALL_SUBSTITUTIONS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_OWN_SUBSTITUTIONS: [USER_ROLES.TEACHER],
  
  // Leave Management
  APPROVE_LEAVE: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  REQUEST_LEAVE: [USER_ROLES.TEACHER],
  VIEW_ALL_LEAVES: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_OWN_LEAVES: [USER_ROLES.TEACHER],
  
  // Attendance
  VIEW_ALL_ATTENDANCE: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_CLASS_ATTENDANCE: [USER_ROLES.TEACHER],
  VIEW_CHILD_ATTENDANCE: [USER_ROLES.PARENT],
  MARK_ATTENDANCE: [USER_ROLES.TEACHER],
  OVERRIDE_ATTENDANCE: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL],
  
  // Alerts
  VIEW_ALL_ALERTS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_CLASSROOM_ALERTS: [USER_ROLES.TEACHER],
  RESOLVE_ALERTS: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_CHILD_ALERTS: [USER_ROLES.PARENT],
  
  // Camera & AI
  MANAGE_CAMERAS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.PRINCIPAL],
  VIEW_CAMERAS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL],
  CONFIGURE_AI: [USER_ROLES.SUPER_ADMIN, USER_ROLES.PRINCIPAL],
  
  // Configuration
  MANAGE_CONFIG: [USER_ROLES.SUPER_ADMIN, USER_ROLES.PRINCIPAL],
  VIEW_CONFIG: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  
  // Dashboard
  VIEW_PRINCIPAL_DASHBOARD: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL],
  VIEW_WING_DASHBOARD: [USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_TEACHER_DASHBOARD: [USER_ROLES.TEACHER],
  VIEW_PARENT_DASHBOARD: [USER_ROLES.PARENT],
  
  // Students
  MANAGE_STUDENTS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_ALL_STUDENTS: [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.WING_ADMIN],
  VIEW_CLASS_STUDENTS: [USER_ROLES.TEACHER],
  VIEW_CHILD_INFO: [USER_ROLES.PARENT],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        schoolId: number;
        wingId?: number | null;
        role: string;
        fullName: string;
      };
    }
  }
}

// Check if role has permission
export function hasPermission(role: string, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(role);
}

// Check if user can access resource based on hierarchy
export function canAccessRole(userRole: string, targetRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[targetRole] || 0);
}

// Middleware: Require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware: Require specific permission
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const hasAnyPermission = permissions.some(p => hasPermission(req.user!.role, p));
    if (!hasAnyPermission) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: permissions,
        userRole: req.user.role
      });
    }
    next();
  };
}

// Middleware: Require specific roles
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Role not authorized",
        required: roles,
        userRole: req.user.role
      });
    }
    next();
  };
}

// Middleware: Require minimum role level
export function requireMinRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!canAccessRole(req.user.role, minRole)) {
      return res.status(403).json({ 
        message: "Insufficient role level",
        required: minRole,
        userRole: req.user.role
      });
    }
    next();
  };
}

// Middleware: Wing-based access control
export function requireWingAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Super admin, correspondent, principal can access all wings
  const globalRoles = [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL];
  if (globalRoles.includes(req.user.role as any)) {
    return next();
  }
  
  // Wing admin and teachers can only access their wing
  const requestedWingId = Number(req.params.wingId || req.query.wingId || req.body?.wingId);
  if (requestedWingId && req.user.wingId && requestedWingId !== req.user.wingId) {
    return res.status(403).json({ message: "Cannot access other wings" });
  }
  
  next();
}

// Middleware: School-based access control (multi-tenancy)
export function requireSchoolAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Super admin can access all schools
  if (req.user.role === USER_ROLES.SUPER_ADMIN) {
    return next();
  }
  
  const requestedSchoolId = Number(req.params.schoolId || req.query.schoolId || req.body?.schoolId);
  if (requestedSchoolId && requestedSchoolId !== req.user.schoolId) {
    return res.status(403).json({ message: "Cannot access other schools" });
  }
  
  next();
}

// Helper: Get filtered data based on role
export function filterByRole<T extends { wingId?: number | null; schoolId?: number }>(
  data: T[],
  user: Express.Request["user"]
): T[] {
  if (!user) return [];
  
  // Global roles see everything in their school
  const globalRoles = [USER_ROLES.SUPER_ADMIN, USER_ROLES.CORRESPONDENT, USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL];
  if (globalRoles.includes(user.role as any)) {
    return data.filter(item => item.schoolId === user.schoolId);
  }
  
  // Wing-specific roles see only their wing
  if (user.wingId) {
    return data.filter(item => item.schoolId === user.schoolId && item.wingId === user.wingId);
  }
  
  return data.filter(item => item.schoolId === user.schoolId);
}

// Export role constants for use in routes
export { USER_ROLES, ROLE_HIERARCHY };
