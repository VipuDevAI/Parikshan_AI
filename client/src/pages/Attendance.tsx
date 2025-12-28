import { Loader2, Search, CheckCircle, XCircle, Clock, Calendar, Users } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { Section, Student } from "@shared/schema";

interface AttendanceRecord {
  id: number;
  studentId: number;
  status: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
    enabled: !!user,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    enabled: !!user,
  });

  const { data: attendanceSummary, isLoading: attendanceLoading, error: attendanceError } = useQuery<{
    present: number;
    absent: number;
    late: number;
    records: AttendanceRecord[];
  }>({
    queryKey: ["/api/attendance/section-summary", selectedSectionId, date],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/section-summary?sectionId=${selectedSectionId}&date=${date}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Failed to load attendance (${res.status})`);
      }
      return res.json();
    },
    enabled: !!selectedSectionId && !!date,
  });

  const filteredStudents = students.filter(s => {
    const matchesSection = !selectedSectionId || s.sectionId === parseInt(selectedSectionId);
    const matchesSearch = !searchQuery || 
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSection && matchesSearch;
  });

  const getStudentAttendance = (studentId: number) => {
    if (!attendanceSummary?.records) return null;
    return attendanceSummary.records.find(r => r.studentId === studentId);
  };

  const presentCount = attendanceSummary?.present || 0;
  const absentCount = attendanceSummary?.absent || 0;
  const lateCount = attendanceSummary?.late || 0;

  const isLoading = sectionsLoading || studentsLoading;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendance Log</h1>
          <p className="text-muted-foreground mt-1">View and manage daily attendance records.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-10 w-44"
              data-testid="input-attendance-date"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Present</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-present-count">{presentCount}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Absent</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400" data-testid="text-absent-count">{absentCount}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Late</CardTitle>
            <Clock className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400" data-testid="text-late-count">{lateCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or admission number..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-student"
              />
            </div>
            <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
              <SelectTrigger className="w-48" data-testid="select-section">
                <SelectValue placeholder="Select Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id.toString()}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !selectedSectionId ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a section to view attendance</p>
              <p className="text-sm">Choose a class section from the dropdown above</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm">Try adjusting your search or section filter</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="p-4 text-left font-medium text-muted-foreground w-32">Admission No</th>
                  <th className="p-4 text-left font-medium text-muted-foreground">Student Name</th>
                  <th className="p-4 text-left font-medium text-muted-foreground">Check In</th>
                  <th className="p-4 text-left font-medium text-muted-foreground">Check Out</th>
                  <th className="p-4 text-center font-medium text-muted-foreground w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredStudents.map((student) => {
                  const attendance = getStudentAttendance(student.id);
                  const status = attendance?.status || "NOT_MARKED";
                  
                  return (
                    <tr key={student.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-student-${student.id}`}>
                      <td className="p-4 font-mono text-muted-foreground">{student.admissionNumber || "-"}</td>
                      <td className="p-4 font-medium">{student.fullName}</td>
                      <td className="p-4 text-muted-foreground">
                        {attendance?.checkInTime 
                          ? new Date(attendance.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                          : "--:--"
                        }
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {attendance?.checkOutTime 
                          ? new Date(attendance.checkOutTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                          : "--:--"
                        }
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          status === "PRESENT" ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800" :
                          status === "ABSENT" ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" :
                          status === "LATE" ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" :
                          "bg-muted text-muted-foreground border-border"
                        }`}>
                          {status === "PRESENT" && <CheckCircle className="w-3 h-3" />}
                          {status === "ABSENT" && <XCircle className="w-3 h-3" />}
                          {status === "LATE" && <Clock className="w-3 h-3" />}
                          {status === "NOT_MARKED" ? "Not Marked" : status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
