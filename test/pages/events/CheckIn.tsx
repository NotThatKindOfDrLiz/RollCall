import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ScanQrCode, Copy, Check, ClipboardCheck, Info, ExternalLink } from "lucide-react";
import { LoginArea } from "@/components/auth/LoginArea";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import QrScanner from 'qr-scanner';
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useChorusGroups } from "@/hooks/useChorusGroups";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type EventRoom = {
  id: string;
  pubkey: string;
  eventId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  location?: string;
  organizer?: string;
  image?: string;
  website?: string;
  category?: string;
  credential?: string;
  requiredFields: string[];
  customFields: Array<{
    name: string;
    required: boolean;
  }>;
};

const CheckinSchema = z.object({
  eventCode: z.string().min(1, "Event code is required"),
});

export default function CheckIn() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const [scannerActive, setScannerActive] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [scanner, setScanner] = useState<QrScanner | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [eventCode, setEventCode] = useState<string>(eventId || "");
  const [event, setEvent] = useState<EventRoom | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [checkedIn, setCheckedIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [shareToCommunity, setShareToCommunity] = useState(false);
  const [communityId, setCommunityId] = useState("");
  const chorusGroups = useChorusGroups(user?.pubkey);

  const checkInForm = useForm({
    resolver: zodResolver(CheckinSchema),
    defaultValues: {
      eventCode: eventId || "",
    },
  });

  // Check if camera is available
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasCamera(videoDevices.length > 0);
      } catch (err) {
        console.error("Error checking for camera:", err);
        setHasCamera(false);
      }
    };
    
    checkCamera();
  }, []);

  // Initialize QR scanner
  useEffect(() => {
    if (videoElement && hasCamera && scannerActive) {
      const qrScanner = new QrScanner(
        videoElement,
        result => {
          const url = result.data;
          // Extract event code from URL or direct code
          let code = url;
          
          // If it's a URL with path parameter
          if (url.includes('/events/check-in/')) {
            const parts = url.split('/');
            code = parts[parts.length - 1];
          }
          
          setEventCode(code);
          checkInForm.setValue('eventCode', code);
          setScannerActive(false);
          qrScanner.stop();
        },
        { 
          highlightScanRegion: true, 
          highlightCodeOutline: true,
        }
      );
      
      qrScanner.start().catch(err => {
        console.error("Scanner error:", err);
        toast({
          title: "Camera Error",
          description: "Unable to access the camera. Please check your permissions.",
          variant: "destructive",
        });
        setScannerActive(false);
      });
      
      setScanner(qrScanner);
      
      return () => {
        qrScanner.stop();
      };
    }
  }, [videoElement, scannerActive, hasCamera, checkInForm, toast]);

  // Cleanup QR scanner
  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop();
      }
    };
  }, [scanner]);

  // Function to look up an event by its code
  const lookupEvent = useCallback(async (code: string, retryCount = 0) => {
    if (!code.trim()) return;
    
    try {
      // Set loading state
      setIsLookingUp(true);
      
      // Clear current event
      setEvent(null);
      setCheckedIn(false);
      
      // Query for event with this ID
      const filter = {
        kinds: [31110], 
        '#d': [code.trim()]
      };
      
      const events = await nostr.query([filter], { signal: AbortSignal.timeout(5000) });
      
      if (events.length === 0) {
        // If this is a retry and we still can't find it, show error
        if (retryCount > 0) {
          setIsLookingUp(false);
          toast({
            title: "Event not found",
            description: "No event found with this code. Please check and try again.",
            variant: "destructive",
          });
          return;
        }
        
        // If this is the first attempt, wait and retry once
        console.log("Event not found, retrying in 2 seconds...");
        setTimeout(() => {
          lookupEvent(code, retryCount + 1);
        }, 2000);
        return;
      }
      
      const eventData = events[0];
      const title = eventData.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Event';
      const description = eventData.tags.find(t => t[0] === 'description')?.[1] || '';
      const startTimeStr = eventData.tags.find(t => t[0] === 'start')?.[1];
      const endTimeStr = eventData.tags.find(t => t[0] === 'end')?.[1];
      const location = eventData.tags.find(t => t[0] === 'location')?.[1];
      const organizer = eventData.tags.find(t => t[0] === 'organizer')?.[1];
      const image = eventData.tags.find(t => t[0] === 'image')?.[1];
      const website = eventData.tags.find(t => t[0] === 'website')?.[1];
      const category = eventData.tags.find(t => t[0] === 'category')?.[1];
      const credential = eventData.tags.find(t => t[0] === 'credential')?.[1];
      const reqFieldsStr = eventData.tags.find(t => t[0] === 'req_fields')?.[1] || '';
      const requiredFields = reqFieldsStr ? reqFieldsStr.split(',') : [];
      const eventId = eventData.tags.find(t => t[0] === 'd')?.[1] || '';
      
      // Parse customFields from content - handle both imported and regular events
      let customFields: Array<{ name: string; required: boolean }> = [];
      try {
        if (eventData.content) {
          const contentData = JSON.parse(eventData.content);
          
          // Check if this is an imported event (has importedFrom field)
          if (contentData.importedFrom) {
            // For imported events, use the customFields array from the content
            customFields = contentData.customFields || [];
          } else {
            // For regular events, the content should be the customFields array directly
            customFields = Array.isArray(contentData) ? contentData : [];
          }
        }
      } catch (e) {
        console.error("Error parsing customFields", e);
        customFields = [];
      }
      
      const startTime = startTimeStr ? parseInt(startTimeStr) : 0;
      const endTime = endTimeStr ? parseInt(endTimeStr) : 0;
      
      // Check if event has already ended
      const now = Math.floor(Date.now() / 1000);
      if (endTime && now > endTime) {
        setIsLookingUp(false);
        toast({
          title: "Event has ended",
          description: "This event has already ended and is no longer accepting check-ins.",
          variant: "destructive",
        });
        return;
      }
      
      // Check if event hasn't started yet
      if (startTime && now < startTime) {
        setIsLookingUp(false);
        toast({
          title: "Event hasn't started",
          description: "This event hasn't started yet. Please check back later.",
          variant: "destructive",
        });
        return;
      }
      
      const eventRoom: EventRoom = {
        id: eventData.id,
        pubkey: eventData.pubkey,
        eventId,
        title,
        description,
        startTime,
        endTime,
        location,
        organizer,
        image,
        website,
        category,
        credential,
        requiredFields,
        customFields,
      };
      
      setEvent(eventRoom);
      
      // Initialize form data with required fields
      const initialData: Record<string, string> = {};
      requiredFields.forEach(field => {
        initialData[field] = '';
      });
      customFields.forEach(field => {
        if (field.required) {
          initialData[field.name] = '';
        }
      });
      setFormData(initialData);
      
      // Clear loading state
      setIsLookingUp(false);
      
    } catch (error) {
      console.error("Error looking up event:", error);
      setIsLookingUp(false);
      toast({
        title: "Error",
        description: "Failed to look up event. Please try again.",
        variant: "destructive",
      });
    }
  }, [nostr, toast]);

  // Look up event from eventCode if it changes
  useEffect(() => {
    if (eventCode) {
      checkInForm.setValue('eventCode', eventCode);
      lookupEvent(eventCode);
    }
  }, [eventCode, checkInForm, lookupEvent]);

  // Check if user has already checked in to this event
  const { data: existingCheckins, isLoading: isCheckingExisting } = useQuery({
    queryKey: ['checkins', user?.pubkey, eventCode],
    queryFn: async () => {
      if (!user || !eventCode || !event) return [];
      
      const filter = {
        kinds: [1110],
        authors: [user.pubkey],
        '#a': [`31110:${event.pubkey}:${event.eventId}`]
      };
      
      const events = await nostr.query([filter], { signal: AbortSignal.timeout(5000) });
      return events;
    },
    enabled: !!user && !!eventCode && !!event,
  });

  // Reset form when event is found
  useEffect(() => {
    if (event) {
      // Initialize form data with required fields
      const initialData: Record<string, string> = {};
      
      // If the user has already checked in, don't allow another check-in
      if (existingCheckins && existingCheckins.length > 0) {
        setCheckedIn(true);
      }
      
      setFormData(initialData);
    }
  }, [event, existingCheckins]);

  // Submit the initial form to look up an event
  const onSubmitEventCode = (data: z.infer<typeof CheckinSchema>) => {
    lookupEvent(data.eventCode);
  };
  
  // Start/stop scanner
  const toggleScanner = () => {
    setScannerActive(!scannerActive);
  };
  
  // Handle check-in form submission
  const handleCheckin = async () => {
    if (!user || !event) return;
    
    try {
      // Validate required fields
      const missingRequired: string[] = [];
      
      // Check required standard fields
      if (event.requiredFields.includes('email') && !formData.email) {
        missingRequired.push('Email');
      }
      if (event.requiredFields.includes('name') && !formData.name) {
        missingRequired.push('Name');
      }
      
      // Check required custom fields
      for (const field of event.customFields) {
        if (field.required && !formData[field.name]) {
          missingRequired.push(field.name);
        }
      }
      
      if (missingRequired.length > 0) {
        toast({
          title: "Missing required fields",
          description: `Please fill in: ${missingRequired.join(', ')}`,
          variant: "destructive",
        });
        return;
      }
      
      // Create tags for the check-in
      const checkInTags = [
        ["a", `31110:${event.pubkey}:${event.eventId}`],
        ["start", Math.floor(Date.now() / 1000).toString()]
      ];
      
      // Add optional fields if provided
      if (formData.name) checkInTags.push(["name", formData.name]);
      if (formData.email) checkInTags.push(["email", formData.email]);
      
      // Add location if available
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          
          const { latitude, longitude } = position.coords;
          checkInTags.push(["location", `${latitude},${longitude}`]);
        } catch {
          console.log("Geolocation not available or denied");
        }
      }
      
      // Add any custom fields to content as JSON
      const customData: Record<string, string> = {};
      
      for (const field of event.customFields) {
        if (formData[field.name]) {
          customData[field.name] = formData[field.name];
        }
      }
      
      // Publish the check-in event
      await createEvent({
        kind: 1110,
        content: Object.keys(customData).length ? JSON.stringify(customData) : "",
        tags: checkInTags,
      });
      
      // If community sharing is enabled, create a community post
      if (shareToCommunity && communityId) {
        try {
          const attendanceContent = `✅ **Just checked in to: ${event.title}**

📅 **Event**: ${event.title}
📍 **Location**: ${event.location || "TBD"}
👤 **Organizer**: ${event.organizer || "TBD"}

${formData.name ? `👋 **Name**: ${formData.name}` : ""}
${formData.email ? `📧 **Email**: ${formData.email}` : ""}

🎉 Excited to attend this event! 

#rollcall #event-attendance #checkin`;

          // Create community attendance post (kind 1 with community reference)
          await createEvent({
            kind: 1,
            content: attendanceContent,
            tags: [
              ["a", communityId], // Reference to the community
              ["t", "event-attendance"],
              ["t", "rollcall"],
              ["t", "checkin"],
              ["e", `31110:${event.pubkey}:${event.eventId}`], // Reference to the RollCall event
            ],
          });

          toast({
            title: "Check-in & Community Share Successful!",
            description: `You've checked in to ${event.title} and shared with the community!`,
          });
        } catch (shareError) {
          console.error("Error sharing to community:", shareError);
          toast({
            title: "Check-in Successful, Share Failed",
            description: "Check-in completed, but community share failed. You can manually share your attendance.",
          });
        }
      } else {
        toast({
          title: "Check-in successful!",
          description: `You have successfully checked in to ${event.title}`,
        });
      }
      
      setCheckedIn(true);
      
    } catch (error) {
      console.error("Check-in error:", error);
      toast({
        title: "Check-in failed",
        description: "There was a problem with your check-in. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle form field changes
  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Generate a shareable URL for this event
  const shareableUrl = `${window.location.origin}/events/check-in/${eventCode}`;
  
  // Copy URL to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container max-w-2xl py-8 px-4">
          {!user ? (
            <Card className="max-w-md mx-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-2xl">
              <CardHeader className="text-center pb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <ClipboardCheck className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">Login Required</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 text-lg">
                  Please log in to check in to events
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="mb-6 text-center text-slate-600 dark:text-slate-400 leading-relaxed">
                  You need to sign in with your Nostr identity to check in to events.
                </p>
                <LoginArea className="mx-auto w-full" />
              </CardContent>
            </Card>
          ) : !event ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent mb-4">
                  Check In to Event
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400">Scan a QR code or enter an event code to check in</p>
              </div>

              <Tabs defaultValue="scanner" className="w-full">
                <TabsList className="w-full mb-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-1 h-auto rounded-2xl border border-white/20 dark:border-slate-700/20">
                  <TabsTrigger 
                    value="scanner" 
                    className="flex-1 py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-sm font-medium transition-all duration-200"
                  >
                    QR Scanner
                  </TabsTrigger>
                  <TabsTrigger 
                    value="code" 
                    className="flex-1 py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-sm font-medium transition-all duration-200"
                  >
                    Enter Code
                  </TabsTrigger>
                </TabsList>

                {hasCamera && (
                  <TabsContent value="scanner" className="py-4">
                    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                      <CardHeader>
                        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">QR Code Scanner</CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">
                          Point your camera at the event QR code
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {scannerActive ? (
                          <div className="relative">
                            <video
                              ref={setVideoElement}
                              className="w-full h-64 object-cover rounded-xl"
                            />
                            <div className="absolute inset-0 border-2 border-blue-500/50 rounded-xl pointer-events-none"></div>
                          </div>
                        ) : (
                          <div className="h-64 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center">
                            <div className="text-center">
                              <ScanQrCode className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                              <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">Camera Ready</p>
                              <p className="text-sm text-slate-500 dark:text-slate-500">Click start to begin scanning</p>
                            </div>
                          </div>
                        )}
                        <Button 
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                          onClick={toggleScanner}
                          variant={scannerActive ? "secondary" : "default"}
                          size="lg"
                        >
                          <ScanQrCode className="mr-2 h-5 w-5" />
                          {scannerActive ? 'Stop Scanner' : 'Start Scanner'}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}
                
                <TabsContent value="code" className="py-4">
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">Enter Event Code</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400">
                        Enter the code provided by the event organizer
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...checkInForm}>
                        <form onSubmit={checkInForm.handleSubmit(onSubmitEventCode)} className="space-y-6">
                          <FormField
                            control={checkInForm.control}
                            name="eventCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">Event Code</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter event code" 
                                    {...field} 
                                    className="h-12 text-lg border-slate-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                            size="lg"
                            disabled={isLookingUp}
                          >
                            {isLookingUp ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Looking up event...
                              </>
                            ) : (
                              'Find Event'
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : isCheckingExisting ? (
            <div className="space-y-6 py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Checking Attendance</h2>
                <p className="text-slate-600 dark:text-slate-400">Verifying your check-in status...</p>
              </div>
            </div>
          ) : checkedIn ? (
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-2xl">
              <CardHeader className="text-center">
                <div className="flex items-center justify-center mb-6">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl">
                    <ClipboardCheck className="h-10 w-10 text-white" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Check-in Successful!</CardTitle>
                <CardDescription className="text-lg text-slate-600 dark:text-slate-400">
                  You've successfully checked in to the event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-700 dark:to-slate-800 p-6 rounded-xl">
                  <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">{event.title}</h3>
                  {event.organizer && <p className="text-slate-600 dark:text-slate-400">Organized by {event.organizer}</p>}
                </div>
                
                <div className="text-center">
                  <p className="text-slate-700 dark:text-slate-300 mb-4">You can share this event with others:</p>
                  <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700">
                    <div className="flex-grow truncate text-sm text-slate-600 dark:text-slate-400">
                      {shareableUrl}
                    </div>
                    <Button variant="ghost" size="sm" onClick={copyToClipboard} className="ml-2">
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="text-center pt-4">
                  <Button 
                    onClick={() => navigate("/events")}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    size="lg"
                  >
                    Back to Events
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">{event.title}</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 text-lg">
                  {event.organizer ? `Organized by ${event.organizer}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {event.image && (
                  <img 
                    src={event.image} 
                    alt={event.title}
                    className="w-full h-48 object-cover rounded-xl shadow-lg"
                  />
                )}
                
                {event.description && (
                  <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{event.description}</p>
                  </div>
                )}
                
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-700 dark:to-slate-800 p-4 rounded-xl space-y-3">
                  {event.location && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Location:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{event.location}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Start Time:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {new Date(event.startTime * 1000).toLocaleString()}
                    </span>
                  </div>
                  {event.credential && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Credential:</span>
                      <span className="font-semibold text-slate-900 dark:text-white capitalize">{event.credential}</span>
                    </div>
                  )}
                </div>
                
                <Separator className="bg-slate-200 dark:bg-slate-600" />
                
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Check-in Information</h3>
                  
                  {(event.requiredFields.includes('name') || event.requiredFields.includes('email')) && (
                    <div className="space-y-4">
                      {event.requiredFields.includes('name') && (
                        <div>
                          <Label htmlFor="name" className="text-slate-700 dark:text-slate-300 font-medium">Full Name {event.requiredFields.includes('name') && '*'}</Label>
                          <Input 
                            id="name"
                            value={formData.name || ''}
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                            placeholder="Enter your full name"
                            required={event.requiredFields.includes('name')}
                            className="h-12 text-lg border-slate-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400"
                          />
                        </div>
                      )}
                      
                      {event.requiredFields.includes('email') && (
                        <div>
                          <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">Email Address {event.requiredFields.includes('email') && '*'}</Label>
                          <Input 
                            id="email"
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => handleFieldChange('email', e.target.value)}
                            placeholder="Enter your email address"
                            required={event.requiredFields.includes('email')}
                            className="h-12 text-lg border-slate-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {event.customFields.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Additional Information</h4>
                      
                      {event.customFields.map((field, index) => (
                        <div key={index}>
                          <Label htmlFor={`field-${index}`} className="text-slate-700 dark:text-slate-300 font-medium">
                            {field.name} {field.required && '*'}
                          </Label>
                          <Input 
                            id={`field-${index}`}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            placeholder={`Enter ${field.name.toLowerCase()}`}
                            required={field.required}
                            className="h-12 text-lg border-slate-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                    <AlertTitle className="text-blue-900 dark:text-blue-100">Privacy Notice</AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      By checking in, you agree to share your Nostr public key and the provided information with the event organizers.
                    </AlertDescription>
                  </Alert>
                  
                  <Separator className="bg-slate-200 dark:bg-slate-600" />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium text-slate-900 dark:text-white flex items-center gap-2">
                          Share with Community
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Share your attendance with +chorus communities to let others know about this event. +chorus is a decentralized community platform built on Nostr.</p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Share your attendance with a +chorus community
                        </p>
                      </div>
                      <Switch
                        checked={shareToCommunity}
                        onCheckedChange={setShareToCommunity}
                      />
                    </div>
                    
                    {shareToCommunity && (
                      <>
                        {chorusGroups.isLoading ? (
                          <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-medium">
                              Community
                            </Label>
                            <div className="flex items-center justify-center p-4 border rounded-md">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              Loading your communities...
                            </div>
                          </div>
                        ) : chorusGroups.data?.length === 0 ? (
                          <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-medium">
                              Community
                            </Label>
                            <div className="p-4 border border-dashed rounded-md bg-muted/50">
                              <div className="text-center space-y-3">
                                <p className="text-sm text-muted-foreground">
                                  You're not a member of any +chorus communities yet.
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Join a community to share your attendance and discover events from like-minded people.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open('https://chorus.community', '_blank')}
                                  className="w-full"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Explore +chorus Communities
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-medium">
                              Community
                            </Label>
                            <Select
                              value={communityId}
                              onValueChange={setCommunityId}
                              disabled={chorusGroups.isLoading || !chorusGroups.data?.length}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a community" />
                              </SelectTrigger>
                              <SelectContent>
                                {chorusGroups.data?.map(group => (
                                  <SelectItem key={group.naddr} value={group.naddr}>
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={group.picture} />
                                        <AvatarFallback>{group.name.slice(0, 2)}</AvatarFallback>
                                      </Avatar>
                                      <span>{group.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Optional: Share your attendance with a specific community
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-6">
                <Button 
                  variant="outline" 
                  onClick={() => { setEvent(null); setEventCode(''); }}
                  className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCheckin} 
                  disabled={isPending}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  size="lg"
                >
                  {isPending ? 'Processing...' : 'Check In Now'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}