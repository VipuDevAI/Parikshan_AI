import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTimetable } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Calendar, Clock, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Section } from "@shared/schema";

interface TimetableEntry {
  id: number;
  schoolId: number;
  sectionId: number;
  teacherId: number | null;
  dayOfWeek: number;
  periodIndex: number;
  subjectId: number | null;
  roomId: string | null;
  subjectName?: string;
  teacherName?: string;
  roomNumber?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const PERIOD_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", accent: "text-blue-600 dark:text-blue-500" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", accent: "text-emerald-600 dark:text-emerald-500" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-400", accent: "text-purple-600 dark:text-purple-500" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", accent: "text-amber-600 dark:text-amber-500" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-400", accent: "text-pink-600 dark:text-pink-500" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-400", accent: "text-cyan-600 dark:text-cyan-500" },
];

export default function TimetablePage() {
  const { user } = useAuth();
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
    enabled: !!user,
  });

  const { data: rawTimetable, isLoading: timetableLoading } = useTimetable(selectedSectionId);
  const timetable = rawTimetable as TimetableEntry[] | undefined;

  const selectedSection = sections.find(s => s.id.toString() === selectedSectionId);

  const getEntry = (dayIndex: number, periodIndex: number): TimetableEntry | undefined => {
    return timetable?.find((t: TimetableEntry) => t.dayOfWeek === dayIndex && t.periodIndex === periodIndex);
  };

  const getColorForSubject = (subjectName: string) => {
    const hash = subjectName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return PERIOD_COLORS[hash % PERIOD_COLORS.length];
  };

  const isLoading = sectionsLoading;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Class Timetable</h1>
          <p className="text-muted-foreground mt-1">
            {selectedSection ? `Weekly schedule for ${selectedSection.name}` : "Select a section to view timetable"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
            <SelectTrigger className="w-56" data-testid="select-timetable-section">
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !selectedSectionId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Calendar className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a Section</p>
            <p className="text-sm mt-1">Choose a class section from the dropdown to view the timetable</p>
          </CardContent>
        </Card>
      ) : timetableLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="p-4 text-left font-semibold text-muted-foreground w-24 sticky left-0 bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Day
                    </div>
                  </th>
                  {PERIODS.map(p => (
                    <th key={p} className="p-4 text-center font-semibold text-muted-foreground border-l border-border/50 min-w-[120px]">
                      Period {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {DAYS.map((day, dayIndex) => (
                  <tr key={day} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4 font-bold text-foreground bg-muted/10 sticky left-0">{day}</td>
                    {PERIODS.map(period => {
                      const entry = getEntry(dayIndex + 1, period);
                      const colors = entry?.subjectName ? getColorForSubject(entry.subjectName) : null;
                      
                      return (
                        <td key={period} className="p-2 border-l border-border/50 h-24 align-top">
                          {entry ? (
                            <div 
                              className={`h-full ${colors?.bg} border ${colors?.border} rounded-lg p-2.5 text-xs flex flex-col gap-1 hover:shadow-sm transition-all cursor-pointer`}
                              data-testid={`cell-timetable-${dayIndex + 1}-${period}`}
                            >
                              <div className="flex items-center gap-1">
                                <BookOpen className={`w-3 h-3 ${colors?.text}`} />
                                <span className={`font-bold ${colors?.text} text-sm truncate`}>
                                  {entry.subjectName || "Subject"}
                                </span>
                              </div>
                              <span className={`${colors?.accent} truncate`}>
                                {entry.teacherName || "Teacher"}
                              </span>
                              {entry.roomNumber && (
                                <span className={`${colors?.accent} opacity-70 mt-auto text-[10px]`}>
                                  Room {entry.roomNumber}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="h-full rounded-lg border border-dashed border-border/50 flex items-center justify-center text-muted-foreground/40 text-xs">
                              Free
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {selectedSectionId && timetable && timetable.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Periods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-periods">{timetable.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-subjects-count">
                {new Set(timetable.map(t => t.subjectId)).size}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Teachers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-teachers-count">
                {new Set(timetable.map(t => t.teacherId)).size}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Days Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-days-count">
                {new Set(timetable.map(t => t.dayOfWeek)).size}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
