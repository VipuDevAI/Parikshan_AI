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
import { Separator } from "@/components/ui/separator";
import { 
    Upload, Download, FileSpreadsheet, Users, BookOpen, Calendar, 
    Building2, Loader2, Check, AlertCircle, RefreshCw
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
    
    const { data: wings, isLoading: wingsLoading } = useQuery<Wing[]>({
        queryKey: ['/api/wings'],
    });
    
    const { data: classes, isLoading: classesLoading } = useQuery<(Class & { sections: Section[] })[]>({
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
    
    const { data: subjects, isLoading: subjectsLoading } = useQuery<Subject[]>({
        queryKey: ['/api/subjects'],
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
            queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
            queryClient.invalidateQueries({ queryKey: ['/api/teacher-subjects'] });
            queryClient.invalidateQueries({ queryKey: ['/api/academic/classes'] });
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

    const handleDownloadMaster = async () => {
        const wingParam = selectedWing ? `?wingId=${selectedWing}` : "";
        window.open(`/api/timetable/download/master/${schoolId}${wingParam}`, '_blank');
    };

    const handleDownloadTeachers = async () => {
        try {
            const response = await fetch(`/api/timetable/download/teachers/${schoolId}`);
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
            toast({
                title: "Download failed",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    const handleDownloadSection = (sectionId: number, className: string, sectionName: string) => {
        window.open(`/api/timetable/download/section/${sectionId}`, '_blank');
    };

    const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "CORRESPONDENT" || user?.role === "PRINCIPAL";

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold" data-testid="text-page-title">Timetable Management</h1>
                    <p className="text-muted-foreground">Upload data, generate and download timetables</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
            </div>

            <Tabs defaultValue="upload" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="upload" data-testid="tab-upload">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Data
                    </TabsTrigger>
                    <TabsTrigger value="download" data-testid="tab-download">
                        <Download className="w-4 h-4 mr-2" />
                        Download Timetables
                    </TabsTrigger>
                    <TabsTrigger value="subjects" data-testid="tab-subjects">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Subjects
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5" />
                                CSV/Excel Upload
                            </CardTitle>
                            <CardDescription>
                                Upload teacher-subject mappings, subjects, or class/section data from CSV files
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Upload Type</Label>
                                <Select value={uploadType} onValueChange={(v: any) => setUploadType(v)}>
                                    <SelectTrigger data-testid="select-upload-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="subjects">Subjects (with periods per week/day, lab info)</SelectItem>
                                        <SelectItem value="teachers">Teacher-Subject Mappings</SelectItem>
                                        <SelectItem value="classes">Classes and Sections (7-13 sections support)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {uploadType === "subjects" && (
                                <div className="p-4 bg-muted rounded-md space-y-2">
                                    <p className="font-medium">Required CSV columns:</p>
                                    <code className="text-sm block">name, code, periodsPerWeek, periodsPerDay, isLab, languageGroup, streamGroup, isLightSubject</code>
                                    <p className="text-sm text-muted-foreground">
                                        languageGroup: NONE, II_LANGUAGE, III_LANGUAGE | streamGroup: NONE, SCIENCE, COMMERCE, HUMANITIES
                                    </p>
                                </div>
                            )}

                            {uploadType === "teachers" && (
                                <div className="p-4 bg-muted rounded-md space-y-2">
                                    <p className="font-medium">Required CSV columns:</p>
                                    <code className="text-sm block">teacherName, subjectName</code>
                                    <p className="text-sm text-muted-foreground">
                                        Teacher names should match exactly with existing teacher records
                                    </p>
                                </div>
                            )}

                            {uploadType === "classes" && (
                                <div className="p-4 bg-muted rounded-md space-y-2">
                                    <p className="font-medium">Required CSV columns:</p>
                                    <code className="text-sm block">className, sectionName, roomNumber</code>
                                    <p className="text-sm text-muted-foreground">
                                        Supports Roman numerals (VI, IX, XII) and formats like "VI A1", "IX A5", "XII A8"
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Upload CSV File</Label>
                                <Input 
                                    type="file" 
                                    accept=".csv,.txt"
                                    onChange={handleFileUpload}
                                    disabled={!canEdit}
                                    data-testid="input-csv-file"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Or paste CSV data directly</Label>
                                <textarea
                                    className="w-full h-40 p-3 border rounded-md font-mono text-sm"
                                    placeholder="name,code,periodsPerWeek,periodsPerDay,isLab&#10;Mathematics,MATH,6,2,No&#10;Science,SCI,5,1,Yes"
                                    value={csvData}
                                    onChange={(e) => setCsvData(e.target.value)}
                                    disabled={!canEdit}
                                    data-testid="textarea-csv-data"
                                />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button 
                                onClick={handleUpload} 
                                disabled={!canEdit || uploading || !csvData.trim()}
                                data-testid="button-upload"
                            >
                                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                Upload Data
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="download" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="w-5 h-5" />
                                    Master Timetable
                                </CardTitle>
                                <CardDescription>
                                    Full wing timetable with all classes and sections
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Downloads complete timetable for {selectedWing ? `selected wing` : `all wings`}
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleDownloadMaster} data-testid="button-download-master">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Master
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    All Teachers Timetable
                                </CardTitle>
                                <CardDescription>
                                    Bulk download all teacher timetables
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Single CSV with every teacher's weekly schedule
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleDownloadTeachers} data-testid="button-download-teachers">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download All Teachers
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5" />
                                    Class-Section Timetables
                                </CardTitle>
                                <CardDescription>
                                    Download individual class timetables
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="max-h-60 overflow-y-auto space-y-2">
                                {classes?.map(cls => (
                                    <div key={cls.id} className="space-y-1">
                                        <p className="font-medium text-sm">{cls.name}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {cls.sections.map(section => (
                                                <Button
                                                    key={section.id}
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDownloadSection(section.id, cls.name, section.name)}
                                                    data-testid={`button-download-section-${section.id}`}
                                                >
                                                    {section.name}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {!classes?.length && (
                                    <p className="text-sm text-muted-foreground">No classes found</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="subjects" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Configured Subjects
                            </CardTitle>
                            <CardDescription>
                                All subjects with their timetable configuration
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {subjects?.map(subject => (
                                    <Card key={subject.id} className="p-4">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <h4 className="font-medium">{subject.name}</h4>
                                                {subject.code && <p className="text-sm text-muted-foreground">{subject.code}</p>}
                                            </div>
                                            <div className="flex gap-1 flex-wrap">
                                                {subject.isLab && <Badge variant="secondary">Lab</Badge>}
                                                {subject.isLightSubject && <Badge variant="outline">Light</Badge>}
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p>{subject.periodsPerWeek} periods/week, {subject.periodsPerDay} per day</p>
                                            {subject.languageGroup !== "NONE" && (
                                                <Badge variant="outline">{subject.languageGroup}</Badge>
                                            )}
                                            {subject.streamGroup !== "NONE" && (
                                                <Badge variant="outline">{subject.streamGroup}</Badge>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                                {!subjects?.length && (
                                    <p className="text-muted-foreground col-span-full">
                                        No subjects configured. Upload subjects using the Upload tab.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
