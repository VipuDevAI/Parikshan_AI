import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Simple in-memory session store (for production, use Redis or DB sessions)
const sessions = new Map<string, { userId: number; schoolId: number; expiresAt: number }>();

// Create session token
export function createSession(userId: number, schoolId: number): string {
  const token = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  sessions.set(token, { userId, schoolId, expiresAt });
  return token;
}

// Clear session
export function clearSession(token: string): void {
  sessions.delete(token);
}

// Session middleware - populates req.user from session/header
export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Check cookie first, then Authorization header
    let token: string | undefined;
    
    // Check for session cookie
    if (req.cookies?.session_token) {
      token = req.cookies.session_token;
    }
    // Check Authorization header
    else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    } 
    // Check custom header
    else if (req.headers["x-session-token"]) {
      token = req.headers["x-session-token"] as string;
    }
    
    if (token && sessions.has(token)) {
      const session = sessions.get(token)!;
      
      // Check expiry
      if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        return next();
      }
      
      // Load user
      const user = await storage.getUser(session.userId);
      if (user && user.isActive) {
        req.user = {
          id: user.id,
          schoolId: user.schoolId,
          wingId: user.wingId,
          role: user.role,
          fullName: user.fullName
        };
      }
    }
    
    // Also check for user in request body (for dev/testing)
    if (!req.user && req.body?.userId) {
      const user = await storage.getUser(Number(req.body.userId));
      if (user && user.isActive) {
        req.user = {
          id: user.id,
          schoolId: user.schoolId,
          wingId: user.wingId,
          role: user.role,
          fullName: user.fullName
        };
      }
    }
  } catch (error) {
    console.error("Session middleware error:", error);
  }
  
  next();
}

export { sessions };
