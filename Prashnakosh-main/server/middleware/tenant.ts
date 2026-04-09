import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { AuthUser } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
    }
  }
}

export interface TenantRequest extends Request {
  user: AuthUser;
  tenantId: string;
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const tenantId = req.user.tenantId;

  if (req.user.role === "super_admin") {
    next();
    return;
  }

  if (!tenantId) {
    return res.status(403).json({ error: "Tenant context required" });
  }

  req.tenantId = tenantId;
  next();
}

export function getTenantId(req: Request): string | null {
  // Strict tenant isolation: tenantId ONLY from authenticated user context
  return req.tenantId || req.user?.tenantId || null;
}

export function requireTenantId(req: Request, res: Response): string | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    // Super_admin can operate without tenantId for read operations
    if (req.user?.role === "super_admin") {
      return null;
    }
    res.status(403).json({ error: "Tenant ID required for this operation" });
    return null;
  }
  return tenantId;
}

export function requireTenantIdStrict(req: Request, res: Response): string | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(403).json({ error: "Tenant ID required for this operation" });
    return null;
  }
  return tenantId;
}

export function isSuperAdmin(req: Request): boolean {
  return req.user?.role === "super_admin";
}
