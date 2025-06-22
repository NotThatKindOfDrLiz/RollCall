import { useParams, useNavigate } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { genUserName } from "@/lib/genUserName";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RelaySelector } from "@/components/RelaySelector";
import { Download, Link2, MapPin, Clock, User, Calendar, Trash2, Mail } from "lucide-react";
import { LoginArea } from "@/components/auth/LoginArea";
import { EventQRCode } from "@/components/EventQRCode";
import { BookmarkButton } from "@/components/BookmarkButton";
import { EventAnalytics } from "@/components/EventAnalytics";

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

type Attendee = {
  id: string;
  pubkey: string;
  timestamp: number;
  name?: string;
  email?: string;
  location?: string;
  customData: Record<string, unknown>;
};

export default function EventDetails() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { toast } = useToast();

  // Get event details
  const {
    data: event,
    isLoading: isLoadingEvent,
    error: eventError,
    refetch: refetchEvent,
  } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      
      const filter = {
        kinds: [31110],
        "#d": [eventId],
      };
      
      const events = await nostr.query([filter], { signal: AbortSignal.timeout(5000) });
      
      if (events.length === 0) {
        throw new Error("Event not found");
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
      
      // Parse customFields from content
      let customFields: Array<{ name: string; required: boolean }> = [];
      try {
        if (eventData.content) {
          customFields = JSON.parse(eventData.content);
        }
      } catch (e) {
        console.error("Error parsing customFields", e);
      }
      
      const startTime = startTimeStr ? parseInt(startTimeStr) : 0;
      const endTime = endTimeStr ? parseInt(endTimeStr) : 0;
      
      return {
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
      } as EventRoom;
    },
    enabled: !!eventId,
  });

  // Get event status (upcoming, active, ended)
  const getEventStatus = () => {
    if (!event) return "unknown";
    
    const now = Math.floor(Date.now() / 1000);
    
    if (now < event.startTime) {
      return "upcoming";
    } else if (now > event.endTime) {
      return "ended";
    } else {
      return "active";
    }
  };

  const eventStatus = getEventStatus();

  // Format date in a user-friendly way
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Get attendees for the event
  const {
    data: attendees,
    isLoading: isLoadingAttendees,
  } = useQuery({
    queryKey: ["event-attendees", event?.pubkey, event?.eventId],
    queryFn: async () => {
      if (!event) return [];
      
      const filter = {
        kinds: [1110],
        '#a': [`31110:${event.pubkey}:${event.eventId}`],
      };
      
      const checkInEvents = await nostr.query([filter], { signal: AbortSignal.timeout(5000) });
      
      return checkInEvents.map(checkIn => {
        let customData: Record<string, unknown> = {};
        try {
          if (checkIn.content) {
            const parsed = JSON.parse(checkIn.content);
            if (typeof parsed === 'object' && parsed !== null) {
              customData = parsed as Record<string, unknown>;
            }
          }
        } catch (e) {
          console.error("Error parsing custom data", e);
        }
        
        const timestamp = checkIn.tags.find(t => t[0] === 'start')?.[1];
        const name = checkIn.tags.find(t => t[0] === 'name')?.[1];
        const email = checkIn.tags.find(t => t[0] === 'email')?.[1];
        const location = checkIn.tags.find(t => t[0] === 'location')?.[1];
        
        return {
          id: checkIn.id,
          pubkey: checkIn.pubkey,
          timestamp: timestamp ? parseInt(timestamp) : checkIn.created_at,
          name,
          email,
          location,
          customData,
        };
      }).sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    },
    enabled: !!event,
  });

  // Check if current user is the event creator
  const isCreator = user && event && user.pubkey === event.pubkey;

  // Generate CSV data for export
  const generateCsv = () => {
    if (!attendees || attendees.length === 0) return null;
    
    // Collect all possible field names from all attendees
    const customFields = new Set<string>();
    attendees.forEach(attendee => {
      Object.keys(attendee.customData || {}).forEach(key => {
        customFields.add(key);
      });
    });
    
    // Create header row
    const headers = [
      'Timestamp',
      'Public Key',
      'Name',
      'Email',
      ...Array.from(customFields),
    ];
    
    // Create data rows
    const rows = attendees.map(attendee => {
      const row: Array<string> = [
        new Date(attendee.timestamp * 1000).toISOString(),
        attendee.pubkey,
        attendee.name || '',
        attendee.email || '',
      ];
      
      // Add custom fields
      customFields.forEach(field => {
        const value = attendee.customData && attendee.customData[field];
        row.push(value !== undefined ? String(value) : '');
      });
      
      return row;
    });
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
  };

  // Export attendance list to CSV
  const exportAttendance = () => {
    if (!event || !attendees) return;
    
    const csvContent = generateCsv();
    if (!csvContent) {
      toast({
        title: "No data to export",
        description: "There are no attendees for this event yet",
      });
      return;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}_attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteEvent = async () => {
    if (!user || !event) return;
    
    try {
      toast({
        title: "Event Deletion",
        description: "Event deletion will be implemented in a future version.",
      });
      
      // Note: In a real implementation, we would publish a deletion event (kind 5)
      // or update the event with an "inactive" status
      
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Deletion failed",
        description: "There was a problem deleting the event",
        variant: "destructive",
      });
    }
  };
  
  if (isLoadingEvent) {
    return (
      <div className="container px-4 py-2 mx-auto space-y-8">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="container px-4 py-2 mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
            <CardDescription>
              The event you're looking for could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              The event may have been deleted or moved. If you believe this is an
              error, please try refreshing the page.
            </p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/events/manage")}>
              Go to Events List
            </Button>
            <Button onClick={() => refetchEvent()}>Retry</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container px-4 py-2 mx-auto">
      {/* Compact Header */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate("/")}
          className="text-2xl sm:text-3xl font-bold gradient-text hover:opacity-80 transition-opacity"
        >
          RollCall
        </button>
        <LoginArea className="min-w-32" />
      </div>

      <div className="mb-6 flex flex-col md:flex-row justify-between items-start">
        <div>
          <div className="flex items-center mb-2">
            <h1 className="text-2xl font-bold mr-3">{event.title}</h1>
            <Badge
              className={
                eventStatus === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                  : eventStatus === "upcoming"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
              }
            >
              {eventStatus === "active"
                ? "Active"
                : eventStatus === "upcoming"
                ? "Upcoming"
                : "Ended"}
            </Badge>
          </div>
          {event.organizer && (
            <p className="text-muted-foreground">Organized by {event.organizer}</p>
          )}
        </div>
        <div className="mt-4 md:mt-0">
          <RelaySelector />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Event details */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              {event.image && (
                <div className="mb-6">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-64 object-cover rounded-md"
                  />
                </div>
              )}
              
              {event.description && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{event.description}</p>
                </div>
              )}
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Start Time</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(event.startTime)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Clock className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">End Time</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(event.endTime)}
                    </p>
                  </div>
                </div>
                
                {event.location && (
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{event.location}</p>
                    </div>
                  </div>
                )}
                
                {event.website && (
                  <div className="flex items-start">
                    <Link2 className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Website</p>
                      <a 
                        href={event.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {event.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {event.category && (
                  <Badge variant="outline">
                    Category: {event.category}
                  </Badge>
                )}
                {event.credential && event.credential !== "none" && (
                  <Badge variant="outline">
                    Credential: {event.credential}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>
                Attendance
                {attendees && 
                  <Badge variant="outline" className="ml-2">
                    {attendees.length} check-ins
                  </Badge>
                }
              </CardTitle>
              <CardDescription>
                People who have checked in to this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAttendees ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="ml-3 space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !attendees || attendees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No one has checked in yet</p>
                  <p className="text-sm">Share the check-in link to allow participants to register</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attendees.map(attendee => (
                    <AttendeeCard key={attendee.id} attendee={attendee} />
                  ))}
                </div>
              )}
            </CardContent>
            {isCreator && attendees && attendees.length > 0 && (
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={exportAttendance}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Attendance List
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
        
        {/* Right column: Action cards */}
        <div className="space-y-6">
          {/* QR Code */}
          {event && (
            <EventQRCode 
              eventId={event.eventId}
              eventTitle={event.title}
            />
          )}
          
          {/* Bookmark Button */}
          {event && (
            <Card>
              <CardContent className="pt-6">
                <BookmarkButton
                  eventId={event.eventId}
                  eventTitle={event.title}
                  startTime={event.startTime}
                  location={event.location}
                  organizer={event.organizer}
                  className="w-full"
                />
              </CardContent>
            </Card>
          )}
          
          {/* Analytics */}
          {event && attendees && (
            <EventAnalytics
              eventId={event.eventId}
              _eventTitle={event.title}
              startTime={event.startTime}
              endTime={event.endTime}
              checkIns={attendees.map(attendee => ({
                id: attendee.id,
                pubkey: attendee.pubkey,
                eventId: event.eventId,
                checkInTime: attendee.timestamp,
                name: attendee.name,
                email: attendee.email,
                location: attendee.location,
                customData: attendee.customData
              }))}
            />
          )}
          
          {isCreator && (
            <Card>
              <CardHeader>
                <CardTitle>Event Management</CardTitle>
                <CardDescription>
                  Tools for managing this event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full" onClick={() => navigate(`/events/edit/${event.eventId}`)}>
                  Edit Event Details
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Event
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the event
                        and all check-in records will become orphaned.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteEvent}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
          
          {isCreator && attendees && attendees.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Attendees</CardTitle>
                <CardDescription>
                  Send messages to event participants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {attendees.filter(a => a.email).length} of {attendees.length} attendees provided email addresses
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email to Attendees
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface AttendeeCardProps {
  attendee: Attendee;
}

function AttendeeCard({ attendee }: AttendeeCardProps) {
  const author = useAuthor(attendee.pubkey);
  const displayName = attendee.name || author.data?.metadata?.name || genUserName(attendee.pubkey);
  const profileImage = author.data?.metadata?.picture;
  
  // Format check-in time
  const formatCheckInTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  return (
    <div className="flex items-center p-2 rounded-lg hover:bg-muted/40 transition-colors">
      <Avatar className="h-10 w-10">
        {profileImage && <AvatarImage src={profileImage} alt={displayName} />}
        <AvatarFallback>{displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="ml-3 overflow-hidden">
        <p className="font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground">
          Checked in: {formatCheckInTime(attendee.timestamp)}
        </p>
      </div>
      {attendee.email && (
        <Badge variant="outline" className="ml-auto text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Has email
        </Badge>
      )}
    </div>
  );
}