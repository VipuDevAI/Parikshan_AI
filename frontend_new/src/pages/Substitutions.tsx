import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, CalendarDays, User, BookOpen, Award } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function SubstitutionsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
    
    const { data: substitutions, isLoading, refetch } = useQuery({
        queryKey: ['/api/substitutions', selectedDate],
        queryFn: async () => {
            const response = await fetch(`/api/substitutions?date=${selectedDate}`);
            if (!response.ok) throw new Error('Failed to fetch');
            return response.json();
        }
    });
    
    const generateMutation = useMutation({
        mutationFn: async () => {
            return apiRequest('POST', '/api/substitutions/generate', { date: selectedDate });
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['/api/substitutions'] });
            refetch();
            toast({ 
                title: "Substitutions Generated", 
                description: `Created ${data.generated} substitution assignments.`
            });
        },
        onError: () => {
            toast({ 
                title: "Generation Failed", 
                description: "Could not generate substitutions.",
                variant: "destructive"
            });
        }
    });
    
    const canGenerate = ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "WING_COORDINATOR"].includes(user?.role || "");
    
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-substitutions" />
            </div>
        );
    }
    
    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold" data-testid="text-sub-title">Substitution Management</h1>
                    <p className="text-muted-foreground text-sm mt-1">AI-powered teacher substitution assignments</p>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="date" className="sr-only">Date</Label>
                        <Input
                            id="date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-auto"
                            data-testid="input-sub-date"
                        />
                    </div>
                    {canGenerate && (
                        <Button 
                            onClick={() => generateMutation.mutate()}
                            disabled={generateMutation.isPending}
                            data-testid="button-generate-subs"
                        >
                            {generateMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Generate Substitutions
                        </Button>
                    )}
                </div>
            </div>
            
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" />
                        Substitutions for {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
                    </CardTitle>
                    <CardDescription>
                        Automatically assigned based on teacher availability and workload scoring
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {substitutions && substitutions.length > 0 ? (
                        <div className="space-y-4">
                            {substitutions.map((sub: any) => (
                                <div 
                                    key={sub.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-lg bg-muted/20"
                                    data-testid={`substitution-${sub.id}`}
                                >
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="font-mono">
                                                Period {sub.periodIndex}
                                            </Badge>
                                            <Badge variant="secondary">
                                                Section ID: {sub.sectionId}
                                            </Badge>
                                            {sub.score && (
                                                <Badge className="bg-primary/10 text-primary">
                                                    <Award className="w-3 h-3 mr-1" />
                                                    Score: {sub.score}
                                                </Badge>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-red-500" />
                                                <span className="text-muted-foreground">Absent:</span>
                                                <span className="font-medium">Teacher ID {sub.originalTeacherId}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-green-500" />
                                                <span className="text-muted-foreground">Substitute:</span>
                                                <span className="font-medium">Teacher ID {sub.substituteTeacherId}</span>
                                            </div>
                                        </div>
                                        
                                        {sub.subjectId && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <BookOpen className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">Subject ID: {sub.subjectId}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p className="text-lg font-medium">No substitutions for this date</p>
                            <p className="text-sm mt-1">
                                {canGenerate 
                                    ? "Click 'Generate Substitutions' to create assignments based on approved leaves" 
                                    : "Substitutions will appear here once generated by administrators"}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>How Substitution Scoring Works</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                            <div className="text-3xl font-bold text-primary mb-2">100</div>
                            <p className="text-sm font-medium">Base Score</p>
                            <p className="text-xs text-muted-foreground">Starting point for each candidate</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                            <div className="text-3xl font-bold text-yellow-600 mb-2">-10</div>
                            <p className="text-sm font-medium">Per Existing Sub</p>
                            <p className="text-xs text-muted-foreground">Penalty for each assignment that day</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                            <div className="text-3xl font-bold text-red-600 mb-2">Max 3</div>
                            <p className="text-sm font-medium">Daily Limit</p>
                            <p className="text-xs text-muted-foreground">Teachers cannot exceed this count</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
