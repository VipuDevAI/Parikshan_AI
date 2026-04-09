import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CalendarOff, Check, X, Clock, FileText, Plus, Building, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { LeaveRequest, Wing, User, SchoolConfig } from "@shared/schema";

const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
};

const leaveTypeLabels: Record<string, string> = {
    FULL_DAY: "Full Day",
    HALF_DAY_MORNING: "Half Day (Morning)",
    HALF_DAY_AFTERNOON: "Half Day (Afternoon)",
    ON_DUTY: "On-Duty",
    PERMISSION: "Permission (up to 1 hour)"
};

export default function LeavePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedWing, setSelectedWing] = useState<string>("all");
    
    const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
        queryKey: ['/api/leave-requests'],
    });
    
    const { data: wings } = useQuery<Wing[]>({
        queryKey: ['/api/schools/1/wings'],
    });
    
    const { data: users } = useQuery<User[]>({
        queryKey: ['/api/schools/1/users'],
    });
    
    const { data: config } = useQuery<SchoolConfig>({
        queryKey: ['/api/config'],
    });
    
    const approveMutation = useMutation({
        mutationFn: async (id: number) => {
            return apiRequest('PATCH', `/api/leave-requests/${id}/approve`, { approvedBy: user?.id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
            toast({ title: "Leave Approved", description: "The leave request has been approved and substitutions will be arranged." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to approve leave", variant: "destructive" });
        }
    });
    
    const rejectMutation = useMutation({
        mutationFn: async (id: number) => {
            return apiRequest('PATCH', `/api/leave-requests/${id}/reject`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
            toast({ title: "Leave Rejected", description: "The leave request has been rejected." });
        }
    });
    
    const canApprove = ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "WING_ADMIN"].includes(user?.role || "");
    const isTeacher = user?.role === "TEACHER";
    
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-leave" />
            </div>
        );
    }
    
    // Get teacher info with wing
    const getTeacherInfo = (teacherId: number) => {
        const teacher = users?.find(u => u.id === teacherId);
        const wing = wings?.find(w => w.id === teacher?.wingId);
        return { teacher, wing };
    };
    
    // Sort by createdAt (oldest first for first-come-first-serve)
    const sortedRequests = [...(requests || [])].sort((a, b) => 
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    
    // Filter by wing if selected
    const filteredRequests = selectedWing === "all" 
        ? sortedRequests 
        : sortedRequests.filter(r => {
            const { wing } = getTeacherInfo(r.teacherId);
            return wing?.id === Number(selectedWing);
        });
    
    const pendingRequests = filteredRequests.filter(r => r.status === "PENDING");
    const processedRequests = filteredRequests.filter(r => r.status !== "PENDING");
    
    // Count approved leaves per wing for today
    const getWingLeaveCount = (wingId: number | undefined, date: Date) => {
        if (!wingId) return 0;
        const dateStr = format(date, 'yyyy-MM-dd');
        return sortedRequests.filter(r => {
            const { wing } = getTeacherInfo(r.teacherId);
            return wing?.id === wingId && 
                   format(new Date(r.date), 'yyyy-MM-dd') === dateStr &&
                   r.status === "APPROVED";
        }).length;
    };
    
    const maxLeavePerWing = config?.maxLeavePerWing || 3;
    
    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-display font-bold" data-testid="text-leave-title">Leave Management</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {isTeacher ? "Apply for leave and track your requests" : "Review and approve teacher leave requests (First-come, first-serve)"}
                    </p>
                </div>
                
                {isTeacher && (
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="button-apply-leave">
                                <Plus className="w-4 h-4 mr-2" />
                                Apply for Leave
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Apply for Leave</DialogTitle>
                            </DialogHeader>
                            <LeaveApplicationForm 
                                user={user} 
                                onSuccess={() => {
                                    setIsFormOpen(false);
                                    queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
                                }} 
                            />
                        </DialogContent>
                    </Dialog>
                )}
            </div>
            
            {canApprove && wings && wings.length > 0 && (
                <div className="flex items-center gap-4 flex-wrap">
                    <Label className="text-sm font-medium">Filter by Wing:</Label>
                    <Select value={selectedWing} onValueChange={setSelectedWing}>
                        <SelectTrigger className="w-48" data-testid="select-wing-filter">
                            <SelectValue placeholder="All Wings" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Wings</SelectItem>
                            {wings.map(wing => (
                                <SelectItem key={wing.id} value={String(wing.id)}>
                                    {wing.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    <Badge variant="outline" className="ml-auto">
                        Max {maxLeavePerWing} leaves per wing/day
                    </Badge>
                </div>
            )}
            
            {pendingRequests.length > 0 && (
                <Card className="glass-card">
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-yellow-500" />
                                Pending Requests
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Sorted by submission time (earliest first)
                            </CardDescription>
                        </div>
                        <Badge variant="secondary">{pendingRequests.length}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {pendingRequests.map((request, index) => {
                            const { teacher, wing } = getTeacherInfo(request.teacherId);
                            const currentApproved = getWingLeaveCount(wing?.id, new Date(request.date));
                            const canApproveMore = currentApproved < maxLeavePerWing;
                            
                            return (
                                <div 
                                    key={request.id}
                                    className="flex flex-col gap-4 p-4 border border-border rounded-lg bg-muted/20"
                                    data-testid={`leave-request-${request.id}`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                                                <span className="font-semibold">{teacher?.fullName || `Teacher #${request.teacherId}`}</span>
                                                <Badge className={statusColors[request.status || 'PENDING']}>{request.status}</Badge>
                                                <Badge variant="outline">{leaveTypeLabels[request.leaveType || 'CASUAL'] || request.leaveType}</Badge>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Building className="w-4 h-4" />
                                                    {wing?.name || "No Wing"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <CalendarOff className="w-4 h-4" />
                                                    {format(new Date(request.date), "EEE, MMM d, yyyy")}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3" />
                                                Applied {request.createdAt ? formatDistanceToNow(new Date(request.createdAt), { addSuffix: true }) : 'recently'}
                                                {request.createdAt && (
                                                    <span className="ml-1">
                                                        ({format(new Date(request.createdAt), "h:mm a, MMM d")})
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {request.reason && (
                                                <p className="text-sm mt-2 text-muted-foreground italic">
                                                    <FileText className="w-4 h-4 inline mr-1" />
                                                    {request.reason}
                                                </p>
                                            )}
                                            
                                            {!canApproveMore && canApprove && (
                                                <div className="flex items-center gap-2 mt-2 text-amber-600 dark:text-amber-400 text-sm">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Wing limit reached ({currentApproved}/{maxLeavePerWing} approved for this date)
                                                </div>
                                            )}
                                        </div>
                                        
                                        {canApprove && (
                                            <div className="flex gap-2 flex-shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() => approveMutation.mutate(request.id)}
                                                    disabled={approveMutation.isPending || !canApproveMore}
                                                    data-testid={`button-approve-${request.id}`}
                                                >
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => rejectMutation.mutate(request.id)}
                                                    disabled={rejectMutation.isPending}
                                                    data-testid={`button-reject-${request.id}`}
                                                >
                                                    <X className="w-4 h-4 mr-1" />
                                                    Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
            
            {pendingRequests.length === 0 && (
                <Card className="glass-card">
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>{isTeacher ? "You have no pending leave requests" : "No pending leave requests"}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Leave History</CardTitle>
                </CardHeader>
                <CardContent>
                    {processedRequests.length > 0 ? (
                        <div className="space-y-3">
                            {processedRequests.map((request) => {
                                const { teacher, wing } = getTeacherInfo(request.teacherId);
                                return (
                                    <div 
                                        key={request.id}
                                        className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border border-border/50"
                                        data-testid={`leave-history-${request.id}`}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium">{teacher?.fullName || `Teacher #${request.teacherId}`}</span>
                                                <Badge className={statusColors[request.status || 'PENDING']}>{request.status}</Badge>
                                                {wing && <Badge variant="outline" className="text-xs">{wing.name}</Badge>}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {format(new Date(request.date), "MMM d, yyyy")} - {leaveTypeLabels[request.leaveType] || request.leaveType}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <CalendarOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No leave history available</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function LeaveApplicationForm({ user, onSuccess }: { user: any; onSuccess: () => void }) {
    const { toast } = useToast();
    const [leaveType, setLeaveType] = useState("FULL_DAY");
    const [date, setDate] = useState("");
    const [reason, setReason] = useState("");
    
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest('POST', '/api/leave-requests', data);
        },
        onSuccess: () => {
            toast({ 
                title: "Leave Applied", 
                description: "Your leave request has been submitted. Principal will be notified via WhatsApp/Arattai." 
            });
            onSuccess();
        },
        onError: (error: any) => {
            toast({ 
                title: "Error", 
                description: error.message || "Failed to submit leave request", 
                variant: "destructive" 
            });
        }
    });
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!date) {
            toast({ title: "Error", description: "Please select a date", variant: "destructive" });
            return;
        }
        
        createMutation.mutate({
            schoolId: user.schoolId || 1,
            teacherId: user.id,
            leaveType,
            date: new Date(date).toISOString(),
            reason,
            status: "PENDING"
        });
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger data-testid="select-leave-type">
                        <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="FULL_DAY">Full Day</SelectItem>
                        <SelectItem value="HALF_DAY_MORNING">Half Day (Morning)</SelectItem>
                        <SelectItem value="HALF_DAY_AFTERNOON">Half Day (Afternoon)</SelectItem>
                        <SelectItem value="ON_DUTY">On-Duty</SelectItem>
                        <SelectItem value="PERMISSION">Permission (up to 1 hour)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="date">Leave Date</Label>
                <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    data-testid="input-leave-date"
                />
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly describe your reason for leave..."
                    className="resize-none"
                    rows={3}
                    data-testid="input-leave-reason"
                />
            </div>
            
            <Button 
                type="submit" 
                className="w-full" 
                disabled={createMutation.isPending}
                data-testid="button-submit-leave"
            >
                {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                    <Plus className="w-4 h-4 mr-2" />
                )}
                Submit Leave Request
            </Button>
        </form>
    );
}
