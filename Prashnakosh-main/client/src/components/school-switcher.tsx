import { useSchoolContext } from "@/lib/school-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";

interface SchoolSwitcherProps {
  className?: string;
  showCard?: boolean;
}

export function SchoolSwitcher({ className, showCard = false }: SchoolSwitcherProps) {
  const { selectedSchool, setSelectedSchool, schools, isLoading, isSuperAdmin } = useSchoolContext();

  if (!isSuperAdmin) {
    return null;
  }

  const selector = (
    <div className={className}>
      <Select
        value={selectedSchool?.id || ""}
        onValueChange={(value) => {
          const school = schools.find(s => s.id === value);
          setSelectedSchool(school || null);
        }}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full" data-testid="select-school-switcher">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SelectValue placeholder="Select a school to manage" />
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {schools.map((school) => (
            <SelectItem key={school.id} value={school.id} data-testid={`select-school-${school.code}`}>
              <div className="flex flex-col">
                <span className="font-medium">{school.name}</span>
                <span className="text-xs text-muted-foreground">{school.code}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (showCard) {
    return (
      <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            Select School
          </CardTitle>
          <CardDescription>
            Choose a school to view and configure its settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selector}
        </CardContent>
      </Card>
    );
  }

  return selector;
}

export function RequireSchoolSelection({ children }: { children: React.ReactNode }) {
  const { selectedSchool, isSuperAdmin, isLoading } = useSchoolContext();

  if (!isSuperAdmin) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedSchool) {
    return (
      <div className="p-6">
        <SchoolSwitcher showCard />
        <div className="text-center text-muted-foreground py-8">
          Please select a school above to manage its configuration.
        </div>
      </div>
    );
  }

  return (
    <div>
      <SchoolSwitcher showCard className="mb-4" />
      {children}
    </div>
  );
}
