import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";

// Create sessions table if not exists
async function ensureSessionTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        user_id INTEGER NOT NULL,
        school_id INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Clean expired sessions
    await db.execute(sql`DELETE FROM sessions WHERE expires_at < NOW()`);
  } catch (error) {
    console.error("Error creating sessions table:", error);
  }
}

// Initialize table on module load
ensureSessionTable();

// Create session token and store in DB
export async function createSession(userId: number, schoolId: number): Promise<string> {
  const token = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  try {
    await db.execute(sql`
      INSERT INTO sessions (token, user_id, school_id, expires_at)
      VALUES (${token}, ${userId}, ${schoolId}, ${expiresAt})
      ON CONFLICT (token) DO UPDATE SET expires_at = ${expiresAt}
    `);
  } catch (error) {
    console.error("Error creating session:", error);
  }
  
  return token;
}

// Clear session from DB
export async function clearSession(token: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM sessions WHERE token = ${token}`);
  } catch (error) {
    console.error("Error clearing session:", error);
  }
}

// Get session from DB
async function getSession(token: string): Promise<{ userId: number; schoolId: number; expiresAt: Date } | null> {
  try {
    const result = await db.execute(sql`
      SELECT user_id, school_id, expires_at FROM sessions WHERE token = ${token}
    `);
    
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      return {
        userId: row.user_id,
        schoolId: row.school_id,
        expiresAt: new Date(row.expires_at)
      };
    }
  } catch (error) {
    console.error("Error getting session:", error);
  }
  return null;
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
    
    if (token) {
      const session = await getSession(token);
      
      if (session) {
        // Check expiry
        if (session.expiresAt < new Date()) {
          await clearSession(token);
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
