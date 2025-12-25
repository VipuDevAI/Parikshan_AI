import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Settings2, Camera, Clock, Shield, Bell, Save, Building2, Users, BookOpen, Eye, EyeOff, Calendar, Download, Play, FileSpreadsheet, FileText, Key, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SchoolConfig, Camera as CameraType, Wing, Class, Section, SectionCamera, LeaveRequest, Substitution, Timetable, User } from "@shared/schema";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AIStatusResponse {
    isConfigured: boolean;
    configuredAt: string | null;
    hasGlobalKey: boolean;
}

function AIKeyConfiguration({ canEdit }: { canEdit: boolean }) {
    const { toast } = useToast();
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    
    const { data: aiStatus, isLoading } = useQuery<AIStatusResponse>({
        queryKey: ['/api/school-config/ai-status'],
    });
    
    const saveMutation = useMutation({
        mutationFn: async (key: string) => {
            return apiRequest('POST', '/api/school-config/ai-key', { apiKey: key });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/school-config/ai-status'] });
            setApiKey("");
            toast({ title: "API Key Saved", description: "Your OpenAI API key has been configured securely." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to save API key", variant: "destructive" });
        },
    });
    
    const deleteMutation = useMutation({
        mutationFn: async () => {
            return apiRequest('DELETE', '/api/school-config/ai-key', {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/school-config/ai-status'] });
            toast({ title: "API Key Removed", description: "Your OpenAI API key has been removed." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to remove API key", variant: "destructive" });
        },
    });
    
    const testMutation = useMutation({
        mutationFn: async (key?: string) => {
            return apiRequest('POST', '/api/school-config/ai-key/test', key ? { apiKey: key } : {});
        },
        onSuccess: async (response) => {
            const data = await response.json();
            toast({ title: "Connection Successful", description: data.message || "API key is valid and working." });
        },
        onError: (error: any) => {
            toast({ title: "Connection Failed", description: error.message || "Failed to verify API key", variant: "destructive" });
        },
    });
    
    const handleSave = () => {
        if (!apiKey || !apiKey.startsWith('sk-')) {
            toast({ title: "Invalid Key", description: "OpenAI API keys must start with 'sk-'", variant: "destructive" });
            return;
        }
        saveMutation.mutate(apiKey);
    };
    
    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    OpenAI API Key
                </CardTitle>
                <CardDescription>
                    Configure your school's OpenAI API key for AI-powered features like chat assistant and image generation.
                    Your key is encrypted and stored securely.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                    {aiStatus?.isConfigured ? (
                        <>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                            <div>
                                <p className="font-medium">API Key Configured</p>
                                <p className="text-sm text-muted-foreground">
                                    Configured on {aiStatus.configuredAt ? new Date(aiStatus.configuredAt).toLocaleDateString() : 'recently'}
                                </p>
                            </div>
                        </>
                    ) : aiStatus?.hasGlobalKey ? (
                        <>
                            <AlertTriangle className="w-8 h-8 text-yellow-500" />
                            <div>
                                <p className="font-medium">Using Platform Key</p>
                                <p className="text-sm text-muted-foreground">
                                    AI features are using the platform's shared API key. Configure your own key for dedicated usage.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-8 h-8 text-red-500" />
                            <div>
                                <p className="font-medium">Not Configured</p>
                                <p className="text-sm text-muted-foreground">
                                    AI features are disabled. Add your OpenAI API key to enable chat and image features.
                                </p>
                            </div>
                        </>
                    )}
                </div>
                
                {canEdit && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="apiKey">
                                {aiStatus?.isConfigured ? "Update API Key" : "Enter API Key"}
                            </Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="apiKey"
                                        type={showKey ? "text" : "password"}
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        data-testid="input-openai-key"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 -translate-y-1/2"
                                        onClick={() => setShowKey(!showKey)}
                                        data-testid="button-toggle-key-visibility"
                                    >
                                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={!apiKey || saveMutation.isPending}
                                    data-testid="button-save-api-key"
                                >
                                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenAI Platform</a>
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            {apiKey && (
                                <Button
                                    variant="outline"
                                    onClick={() => testMutation.mutate(apiKey)}
                                    disabled={testMutation.isPending}
                                    data-testid="button-test-new-key"
                                >
                                    {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Test New Key
                                </Button>
                            )}
                            {aiStatus?.isConfigured && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => testMutation.mutate(undefined)}
                                        disabled={testMutation.isPending}
                                        data-testid="button-test-saved-key"
                                    >
                                        {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                        Test Saved Key
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => deleteMutation.mutate()}
                                        disabled={deleteMutation.isPending}
                                        data-testid="button-remove-api-key"
                                    >
                                        {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                        Remove Key
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface WebhookConfig {
    whatsappWebhook: string | null;
    arattaiWebhook: string | null;
}

function WhatsAppConfiguration({ canEdit, config }: { canEdit: boolean; config?: WebhookConfig }) {
    const { toast } = useToast();
    const [webhookUrl, setWebhookUrl] = useState("");
    
    const saveMutation = useMutation({
        mutationFn: async (url: string) => {
            return apiRequest('POST', '/api/school-config/whatsapp-webhook', { webhookUrl: url });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/config'] });
            setWebhookUrl("");
            toast({ title: "Webhook Saved", description: "WhatsApp webhook URL has been configured." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to save webhook URL", variant: "destructive" });
        },
    });
    
    const deleteMutation = useMutation({
        mutationFn: async () => {
            return apiRequest('DELETE', '/api/school-config/whatsapp-webhook', {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/config'] });
            toast({ title: "Webhook Removed", description: "WhatsApp webhook URL has been removed." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to remove webhook URL", variant: "destructive" });
        },
    });
    
    const handleSave = () => {
        try {
            new URL(webhookUrl);
        } catch {
            toast({ title: "Invalid URL", description: "Please enter a valid URL", variant: "destructive" });
            return;
        }
        saveMutation.mutate(webhookUrl);
    };
    
    const isConfigured = !!config?.whatsappWebhook;
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    WhatsApp Integration
                </CardTitle>
                <CardDescription>
                    Configure your WhatsApp Business API webhook URL for sending notifications to parents and staff.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                    {isConfigured ? (
                        <>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium">Webhook Configured</p>
                                <p className="text-sm text-muted-foreground truncate">
                                    {config?.whatsappWebhook}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-8 h-8 text-red-500" />
                            <div>
                                <p className="font-medium">Not Configured</p>
                                <p className="text-sm text-muted-foreground">
                                    WhatsApp notifications are disabled. Add your webhook URL to enable.
                                </p>
                            </div>
                        </>
                    )}
                </div>
                
                {canEdit && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="whatsappWebhook">
                                {isConfigured ? "Update Webhook URL" : "Enter Webhook URL"}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="whatsappWebhook"
                                    type="url"
                                    placeholder="https://api.whatsapp.com/..."
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    className="flex-1"
                                    data-testid="input-whatsapp-webhook"
                                />
                                <Button
                                    onClick={handleSave}
                                    disabled={!webhookUrl || saveMutation.isPending}
                                    data-testid="button-save-whatsapp-webhook"
                                >
                                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                        
                        {isConfigured && (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="destructive"
                                    onClick={() => deleteMutation.mutate()}
                                    disabled={deleteMutation.isPending}
                                    data-testid="button-remove-whatsapp-webhook"
                                >
                                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Remove Webhook
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ArattaiConfiguration({ canEdit, config }: { canEdit: boolean; config?: WebhookConfig }) {
    const { toast } = useToast();
    const [webhookUrl, setWebhookUrl] = useState("");
    
    const saveMutation = useMutation({
        mutationFn: async (url: string) => {
            return apiRequest('POST', '/api/school-config/arattai-webhook', { webhookUrl: url });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/config'] });
            setWebhookUrl("");
            toast({ title: "Webhook Saved", description: "Arattai webhook URL has been configured." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to save webhook URL", variant: "destructive" });
        },
    });
    
    const deleteMutation = useMutation({
        mutationFn: async () => {
            return apiRequest('DELETE', '/api/school-config/arattai-webhook', {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/config'] });
            toast({ title: "Webhook Removed", description: "Arattai webhook URL has been removed." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to remove webhook URL", variant: "destructive" });
        },
    });
    
    const handleSave = () => {
        try {
            new URL(webhookUrl);
        } catch {
            toast({ title: "Invalid URL", description: "Please enter a valid URL", variant: "destructive" });
            return;
        }
        saveMutation.mutate(webhookUrl);
    };
    
    const isConfigured = !!config?.arattaiWebhook;
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Arattai Integration
                </CardTitle>
                <CardDescription>
                    Configure your Arattai messaging webhook URL for Tamil language notifications.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                    {isConfigured ? (
                        <>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium">Webhook Configured</p>
                                <p className="text-sm text-muted-foreground truncate">
                                    {config?.arattaiWebhook}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-8 h-8 text-red-500" />
                            <div>
                                <p className="font-medium">Not Configured</p>
                                <p className="text-sm text-muted-foreground">
                                    Arattai notifications are disabled. Add your webhook URL to enable.
                                </p>
                            </div>
                        </>
                    )}
                </div>
                
                {canEdit && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="arattaiWebhook">
                                {isConfigured ? "Update Webhook URL" : "Enter Webhook URL"}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="arattaiWebhook"
                                    type="url"
                                    placeholder="https://api.arattai.io/..."
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    className="flex-1"
                                    data-testid="input-arattai-webhook"
                                />
                                <Button
                                    onClick={handleSave}
                                    disabled={!webhookUrl || saveMutation.isPending}
                                    data-testid="button-save-arattai-webhook"
                                >
                                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                        
                        {isConfigured && (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="destructive"
                                    onClick={() => deleteMutation.mutate()}
                                    disabled={deleteMutation.isPending}
                                    data-testid="button-remove-arattai-webhook"
                                >
                                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Remove Webhook
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SectionCameraControls({ schoolId, cameras }: { schoolId: number; cameras: CameraType[] }) {
    const { toast } = useToast();
    const [selectedWing, setSelectedWing] = useState<string>("");
    const [selectedClass, setSelectedClass] = useState<string>("");
    
    const { data: wings } = useQuery<Wing[]>({ queryKey: ['/api/wings'] });
    const { data: classes } = useQuery<Class[]>({ queryKey: ['/api/classes'] });
    const { data: sections } = useQuery<Section[]>({ queryKey: ['/api/sections'] });
    const { data: sectionCameras, isLoading } = useQuery<SectionCamera[]>({
        queryKey: ['/api/section-cameras', schoolId],
    });
    
    const filteredClasses = classes?.filter(c => !selectedWing || c.wingId === parseInt(selectedWing)) || [];
    const filteredSections = sections?.filter(s => {
        if (selectedClass) return s.classId === parseInt(selectedClass);
        if (selectedWing) {
            const sectionClass = classes?.find(c => c.id === s.classId);
            return sectionClass?.wingId === parseInt(selectedWing);
        }
        return true;
    }) || [];
    
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: number; updates: Partial<SectionCamera> }) => {
            return apiRequest('PATCH', `/api/section-cameras/${id}`, updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/section-cameras', schoolId] });
            toast({ title: "Camera Control Updated", description: "Section camera settings saved." });
        },
    });
    
    const createMutation = useMutation({
        mutationFn: async (data: { sectionId: number; cameraId: number }) => {
            return apiRequest('POST', '/api/section-cameras', {
                schoolId, sectionId: data.sectionId, cameraId: data.cameraId,
                isEnabled: true, enableAttendance: true, enableDiscipline: true
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/section-cameras', schoolId] });
            toast({ title: "Camera Assigned", description: "Camera assigned to section." });
        },
    });
    
    const getSectionCamera = (sectionId: number, cameraId: number) => 
        sectionCameras?.find(sc => sc.sectionId === sectionId && sc.cameraId === cameraId);
    
    const getClassForSection = (sectionId: number) => {
        const section = sections?.find(s => s.id === sectionId);
        return section ? classes?.find(c => c.id === section.classId) : null;
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Section Camera Controls
                </CardTitle>
                <CardDescription>Enable or disable camera features per class/section</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Filter by Wing</Label>
                        <Select value={selectedWing} onValueChange={(v) => { setSelectedWing(v); setSelectedClass(""); }}>
                            <SelectTrigger data-testid="cam-select-wing">
                                <SelectValue placeholder="All Wings" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All Wings</SelectItem>
                                {wings?.map(w => (
                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Filter by Class</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger data-testid="cam-select-class">
                                <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All Classes</SelectItem>
                                {filteredClasses.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : cameras.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No cameras to configure</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[300px]">
                        <div className="space-y-4">
                            {filteredSections.map(section => {
                                const classItem = getClassForSection(section.id);
                                return (
                                    <div key={section.id} className="border rounded-lg p-3" data-testid={`section-cam-${section.id}`}>
                                        <p className="font-medium text-sm mb-2">{classItem?.name} - Section {section.name}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {cameras.map(camera => {
                                                const control = getSectionCamera(section.id, camera.id);
                                                const isEnabled = control?.isEnabled ?? false;
                                                const attendanceEnabled = control?.enableAttendance ?? true;
                                                const disciplineEnabled = control?.enableDiscipline ?? true;
                                                
                                                return (
                                                    <div key={camera.id} className="flex flex-col gap-2 p-2 bg-muted/30 rounded-md">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium truncate">{camera.name}</span>
                                                            {control ? (
                                                                <Button
                                                                    size="icon"
                                                                    variant={isEnabled ? "default" : "outline"}
                                                                    onClick={() => updateMutation.mutate({ id: control.id, updates: { isEnabled: !isEnabled } })}
                                                                    data-testid={`cam-toggle-${section.id}-${camera.id}`}
                                                                >
                                                                    {isEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => createMutation.mutate({ sectionId: section.id, cameraId: camera.id })}
                                                                    data-testid={`cam-assign-${section.id}-${camera.id}`}
                                                                >
                                                                    Assign
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {control && isEnabled && (
                                                            <div className="flex gap-2 text-xs">
                                                                <label className="flex items-center gap-1">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={attendanceEnabled}
                                                                        onChange={() => updateMutation.mutate({ id: control.id, updates: { enableAttendance: !attendanceEnabled } })}
                                                                        className="w-3 h-3"
                                                                    />
                                                                    Attendance
                                                                </label>
                                                                <label className="flex items-center gap-1">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={disciplineEnabled}
                                                                        onChange={() => updateMutation.mutate({ id: control.id, updates: { enableDiscipline: !disciplineEnabled } })}
                                                                        className="w-3 h-3"
                                                                    />
                                                                    Discipline
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}

function SubstitutionManagement({ schoolId, canEdit }: { schoolId: number; canEdit: boolean }) {
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSubs, setGeneratedSubs] = useState<any[]>([]);
    const [skippedPeriods, setSkippedPeriods] = useState<any[]>([]);
    
    const { data: leaveRequests, isLoading: leavesLoading } = useQuery<LeaveRequest[]>({
        queryKey: ['/api/leave-requests', { date: selectedDate }],
        queryFn: async () => {
            const res = await fetch(`/api/leave-requests?date=${selectedDate}`);
            if (!res.ok) throw new Error('Failed to fetch leave requests');
            return res.json();
        },
        enabled: !!selectedDate,
    });
    
    const { data: substitutions, isLoading: subsLoading, refetch: refetchSubs } = useQuery<Substitution[]>({
        queryKey: ['/api/substitutions', { date: selectedDate }],
        queryFn: async () => {
            const res = await fetch(`/api/substitutions?date=${selectedDate}`);
            if (!res.ok) throw new Error('Failed to fetch substitutions');
            return res.json();
        },
        enabled: !!selectedDate,
    });
    
    const { data: teachers } = useQuery<User[]>({
        queryKey: ['/api/teachers'],
    });
    
    const { data: sections } = useQuery<Section[]>({
        queryKey: ['/api/sections'],
    });
    
    const { data: timetable } = useQuery<Timetable[]>({
        queryKey: ['/api/timetable', schoolId],
    });
    
    const approvedLeaves = leaveRequests?.filter(l => l.status === 'APPROVED') || [];
    const pendingLeaves = leaveRequests?.filter(l => l.status === 'PENDING') || [];
    
    const getTeacherName = (id: number) => teachers?.find(t => t.id === id)?.fullName || `Teacher ${id}`;
    const getSectionName = (id: number) => sections?.find(s => s.id === id)?.name || `Section ${id}`;
    
    const generateMutation = useMutation({
        mutationFn: async () => {
            return apiRequest('POST', '/api/substitutions/generate', { 
                schoolId, 
                date: selectedDate 
            });
        },
        onSuccess: async (response: any) => {
            const data = await response.json();
            setGeneratedSubs(data.substitutions || []);
            setSkippedPeriods(data.skipped || []);
            refetchSubs();
            toast({ 
                title: "Substitutions Generated", 
                description: `Generated ${data.generated || 0} substitutions. ${data.skipped?.length || 0} periods skipped.` 
            });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to generate substitutions", variant: "destructive" });
        },
    });
    
    const downloadExcel = async () => {
        try {
            const response = await fetch(`/api/substitutions/download?schoolId=${schoolId}&date=${selectedDate}&format=excel`);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `substitutions_${selectedDate}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast({ title: "Error", description: "Failed to download Excel", variant: "destructive" });
        }
    };
    
    const downloadPDF = async () => {
        try {
            const response = await fetch(`/api/substitutions/download?schoolId=${schoolId}&date=${selectedDate}&format=pdf`);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `substitutions_${selectedDate}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Substitution Management
                </CardTitle>
                <CardDescription>Generate and download daily substitution reports from master timetable</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="subDate">Select Date</Label>
                        <Input
                            id="subDate"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            data-testid="input-sub-date"
                        />
                    </div>
                    <Button
                        onClick={() => generateMutation.mutate()}
                        disabled={!canEdit || generateMutation.isPending || approvedLeaves.length === 0}
                        data-testid="button-generate-subs"
                    >
                        {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        Generate Substitutions
                    </Button>
                    <Button
                        variant="outline"
                        onClick={downloadExcel}
                        disabled={!substitutions?.length}
                        data-testid="button-download-excel"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Download Excel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={downloadPDF}
                        disabled={!substitutions?.length}
                        data-testid="button-download-pdf"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Download PDF
                    </Button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                            Approved Leaves ({approvedLeaves.length})
                            {pendingLeaves.length > 0 && (
                                <Badge variant="secondary">{pendingLeaves.length} pending</Badge>
                            )}
                        </h4>
                        {leavesLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                        ) : approvedLeaves.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">No approved leaves for this date</p>
                        ) : (
                            <ScrollArea className="h-[200px]">
                                <div className="space-y-2">
                                    {approvedLeaves.map(leave => (
                                        <div key={leave.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                            <div>
                                                <p className="font-medium text-sm">{getTeacherName(leave.teacherId)}</p>
                                                <p className="text-xs text-muted-foreground">{leave.leaveType} - {leave.reason || 'No reason'}</p>
                                            </div>
                                            <Badge variant="outline">{leave.leaveType}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        <h4 className="font-medium">Generated Substitutions ({substitutions?.length || 0})</h4>
                        {subsLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                        ) : !substitutions?.length ? (
                            <p className="text-sm text-muted-foreground py-4">No substitutions generated yet</p>
                        ) : (
                            <ScrollArea className="h-[200px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Period</TableHead>
                                            <TableHead>Section</TableHead>
                                            <TableHead>Substitute</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {substitutions.map(sub => (
                                            <TableRow key={sub.id}>
                                                <TableCell>P{sub.periodIndex}</TableCell>
                                                <TableCell>{getSectionName(sub.sectionId)}</TableCell>
                                                <TableCell>{getTeacherName(sub.substituteTeacherId)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        )}
                    </div>
                </div>
                
                {skippedPeriods.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="font-medium text-destructive">Skipped Periods ({skippedPeriods.length})</h4>
                        <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
                            {skippedPeriods.map((skip, i) => (
                                <p key={i} className="text-sm">
                                    Period {skip.periodIndex} - {getSectionName(skip.sectionId)}: {skip.reason}
                                </p>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const { data: config, isLoading } = useQuery<SchoolConfig | null>({
        queryKey: ['/api/config'],
    });
    
    const { data: cameras, isLoading: camerasLoading } = useQuery<CameraType[]>({
        queryKey: ['/api/cameras'],
    });
    
    const [formData, setFormData] = useState({
        // Basic Timetable
        periodsPerDay: 8,
        periodDuration: 45,
        lunchAfterPeriod: 4,
        // Advanced Timetable Rules
        maxPeriodsPerTeacherPerDay: 7,
        maxPeriodsPerTeacherPerWeek: 35,
        maxConsecutivePeriods: 3,
        enforceRoomConflicts: true,
        // Substitution Rules
        maxSubstitutionsPerDay: 3,
        maxConsecutiveSubstitutions: 2,
        wingPriorityOverride: true,
        autoGenerateSubstitutions: false,
        excludeVPFromSubstitution: true,
        excludePrincipalFromSubstitution: true,
        maxTeacherPeriodsForSubstitution: 7,
        avoidBackToBackSubstitution: true,
        // AI Features
        enableFaceRecognition: true,
        enableDisciplineAlerts: true,
        enableMoodDetection: false,
        enableUniformCheck: true,
        // AI Thresholds
        attendanceConfidenceThreshold: 80,
        crowdingThreshold: 30,
        fightConfidenceThreshold: 85,
        uniformViolationThreshold: 75,
        // Leave Settings
        leaveDeadlineHour: 7,
        leaveDeadlineMinute: 0,
        // Scoring Weights
        scoreWeightBase: 100,
        scoreWeightSubjectMatch: 30,
        scoreWeightClassFamiliarity: 20,
        scoreWeightPeriodGap: -15,
        scoreWeightSubstitutionLoad: -10,
        scoreWeightOverload: -50,
        // Notifications
        enableWhatsAppNotifications: false,
        enableEmailNotifications: false,
        whatsappWebhook: "",
        arattaiWebhook: "",
    });
    
    useEffect(() => {
        if (config) {
            setFormData({
                periodsPerDay: config.periodsPerDay ?? 8,
                periodDuration: config.periodDuration ?? 45,
                lunchAfterPeriod: config.lunchAfterPeriod ?? 4,
                maxPeriodsPerTeacherPerDay: config.maxPeriodsPerTeacherPerDay ?? 7,
                maxPeriodsPerTeacherPerWeek: config.maxPeriodsPerTeacherPerWeek ?? 35,
                maxConsecutivePeriods: config.maxConsecutivePeriods ?? 3,
                enforceRoomConflicts: config.enforceRoomConflicts ?? true,
                maxSubstitutionsPerDay: config.maxSubstitutionsPerDay ?? 3,
                maxConsecutiveSubstitutions: config.maxConsecutiveSubstitutions ?? 2,
                wingPriorityOverride: config.wingPriorityOverride ?? true,
                autoGenerateSubstitutions: config.autoGenerateSubstitutions ?? false,
                excludeVPFromSubstitution: config.excludeVPFromSubstitution ?? true,
                excludePrincipalFromSubstitution: config.excludePrincipalFromSubstitution ?? true,
                maxTeacherPeriodsForSubstitution: config.maxTeacherPeriodsForSubstitution ?? 7,
                avoidBackToBackSubstitution: config.avoidBackToBackSubstitution ?? true,
                enableFaceRecognition: config.enableFaceRecognition ?? true,
                enableDisciplineAlerts: config.enableDisciplineAlerts ?? true,
                enableMoodDetection: config.enableMoodDetection ?? false,
                enableUniformCheck: config.enableUniformCheck ?? true,
                attendanceConfidenceThreshold: config.attendanceConfidenceThreshold ?? 80,
                crowdingThreshold: config.crowdingThreshold ?? 30,
                fightConfidenceThreshold: config.fightConfidenceThreshold ?? 85,
                uniformViolationThreshold: config.uniformViolationThreshold ?? 75,
                leaveDeadlineHour: config.leaveDeadlineHour ?? 7,
                leaveDeadlineMinute: config.leaveDeadlineMinute ?? 0,
                scoreWeightBase: config.scoreWeightBase ?? 100,
                scoreWeightSubjectMatch: config.scoreWeightSubjectMatch ?? 30,
                scoreWeightClassFamiliarity: config.scoreWeightClassFamiliarity ?? 20,
                scoreWeightPeriodGap: config.scoreWeightPeriodGap ?? -15,
                scoreWeightSubstitutionLoad: config.scoreWeightSubstitutionLoad ?? -10,
                scoreWeightOverload: config.scoreWeightOverload ?? -50,
                enableWhatsAppNotifications: config.enableWhatsAppNotifications ?? false,
                enableEmailNotifications: config.enableEmailNotifications ?? false,
                whatsappWebhook: config.whatsappWebhook ?? "",
                arattaiWebhook: config.arattaiWebhook ?? "",
            });
        }
    }, [config]);
    
    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest('PATCH', '/api/config', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/config'] });
            toast({
                title: "Settings Updated",
                description: "Your configuration has been saved successfully.",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to update settings.",
                variant: "destructive"
            });
        }
    });
    
    const handleSave = () => {
        updateMutation.mutate(formData);
    };
    
    const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "PRINCIPAL";
    const isWingAdmin = user?.role === "WING_ADMIN";
    const canEditWing = isWingAdmin || canEdit;
    
    const [wingFormData, setWingFormData] = useState({
        // Timetable Rules
        maxPeriodsPerTeacherPerDay: 7,
        maxPeriodsPerTeacherPerWeek: 35,
        maxConsecutivePeriods: 3,
        enforceRoomConflicts: true,
        // Substitution Rules
        maxSubsPerTeacher: 3,
        maxConsecutiveSubstitutions: 2,
        wingPriorityOverride: true,
        autoSubstitution: false,
        // Attendance Thresholds
        minAttendancePercent: 75,
        parentNotifyBelowPercent: 70,
        // AI Thresholds
        attendanceConfidenceThreshold: 80,
        crowdingThreshold: 30,
        fightConfidenceThreshold: 85,
        // Notifications
        notifyWhatsApp: false,
        notifyEmail: false,
    });
    
    useEffect(() => {
        if (config) {
            setWingFormData({
                maxPeriodsPerTeacherPerDay: config.maxPeriodsPerTeacherPerDay ?? 7,
                maxPeriodsPerTeacherPerWeek: config.maxPeriodsPerTeacherPerWeek ?? 35,
                maxConsecutivePeriods: config.maxConsecutivePeriods ?? 3,
                enforceRoomConflicts: config.enforceRoomConflicts ?? true,
                maxSubsPerTeacher: config.maxSubstitutionsPerDay ?? 3,
                maxConsecutiveSubstitutions: config.maxConsecutiveSubstitutions ?? 2,
                wingPriorityOverride: config.wingPriorityOverride ?? true,
                autoSubstitution: config.autoGenerateSubstitutions ?? false,
                minAttendancePercent: config.minAttendancePercent ?? 75,
                parentNotifyBelowPercent: config.parentNotifyBelowPercent ?? 70,
                attendanceConfidenceThreshold: config.attendanceConfidenceThreshold ?? 80,
                crowdingThreshold: config.crowdingThreshold ?? 30,
                fightConfidenceThreshold: config.fightConfidenceThreshold ?? 85,
                notifyWhatsApp: config.enableWhatsAppNotifications ?? false,
                notifyEmail: config.enableEmailNotifications ?? false,
            });
        }
    }, [config]);
    
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-settings" />
            </div>
        );
    }
    
    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-display font-bold" data-testid="text-settings-title">School Configuration</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your school settings and AI preferences</p>
                </div>
                {canEdit && (
                    <Button 
                        onClick={handleSave} 
                        disabled={updateMutation.isPending}
                        data-testid="button-save-settings"
                    >
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                )}
            </div>
            
            <Tabs defaultValue={isWingAdmin ? "wing" : "timetable"} className="w-full">
                <TabsList className={`grid w-full ${isWingAdmin ? 'grid-cols-1 max-w-xs' : 'grid-cols-5'}`} data-testid="tabs-settings">
                    {!isWingAdmin && (
                        <>
                            <TabsTrigger value="timetable" data-testid="tab-timetable">
                                <Clock className="w-4 h-4 mr-2" />
                                Timetable
                            </TabsTrigger>
                            <TabsTrigger value="ai" data-testid="tab-ai">
                                <Camera className="w-4 h-4 mr-2" />
                                AI Features
                            </TabsTrigger>
                            <TabsTrigger value="substitution" data-testid="tab-substitution">
                                <Settings2 className="w-4 h-4 mr-2" />
                                Substitution
                            </TabsTrigger>
                            <TabsTrigger value="cameras" data-testid="tab-cameras">
                                <Shield className="w-4 h-4 mr-2" />
                                Cameras
                            </TabsTrigger>
                        </>
                    )}
                    <TabsTrigger value="wing" data-testid="tab-wing">
                        <Building2 className="w-4 h-4 mr-2" />
                        Wing Settings
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="timetable" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                Basic Timetable Settings
                            </CardTitle>
                            <CardDescription>Configure periods, duration, and schedule structure</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="periodsPerDay">Periods Per Day</Label>
                                <Input
                                    id="periodsPerDay"
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={formData.periodsPerDay}
                                    onChange={(e) => setFormData(prev => ({ ...prev, periodsPerDay: parseInt(e.target.value) || 8 }))}
                                    disabled={!canEdit}
                                    data-testid="input-periods-per-day"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="periodDuration">Period Duration (minutes)</Label>
                                <Input
                                    id="periodDuration"
                                    type="number"
                                    min={30}
                                    max={60}
                                    value={formData.periodDuration}
                                    onChange={(e) => setFormData(prev => ({ ...prev, periodDuration: parseInt(e.target.value) || 45 }))}
                                    disabled={!canEdit}
                                    data-testid="input-period-duration"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lunchAfterPeriod">Lunch After Period</Label>
                                <Input
                                    id="lunchAfterPeriod"
                                    type="number"
                                    min={1}
                                    max={formData.periodsPerDay}
                                    value={formData.lunchAfterPeriod}
                                    onChange={(e) => setFormData(prev => ({ ...prev, lunchAfterPeriod: parseInt(e.target.value) || 4 }))}
                                    disabled={!canEdit}
                                    data-testid="input-lunch-after"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Teacher Workload Constraints
                            </CardTitle>
                            <CardDescription>Set limits on teacher assignments to prevent overload</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="maxPeriodsPerTeacherPerDay">Max Periods Per Teacher/Day</Label>
                                <Input
                                    id="maxPeriodsPerTeacherPerDay"
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={formData.maxPeriodsPerTeacherPerDay}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxPeriodsPerTeacherPerDay: parseInt(e.target.value) || 7 }))}
                                    disabled={!canEdit}
                                    data-testid="input-max-periods-teacher-day"
                                />
                                <p className="text-xs text-muted-foreground">Hard limit - generation fails if exceeded</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxPeriodsPerTeacherPerWeek">Max Periods Per Teacher/Week</Label>
                                <Input
                                    id="maxPeriodsPerTeacherPerWeek"
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={formData.maxPeriodsPerTeacherPerWeek}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxPeriodsPerTeacherPerWeek: parseInt(e.target.value) || 35 }))}
                                    disabled={!canEdit}
                                    data-testid="input-max-periods-teacher-week"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxConsecutivePeriods">Max Consecutive Periods</Label>
                                <Input
                                    id="maxConsecutivePeriods"
                                    type="number"
                                    min={1}
                                    max={6}
                                    value={formData.maxConsecutivePeriods}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxConsecutivePeriods: parseInt(e.target.value) || 3 }))}
                                    disabled={!canEdit}
                                    data-testid="input-max-consecutive-periods"
                                />
                                <p className="text-xs text-muted-foreground">Prevents teacher fatigue</p>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="w-5 h-5" />
                                Room Management
                            </CardTitle>
                            <CardDescription>Configure room conflict detection</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Enforce Room Conflicts</Label>
                                    <p className="text-sm text-muted-foreground">Prevent double-booking of rooms in timetable</p>
                                </div>
                                <Switch
                                    checked={formData.enforceRoomConflicts}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enforceRoomConflicts: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-room-conflicts"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="ai" className="mt-6 space-y-6">
                    <AIKeyConfiguration canEdit={canEdit} />
                    <WhatsAppConfiguration canEdit={canEdit} config={config ? { whatsappWebhook: config.whatsappWebhook, arattaiWebhook: config.arattaiWebhook } : undefined} />
                    <ArattaiConfiguration canEdit={canEdit} config={config ? { whatsappWebhook: config.whatsappWebhook, arattaiWebhook: config.arattaiWebhook } : undefined} />
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Camera className="w-5 h-5" />
                                AI Camera Features
                            </CardTitle>
                            <CardDescription>Enable or disable AI monitoring capabilities</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Face Recognition</Label>
                                    <p className="text-sm text-muted-foreground">Automatic attendance through face detection</p>
                                </div>
                                <Switch
                                    checked={formData.enableFaceRecognition}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableFaceRecognition: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-face-recognition"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Discipline Alerts</Label>
                                    <p className="text-sm text-muted-foreground">Detect fights, bullying, and aggressive behavior</p>
                                </div>
                                <Switch
                                    checked={formData.enableDisciplineAlerts}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableDisciplineAlerts: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-discipline-alerts"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Mood Detection</Label>
                                    <p className="text-sm text-muted-foreground">Detect student emotional states and engagement</p>
                                </div>
                                <Switch
                                    checked={formData.enableMoodDetection}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableMoodDetection: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-mood-detection"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Uniform Checks</Label>
                                    <p className="text-sm text-muted-foreground">Automatically detect uniform violations</p>
                                </div>
                                <Switch
                                    checked={formData.enableUniformCheck}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableUniformCheck: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-uniform-checks"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                AI Confidence Thresholds
                            </CardTitle>
                            <CardDescription>Set minimum confidence levels for AI detection (0-100%)</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="attendanceConfidenceThreshold">Face Recognition Confidence (%)</Label>
                                <Input
                                    id="attendanceConfidenceThreshold"
                                    type="number"
                                    min={50}
                                    max={100}
                                    value={formData.attendanceConfidenceThreshold}
                                    onChange={(e) => setFormData(prev => ({ ...prev, attendanceConfidenceThreshold: parseInt(e.target.value) || 80 }))}
                                    disabled={!canEdit}
                                    data-testid="input-face-confidence"
                                />
                                <p className="text-xs text-muted-foreground">Minimum confidence for attendance marking</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fightConfidenceThreshold">Fight Detection Confidence (%)</Label>
                                <Input
                                    id="fightConfidenceThreshold"
                                    type="number"
                                    min={50}
                                    max={100}
                                    value={formData.fightConfidenceThreshold}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fightConfidenceThreshold: parseInt(e.target.value) || 85 }))}
                                    disabled={!canEdit}
                                    data-testid="input-fight-confidence"
                                />
                                <p className="text-xs text-muted-foreground">Threshold for generating fight alerts</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="crowdingThreshold">Crowding Threshold (people)</Label>
                                <Input
                                    id="crowdingThreshold"
                                    type="number"
                                    min={5}
                                    max={100}
                                    value={formData.crowdingThreshold}
                                    onChange={(e) => setFormData(prev => ({ ...prev, crowdingThreshold: parseInt(e.target.value) || 30 }))}
                                    disabled={!canEdit}
                                    data-testid="input-crowding-threshold"
                                />
                                <p className="text-xs text-muted-foreground">Number of people to trigger crowding alert</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="uniformViolationThreshold">Uniform Detection Confidence (%)</Label>
                                <Input
                                    id="uniformViolationThreshold"
                                    type="number"
                                    min={50}
                                    max={100}
                                    value={formData.uniformViolationThreshold}
                                    onChange={(e) => setFormData(prev => ({ ...prev, uniformViolationThreshold: parseInt(e.target.value) || 75 }))}
                                    disabled={!canEdit}
                                    data-testid="input-uniform-confidence"
                                />
                                <p className="text-xs text-muted-foreground">Minimum confidence for uniform violation</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="substitution" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="w-5 h-5" />
                                Substitution Rules
                            </CardTitle>
                            <CardDescription>Configure leave and substitution limits</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="maxSubs">Max Substitutions/Teacher/Day</Label>
                                <Input
                                    id="maxSubs"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={formData.maxSubstitutionsPerDay}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxSubstitutionsPerDay: parseInt(e.target.value) || 3 }))}
                                    disabled={!canEdit}
                                    data-testid="input-max-subs"
                                />
                                <p className="text-xs text-muted-foreground">Hard cap per day</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxConsecutiveSubstitutions">Max Consecutive Subs</Label>
                                <Input
                                    id="maxConsecutiveSubstitutions"
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={formData.maxConsecutiveSubstitutions}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxConsecutiveSubstitutions: parseInt(e.target.value) || 2 }))}
                                    disabled={!canEdit}
                                    data-testid="input-max-consecutive-subs"
                                />
                                <p className="text-xs text-muted-foreground">Avoid back-to-back subs</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="leaveDeadlineHour">Leave Deadline Hour (24h)</Label>
                                <Input
                                    id="leaveDeadlineHour"
                                    type="number"
                                    min={0}
                                    max={23}
                                    value={formData.leaveDeadlineHour}
                                    onChange={(e) => setFormData(prev => ({ ...prev, leaveDeadlineHour: parseInt(e.target.value) || 7 }))}
                                    disabled={!canEdit}
                                    data-testid="input-leave-deadline-hour"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Substitution Options</CardTitle>
                            <CardDescription>Control automation and priorities</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Wing Priority Override</Label>
                                    <p className="text-sm text-muted-foreground">Prefer teachers from the same wing for substitutions</p>
                                </div>
                                <Switch
                                    checked={formData.wingPriorityOverride}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, wingPriorityOverride: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-wing-priority"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Auto-Generate Substitutions</Label>
                                    <p className="text-sm text-muted-foreground">Automatically assign substitutes when leaves are approved</p>
                                </div>
                                <Switch
                                    checked={formData.autoGenerateSubstitutions}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoGenerateSubstitutions: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-auto-generate"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Exclude VP from Substitutions</Label>
                                    <p className="text-sm text-muted-foreground">Vice Principal will not be assigned as substitute</p>
                                </div>
                                <Switch
                                    checked={formData.excludeVPFromSubstitution}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, excludeVPFromSubstitution: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-exclude-vp"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Exclude Principal from Substitutions</Label>
                                    <p className="text-sm text-muted-foreground">Principal will not be assigned as substitute</p>
                                </div>
                                <Switch
                                    checked={formData.excludePrincipalFromSubstitution}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, excludePrincipalFromSubstitution: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-exclude-principal"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Avoid Back-to-Back Substitutions</Label>
                                    <p className="text-sm text-muted-foreground">Prevent giving consecutive period substitutions to same teacher</p>
                                </div>
                                <Switch
                                    checked={formData.avoidBackToBackSubstitution}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avoidBackToBackSubstitution: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-avoid-back-to-back"
                                />
                            </div>
                            <div className="space-y-2 pt-4">
                                <Label htmlFor="maxTeacherPeriodsForSubstitution">Max Teacher Periods for Substitution</Label>
                                <Input
                                    id="maxTeacherPeriodsForSubstitution"
                                    type="number"
                                    min={5}
                                    max={10}
                                    value={formData.maxTeacherPeriodsForSubstitution}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxTeacherPeriodsForSubstitution: parseInt(e.target.value) || 7 }))}
                                    disabled={!canEdit}
                                    data-testid="input-max-teacher-periods"
                                />
                                <p className="text-xs text-muted-foreground">Teachers with this many or more periods won't get substitutions unless necessary</p>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Scoring Weights
                            </CardTitle>
                            <CardDescription>Fine-tune how substitutes are scored and ranked</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="scoreWeightBase">Base Score</Label>
                                <Input
                                    id="scoreWeightBase"
                                    type="number"
                                    min={0}
                                    max={200}
                                    value={formData.scoreWeightBase}
                                    onChange={(e) => setFormData(prev => ({ ...prev, scoreWeightBase: parseInt(e.target.value) || 100 }))}
                                    disabled={!canEdit}
                                    data-testid="input-score-base"
                                />
                                <p className="text-xs text-muted-foreground">Starting score for all teachers</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scoreWeightSubjectMatch">Subject Match Bonus</Label>
                                <Input
                                    id="scoreWeightSubjectMatch"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={formData.scoreWeightSubjectMatch}
                                    onChange={(e) => setFormData(prev => ({ ...prev, scoreWeightSubjectMatch: parseInt(e.target.value) || 30 }))}
                                    disabled={!canEdit}
                                    data-testid="input-score-subject"
                                />
                                <p className="text-xs text-muted-foreground">Bonus for same subject</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scoreWeightClassFamiliarity">Class Familiarity Bonus</Label>
                                <Input
                                    id="scoreWeightClassFamiliarity"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={formData.scoreWeightClassFamiliarity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, scoreWeightClassFamiliarity: parseInt(e.target.value) || 20 }))}
                                    disabled={!canEdit}
                                    data-testid="input-score-familiarity"
                                />
                                <p className="text-xs text-muted-foreground">Bonus for teaching same class</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scoreWeightPeriodGap">Period Gap Penalty</Label>
                                <Input
                                    id="scoreWeightPeriodGap"
                                    type="number"
                                    min={-100}
                                    max={0}
                                    value={formData.scoreWeightPeriodGap}
                                    onChange={(e) => setFormData(prev => ({ ...prev, scoreWeightPeriodGap: parseInt(e.target.value) || -15 }))}
                                    disabled={!canEdit}
                                    data-testid="input-score-period-gap"
                                />
                                <p className="text-xs text-muted-foreground">Penalty per period gap</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scoreWeightSubstitutionLoad">Substitution Load Penalty</Label>
                                <Input
                                    id="scoreWeightSubstitutionLoad"
                                    type="number"
                                    min={-100}
                                    max={0}
                                    value={formData.scoreWeightSubstitutionLoad}
                                    onChange={(e) => setFormData(prev => ({ ...prev, scoreWeightSubstitutionLoad: parseInt(e.target.value) || -10 }))}
                                    disabled={!canEdit}
                                    data-testid="input-score-load"
                                />
                                <p className="text-xs text-muted-foreground">Penalty per existing sub</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scoreWeightOverload">Overload Penalty</Label>
                                <Input
                                    id="scoreWeightOverload"
                                    type="number"
                                    min={-200}
                                    max={0}
                                    value={formData.scoreWeightOverload}
                                    onChange={(e) => setFormData(prev => ({ ...prev, scoreWeightOverload: parseInt(e.target.value) || -50 }))}
                                    disabled={!canEdit}
                                    data-testid="input-score-overload"
                                />
                                <p className="text-xs text-muted-foreground">Heavy penalty for 7+ periods</p>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                Notifications
                            </CardTitle>
                            <CardDescription>Configure how substitution notifications are sent</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">WhatsApp Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Send substitution alerts via WhatsApp</p>
                                </div>
                                <Switch
                                    checked={formData.enableWhatsAppNotifications}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableWhatsAppNotifications: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-whatsapp"
                                />
                            </div>
                            {formData.enableWhatsAppNotifications && (
                                <div className="space-y-2 pl-4 border-l-2 border-muted">
                                    <Label htmlFor="whatsappWebhook">WhatsApp Webhook URL</Label>
                                    <Input
                                        id="whatsappWebhook"
                                        type="url"
                                        placeholder="https://your-whatsapp-api.com/webhook"
                                        value={formData.whatsappWebhook}
                                        onChange={(e) => setFormData(prev => ({ ...prev, whatsappWebhook: e.target.value }))}
                                        disabled={!canEdit}
                                        data-testid="input-whatsapp-webhook"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Enter your WhatsApp Business API webhook endpoint
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="font-medium">Email Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Send substitution alerts via Email</p>
                                </div>
                                <Switch
                                    checked={formData.enableEmailNotifications}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableEmailNotifications: checked }))}
                                    disabled={!canEdit}
                                    data-testid="switch-email"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                Arattai Integration
                            </CardTitle>
                            <CardDescription>Configure Arattai for in-app messaging</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="arattaiWebhook">Arattai Webhook URL</Label>
                                <Input
                                    id="arattaiWebhook"
                                    type="url"
                                    placeholder="https://arattai.app/api/webhook"
                                    value={formData.arattaiWebhook}
                                    onChange={(e) => setFormData(prev => ({ ...prev, arattaiWebhook: e.target.value }))}
                                    disabled={!canEdit}
                                    data-testid="input-arattai-webhook"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Connect to Arattai for real-time notifications to Parents and Teachers
                                </p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-4 text-sm">
                                <p className="font-medium mb-2">Notification Recipients</p>
                                <ul className="space-y-1 text-muted-foreground">
                                    <li>Principal: WhatsApp, Email, Push</li>
                                    <li>Vice Principal: WhatsApp, Push</li>
                                    <li>Teachers: WhatsApp, Push</li>
                                    <li>Parents: WhatsApp only</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <SubstitutionManagement schoolId={user?.schoolId || 1} canEdit={canEdit} />
                </TabsContent>
                
                <TabsContent value="cameras" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                Camera Inventory
                            </CardTitle>
                            <CardDescription>View and manage AI-enabled cameras</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {camerasLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : cameras && cameras.length > 0 ? (
                                <div className="space-y-3">
                                    {cameras.map((camera: any) => (
                                        <div 
                                            key={camera.id} 
                                            className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50"
                                            data-testid={`camera-item-${camera.id}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${camera.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                <div>
                                                    <p className="font-medium text-sm">{camera.name}</p>
                                                    <p className="text-xs text-muted-foreground">{camera.location} - {camera.type}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${camera.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {camera.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No cameras configured yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    
                    <SectionCameraControls schoolId={user?.schoolId || 1} cameras={cameras || []} />
                </TabsContent>
                
                <TabsContent value="wing" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Timetable Rules
                            </CardTitle>
                            <CardDescription>Configure timetable generation constraints</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="maxPeriodsPerDay">Max Periods Per Teacher Per Day</Label>
                                <Input
                                    id="maxPeriodsPerDay"
                                    type="number"
                                    min={4}
                                    max={8}
                                    value={wingFormData.maxPeriodsPerTeacherPerDay}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, maxPeriodsPerTeacherPerDay: parseInt(e.target.value) || 7 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-max-ppd"
                                />
                                <p className="text-xs text-muted-foreground">Hard limit on periods per teacher per day</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxPeriodsPerWeek">Max Periods Per Teacher Per Week</Label>
                                <Input
                                    id="maxPeriodsPerWeek"
                                    type="number"
                                    min={20}
                                    max={45}
                                    value={wingFormData.maxPeriodsPerTeacherPerWeek}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, maxPeriodsPerTeacherPerWeek: parseInt(e.target.value) || 35 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-max-ppw"
                                />
                                <p className="text-xs text-muted-foreground">Maximum teaching load per week</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxConsecutive">Max Consecutive Periods</Label>
                                <Input
                                    id="maxConsecutive"
                                    type="number"
                                    min={2}
                                    max={5}
                                    value={wingFormData.maxConsecutivePeriods}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, maxConsecutivePeriods: parseInt(e.target.value) || 3 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-max-consecutive"
                                />
                                <p className="text-xs text-muted-foreground">Prevent teacher fatigue from back-to-back classes</p>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                <div>
                                    <p className="font-medium text-sm">Enforce Room Conflicts</p>
                                    <p className="text-xs text-muted-foreground">Prevent double-booking rooms</p>
                                </div>
                                <Switch
                                    checked={wingFormData.enforceRoomConflicts}
                                    onCheckedChange={(checked) => setWingFormData(prev => ({ ...prev, enforceRoomConflicts: checked }))}
                                    disabled={!canEditWing}
                                    data-testid="switch-room-conflicts"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="w-5 h-5" />
                                Substitution Rules
                            </CardTitle>
                            <CardDescription>Configure automatic substitution assignment</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="maxSubsPerTeacher">Max Substitutions Per Day</Label>
                                <Input
                                    id="maxSubsPerTeacher"
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={wingFormData.maxSubsPerTeacher}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, maxSubsPerTeacher: parseInt(e.target.value) || 3 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-max-subs"
                                />
                                <p className="text-xs text-muted-foreground">Cap on substitutions per teacher</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxConsecutiveSubs">Max Consecutive Substitutions</Label>
                                <Input
                                    id="maxConsecutiveSubs"
                                    type="number"
                                    min={1}
                                    max={4}
                                    value={wingFormData.maxConsecutiveSubstitutions}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, maxConsecutiveSubstitutions: parseInt(e.target.value) || 2 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-max-consec-subs"
                                />
                                <p className="text-xs text-muted-foreground">Avoid back-to-back substitution assignments</p>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                <div>
                                    <p className="font-medium text-sm">Wing Priority Override</p>
                                    <p className="text-xs text-muted-foreground">Prefer teachers from same wing</p>
                                </div>
                                <Switch
                                    checked={wingFormData.wingPriorityOverride}
                                    onCheckedChange={(checked) => setWingFormData(prev => ({ ...prev, wingPriorityOverride: checked }))}
                                    disabled={!canEditWing}
                                    data-testid="switch-wing-priority"
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                <div>
                                    <p className="font-medium text-sm">Auto-generate Substitutions</p>
                                    <p className="text-xs text-muted-foreground">Assign automatically on leave approval</p>
                                </div>
                                <Switch
                                    checked={wingFormData.autoSubstitution}
                                    onCheckedChange={(checked) => setWingFormData(prev => ({ ...prev, autoSubstitution: checked }))}
                                    disabled={!canEditWing}
                                    data-testid="switch-auto-sub"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Attendance & AI Thresholds
                            </CardTitle>
                            <CardDescription>Configure detection sensitivity and alerts</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="minAttendance">Minimum Attendance %</Label>
                                <Input
                                    id="minAttendance"
                                    type="number"
                                    min={50}
                                    max={100}
                                    value={wingFormData.minAttendancePercent}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, minAttendancePercent: parseInt(e.target.value) || 75 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-min-attendance"
                                />
                                <p className="text-xs text-muted-foreground">Students below this are flagged</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="parentNotify">Parent Notification Threshold %</Label>
                                <Input
                                    id="parentNotify"
                                    type="number"
                                    min={50}
                                    max={100}
                                    value={wingFormData.parentNotifyBelowPercent}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, parentNotifyBelowPercent: parseInt(e.target.value) || 70 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-parent-notify"
                                />
                                <p className="text-xs text-muted-foreground">Auto-notify parents below this</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="attendanceConf">Face Recognition Confidence %</Label>
                                <Input
                                    id="attendanceConf"
                                    type="number"
                                    min={50}
                                    max={100}
                                    value={wingFormData.attendanceConfidenceThreshold}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, attendanceConfidenceThreshold: parseInt(e.target.value) || 80 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-face-confidence"
                                />
                                <p className="text-xs text-muted-foreground">Minimum confidence for attendance marking</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="crowding">Crowding Alert Threshold</Label>
                                <Input
                                    id="crowding"
                                    type="number"
                                    min={10}
                                    max={100}
                                    value={wingFormData.crowdingThreshold}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, crowdingThreshold: parseInt(e.target.value) || 30 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-crowding"
                                />
                                <p className="text-xs text-muted-foreground">Student count to trigger crowding alert</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fightConf">Fight Detection Confidence %</Label>
                                <Input
                                    id="fightConf"
                                    type="number"
                                    min={50}
                                    max={100}
                                    value={wingFormData.fightConfidenceThreshold}
                                    onChange={(e) => setWingFormData(prev => ({ ...prev, fightConfidenceThreshold: parseInt(e.target.value) || 85 }))}
                                    disabled={!canEditWing}
                                    data-testid="input-fight-confidence"
                                />
                                <p className="text-xs text-muted-foreground">Higher = fewer false positives</p>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                Notifications
                            </CardTitle>
                            <CardDescription>Configure alert delivery channels</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                <div>
                                    <p className="font-medium">WhatsApp Notifications</p>
                                    <p className="text-sm text-muted-foreground">Send alerts via WhatsApp</p>
                                </div>
                                <Switch
                                    checked={wingFormData.notifyWhatsApp}
                                    onCheckedChange={(checked) => setWingFormData(prev => ({ ...prev, notifyWhatsApp: checked }))}
                                    disabled={!canEditWing}
                                    data-testid="switch-whatsapp"
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                <div>
                                    <p className="font-medium">Email Notifications</p>
                                    <p className="text-sm text-muted-foreground">Send email summaries</p>
                                </div>
                                <Switch
                                    checked={wingFormData.notifyEmail}
                                    onCheckedChange={(checked) => setWingFormData(prev => ({ ...prev, notifyEmail: checked }))}
                                    disabled={!canEditWing}
                                    data-testid="switch-email"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    {canEditWing && (
                        <div className="flex justify-end">
                            <Button 
                                onClick={() => {
                                    updateMutation.mutate({
                                        maxPeriodsPerTeacherPerDay: wingFormData.maxPeriodsPerTeacherPerDay,
                                        maxPeriodsPerTeacherPerWeek: wingFormData.maxPeriodsPerTeacherPerWeek,
                                        maxConsecutivePeriods: wingFormData.maxConsecutivePeriods,
                                        enforceRoomConflicts: wingFormData.enforceRoomConflicts,
                                        maxSubstitutionsPerDay: wingFormData.maxSubsPerTeacher,
                                        maxConsecutiveSubstitutions: wingFormData.maxConsecutiveSubstitutions,
                                        wingPriorityOverride: wingFormData.wingPriorityOverride,
                                        autoGenerateSubstitutions: wingFormData.autoSubstitution,
                                        minAttendancePercent: wingFormData.minAttendancePercent,
                                        parentNotifyBelowPercent: wingFormData.parentNotifyBelowPercent,
                                        attendanceConfidenceThreshold: wingFormData.attendanceConfidenceThreshold,
                                        crowdingThreshold: wingFormData.crowdingThreshold,
                                        fightConfidenceThreshold: wingFormData.fightConfidenceThreshold,
                                        enableWhatsAppNotifications: wingFormData.notifyWhatsApp,
                                        enableEmailNotifications: wingFormData.notifyEmail,
                                    });
                                }} 
                                disabled={updateMutation.isPending}
                                data-testid="button-save-wing"
                            >
                                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Save All Settings
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
