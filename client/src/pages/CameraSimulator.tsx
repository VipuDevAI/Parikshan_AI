import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, AlertTriangle, Users, UserCheck, Play, CheckCircle } from "lucide-react";

interface SimulationResult {
  success: boolean;
  message: string;
  timestamp: string;
}

export default function CameraSimulator() {
  const { toast } = useToast();
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const [faceData, setFaceData] = useState({
    cameraId: "1",
    entityId: "1",
    entityType: "TEACHER",
    confidence: "0.95"
  });

  const [disciplineData, setDisciplineData] = useState({
    cameraId: "1",
    eventType: "FIGHT",
    confidence: "0.9"
  });

  const [attendanceData, setAttendanceData] = useState({
    cameraId: "1",
    attentiveCount: "25",
    totalCount: "30"
  });

  const addResult = (success: boolean, message: string) => {
    setResults(prev => [{
      success,
      message,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev.slice(0, 9)]);
  };

  const simulateFaceDetection = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/camera/webhook/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: Number(faceData.cameraId),
          entityId: Number(faceData.entityId),
          entityType: faceData.entityType,
          confidence: Number(faceData.confidence),
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok) {
        addResult(true, `Face detection: ${faceData.entityType} #${faceData.entityId} detected`);
        toast({ title: "Success", description: data.message });
      } else {
        addResult(false, data.message);
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      addResult(false, e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setIsSimulating(false);
  };

  const simulateDisciplineEvent = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/camera/webhook/discipline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: Number(disciplineData.cameraId),
          eventType: disciplineData.eventType,
          confidence: Number(disciplineData.confidence),
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok) {
        addResult(true, `Discipline event: ${disciplineData.eventType} detected`);
        toast({ title: "Success", description: data.message });
      } else {
        addResult(false, data.message);
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      addResult(false, e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setIsSimulating(false);
  };

  const simulateAttentionCheck = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/camera/webhook/attention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: Number(attendanceData.cameraId),
          attentiveCount: Number(attendanceData.attentiveCount),
          totalCount: Number(attendanceData.totalCount),
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok) {
        addResult(true, `Attention check: ${data.attentionRate} attentive`);
        toast({ title: "Success", description: data.message });
      } else {
        addResult(false, data.message);
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      addResult(false, e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setIsSimulating(false);
  };

  const simulateTeacherAbsence = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/camera/webhook/teacher-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: Number(faceData.cameraId),
          teacherPresent: false,
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok) {
        addResult(true, "Teacher absence noted");
        toast({ title: "Success", description: data.message });
      } else {
        addResult(false, data.message);
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      addResult(false, e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setIsSimulating(false);
  };

  const simulateGenericEvent = async (eventType: string) => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/camera/webhook/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: Number(faceData.cameraId),
          eventType,
          data: eventType === "FACE_DETECTION" 
            ? { entityId: Number(faceData.entityId), entityType: faceData.entityType }
            : eventType === "DISCIPLINE"
            ? { disciplineType: disciplineData.eventType }
            : eventType === "ATTENTION"
            ? { attentiveCount: Number(attendanceData.attentiveCount), totalCount: Number(attendanceData.totalCount) }
            : { teacherPresent: false },
          confidence: 0.9,
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok) {
        addResult(true, `Generic ${eventType} event processed`);
        toast({ title: "Success", description: data.message });
      } else {
        addResult(false, data.message);
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      addResult(false, e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setIsSimulating(false);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground" data-testid="text-title">
          Camera Webhook Simulator
        </h1>
        <p className="text-muted-foreground mt-1">
          Test camera AI integrations by simulating webhook events
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Face Detection / Attendance
            </CardTitle>
            <CardDescription>Simulate face recognition for attendance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="face-camera">Camera ID</Label>
                <Input
                  id="face-camera"
                  value={faceData.cameraId}
                  onChange={e => setFaceData(p => ({ ...p, cameraId: e.target.value }))}
                  data-testid="input-face-camera"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="face-entity">Entity ID</Label>
                <Input
                  id="face-entity"
                  value={faceData.entityId}
                  onChange={e => setFaceData(p => ({ ...p, entityId: e.target.value }))}
                  data-testid="input-face-entity"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select
                  value={faceData.entityType}
                  onValueChange={v => setFaceData(p => ({ ...p, entityType: v }))}
                >
                  <SelectTrigger data-testid="select-entity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="STUDENT">Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="face-confidence">Confidence</Label>
                <Input
                  id="face-confidence"
                  value={faceData.confidence}
                  onChange={e => setFaceData(p => ({ ...p, confidence: e.target.value }))}
                  data-testid="input-face-confidence"
                />
              </div>
            </div>
            <Button 
              onClick={simulateFaceDetection} 
              disabled={isSimulating}
              className="w-full"
              data-testid="button-simulate-face"
            >
              <Play className="w-4 h-4 mr-2" />
              Simulate Face Detection
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Discipline Events
            </CardTitle>
            <CardDescription>Simulate fight, running, or crowding detection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="disc-camera">Camera ID</Label>
                <Input
                  id="disc-camera"
                  value={disciplineData.cameraId}
                  onChange={e => setDisciplineData(p => ({ ...p, cameraId: e.target.value }))}
                  data-testid="input-disc-camera"
                />
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select
                  value={disciplineData.eventType}
                  onValueChange={v => setDisciplineData(p => ({ ...p, eventType: v }))}
                >
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIGHT">Fight Detected</SelectItem>
                    <SelectItem value="RUNNING">Running Detected</SelectItem>
                    <SelectItem value="CROWDING">Crowding Detected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disc-confidence">Confidence</Label>
              <Input
                id="disc-confidence"
                value={disciplineData.confidence}
                onChange={e => setDisciplineData(p => ({ ...p, confidence: e.target.value }))}
                data-testid="input-disc-confidence"
              />
            </div>
            <Button 
              onClick={simulateDisciplineEvent} 
              disabled={isSimulating}
              variant="destructive"
              className="w-full"
              data-testid="button-simulate-discipline"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Simulate Discipline Event
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Classroom Attention
            </CardTitle>
            <CardDescription>Simulate classroom attention monitoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="att-camera">Camera ID</Label>
                <Input
                  id="att-camera"
                  value={attendanceData.cameraId}
                  onChange={e => setAttendanceData(p => ({ ...p, cameraId: e.target.value }))}
                  data-testid="input-att-camera"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="att-attentive">Attentive</Label>
                <Input
                  id="att-attentive"
                  value={attendanceData.attentiveCount}
                  onChange={e => setAttendanceData(p => ({ ...p, attentiveCount: e.target.value }))}
                  data-testid="input-att-attentive"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="att-total">Total</Label>
                <Input
                  id="att-total"
                  value={attendanceData.totalCount}
                  onChange={e => setAttendanceData(p => ({ ...p, totalCount: e.target.value }))}
                  data-testid="input-att-total"
                />
              </div>
            </div>
            <Button 
              onClick={simulateAttentionCheck} 
              disabled={isSimulating}
              variant="secondary"
              className="w-full"
              data-testid="button-simulate-attention"
            >
              <Users className="w-4 h-4 mr-2" />
              Simulate Attention Check
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Teacher Presence & Generic Events
            </CardTitle>
            <CardDescription>Simulate teacher absence and generic event endpoint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test the teacher absence detection and the generic event router endpoint.
            </p>
            <Button 
              onClick={simulateTeacherAbsence} 
              disabled={isSimulating}
              variant="outline"
              className="w-full"
              data-testid="button-simulate-absence"
            >
              <Camera className="w-4 h-4 mr-2" />
              Simulate Teacher Absence
            </Button>
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={() => simulateGenericEvent("FACE_DETECTION")} 
                disabled={isSimulating}
                variant="secondary"
                size="sm"
                data-testid="button-generic-face"
              >
                Generic Face
              </Button>
              <Button 
                onClick={() => simulateGenericEvent("DISCIPLINE")} 
                disabled={isSimulating}
                variant="secondary"
                size="sm"
                data-testid="button-generic-discipline"
              >
                Generic Discipline
              </Button>
              <Button 
                onClick={() => simulateGenericEvent("ATTENTION")} 
                disabled={isSimulating}
                variant="secondary"
                size="sm"
                data-testid="button-generic-attention"
              >
                Generic Attention
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Log</CardTitle>
          <CardDescription>Recent webhook simulation results</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No simulations yet. Use the forms above to test camera webhooks.
            </p>
          ) : (
            <div className="space-y-2">
              {results.map((result, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm">{result.message}</span>
                  <Badge variant="outline" className="text-xs">{result.timestamp}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
