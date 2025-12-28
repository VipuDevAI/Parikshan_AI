import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ActionTile, ActionTileGroup } from "@/components/ui/action-tile";
import { 
    Upload, Download, FileSpreadsheet, Users, BookOpen, Calendar, 
    Building2, Loader2, Trash2, Eye, RefreshCw, FileText, GraduationCap
} from "lucide-react";
import type { Wing, Class, Section, Subject } from "@shared/schema";

export default function TimetableManagementPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const schoolId = user?.schoolId || 1;
    
    const [selectedWing, setSelectedWing] = useState<string>("");
    const [uploadType, setUploadType] = useState<"subjects" | "teachers" | "classes">("subjects");
    const [csvData, setCsvData] = useState<string>("");
    const [uploading, setUploading] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    
    const { data: wings } = useQuery<Wing[]>({
        queryKey: ['/api/wings'],
    });
    
    const { data: classes, refetch: refetchClasses } = useQuery<(Class & { sections: Section[] })[]>({
        queryKey: ['/api/classes'],
        queryFn: async () => {
            const classesRes = await fetch('/api/classes', { credentials: 'include' });
            if (!classesRes.ok) throw new Error('Failed to fetch classes');
            const classesData = await classesRes.json();
            
            const sectionsRes = await fetch('/api/sections', { credentials: 'include' });
            if (!sectionsRes.ok) throw new Error('Failed to fetch sections');
            const sectionsData: Section[] = await sectionsRes.json();
            
            return classesData.map((cls: Class) => ({
                ...cls,
                sections: sectionsData.filter(s => s.classId === cls.id)
            }));
        }
    });
    
    const { data: subjects, refetch: refetchSubjects } = useQuery<Subject[]>({
        queryKey: ['/api/subjects'],
    });

    const { data: teacherSubjects, refetch: refetchTeacherSubjects } = useQuery<any[]>({
        queryKey: ['/api/teacher-subjects'],
    });

    const deleteSubjectMutation = useMutation({
        mutationFn: async (id: number) => apiRequest('DELETE', `/api/subjects/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
            toast({ title: "Subject deleted" });
        },
        onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
    });

    const deleteClassMutation = useMutation({
        mutationFn: async (id: number) => apiRequest('DELETE', `/api/classes/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
            toast({ title: "Class deleted" });
        },
        onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
    });

    const parseCSV = (text: string): any[] => {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows: any[] = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((h, idx) => {
                row[h] = values[idx] || '';
            });
            rows.push(row);
        }
        
        return rows;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setCsvData(text);
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (!csvData.trim()) {
            toast({ title: "No data", description: "Please upload or paste CSV data first", variant: "destructive" });
            return;
        }
        
        setUploading(true);
        try {
            const data = parseCSV(csvData);
            if (data.length === 0) {
                throw new Error("No valid data rows found in CSV");
            }
            
            const endpoint = uploadType === "subjects" 
                ? "/api/upload/subjects"
                : uploadType === "teachers"
                ? "/api/upload/teacher-subjects"
                : "/api/upload/classes";
            
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    schoolId,
                    wingId: selectedWing ? parseInt(selectedWing) : null,
                    data
                })
            });
            
            if (!response.ok) {
                throw new Error(await response.text());
            }
            
            const result = await response.json();
            
            toast({
                title: "Upload successful",
                description: `Imported ${result.count || data.length} records`,
            });
            
            setCsvData("");
            setShowUploadForm(false);
            queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
            queryClient.invalidateQueries({ queryKey: ['/api/teacher-subjects'] });
            queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
        } catch (error: any) {
            toast({
                title: "Upload failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAllSubjects = async () => {
        if (!confirm("Delete ALL subjects? This cannot be undone.")) return;
        for (const s of subjects || []) {
            await deleteSubjectMutation.mutateAsync(s.id);
        }
    };

    const handleDeleteAllClasses = async () => {
        if (!confirm("Delete ALL classes? This cannot be undone.")) return;
        for (const c of classes || []) {
            await deleteClassMutation.mutateAsync(c.id);
        }
    };

    const handleDownloadMaster = () => {
        const wingParam = selectedWing ? `?wingId=${selectedWing}` : "";
        window.open(`/api/timetable/download/master/${schoolId}${wingParam}`, '_blank');
    };

    const handleDownloadTeachers = async () => {
        try {
            const response = await fetch(`/api/timetable/download/teachers/${schoolId}`, { credentials: "include" });
            const data = await response.json();
            
            let csv = "Teacher Name,Day,Period 1,Period 2,Period 3,Period 4,Period 5,Period 6,Period 7,Period 8\n";
            for (const teacher of data) {
                for (const day of teacher.schedule) {
                    csv += `"${teacher.teacherName}",${day.day}`;
                    for (let p = 1; p <= 8; p++) {
                        csv += `,"${day[`period${p}`] || 'Free'}"`;
                    }
                    csv += "\n";
                }
            }
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'all_teachers_timetable.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            toast({ title: "Download failed", description: error.message, variant: "destructive" });
        }
    };

    const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "CORRESPONDENT" || user?.role === "PRINCIPAL";

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold" data-testid="text-page-title">Timetable Management</h1>
                    <p className="text-muted-foreground">Upload, manage and download timetables</p>
                </div>
                <Select value={selectedWing} onValueChange={setSelectedWing}>
                    <SelectTrigger className="w-48" data-testid="select-wing">
                        <SelectValue placeholder="All Wings" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">All Wings</SelectItem>
                        {wings?.map(wing => (
                            <SelectItem key={wing.id} value={String(wing.id)}>{wing.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                            Upload Master Data
                        </CardTitle>
                        <CardDescription>Import subjects, teacher mappings, and classes via CSV</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <ActionTileGroup>
                            <ActionTile
                                icon={BookOpen}
                                label="UPLOAD SUBJECTS"
                                variant="success"
                                size="lg"
                                onClick={() => { setUploadType("subjects"); setShowUploadForm(true); }}
                                disabled={!canEdit}
                                data-testid="button-upload-subjects"
                            />
                            <ActionTile
                                icon={Users}
                                label="UPLOAD TEACHER-SUBJECTS"
                                variant="success"
                                size="lg"
                                onClick={() => { setUploadType("teachers"); setShowUploadForm(true); }}
                                disabled={!canEdit}
                                data-testid="button-upload-teachers"
                            />
                            <ActionTile
                                icon={GraduationCap}
                                label="UPLOAD CLASSES"
                                variant="success"
                                size="lg"
                                onClick={() => { setUploadType("classes"); setShowUploadForm(true); }}
                                disabled={!canEdit}
                                data-testid="button-upload-classes"
                            />
                        </ActionTileGroup>

                        <div className="border-t pt-4">
                            <h4 className="font-medium mb-3 text-muted-foreground">Delete Data</h4>
                            <ActionTileGroup>
                                <ActionTile
                                    icon={Trash2}
                                    label="DELETE ALL SUBJECTS"
                                    variant="danger"
                                    onClick={handleDeleteAllSubjects}
                                    disabled={!canEdit || !subjects?.length}
                                    data-testid="button-delete-subjects"
                                />
                                <ActionTile
                                    icon={Trash2}
                                    label="DELETE ALL CLASSES"
                                    variant="danger"
                                    onClick={handleDeleteAllClasses}
                                    disabled={!canEdit || !classes?.length}
                                    data-testid="button-delete-classes"
                                />
                            </ActionTileGroup>
                        </div>

                        {showUploadForm && (
                            <Card className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="secondary" className="text-sm">
                                            Uploading: {uploadType === "subjects" ? "Subjects" : uploadType === "teachers" ? "Teacher-Subject Mappings" : "Classes"}
                                        </Badge>
                                        <Button variant="ghost" size="sm" onClick={() => setShowUploadForm(false)}>Cancel</Button>
                                    </div>
                                    
                                    <div className="p-3 bg-muted rounded-md text-sm">
                                        <strong>Required columns:</strong>
                                        {uploadType === "subjects" && <code className="block mt-1">name, code, periodsPerWeek, periodsPerDay, isLab</code>}
                                        {uploadType === "teachers" && <code className="block mt-1">teacherName, subjectName</code>}
                                        {uploadType === "classes" && <code className="block mt-1">className, sectionName, roomNumber</code>}
                                    </div>

                                    <div>
                                        <Label>Choose CSV File</Label>
                                        <Input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="mt-1" data-testid="input-csv-file" />
                                    </div>

                                    <div>
                                        <Label>Or paste CSV data</Label>
                                        <textarea
                                            className="w-full h-32 p-3 mt-1 border rounded-md font-mono text-sm bg-background"
                                            placeholder="Paste CSV data here..."
                                            value={csvData}
                                            onChange={(e) => setCsvData(e.target.value)}
                                            data-testid="textarea-csv-data"
                                        />
                                    </div>

                                    <Button onClick={handleUpload} disabled={uploading || !csvData.trim()} className="w-full" data-testid="button-upload-submit">
                                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                        Upload Data
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="w-5 h-5 text-blue-600" />
                            Download Timetables
                        </CardTitle>
                        <CardDescription>Export schedules as CSV</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ActionTileGroup className="flex-col">
                            <ActionTile
                                icon={Building2}
                                label="MASTER TIMETABLE"
                                variant="info"
                                size="lg"
                                onClick={handleDownloadMaster}
                                className="w-full"
                                data-testid="button-download-master"
                            />
                            <ActionTile
                                icon={Users}
                                label="ALL TEACHERS"
                                variant="info"
                                size="lg"
                                onClick={handleDownloadTeachers}
                                className="w-full"
                                data-testid="button-download-teachers"
                            />
                        </ActionTileGroup>

                        <div className="border-t pt-4">
                            <h4 className="font-medium mb-2 text-sm text-muted-foreground">Download by Section</h4>
                            <div className="max-h-48 overflow-y-auto space-y-2">
                                {classes?.map(cls => (
                                    <div key={cls.id} className="space-y-1">
                                        <p className="font-medium text-xs text-muted-foreground">{cls.name}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {cls.sections.map(section => (
                                                <Button
                                                    key={section.id}
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => window.open(`/api/timetable/download/section/${section.id}`, '_blank')}
                                                    data-testid={`button-download-section-${section.id}`}
                                                >
                                                    {section.name}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Current Data Summary
                        </CardTitle>
                        <CardDescription>Overview of uploaded configuration</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { refetchSubjects(); refetchClasses(); refetchTeacherSubjects(); }}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 text-center">
                            <div className="text-3xl font-bold text-emerald-600">{subjects?.length || 0}</div>
                            <div className="text-sm text-muted-foreground">Subjects</div>
                        </Card>
                        <Card className="p-4 text-center">
                            <div className="text-3xl font-bold text-blue-600">{teacherSubjects?.length || 0}</div>
                            <div className="text-sm text-muted-foreground">Teacher-Subject Maps</div>
                        </Card>
                        <Card className="p-4 text-center">
                            <div className="text-3xl font-bold text-purple-600">{classes?.length || 0}</div>
                            <div className="text-sm text-muted-foreground">Classes</div>
                        </Card>
                        <Card className="p-4 text-center">
                            <div className="text-3xl font-bold text-amber-600">{classes?.reduce((acc, c) => acc + (c.sections?.length || 0), 0) || 0}</div>
                            <div className="text-sm text-muted-foreground">Sections</div>
                        </Card>
                    </div>

                    {subjects && subjects.length > 0 && (
                        <div className="mt-6">
                            <h4 className="font-medium mb-3">Subjects List</h4>
                            <div className="flex flex-wrap gap-2">
                                {subjects.map(s => (
                                    <Badge key={s.id} variant="secondary" className="gap-1">
                                        {s.name}
                                        {canEdit && (
                                            <button 
                                                onClick={() => deleteSubjectMutation.mutate(s.id)} 
                                                className="ml-1 text-red-500 hover:text-red-700"
                                                data-testid={`button-delete-subject-${s.id}`}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
