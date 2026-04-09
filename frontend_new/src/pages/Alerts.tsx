import { useAlerts } from "@/hooks/use-data";
import { AlertCard } from "@/components/AlertCard";
import { Loader2, Filter } from "lucide-react";
import { useState } from "react";

export default function AlertsPage() {
  const { data: alerts, isLoading } = useAlerts();
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH">("ALL");

  const filteredAlerts = alerts?.filter(a => {
    if (filter === "ALL") return true;
    return a.severity === filter;
  });

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">AI Insights Feed</h1>
          <p className="text-muted-foreground mt-1">Real-time alerts detected by surveillance cameras.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select 
            className="glass-card rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Priority</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAlerts?.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
          {filteredAlerts?.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              No alerts found matching your filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
