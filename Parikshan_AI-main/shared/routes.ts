import { z } from 'zod';
import { 
  insertUserSchema, 
  insertSchoolSchema, 
  insertWingSchema, 
  insertClassSchema, 
  insertSectionSchema,
  insertStudentSchema,
  insertTimetableSchema,
  insertAttendanceSchema,
  insertAlertSchema,
  insertLeaveRequestSchema,
  insertSubstitutionSchema,
  insertCameraSchema,
  insertNvrSchema,
  insertSchoolConfigSchema,
  insertEdgeAgentSchema,
  users,
  schools,
  wings,
  classes,
  sections,
  students,
  timetable,
  attendance,
  alerts,
  leaveRequests,
  substitutions,
  cameras,
  nvrs,
  schoolConfig,
  edgeAgents
} from './schema';

// Shared error schemas
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  // --- AUTH ---
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        schoolCode: z.string(),
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.object({
          user: z.custom<typeof users.$inferSelect>(),
          school: z.custom<typeof schools.$inferSelect>(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    user: {
        method: 'GET' as const,
        path: '/api/user',
        responses: {
            200: z.custom<typeof users.$inferSelect>(),
            401: errorSchemas.unauthorized
        }
    }
  },

  // --- SCHOOL & CONFIG ---
  schools: {
    get: {
      method: 'GET' as const,
      path: '/api/schools/:id',
      responses: {
        200: z.custom<typeof schools.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: { // Super Admin only
      method: 'POST' as const,
      path: '/api/schools',
      input: insertSchoolSchema,
      responses: {
        201: z.custom<typeof schools.$inferSelect>(),
      },
    },
  },

  // --- WINGS ---
  wings: {
    list: {
        method: 'GET' as const,
        path: '/api/schools/:schoolId/wings',
        responses: {
            200: z.array(z.custom<typeof wings.$inferSelect>()),
        }
    },
    create: {
        method: 'POST' as const,
        path: '/api/schools/:schoolId/wings',
        input: insertWingSchema.omit({ schoolId: true }),
        responses: {
            201: z.custom<typeof wings.$inferSelect>(),
        }
    }
  },

  // --- USERS ---
  users: {
      list: {
          method: 'GET' as const,
          path: '/api/schools/:schoolId/users',
          input: z.object({
              role: z.string().optional()
          }).optional(),
          responses: {
              200: z.array(z.custom<typeof users.$inferSelect>())
          }
      },
      create: {
          method: 'POST' as const,
          path: '/api/schools/:schoolId/users',
          input: insertUserSchema.omit({ schoolId: true }),
          responses: {
              201: z.custom<typeof users.$inferSelect>(),
              400: errorSchemas.validation
          }
      }
  },

  // --- ACADEMIC ---
  academic: {
      listClasses: {
          method: 'GET' as const,
          path: '/api/schools/:schoolId/classes',
          responses: {
              200: z.array(z.custom<typeof classes.$inferSelect & { sections: typeof sections.$inferSelect[] }>())
          }
      },
      // Simplified for lite build - grouping endpoints
  },

  // --- TIMETABLE ---
  timetable: {
      get: {
          method: 'GET' as const,
          path: '/api/timetable',
          input: z.object({
              sectionId: z.string().optional(),
              teacherId: z.string().optional()
          }),
          responses: {
              200: z.array(z.custom<typeof timetable.$inferSelect>())
          }
      },
      create: {
          method: 'POST' as const,
          path: '/api/timetable',
          input: insertTimetableSchema,
          responses: {
              201: z.custom<typeof timetable.$inferSelect>()
          }
      }
  },

  // --- ALERTS (AI) ---
  alerts: {
      list: {
          method: 'GET' as const,
          path: '/api/alerts',
          input: z.object({
              severity: z.string().optional(),
              resolved: z.string().optional() // 'true' | 'false'
          }).optional(),
          responses: {
              200: z.array(z.custom<typeof alerts.$inferSelect>())
          }
      },
      create: { // From AI service
          method: 'POST' as const,
          path: '/api/alerts',
          input: insertAlertSchema,
          responses: {
              201: z.custom<typeof alerts.$inferSelect>()
          }
      }
  },
  
  // --- STATS ---
  stats: {
      dashboard: {
          method: 'GET' as const,
          path: '/api/stats/dashboard',
          responses: {
              200: z.object({
                  totalStudents: z.number(),
                  totalTeachers: z.number(),
                  presentToday: z.number(),
                  alertsToday: z.number()
              })
          }
      }
  },

  // --- LEAVE REQUESTS ---
  leave: {
      list: {
          method: 'GET' as const,
          path: '/api/leave-requests',
          responses: {
              200: z.array(z.custom<typeof leaveRequests.$inferSelect>())
          }
      },
      create: {
          method: 'POST' as const,
          path: '/api/leave-requests',
          input: insertLeaveRequestSchema,
          responses: {
              201: z.custom<typeof leaveRequests.$inferSelect>()
          }
      },
      approve: {
          method: 'PATCH' as const,
          path: '/api/leave-requests/:id/approve',
          responses: {
              200: z.custom<typeof leaveRequests.$inferSelect>()
          }
      },
      reject: {
          method: 'PATCH' as const,
          path: '/api/leave-requests/:id/reject',
          responses: {
              200: z.custom<typeof leaveRequests.$inferSelect>()
          }
      }
  },

  // --- SUBSTITUTIONS ---
  substitutions: {
      list: {
          method: 'GET' as const,
          path: '/api/substitutions',
          input: z.object({
              date: z.string().optional(),
              teacherId: z.string().optional()
          }).optional(),
          responses: {
              200: z.array(z.custom<typeof substitutions.$inferSelect>())
          }
      },
      generate: {
          method: 'POST' as const,
          path: '/api/substitutions/generate',
          input: z.object({
              date: z.string(),
              leaveRequestId: z.number().optional()
          }),
          responses: {
              200: z.object({
                  generated: z.number(),
                  substitutions: z.array(z.custom<typeof substitutions.$inferSelect>())
              })
          }
      }
  },

  // --- CAMERAS ---
  cameras: {
      list: {
          method: 'GET' as const,
          path: '/api/cameras',
          responses: {
              200: z.array(z.custom<typeof cameras.$inferSelect>())
          }
      },
      create: {
          method: 'POST' as const,
          path: '/api/cameras',
          input: insertCameraSchema,
          responses: {
              201: z.custom<typeof cameras.$inferSelect>()
          }
      }
  },

  // --- NVRs ---
  nvrs: {
      list: {
          method: 'GET' as const,
          path: '/api/nvrs',
          responses: {
              200: z.array(z.custom<typeof nvrs.$inferSelect>())
          }
      },
      create: {
          method: 'POST' as const,
          path: '/api/nvrs',
          input: insertNvrSchema,
          responses: {
              201: z.custom<typeof nvrs.$inferSelect>()
          }
      }
  },

  // --- SCHOOL CONFIG ---
  config: {
      get: {
          method: 'GET' as const,
          path: '/api/config',
          responses: {
              200: z.custom<typeof schoolConfig.$inferSelect>()
          }
      },
      update: {
          method: 'PATCH' as const,
          path: '/api/config',
          input: insertSchoolConfigSchema.partial(),
          responses: {
              200: z.custom<typeof schoolConfig.$inferSelect>()
          }
      }
  },

  // --- FACE REGISTRATION ---
  face: {
      register: {
          method: 'POST' as const,
          path: '/api/face/register',
          input: z.object({
              entityType: z.enum(['TEACHER', 'STUDENT']),
              entityId: z.number(),
              imageData: z.string(), // Base64 encoded image
              schoolId: z.number()
          }),
          responses: {
              200: z.object({
                  success: z.boolean(),
                  message: z.string(),
                  faceId: z.string().optional()
              }),
              400: errorSchemas.validation,
              404: errorSchemas.notFound
          }
      },
      verify: {
          method: 'POST' as const,
          path: '/api/face/verify',
          input: z.object({
              imageData: z.string(), // Base64 encoded image
              schoolId: z.number()
          }),
          responses: {
              200: z.object({
                  matches: z.array(z.object({
                      entityType: z.enum(['TEACHER', 'STUDENT']),
                      entityId: z.number(),
                      confidence: z.number(),
                      fullName: z.string()
                  }))
              })
          }
      },
      status: {
          method: 'GET' as const,
          path: '/api/face/status/:entityType/:entityId',
          responses: {
              200: z.object({
                  registered: z.boolean(),
                  lastUpdated: z.string().optional()
              })
          }
      }
  },

  // --- EDGE AGENT APIs ---
  edge: {
      // Agent login - returns auth token
      login: {
          method: 'POST' as const,
          path: '/api/edge/login',
          input: z.object({
              agentId: z.string(),
              secret: z.string(), // Shared secret for initial auth
              schoolCode: z.string()
          }),
          responses: {
              200: z.object({
                  token: z.string(),
                  expiresAt: z.string(),
                  schoolId: z.number(),
                  agentConfig: z.any()
              }),
              401: errorSchemas.unauthorized
          }
      },
      // Get full configuration (cameras, NVRs, face encodings)
      config: {
          method: 'GET' as const,
          path: '/api/edge/config',
          responses: {
              200: z.object({
                  cameras: z.array(z.any()),
                  nvrs: z.array(z.any()),
                  faceEncodings: z.array(z.any()),
                  schoolConfig: z.any(),
                  lastUpdated: z.string()
              }),
              401: errorSchemas.unauthorized
          }
      },
      // Heartbeat - agent reports status
      heartbeat: {
          method: 'POST' as const,
          path: '/api/edge/heartbeat',
          input: z.object({
              agentId: z.string(),
              status: z.enum(['ONLINE', 'OFFLINE', 'DEGRADED', 'UPDATING', 'ERROR']),
              activeCameras: z.number().optional(),
              eventsProcessed: z.number().optional(),
              eventsQueuedOffline: z.number().optional(),
              cpuUsage: z.number().optional(),
              memoryUsage: z.number().optional(),
              version: z.string().optional(),
              hostname: z.string().optional(),
              ipAddress: z.string().optional()
          }),
          responses: {
              200: z.object({
                  acknowledged: z.boolean(),
                  configVersion: z.string().optional(),
                  commands: z.array(z.any()).optional()
              }),
              401: errorSchemas.unauthorized
          }
      },
      // Submit events (attendance, alerts, etc.)
      events: {
          method: 'POST' as const,
          path: '/api/edge/events',
          input: z.object({
              agentId: z.string(),
              events: z.array(z.object({
                  type: z.enum(['ATTENDANCE', 'ALERT', 'PRESENCE', 'DISCIPLINE']),
                  cameraId: z.number(),
                  timestamp: z.string(),
                  data: z.any()
              }))
          }),
          responses: {
              200: z.object({
                  processed: z.number(),
                  failed: z.number(),
                  errors: z.array(z.string()).optional()
              }),
              401: errorSchemas.unauthorized
          }
      },
      // List edge agents (admin)
      list: {
          method: 'GET' as const,
          path: '/api/edge/agents',
          responses: {
              200: z.array(z.custom<typeof edgeAgents.$inferSelect>())
          }
      },
      // Register new edge agent
      register: {
          method: 'POST' as const,
          path: '/api/edge/agents',
          input: insertEdgeAgentSchema.pick({
              name: true,
              description: true,
              maxCameras: true
          }),
          responses: {
              201: z.object({
                  agent: z.custom<typeof edgeAgents.$inferSelect>(),
                  secret: z.string() // One-time secret for agent setup
              })
          }
      },
      // Get specific agent status
      status: {
          method: 'GET' as const,
          path: '/api/edge/agents/:agentId',
          responses: {
              200: z.custom<typeof edgeAgents.$inferSelect>(),
              404: errorSchemas.notFound
          }
      },
      // Delete/deactivate agent
      delete: {
          method: 'DELETE' as const,
          path: '/api/edge/agents/:agentId',
          responses: {
              200: z.object({ message: z.string() }),
              404: errorSchemas.notFound
          }
      }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// Export User type for frontend
export type User = typeof users.$inferSelect;
