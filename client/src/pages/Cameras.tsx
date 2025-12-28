import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
    Camera, Plus, Settings, Trash2, AlertCircle, CheckCircle, 
    Wifi, WifiOff, MapPin, Building2, Users, BookOpen, Info,
    Loader2, Video, Monitor, Shield, Clock, Server, Cpu, Activity,
    Download, RefreshCw, Copy
} from "lucide-react";
import type { Camera as CameraType, Section, Nvr, EdgeAgent } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const CAMERA_LIMITS = {
    FREE: { cameras: 5, description: "Basic plan" },
    STANDARD: { cameras: 25, description: "Standard plan" },
    PROFESSIONAL: { cameras: 50, description: "Professional plan" },
    ENTERPRISE: { cameras: 150, description: "Enterprise plan - Large schools" },
    ENTERPRISE_PLUS: { cameras: 300, description: "Enterprise Plus - Multi-campus" }
};

const SUPPORTED_CAMERA_TYPES = [
    { value: "HIKVISION", label: "Hikvision", protocol: "RTSP" },
    { value: "DAHUA", label: "Dahua", protocol: "RTSP" },
    { value: "AXIS", label: "Axis Communications", protocol: "RTSP/ONVIF" },
    { value: "HANWHA", label: "Hanwha (Samsung)", protocol: "RTSP" },
    { value: "UNIVIEW", label: "Uniview", protocol: "RTSP" },
    { value: "CP_PLUS", label: "CP Plus", protocol: "RTSP" },
    { value: "GENERIC_RTSP", label: "Generic RTSP Camera", protocol: "RTSP" },
    { value: "GENERIC_ONVIF", label: "ONVIF Compatible", protocol: "ONVIF" }
];

