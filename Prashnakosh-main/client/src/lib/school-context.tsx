import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";

interface School {
  id: string;
  name: string;
  code: string;
  active?: boolean;
}

interface SchoolContextType {
  selectedSchool: School | null;
  setSelectedSchool: (school: School | null) => void;
  schools: School[];
  isLoading: boolean;
  isSuperAdmin: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [selectedSchool, setSelectedSchoolState] = useState<School | null>(null);

  // Fetch schools for Super Admin
  const { data: schools = [], isLoading } = useQuery<School[]>({
    queryKey: ["/api/admin/schools"],
    queryFn: async () => {
      const res = await fetch("/api/admin/schools", {
        headers: { Authorization: `Bearer ${localStorage.getItem("safal_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  // Restore selection from localStorage
  useEffect(() => {
    if (isSuperAdmin && schools.length > 0 && !selectedSchool) {
      const savedSchoolId = localStorage.getItem("superadmin_selected_school");
      if (savedSchoolId) {
        const savedSchool = schools.find(s => s.id === savedSchoolId);
        if (savedSchool) {
          setSelectedSchoolState(savedSchool);
        }
      }
    }
  }, [isSuperAdmin, schools, selectedSchool]);

  const setSelectedSchool = (school: School | null) => {
    setSelectedSchoolState(school);
    if (school) {
      localStorage.setItem("superadmin_selected_school", school.id);
    } else {
      localStorage.removeItem("superadmin_selected_school");
    }
  };

  return (
    <SchoolContext.Provider value={{ 
      selectedSchool, 
      setSelectedSchool, 
      schools, 
      isLoading,
      isSuperAdmin 
    }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchoolContext() {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error("useSchoolContext must be used within a SchoolProvider");
  }
  return context;
}
