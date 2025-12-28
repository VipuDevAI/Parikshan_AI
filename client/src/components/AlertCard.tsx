import { AlertTriangle, MapPin, CheckCircle, Clock } from "lucide-react";
import { type Alert } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface AlertCardProps {
  alert: Alert;
  compact?: boolean;
}

export function AlertCard({ alert, compact }: AlertCardProps) {
  const isCritical = alert.severity === "CRITICAL" || alert.severity === "HIGH";
  
  if (compact) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-lg border p-3 transition-all duration-300",
        isCritical 
          ? "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30" 
          : "bg-muted/50 border-border"
      )}>
        {isCritical && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
        )}
        
        <div className="flex items-start gap-3 pl-1">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isCritical ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-orange-100 text-orange-600 dark:bg-orange-900/30"
          )}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-foreground text-sm truncate">
                {alert.type.replace(/_/g, " ")}
              </h4>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0",
                isCritical 
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
              )}>
                {alert.severity}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {alert.message}
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {alert.createdAt && formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:shadow-md",
      isCritical 
        ? "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30" 
        : "bg-card border-border"
    )}>
      {isCritical && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
      )}
      
      <div className="flex gap-4">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
          isCritical ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
        )}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-foreground text-sm truncate pr-4">
                {alert.type.replace(/_/g, " ")}
              </h4>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {alert.createdAt && formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
              </p>
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase",
              isCritical 
                ? "bg-red-100 text-red-700 border border-red-200" 
                : "bg-orange-100 text-orange-700 border border-orange-200"
            )}>
              {alert.severity}
            </span>
          </div>
          
          <p className="mt-2 text-sm text-foreground/80 leading-relaxed">
            {alert.message}
          </p>
          
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-2">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {alert.location || "Unknown Location"}
            </span>
            <span className={cn(
              "flex items-center gap-1.5 ml-auto",
              alert.isResolved ? "text-green-600 font-medium" : "text-amber-600 font-medium"
            )}>
              {alert.isResolved ? (
                <><CheckCircle className="w-3.5 h-3.5" /> Resolved</>
              ) : (
                <><Clock className="w-3.5 h-3.5" /> Active</>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
