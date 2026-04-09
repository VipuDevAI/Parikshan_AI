import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertAlert } from "@shared/schema";

// --- ALERTS ---
export function useAlerts() {
  return useQuery({
    queryKey: [api.alerts.list.path],
    queryFn: async () => {
      const res = await fetch(api.alerts.list.path);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return api.alerts.list.responses[200].parse(await res.json());
    },
    // No auto-refresh - user can manually refresh or use real-time websockets later
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAlert) => {
      const res = await fetch(api.alerts.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create alert");
      return api.alerts.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.alerts.list.path] });
    },
  });
}

// --- STATS ---
export function useDashboardStats() {
  return useQuery({
    queryKey: [api.stats.dashboard.path],
    queryFn: async () => {
      const res = await fetch(api.stats.dashboard.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.dashboard.responses[200].parse(await res.json());
    },
  });
}

// --- TIMETABLE ---
export function useTimetable(sectionId?: string, teacherId?: string) {
  const url = `${api.timetable.get.path}?${new URLSearchParams({ 
    ...(sectionId ? { sectionId } : {}),
    ...(teacherId ? { teacherId } : {})
  }).toString()}`;

  return useQuery({
    queryKey: [api.timetable.get.path, sectionId, teacherId],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timetable");
      // Return raw JSON as API now returns enriched data with joined fields
      return res.json();
    },
    enabled: !!sectionId || !!teacherId,
  });
}

// --- USERS ---
export function useUsers(schoolId: number, role?: string) {
  const url = buildUrl(api.users.list.path, { schoolId });
  const finalUrl = role ? `${url}?role=${role}` : url;

  return useQuery({
    queryKey: [api.users.list.path, schoolId, role],
    queryFn: async () => {
      const res = await fetch(finalUrl);
      if (!res.ok) throw new Error("Failed to fetch users");
      return api.users.list.responses[200].parse(await res.json());
    },
    enabled: !!schoolId,
  });
}

// --- LEAVE REQUESTS ---
export function useLeaveRequests(date?: Date) {
  const params = date ? `?date=${date.toISOString().split('T')[0]}` : '';
  const url = `${api.leave.list.path}${params}`;
  
  return useQuery({
    queryKey: [api.leave.list.path, date?.toISOString()],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch leave requests");
      return res.json();
    },
  });
}

// --- SUBSTITUTIONS ---
export function useSubstitutions(date?: Date, teacherId?: number) {
  const params = new URLSearchParams();
  if (date) params.set('date', date.toISOString().split('T')[0]);
  if (teacherId) params.set('teacherId', String(teacherId));
  const url = `${api.substitutions.list.path}?${params.toString()}`;
  
  return useQuery({
    queryKey: [api.substitutions.list.path, date?.toISOString(), teacherId],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch substitutions");
      return res.json();
    },
  });
}

// --- ATTENDANCE TREND ---
export function useAttendanceTrend() {
  return useQuery({
    queryKey: ['/api/attendance/trend'],
    queryFn: async () => {
      const res = await fetch('/api/attendance/trend');
      if (!res.ok) throw new Error("Failed to fetch attendance trend");
      return res.json();
    },
  });
}

// --- ACADEMIC ---
export function useClasses(schoolId: number) {
  const url = buildUrl(api.academic.listClasses.path, { schoolId });
  return useQuery({
    queryKey: [api.academic.listClasses.path, schoolId],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch classes");
      return api.academic.listClasses.responses[200].parse(await res.json());
    },
    enabled: !!schoolId,
  });
}
