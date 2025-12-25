import { Loader2, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Using mock data for UI visualization since database might be empty initially
const MOCK_STUDENTS = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  fullName: `Student ${i + 1}`,
  rollNumber: `10${i + 100}`,
  status: ["PRESENT", "ABSENT", "LATE"][Math.floor(Math.random() * 3)],
}));

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendance Log</h1>
          <p className="text-muted-foreground mt-1">View and manage daily attendance records.</p>
        </div>
        <input 
          type="date" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 rounded-xl border border-border bg-card outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                    placeholder="Search by name or roll number..." 
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/40 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                />
            </div>
            <div className="flex gap-2 ml-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Present: 12
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Absent: 2
                </div>
            </div>
        </div>

        <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
                <tr>
                    <th className="p-4 text-left font-medium text-muted-foreground w-20">Roll No</th>
                    <th className="p-4 text-left font-medium text-muted-foreground">Student Name</th>
                    <th className="p-4 text-left font-medium text-muted-foreground">Check In</th>
                    <th className="p-4 text-center font-medium text-muted-foreground w-32">Status</th>
                    <th className="p-4 text-right font-medium text-muted-foreground w-32">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
                {MOCK_STUDENTS.map((student) => (
                    <tr key={student.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="p-4 font-mono text-muted-foreground">{student.rollNumber}</td>
                        <td className="p-4 font-medium">{student.fullName}</td>
                        <td className="p-4 text-muted-foreground">
                            {student.status === "ABSENT" ? "--:--" : "08:45 AM"}
                        </td>
                        <td className="p-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                student.status === "PRESENT" ? "bg-green-100 text-green-700 border-green-200" :
                                student.status === "ABSENT" ? "bg-red-100 text-red-700 border-red-200" :
                                "bg-amber-100 text-amber-700 border-amber-200"
                            }`}>
                                {student.status === "PRESENT" && <CheckCircle className="w-3 h-3" />}
                                {student.status === "ABSENT" && <XCircle className="w-3 h-3" />}
                                {student.status === "LATE" && <Clock className="w-3 h-3" />}
                                {student.status}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <button className="text-primary hover:underline text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Edit
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
