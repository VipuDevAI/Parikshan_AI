import { useState } from "react";
import { useTimetable } from "@/hooks/use-data";
import { Loader2, Calendar } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TimetablePage() {
  const [selectedSectionId, setSelectedSectionId] = useState("1"); // Mock section ID
  const { data: timetable, isLoading } = useTimetable(selectedSectionId);

  // Helper to find entry for a cell
  const getEntry = (dayIndex: number, periodIndex: number) => {
    return timetable?.find(t => t.dayOfWeek === dayIndex && t.periodIndex === periodIndex);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Class Timetable</h1>
          <p className="text-muted-foreground mt-1">Weekly schedule for Class 10-A</p>
        </div>
        <div className="flex gap-2">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all">
                Edit Schedule
            </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-4 text-left font-semibold text-muted-foreground w-20">Day</th>
                {PERIODS.map(p => (
                  <th key={p} className="p-4 text-center font-semibold text-muted-foreground border-l border-border/50">
                    Period {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {DAYS.map((day, dayIndex) => (
                <tr key={day} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold text-foreground bg-muted/10">{day}</td>
                  {PERIODS.map(period => {
                    const entry = getEntry(dayIndex + 1, period);
                    return (
                      <td key={period} className="p-2 border-l border-border/50 h-24 align-top">
                        {entry ? (
                          <div className="h-full bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs flex flex-col gap-1 hover:shadow-sm transition-all cursor-pointer">
                            <span className="font-bold text-blue-700 text-sm">Maths</span>
                            <span className="text-blue-600">Mr. Sharma</span>
                            <span className="text-blue-400 mt-auto">Room 101</span>
                          </div>
                        ) : (
                          <div className="h-full rounded-lg border border-dashed border-border/50 flex items-center justify-center text-muted-foreground/30 text-xs">
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
        </div>
      )}
    </div>
  );
}
