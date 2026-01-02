import { useState, useRef, useEffect, useMemo } from "react";
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
import { Progress } from "@/components/ui/progress";
import { 
    Loader2, Camera, Upload, Users, Search, Trash2, 
    UserCheck, AlertCircle, CheckCircle, Image, FolderUp, GraduationCap, Briefcase, X, Eye
} from "lucide-react";
import { ActionTile, ActionTileGroup } from "@/components/ui/action-tile";
import type { Wing, Class, Section, Student, FaceEncoding } from "@shared/schema";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Person search result types
type StudentResult = {
    id: number;
    type: 'STUDENT';
    fullName: string;
    identifier: string;
    classSection: string;
    wing: string;
    sectionId: number;
};

type StaffResult = {
    id: number;
    type: 'STAFF';
    fullName: string;
    identifier: string;
    role: string;
    wing: string;
    designation: string;
};

type PersonResult = StudentResult | StaffResult;

export default function FaceRegistrationPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const quickSearchInputRef = useRef<HTMLInputElement>(null);
    
    const [selectedWing, setSelectedWing] = useState<string>("all");
    const [selectedClass, setSelectedClass] = useState<string>("all");
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("individual");
    
    // Quick search state
    const [quickSearchTerm, setQuickSearchTerm] = useState("");
    const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState("");
    
    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(quickSearchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [quickSearchTerm]);
    
    // Search query
    const { data: searchResults, isLoading: searchLoading } = useQuery<{ students: StudentResult[]; staff: StaffResult[] }>({
        queryKey: ['/api/search/persons', debouncedSearch],
        queryFn: async () => {
            if (debouncedSearch.length < 2) return { students: [], staff: [] };
            const res = await fetch(`/api/search/persons?q=${encodeURIComponent(debouncedSearch)}`, { credentials: 'include' });
            if (!res.ok) return { students: [], staff: [] };
            return res.json();
        },
        enabled: debouncedSearch.length >= 2
    });
    
    const schoolId = user?.schoolId || 1;
    
    const { data: wings, isLoading: wingsLoading, isError: wingsError } = useQuery<Wing[]>({
        queryKey: ['/api/wings'],
    });
    
    const { data: classes, isLoading: classesLoading, isError: classesError } = useQuery<Class[]>({
        queryKey: ['/api/classes'],
    });
    
    const { data: sections, isLoading: sectionsLoading, isError: sectionsError } = useQuery<Section[]>({
        queryKey: ['/api/sections'],
    });
    
    const { data: students, isLoading: studentsLoading, isError: studentsError } = useQuery<Student[]>({
        queryKey: ['/api/students'],
    });
    
    const { data: faceEncodings, isLoading: encodingsLoading } = useQuery<FaceEncoding[]>({
        queryKey: ['/api/face-encodings', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/face-encodings/${schoolId}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch face encodings');
            const data = await res.json();
            // API returns { encodings: [], totalCount: 0 } - extract the array
            return Array.isArray(data) ? data : (data.encodings || []);
        },
        enabled: !!schoolId
    });
    
    // Check loading/error states BEFORE any derived computations
    const isDataLoading = wingsLoading || classesLoading || sectionsLoading || studentsLoading;
    const hasDataError = wingsError || classesError || sectionsError || studentsError;
    const isDataReady = wings && classes && sections && students;
    
    // Derived computations - only computed when data is ready (safe due to useMemo deps)
    const filteredClasses = useMemo(() => {
        if (!classes) return [];
        return classes.filter(c => selectedWing === "all" || c.wingId === parseInt(selectedWing));
    }, [classes, selectedWing]);
    
    const filteredSections = useMemo(() => {
        if (!sections) return [];
        return sections.filter(s => selectedClass === "all" || s.classId === parseInt(selectedClass));
    }, [sections, selectedClass]);
    
    const filteredStudents = useMemo(() => {
        if (!students || !sections || !classes) return [];
        return students.filter(s => {
            const section = sections.find(sec => sec.id === s.sectionId);
            const classItem = section ? classes.find(c => c.id === section.classId) : null;
            
            if (selectedSection !== "all" && s.sectionId !== parseInt(selectedSection)) return false;
            if (selectedClass !== "all" && section?.classId !== parseInt(selectedClass)) return false;
            if (selectedWing !== "all" && classItem?.wingId !== parseInt(selectedWing)) return false;
            if (searchTerm && !s.fullName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            
            return true;
        });
    }, [students, sections, classes, selectedSection, selectedClass, selectedWing, searchTerm]);
    
    const studentEncodingMap = useMemo(() => {
        if (!Array.isArray(faceEncodings)) return new Map();
        return new Map(faceEncodings.filter(e => e.entityType === 'STUDENT').map(e => [e.entityId, e]));
    }, [faceEncodings]);
    
    const registeredCount = Array.isArray(faceEncodings) ? faceEncodings.filter(e => e.entityType === 'STUDENT').length : 0;
    const totalStudents = students?.length || 0;
    const registrationProgress = totalStudents > 0 ? (registeredCount / totalStudents) * 100 : 0;
    
    const createEncodingMutation = useMutation({
        mutationFn: async (data: { entityType: string; entityId: number; sectionId?: number; encoding: string; photoUrl?: string }) => {
            return apiRequest('POST', '/api/face-encodings', { ...data, schoolId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/face-encodings', schoolId] });
        },
    });
    
    const deleteEncodingMutation = useMutation({
        mutationFn: async (id: number) => {
            return apiRequest('DELETE', `/api/face-encodings/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/face-encodings', schoolId] });
            toast({ title: "Face Removed", description: "Face registration has been removed." });
        },
    });
    
    const handleSingleUpload = async (studentId: number, sectionId: number, file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            try {
                await createEncodingMutation.mutateAsync({
                    entityType: 'STUDENT',
                    entityId: studentId,
                    sectionId,
                    encoding: base64.split(',')[1] || base64,
                    photoUrl: base64,
                });
                toast({ title: "Face Registered", description: "Student face has been registered successfully." });
            } catch (error) {
                toast({ title: "Registration Failed", description: "Could not register face.", variant: "destructive" });
            }
        };
        reader.readAsDataURL(file);
    };
    
    // Handle quick register upload for selected person
    const handleQuickUpload = async (file: File) => {
        if (!selectedPerson) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            try {
                await createEncodingMutation.mutateAsync({
                    entityType: selectedPerson.type,
                    entityId: selectedPerson.id,
                    sectionId: selectedPerson.type === 'STUDENT' ? (selectedPerson as StudentResult).sectionId : undefined,
                    encoding: base64.split(',')[1] || base64,
                    photoUrl: base64,
                });
                toast({ title: "Face Registered", description: `${selectedPerson.fullName}'s face has been registered.` });
                setSelectedPerson(null);
                setQuickSearchTerm("");
            } catch (error) {
                toast({ title: "Registration Failed", description: "Could not register face.", variant: "destructive" });
            }
        };
        reader.readAsDataURL(file);
    };
    
    // Select a person from search results
    const handleSelectPerson = (person: PersonResult) => {
        setSelectedPerson(person);
        setShowSearchResults(false);
        setQuickSearchTerm("");
    };
    
    const handleBulkUpload = async () => {
        if (selectedFiles.length === 0) {
            toast({ title: "No Files", description: "Please select files to upload.", variant: "destructive" });
            return;
        }
        
        setIsUploading(true);
        setUploadProgress(0);
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const fileName = file.name.replace(/\.[^/.]+$/, "").toLowerCase();
            
            const matchingStudent = filteredStudents.find(s => 
                s.rollNumber?.toLowerCase() === fileName || 
                s.fullName.toLowerCase().replace(/\s+/g, '_') === fileName ||
                s.fullName.toLowerCase().replace(/\s+/g, '') === fileName
            );
            
            if (matchingStudent) {
                const reader = new FileReader();
                await new Promise<void>((resolve) => {
                    reader.onload = async (e) => {
                        const base64 = e.target?.result as string;
                        try {
                            await createEncodingMutation.mutateAsync({
                                entityType: 'STUDENT',
                                entityId: matchingStudent.id,
                                sectionId: matchingStudent.sectionId,
                                encoding: base64.split(',')[1] || base64,
                                photoUrl: base64,
                            });
                            successCount++;
                        } catch {
                            failCount++;
                        }
                        resolve();
                    };
                    reader.onerror = () => {
                        failCount++;
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            } else {
                failCount++;
            }
            
            setUploadProgress(((i + 1) / selectedFiles.length) * 100);
        }
        
        setIsUploading(false);
        setSelectedFiles([]);
        if (bulkFileInputRef.current) {
            bulkFileInputRef.current.value = '';
        }
        
        toast({
            title: "Bulk Upload Complete",
            description: `Registered ${successCount} faces. ${failCount > 0 ? `${failCount} failed to match.` : ''}`,
        });
    };
    
    const getStudentDisplayInfo = (student: Student) => {
        const section = sections?.find(s => s.id === student.sectionId);
        const classItem = section ? classes?.find(c => c.id === section.classId) : null;
        return `${classItem?.name || 'Unknown'} - ${section?.name || 'Unknown'}`;
    };

    const handleDeleteAllFaces = async () => {
        setIsDeletingAll(true);
        try {
            for (const e of faceEncodings || []) {
                await deleteEncodingMutation.mutateAsync(e.id);
            }
            toast({ title: "All faces deleted" });
        } catch (error: any) {
            toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        } finally {
            setIsDeletingAll(false);
        }
    };
    
    // Error guard - show error state if data fetch failed
    if (hasDataError) {
        return (
            <div className="flex-1 flex items-center justify-center h-full p-8">
                <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
                    <p className="text-destructive font-medium">Failed to load data</p>
                    <p className="text-muted-foreground mt-1">Please refresh the page or try again later.</p>
                </div>
            </div>
        );
    }
    
    // Loading guard - prevent blank page from undefined data
    if (isDataLoading || !isDataReady) {
        return (
            <div className="flex-1 flex items-center justify-center h-full p-8">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading face registration data...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6" data-testid="page-face-registration">
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold" data-testid="text-page-title">Face Registration</h1>
                        <p className="text-muted-foreground">Register and manage student faces for AI attendance</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span data-testid="text-registered-count">{registeredCount} Registered</span>
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" />
                            <span data-testid="text-total-students">{totalStudents} Total Students</span>
                        </Badge>
                    </div>
                </div>
                
                <Card className="p-4">
                    <ActionTileGroup>
                        <ActionTile
                            icon={Camera}
                            label="Individual Registration"
                            variant="primary"
                            size="lg"
                            onClick={() => setActiveTab("individual")}
                            data-testid="tile-individual"
                        />
                        <ActionTile
                            icon={FolderUp}
                            label="Bulk Upload"
                            variant="success"
                            size="lg"
                            onClick={() => setActiveTab("bulk")}
                            data-testid="tile-bulk"
                        />
                        <ActionTile
                            icon={Eye}
                            label="View Registrations"
                            variant="info"
                            size="lg"
                            onClick={() => setActiveTab("manage")}
                            data-testid="tile-manage"
                        />
                        <ActionTile
                            icon={isDeletingAll ? Loader2 : Trash2}
                            label="Delete All Faces"
                            variant="danger"
                            size="lg"
                            disabled={!registeredCount || isDeletingAll}
                            onClick={() => setDeleteAllDialogOpen(true)}
                            data-testid="tile-delete-all-faces"
                        />
                    </ActionTileGroup>
                </Card>
            </div>

            <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Face Registrations?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete {registeredCount} face registration(s). This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { handleDeleteAllFaces(); setDeleteAllDialogOpen(false); }}>Delete All</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Card className="glass-card glow-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Registration Progress</CardTitle>
                    <CardDescription>Overall face registration status for your school</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span>{registeredCount} of {totalStudents} students registered</span>
                            <span className="font-medium">{registrationProgress.toFixed(1)}%</span>
                        </div>
                        <Progress value={registrationProgress} className="h-2" data-testid="progress-registration" />
                    </div>
                </CardContent>
            </Card>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="hidden">
                    <TabsTrigger value="individual" />
                    <TabsTrigger value="bulk" />
                    <TabsTrigger value="manage" />
                </TabsList>
                
                <TabsContent value="individual" className="space-y-4">
                    {/* Quick Register by Name Search */}
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Search className="w-5 h-5" />
                                Quick Register by Name
                            </CardTitle>
                            <CardDescription>
                                Search for a student or staff member by name. If multiple people share the same name, select the correct one from the list.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    ref={quickSearchInputRef}
                                    placeholder="Type a name to search (e.g., Arjun Kumar)..."
                                    className="pl-9"
                                    value={quickSearchTerm}
                                    onChange={(e) => {
                                        setQuickSearchTerm(e.target.value);
                                        setShowSearchResults(e.target.value.length >= 2);
                                    }}
                                    onFocus={() => setShowSearchResults(quickSearchTerm.length >= 2)}
                                    data-testid="input-quick-search"
                                />
                                
                                {/* Search Results Dropdown */}
                                {showSearchResults && quickSearchTerm.length >= 2 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                                        {searchLoading ? (
                                            <div className="p-4 text-center">
                                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                            </div>
                                        ) : (
                                            <>
                                                {(searchResults?.students?.length || 0) + (searchResults?.staff?.length || 0) === 0 ? (
                                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                                        No matching persons found
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Students Section */}
                                                        {(searchResults?.students?.length || 0) > 0 && (
                                                            <div>
                                                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted flex items-center gap-1">
                                                                    <GraduationCap className="w-3 h-3" /> Students
                                                                </div>
                                                                {searchResults?.students?.map((s) => (
                                                                    <div
                                                                        key={`student-${s.id}`}
                                                                        className="px-3 py-2 hover-elevate cursor-pointer flex items-center justify-between gap-2"
                                                                        onClick={() => handleSelectPerson(s)}
                                                                        data-testid={`result-student-${s.id}`}
                                                                    >
                                                                        <div>
                                                                            <p className="font-medium">{s.fullName}</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {s.identifier} | {s.classSection} | {s.wing}
                                                                            </p>
                                                                        </div>
                                                                        <Badge variant="secondary" className="text-xs">Student</Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* Staff Section */}
                                                        {(searchResults?.staff?.length || 0) > 0 && (
                                                            <div>
                                                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted flex items-center gap-1">
                                                                    <Briefcase className="w-3 h-3" /> Staff
                                                                </div>
                                                                {searchResults?.staff?.map((u) => (
                                                                    <div
                                                                        key={`staff-${u.id}`}
                                                                        className="px-3 py-2 hover-elevate cursor-pointer flex items-center justify-between gap-2"
                                                                        onClick={() => handleSelectPerson(u)}
                                                                        data-testid={`result-staff-${u.id}`}
                                                                    >
                                                                        <div>
                                                                            <p className="font-medium">{u.fullName}</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {u.identifier} | {u.designation} | {u.wing}
                                                                            </p>
                                                                        </div>
                                                                        <Badge variant="outline" className="text-xs">{u.role}</Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Selected Person Card */}
                            {selectedPerson && (
                                <div className="border rounded-md p-4 bg-muted/50">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                {selectedPerson.type === 'STUDENT' ? (
                                                    <GraduationCap className="w-6 h-6 text-primary" />
                                                ) : (
                                                    <Briefcase className="w-6 h-6 text-primary" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{selectedPerson.fullName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {selectedPerson.type === 'STUDENT' 
                                                        ? `${(selectedPerson as StudentResult).classSection} | ${selectedPerson.identifier}`
                                                        : `${(selectedPerson as StaffResult).designation} | ${selectedPerson.identifier}`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleQuickUpload(file);
                                                    }}
                                                    data-testid="input-quick-photo"
                                                />
                                                <Button asChild>
                                                    <span>
                                                        <Camera className="w-4 h-4 mr-2" />
                                                        Upload Photo
                                                    </span>
                                                </Button>
                                            </label>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => setSelectedPerson(null)}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-lg">Filter Students</CardTitle>
                            <CardDescription>Or browse by class and section to filter students</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Wing</Label>
                                    <Select value={selectedWing} onValueChange={setSelectedWing}>
                                        <SelectTrigger data-testid="select-wing">
                                            <SelectValue placeholder="All Wings" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Wings</SelectItem>
                                            {wings?.map(w => (
                                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Class</Label>
                                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection("all"); }}>
                                        <SelectTrigger data-testid="select-class">
                                            <SelectValue placeholder="All Classes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Classes</SelectItem>
                                            {filteredClasses.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Section</Label>
                                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                                        <SelectTrigger data-testid="select-section">
                                            <SelectValue placeholder="All Sections" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Sections</SelectItem>
                                            {filteredSections.map(s => (
                                                <SelectItem key={s.id} value={s.id.toString()}>Section {s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Search</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                        <Input 
                                            placeholder="Search by name..." 
                                            className="pl-9" 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            data-testid="input-search"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-lg">Students ({filteredStudents.length})</CardTitle>
                            <CardDescription>Click on a student to register their face</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                {encodingsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    </div>
                                ) : filteredStudents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                        <Users className="w-12 h-12 mb-2 opacity-50" />
                                        <p>No students found</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filteredStudents.map(student => {
                                            const encoding = studentEncodingMap.get(student.id);
                                            const isRegistered = !!encoding;
                                            
                                            return (
                                                <div 
                                                    key={student.id}
                                                    className="flex items-center gap-3 p-3 rounded-md border bg-card hover-elevate"
                                                    data-testid={`card-student-${student.id}`}
                                                >
                                                    <div className="relative">
                                                        {encoding?.photoUrl ? (
                                                            <img 
                                                                src={encoding.photoUrl} 
                                                                alt={student.fullName}
                                                                className="w-12 h-12 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                                                <Users className="w-6 h-6 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                        {isRegistered && (
                                                            <CheckCircle className="absolute -bottom-1 -right-1 w-4 h-4 text-green-500 bg-background rounded-full" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate" data-testid={`text-student-name-${student.id}`}>
                                                            {student.fullName}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {student.rollNumber || 'No Roll'} | {getStudentDisplayInfo(student)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {isRegistered ? (
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost"
                                                                onClick={() => encoding && deleteEncodingMutation.mutate(encoding.id)}
                                                                data-testid={`button-delete-${student.id}`}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                        ) : (
                                                            <label>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleSingleUpload(student.id, student.sectionId, file);
                                                                    }}
                                                                    data-testid={`input-photo-${student.id}`}
                                                                />
                                                                <Button size="icon" variant="outline" asChild>
                                                                    <span>
                                                                        <Camera className="w-4 h-4" />
                                                                    </span>
                                                                </Button>
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="bulk" className="space-y-4">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FolderUp className="w-5 h-5" />
                                Bulk Face Upload
                            </CardTitle>
                            <CardDescription>
                                Upload multiple photos at once. Name files by roll number or student name (e.g., "101.jpg" or "john_doe.jpg")
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Filter by Wing (Optional)</Label>
                                    <Select value={selectedWing} onValueChange={setSelectedWing}>
                                        <SelectTrigger data-testid="bulk-select-wing">
                                            <SelectValue placeholder="All Wings" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Wings</SelectItem>
                                            {wings?.map(w => (
                                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Filter by Class (Optional)</Label>
                                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection("all"); }}>
                                        <SelectTrigger data-testid="bulk-select-class">
                                            <SelectValue placeholder="All Classes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Classes</SelectItem>
                                            {filteredClasses.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Filter by Section (Optional)</Label>
                                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                                        <SelectTrigger data-testid="bulk-select-section">
                                            <SelectValue placeholder="All Sections" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Sections</SelectItem>
                                            {filteredSections.map(s => (
                                                <SelectItem key={s.id} value={s.id.toString()}>Section {s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <div className="border-2 border-dashed rounded-lg p-8 text-center">
                                <input
                                    ref={bulkFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                                    data-testid="input-bulk-files"
                                />
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-4 bg-muted rounded-full">
                                        <Image className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Drag and drop photos here, or click to browse</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Supports JPG, PNG. Max 10MB per file.
                                        </p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => bulkFileInputRef.current?.click()}
                                        data-testid="button-browse-files"
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Browse Files
                                    </Button>
                                </div>
                            </div>
                            
                            {selectedFiles.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-medium">{selectedFiles.length} files selected</p>
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => {
                                                setSelectedFiles([]);
                                                if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
                                            }}
                                            data-testid="button-clear-files"
                                        >
                                            Clear All
                                        </Button>
                                    </div>
                                    <ScrollArea className="h-[150px] border rounded-md p-2">
                                        <div className="space-y-1">
                                            {selectedFiles.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between text-sm py-1">
                                                    <span className="truncate">{file.name}</span>
                                                    <span className="text-muted-foreground">
                                                        {(file.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                            
                            {isUploading && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Uploading...</span>
                                        <span>{uploadProgress.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={uploadProgress} className="h-2" />
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button 
                                className="w-full" 
                                onClick={handleBulkUpload}
                                disabled={selectedFiles.length === 0 || isUploading}
                                data-testid="button-start-upload"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Start Bulk Upload
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                    
                    <Card className="glass-card">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                File Naming Guide
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <p className="font-medium">By Roll Number</p>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                        <li>101.jpg</li>
                                        <li>102.png</li>
                                        <li>A101.jpg</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <p className="font-medium">By Student Name</p>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                        <li>john_doe.jpg</li>
                                        <li>jane_smith.png</li>
                                        <li>rahulkumar.jpg</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="manage" className="space-y-4">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-lg">Registered Faces ({registeredCount})</CardTitle>
                            <CardDescription>View and manage all registered faces</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div className="space-y-2">
                                    <Label>Wing</Label>
                                    <Select value={selectedWing} onValueChange={setSelectedWing}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Wings" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Wings</SelectItem>
                                            {wings?.map(w => (
                                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Class</Label>
                                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection("all"); }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Classes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Classes</SelectItem>
                                            {filteredClasses.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Section</Label>
                                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Sections" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Sections</SelectItem>
                                            {filteredSections.map(s => (
                                                <SelectItem key={s.id} value={s.id.toString()}>Section {s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Search</Label>
                                    <Input 
                                        placeholder="Search..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <ScrollArea className="h-[400px]">
                                {encodingsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {filteredStudents
                                            .filter(s => studentEncodingMap.has(s.id))
                                            .map(student => {
                                                const encoding = studentEncodingMap.get(student.id)!;
                                                return (
                                                    <div 
                                                        key={student.id}
                                                        className="relative group"
                                                        data-testid={`registered-${student.id}`}
                                                    >
                                                        {encoding.photoUrl ? (
                                                            <img 
                                                                src={encoding.photoUrl} 
                                                                alt={student.fullName}
                                                                className="w-full aspect-square rounded-md object-cover border"
                                                            />
                                                        ) : (
                                                            <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center border">
                                                                <Users className="w-8 h-8 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex flex-col items-center justify-center p-2">
                                                            <p className="text-white text-sm font-medium text-center truncate w-full">
                                                                {student.fullName}
                                                            </p>
                                                            <p className="text-white/70 text-xs">
                                                                {student.rollNumber}
                                                            </p>
                                                            <Button 
                                                                size="sm" 
                                                                variant="destructive"
                                                                className="mt-2"
                                                                onClick={() => deleteEncodingMutation.mutate(encoding.id)}
                                                            >
                                                                <Trash2 className="w-3 h-3 mr-1" />
                                                                Remove
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