export default function CamerasPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [showAddForm, setShowAddForm] = useState(false);
    const [showNvrForm, setShowNvrForm] = useState(false);
    const [connectionType, setConnectionType] = useState<"direct" | "nvr">("direct");
    const [formData, setFormData] = useState({
        name: "",
        location: "",
        type: "ENTRY",
        roomId: "",
        sectionId: "",
        brand: "",
        rtspUrl: "",
        resolution: "1080p",
        streamType: "main",
        nvrId: "",
        channelNumber: ""
    });
    const [nvrFormData, setNvrFormData] = useState({
        name: "",
        brand: "HIKVISION",
        ipAddress: "",
        port: "554",
        username: "",
        password: "",
        totalChannels: "16",
        rtspTemplate: ""
    });

    const { data: cameras, isLoading: camerasLoading } = useQuery<CameraType[]>({
        queryKey: ['/api/cameras'],
    });

    const { data: sections } = useQuery<Section[]>({
        queryKey: ['/api/sections'],
    });

    const { data: nvrs } = useQuery<Nvr[]>({
        queryKey: ['/api/nvrs'],
    });

    const { data: edgeAgents, isLoading: agentsLoading } = useQuery<EdgeAgent[]>({
        queryKey: ['/api/edge/agents'],
    });

    const [showEdgeAgentForm, setShowEdgeAgentForm] = useState(false);
    const [newAgentSecret, setNewAgentSecret] = useState<string | null>(null);
    const [edgeAgentFormData, setEdgeAgentFormData] = useState({
        name: "",
        description: "",
        maxCameras: "50"
    });

    const createEdgeAgentMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiRequest('POST', '/api/edge/agents', data);
            return response.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['/api/edge/agents'] });
            setNewAgentSecret(data.secret);
            toast({ title: "Edge Agent Created", description: "Save the secret key shown below - you won't see it again!" });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const deleteEdgeAgentMutation = useMutation({
        mutationFn: async (agentId: string) => {
            return apiRequest('DELETE', `/api/edge/agents/${agentId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/edge/agents'] });
            toast({ title: "Agent Deleted", description: "Edge agent has been removed." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const createCameraMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest('POST', '/api/cameras', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/cameras'] });
            toast({ title: "Camera Added", description: "Camera has been registered successfully." });
            resetCameraForm();
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const createNvrMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest('POST', '/api/nvrs', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/nvrs'] });
            toast({ title: "NVR Added", description: "NVR has been registered successfully." });
            setShowNvrForm(false);
            setNvrFormData({ name: "", brand: "HIKVISION", ipAddress: "", port: "554", username: "", password: "", totalChannels: "16", rtspTemplate: "" });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createCameraMutation.mutate({
            name: formData.name,
            location: formData.location,
            type: formData.type,
            roomId: formData.roomId || null,
            sectionId: formData.sectionId ? Number(formData.sectionId) : null,
            brand: formData.brand || null,
            rtspUrl: formData.rtspUrl || null,
            resolution: formData.resolution || null,
            streamType: formData.streamType || null,
            nvrId: formData.nvrId ? Number(formData.nvrId) : null,
            channelNumber: formData.channelNumber ? Number(formData.channelNumber) : null
        });
    };

    const handleNvrSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createNvrMutation.mutate({
            name: nvrFormData.name,
            brand: nvrFormData.brand,
            ipAddress: nvrFormData.ipAddress,
            port: Number(nvrFormData.port),
            username: nvrFormData.username,
            password: nvrFormData.password,
            totalChannels: Number(nvrFormData.totalChannels),
            rtspTemplate: nvrFormData.rtspTemplate || null
        });
    };

    const resetCameraForm = () => {
        setFormData({ name: "", location: "", type: "ENTRY", roomId: "", sectionId: "", brand: "", rtspUrl: "", resolution: "1080p", streamType: "main", nvrId: "", channelNumber: "" });
        setShowAddForm(false);
    };

    const cameraCount = cameras?.length || 0;
    const maxCameras = CAMERA_LIMITS.STANDARD.cameras;
    const canAddCamera = user?.role === 'SUPER_ADMIN' || user?.role === 'CORRESPONDENT' || user?.role === 'PRINCIPAL';

    return (
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6" data-testid="page-cameras">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold" data-testid="text-page-title">Camera Management</h1>
                    <p className="text-muted-foreground">Configure and monitor AI-powered cameras</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                        <Camera className="w-3 h-3" />
                        <span data-testid="text-camera-count">{cameraCount} / {maxCameras} Cameras</span>
                    </Badge>
                    {canAddCamera && (
                        <Button onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-camera">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Camera
                        </Button>
                    )}
                </div>
            </div>

            <Tabs defaultValue="cameras" className="space-y-6">
                <TabsList className="flex-wrap">
                    <TabsTrigger value="cameras" data-testid="tab-cameras">
                        <Video className="w-4 h-4 mr-2" />
                        Cameras
                    </TabsTrigger>
                    <TabsTrigger value="nvr" data-testid="tab-nvr">
                        <Server className="w-4 h-4 mr-2" />
                        NVR Setup
                    </TabsTrigger>
                    <TabsTrigger value="guide" data-testid="tab-guide">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Connection Guide
                    </TabsTrigger>
                    <TabsTrigger value="limits" data-testid="tab-limits">
                        <Info className="w-4 h-4 mr-2" />
                        Plans & Limits
                    </TabsTrigger>
                    <TabsTrigger value="edge" data-testid="tab-edge">
                        <Cpu className="w-4 h-4 mr-2" />
                        Edge Agents
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="cameras" className="space-y-6">
                    {showAddForm && (
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Plus className="w-5 h-5" />
                                    Add New Camera
                                </CardTitle>
                                <CardDescription>
                                    Register a new AI camera for attendance and monitoring
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={handleSubmit}>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="cam-name">Camera Name</Label>
                                            <Input
                                                id="cam-name"
                                                placeholder="e.g., Main Gate Camera 1"
                                                value={formData.name}
                                                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                                required
                                                data-testid="input-camera-name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="cam-location">Location</Label>
                                            <Input
                                                id="cam-location"
                                                placeholder="e.g., Main Entrance, Block A"
                                                value={formData.location}
                                                onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                                required
                                                data-testid="input-camera-location"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Camera Type</Label>
                                            <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v }))}>
                                                <SelectTrigger data-testid="select-camera-type">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ENTRY">Entry Camera</SelectItem>
                                                    <SelectItem value="CLASSROOM">Classroom Camera</SelectItem>
                                                    <SelectItem value="CORRIDOR">Corridor Camera</SelectItem>
                                                    <SelectItem value="PLAYGROUND">Playground Camera</SelectItem>
                                                    <SelectItem value="LAB">Lab Camera</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Room ID (Optional)</Label>
                                            <Input
                                                placeholder="e.g., ROOM-101, LAB-A"
                                                value={formData.roomId}
                                                onChange={e => setFormData(p => ({ ...p, roomId: e.target.value }))}
                                                data-testid="input-camera-room"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Classroom Section (Optional)</Label>
                                            <Select value={formData.sectionId} onValueChange={v => setFormData(p => ({ ...p, sectionId: v }))}>
                                                <SelectTrigger data-testid="select-camera-section">
                                                    <SelectValue placeholder="Select section" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="">Not a classroom camera</SelectItem>
                                                    {sections?.map(s => (
                                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Separator />
                                    <h4 className="font-medium">Connection Settings</h4>
                                    
                                    <div className="flex gap-4 mb-4">
                                        <Button 
                                            type="button" 
                                            variant={connectionType === "direct" ? "default" : "outline"}
                                            onClick={() => setConnectionType("direct")}
                                            size="sm"
                                        >
                                            Direct RTSP
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={connectionType === "nvr" ? "default" : "outline"}
                                            onClick={() => setConnectionType("nvr")}
                                            size="sm"
                                        >
                                            Via NVR
                                        </Button>
                                    </div>

                                    {connectionType === "direct" ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2 md:col-span-2">
                                                <Label>RTSP URL</Label>
                                                <Input
                                                    placeholder="rtsp://admin:password@192.168.1.64:554/Streaming/Channels/101"
                                                    value={formData.rtspUrl}
                                                    onChange={e => setFormData(p => ({ ...p, rtspUrl: e.target.value }))}
                                                    data-testid="input-camera-rtsp"
                                                />
                                                <p className="text-xs text-muted-foreground">Full RTSP URL including credentials</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Camera Brand</Label>
                                                <Select value={formData.brand} onValueChange={v => setFormData(p => ({ ...p, brand: v }))}>
                                                    <SelectTrigger data-testid="select-camera-brand">
                                                        <SelectValue placeholder="Select brand" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SUPPORTED_CAMERA_TYPES.map(cam => (
                                                            <SelectItem key={cam.value} value={cam.value}>{cam.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Resolution</Label>
                                                <Select value={formData.resolution} onValueChange={v => setFormData(p => ({ ...p, resolution: v }))}>
                                                    <SelectTrigger data-testid="select-camera-resolution">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="720p">720p (HD)</SelectItem>
                                                        <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                                                        <SelectItem value="4K">4K (Ultra HD)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Select NVR</Label>
                                                <Select value={formData.nvrId} onValueChange={v => setFormData(p => ({ ...p, nvrId: v }))}>
                                                    <SelectTrigger data-testid="select-camera-nvr">
                                                        <SelectValue placeholder="Select NVR" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {nvrs?.length === 0 && (
                                                            <SelectItem value="" disabled>No NVRs configured - add one first</SelectItem>
                                                        )}
                                                        {nvrs?.map(nvr => (
                                                            <SelectItem key={nvr.id} value={String(nvr.id)}>{nvr.name} ({nvr.ipAddress})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Channel Number</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g., 1, 2, 3..."
                                                    value={formData.channelNumber}
                                                    onChange={e => setFormData(p => ({ ...p, channelNumber: e.target.value }))}
                                                    min="1"
                                                    max="150"
                                                    data-testid="input-camera-channel"
                                                />
                                                <p className="text-xs text-muted-foreground">NVR channel number (1-150)</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="flex gap-2">
                                    <Button type="submit" disabled={createCameraMutation.isPending} data-testid="button-save-camera">
                                        {createCameraMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Save Camera
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                                        Cancel
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    )}

                    {camerasLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : cameras?.length === 0 ? (
                        <Card className="glass-card">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <Camera className="w-16 h-16 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Cameras Configured</h3>
                                <p className="text-muted-foreground max-w-md mb-4">
                                    Add your first AI camera to start automated attendance tracking and security monitoring.
                                </p>
                                {canAddCamera && (
                                    <Button onClick={() => setShowAddForm(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Your First Camera
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cameras?.map(camera => {
                                const isOnline = camera.isActive && camera.lastPingAt && 
                                    (new Date().getTime() - new Date(camera.lastPingAt).getTime()) < 300000;
                                return (
                                    <Card key={camera.id} className="glass-card">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-2 rounded-lg ${isOnline ? 'bg-green-500/10' : 'bg-muted'}`}>
                                                        <Camera className={`w-5 h-5 ${isOnline ? 'text-green-500' : 'text-muted-foreground'}`} />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">{camera.name}</CardTitle>
                                                        <p className="text-xs text-muted-foreground">{camera.location}</p>
                                                    </div>
                                                </div>
                                                <Badge variant={isOnline ? 'default' : 'secondary'}>
                                                    {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                                                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Monitor className="w-4 h-4" />
                                                    <span>{SUPPORTED_CAMERA_TYPES.find(t => t.value === camera.type)?.label || camera.type}</span>
                                                </div>
                                                {camera.sectionId && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Users className="w-4 h-4" />
                                                        <span>Classroom: {sections?.find(s => s.id === camera.sectionId)?.name}</span>
                                                    </div>
                                                )}
                                                {camera.lastPingAt && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Clock className="w-4 h-4" />
                                                        <span>Last seen: {new Date(camera.lastPingAt).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="nvr" className="space-y-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="w-5 h-5" />
                                NVR Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure your Network Video Recorder (NVR) to connect all cameras at once
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!showNvrForm ? (
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {nvrs?.length || 0} NVR(s) configured
                                        </p>
                                    </div>
                                    {canAddCamera && (
                                        <Button onClick={() => setShowNvrForm(true)} data-testid="button-add-nvr">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add NVR
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <form onSubmit={handleNvrSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>NVR Name</Label>
                                            <Input
                                                placeholder="e.g., Main Building NVR"
                                                value={nvrFormData.name}
                                                onChange={e => setNvrFormData(p => ({ ...p, name: e.target.value }))}
                                                required
                                                data-testid="input-nvr-name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Brand</Label>
                                            <Select value={nvrFormData.brand} onValueChange={v => setNvrFormData(p => ({ ...p, brand: v }))}>
                                                <SelectTrigger data-testid="select-nvr-brand">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SUPPORTED_CAMERA_TYPES.slice(0, -2).map(cam => (
                                                        <SelectItem key={cam.value} value={cam.value}>{cam.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>IP Address</Label>
                                            <Input
                                                placeholder="192.168.1.100"
                                                value={nvrFormData.ipAddress}
                                                onChange={e => setNvrFormData(p => ({ ...p, ipAddress: e.target.value }))}
                                                required
                                                data-testid="input-nvr-ip"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>RTSP Port</Label>
                                            <Input
                                                type="number"
                                                placeholder="554"
                                                value={nvrFormData.port}
                                                onChange={e => setNvrFormData(p => ({ ...p, port: e.target.value }))}
                                                data-testid="input-nvr-port"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Total Channels</Label>
                                            <Input
                                                type="number"
                                                placeholder="16"
                                                value={nvrFormData.totalChannels}
                                                onChange={e => setNvrFormData(p => ({ ...p, totalChannels: e.target.value }))}
                                                required
                                                data-testid="input-nvr-channels"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Username</Label>
                                            <Input
                                                placeholder="admin"
                                                value={nvrFormData.username}
                                                onChange={e => setNvrFormData(p => ({ ...p, username: e.target.value }))}
                                                required
                                                data-testid="input-nvr-username"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Password</Label>
                                            <Input
                                                type="password"
                                                placeholder="********"
                                                value={nvrFormData.password}
                                                onChange={e => setNvrFormData(p => ({ ...p, password: e.target.value }))}
                                                required
                                                data-testid="input-nvr-password"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>RTSP URL Template (Optional)</Label>
                                        <Input
                                            placeholder="rtsp://{username}:{password}@{ip}:{port}/ch{channel}/main"
                                            value={nvrFormData.rtspTemplate}
                                            onChange={e => setNvrFormData(p => ({ ...p, rtspTemplate: e.target.value }))}
                                            data-testid="input-nvr-template"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Use placeholders: {"{username}"}, {"{password}"}, {"{ip}"}, {"{port}"}, {"{channel}"}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="submit" disabled={createNvrMutation.isPending} data-testid="button-save-nvr">
                                            {createNvrMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Save NVR
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => setShowNvrForm(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>

                    {nvrs && nvrs.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {nvrs.map(nvr => (
                                <Card key={nvr.id} className="glass-card">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-primary/10">
                                                    <Server className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">{nvr.name}</CardTitle>
                                                    <p className="text-xs text-muted-foreground">{nvr.brand}</p>
                                                </div>
                                            </div>
                                            <Badge variant={nvr.isActive ? 'default' : 'secondary'}>
                                                {nvr.isActive ? 'ACTIVE' : 'INACTIVE'}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <MapPin className="w-4 h-4" />
                                                <span>{nvr.ipAddress}:{nvr.port}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Video className="w-4 h-4" />
                                                <span>{nvr.totalChannels} channels</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="guide" className="space-y-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Camera Connection Guide
                            </CardTitle>
                            <CardDescription>
                                Step-by-step instructions to connect your cameras to Parikshan.AI
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
                                    Supported Camera Brands
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {SUPPORTED_CAMERA_TYPES.slice(0, -2).map(cam => (
                                        <div key={cam.value} className="p-3 border rounded-lg text-center">
                                            <p className="font-medium text-sm">{cam.label}</p>
                                            <p className="text-xs text-muted-foreground">{cam.protocol}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
                                    Network Requirements
                                </h3>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span>Cameras must be on the same network as the Parikshan.AI Edge Device</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span>Minimum bandwidth: 2 Mbps per camera for 720p, 4 Mbps for 1080p</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span>Static IP recommended for each camera (DHCP reservation works too)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span>Port 554 (RTSP) must be accessible on the camera</span>
                                    </li>
                                </ul>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">3</span>
                                    RTSP URL Format
                                </h3>
                                <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                                    <p className="font-semibold mb-2">Generic Format:</p>
                                    <code>rtsp://username:password@camera-ip:554/stream-path</code>
                                    <Separator className="my-3" />
                                    <p className="font-semibold mb-2">Examples by Brand:</p>
                                    <div className="space-y-1 text-xs">
                                        <p><strong>Hikvision:</strong> rtsp://admin:password@192.168.1.64:554/Streaming/Channels/101</p>
                                        <p><strong>Dahua:</strong> rtsp://admin:password@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0</p>
                                        <p><strong>CP Plus:</strong> rtsp://admin:password@192.168.1.120:554/cam/realmonitor?channel=1&subtype=1</p>
                                        <p><strong>Axis:</strong> rtsp://root:password@192.168.1.90:554/axis-media/media.amp</p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">4</span>
                                    Webhook Integration (Advanced)
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    For cameras with built-in AI or NVR systems, you can send events directly to our webhook:
                                </p>
                                <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                                    <p><strong>Endpoint:</strong> POST https://your-domain/api/camera/webhook/event</p>
                                    <p><strong>Headers:</strong> x-camera-token: YOUR_WEBHOOK_SECRET</p>
                                    <p><strong>Body:</strong> {"{"} cameraId, eventType, data, confidence, timestamp {"}"}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Contact support to get your webhook secret and integration documentation.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="limits" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(CAMERA_LIMITS).map(([plan, details]) => (
                            <Card key={plan} className={`glass-card ${plan === 'STANDARD' ? 'ring-2 ring-primary' : ''}`}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{plan.replace('_', ' ')}</CardTitle>
                                    <CardDescription>{details.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2">
                                        <Camera className="w-8 h-8 text-primary" />
                                        <div>
                                            <p className="text-3xl font-bold">{details.cameras}</p>
                                            <p className="text-sm text-muted-foreground">cameras</p>
                                        </div>
                                    </div>
                                </CardContent>
                                {plan === 'STANDARD' && (
                                    <CardFooter>
                                        <Badge>Current Plan</Badge>
                                    </CardFooter>
                                )}
                            </Card>
                        ))}
                    </div>

                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                Camera Features by Plan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-3">Feature</th>
                                            <th className="text-center p-3">Free</th>
                                            <th className="text-center p-3">Standard</th>
                                            <th className="text-center p-3">Professional</th>
                                            <th className="text-center p-3">Enterprise</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b">
                                            <td className="p-3">Face Recognition Attendance</td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3">Discipline Detection (Fight, Running)</td>
                                            <td className="text-center p-3 text-muted-foreground">-</td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3">Classroom Attention Monitoring</td>
                                            <td className="text-center p-3 text-muted-foreground">-</td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3">Uniform Compliance Check</td>
                                            <td className="text-center p-3 text-muted-foreground">-</td>
                                            <td className="text-center p-3 text-muted-foreground">-</td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3">Real-time WhatsApp Alerts</td>
                                            <td className="text-center p-3 text-muted-foreground">-</td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                            <td className="text-center p-3"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3">Face Encodings Storage</td>
                                            <td className="text-center p-3">1,000</td>
                                            <td className="text-center p-3">5,000</td>
                                            <td className="text-center p-3">10,000</td>
                                            <td className="text-center p-3">Unlimited</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3">Event Retention</td>
                                            <td className="text-center p-3">7 days</td>
                                            <td className="text-center p-3">30 days</td>
                                            <td className="text-center p-3">90 days</td>
                                            <td className="text-center p-3">1 year</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-amber-500/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="w-5 h-5" />
                                Important Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <p>
                                <strong>Edge Device Required:</strong> AI processing happens on our Edge Device installed at your school. 
                                Contact our team for Edge Device installation.
                            </p>
                            <p>
                                <strong>Internet Bandwidth:</strong> Each camera requires stable upload bandwidth for cloud sync. 
                                We recommend at least 50 Mbps shared upload for 25 cameras.
                            </p>
                            <p>
                                <strong>Camera Placement:</strong> For best face recognition, cameras should be placed at face height 
                                (1.2-1.5m) near entry/exit points with good lighting.
                            </p>
                            <p>
                                <strong>Support:</strong> Our team provides remote setup assistance and on-site installation 
                                support for Professional and Enterprise plans.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="edge" className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">Edge Agents</h2>
                            <p className="text-muted-foreground text-sm">
                                On-premise AI processing units that connect cameras to Parikshan.AI
                            </p>
                        </div>
                        <Button onClick={() => setShowEdgeAgentForm(!showEdgeAgentForm)} data-testid="button-add-edge-agent">
                            <Plus className="w-4 h-4 mr-2" />
                            Register Edge Agent
                        </Button>
                    </div>

                    {newAgentSecret && (
                        <Card className="border-green-500/50 bg-green-500/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                    <CheckCircle className="w-5 h-5" />
                                    Edge Agent Created Successfully
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-muted rounded-md font-mono text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="break-all">{newAgentSecret}</span>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => {
                                                navigator.clipboard.writeText(newAgentSecret);
                                                toast({ title: "Copied", description: "Secret copied to clipboard" });
                                            }}
                                            data-testid="button-copy-secret"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-amber-600 dark:text-amber-400">
                                    Save this secret now. You won't be able to see it again.
                                </p>
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setNewAgentSecret(null);
                                        setShowEdgeAgentForm(false);
                                        setEdgeAgentFormData({ name: "", description: "", maxCameras: "50" });
                                    }}
                                >
                                    Done
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {showEdgeAgentForm && !newAgentSecret && (
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Cpu className="w-5 h-5" />
                                    Register New Edge Agent
                                </CardTitle>
                                <CardDescription>
                                    Create credentials for a new edge agent installation
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                createEdgeAgentMutation.mutate({
                                    name: edgeAgentFormData.name,
                                    description: edgeAgentFormData.description || null,
                                    maxCameras: parseInt(edgeAgentFormData.maxCameras) || 50
                                });
                            }}>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="agent-name">Agent Name</Label>
                                            <Input
                                                id="agent-name"
                                                placeholder="e.g., Main Campus Edge"
                                                value={edgeAgentFormData.name}
                                                onChange={e => setEdgeAgentFormData(p => ({ ...p, name: e.target.value }))}
                                                required
                                                data-testid="input-agent-name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="agent-max-cameras">Max Cameras</Label>
                                            <Select
                                                value={edgeAgentFormData.maxCameras}
                                                onValueChange={v => setEdgeAgentFormData(p => ({ ...p, maxCameras: v }))}
                                            >
                                                <SelectTrigger data-testid="select-agent-max-cameras">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="25">25 cameras</SelectItem>
                                                    <SelectItem value="50">50 cameras</SelectItem>
                                                    <SelectItem value="100">100 cameras</SelectItem>
                                                    <SelectItem value="150">150 cameras</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="agent-description">Description (Optional)</Label>
                                        <Input
                                            id="agent-description"
                                            placeholder="e.g., Server room location, hardware specs"
                                            value={edgeAgentFormData.description}
                                            onChange={e => setEdgeAgentFormData(p => ({ ...p, description: e.target.value }))}
                                            data-testid="input-agent-description"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-wrap gap-2">
                                    <Button type="submit" disabled={createEdgeAgentMutation.isPending} data-testid="button-create-agent">
                                        {createEdgeAgentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Create Agent
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => setShowEdgeAgentForm(false)}>
                                        Cancel
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    )}

                    {agentsLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !edgeAgents || edgeAgents.length === 0 ? (
                        <Card className="glass-card">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <Cpu className="w-12 h-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium">No Edge Agents</h3>
                                <p className="text-sm text-muted-foreground max-w-md mt-2">
                                    Register an edge agent to start processing camera feeds locally with AI.
                                    Edge agents run on your school's server and send only event data to the cloud.
                                </p>
                                <Button className="mt-4" onClick={() => setShowEdgeAgentForm(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Register Your First Agent
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {edgeAgents.map((agent) => (
                                <Card key={agent.agentId} className="glass-card">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    agent.status === 'ONLINE' ? 'bg-green-500' :
                                                    agent.status === 'OFFLINE' ? 'bg-red-500' :
                                                    'bg-yellow-500'
                                                }`} />
                                                <CardTitle className="text-lg" data-testid={`text-agent-name-${agent.agentId}`}>
                                                    {agent.name}
                                                </CardTitle>
                                            </div>
                                            <Badge variant={agent.status === 'ONLINE' ? 'default' : 'secondary'}>
                                                {agent.status}
                                            </Badge>
                                        </div>
                                        {agent.description && (
                                            <CardDescription>{agent.description}</CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Camera className="w-4 h-4 text-muted-foreground" />
                                                <span>{agent.activeCameras || 0} / {agent.maxCameras} cameras</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-muted-foreground" />
                                                <span>{agent.eventsToday || 0} events today</span>
                                            </div>
                                        </div>
                                        
                                        {agent.lastHeartbeat && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3" />
                                                <span>Last seen: {formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true })}</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                                            <span>ID: {agent.agentId.slice(0, 8)}...</span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-5 w-5"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(agent.agentId);
                                                    toast({ title: "Copied", description: "Agent ID copied to clipboard" });
                                                }}
                                            >
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex flex-wrap gap-2 pt-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                const script = `curl -sSL https://parikshan.ai/edge/install.sh | AGENT_ID=${agent.agentId} bash`;
                                                navigator.clipboard.writeText(script);
                                                toast({ title: "Copied", description: "Install command copied to clipboard" });
                                            }}
                                            data-testid={`button-copy-install-${agent.agentId}`}
                                        >
                                            <Download className="w-4 h-4 mr-1" />
                                            Copy Install Command
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive"
                                            onClick={() => {
                                                if (confirm('Are you sure you want to delete this edge agent?')) {
                                                    deleteEdgeAgentMutation.mutate(agent.agentId);
                                                }
                                            }}
                                            data-testid={`button-delete-agent-${agent.agentId}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}

                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Edge Agent Deployment Guide
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-2">
                                <h4 className="font-medium">1. Register Agent</h4>
                                <p className="text-muted-foreground">
                                    Click "Register Edge Agent" and save the secret key shown.
                                </p>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="font-medium">2. Install Docker</h4>
                                <p className="text-muted-foreground">
                                    Install Docker on your school's server. Works on Ubuntu 20.04+, Windows Server 2019+, or any system with Docker support.
                                </p>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="font-medium">3. Run Install Script</h4>
                                <div className="p-3 bg-muted rounded-md font-mono text-xs">
                                    curl -sSL https://parikshan.ai/edge/install.sh | bash
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="font-medium">4. Configure Cameras</h4>
                                <p className="text-muted-foreground">
                                    Add your cameras in the "Cameras" tab. The edge agent will automatically fetch the configuration.
                                </p>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="font-medium">System Requirements</h4>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                    <li>CPU: 4+ cores recommended (Intel i5/AMD Ryzen 5 or better)</li>
                                    <li>RAM: 8GB minimum, 16GB recommended for 50+ cameras</li>
                                    <li>Storage: 50GB SSD for logs and offline queue</li>
                                    <li>Network: Gigabit LAN access to camera network</li>
                                    <li>Internet: 10Mbps+ upload for cloud sync</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
