import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginArea } from "@/components/auth/LoginArea";
import { Calendar, User, CheckSquare, Award } from "lucide-react";

type EventCheckIn = {
  id: string;
  pubkey: string;
  eventId: string;
  hostPubkey: string;
  checkInTime: number;
  name?: string;
  email?: string;
  location?: string;
  customData: Record<string, unknown>;
};

type EventDetails = {
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
  category?: string;
  credential?: string;
};

export default function MyAttendance() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Fetch the user's check-ins
  const {
    data: checkIns,
    isLoading: isLoadingCheckIns,
    error: checkInsError,
    refetch: refetchCheckIns
  } = useQuery({
    queryKey: ["my-checkins", user?.pubkey],
    queryFn: async () => {
      if (!user) return [];
      
      // Get all check-ins by the user
      const filter = {
        kinds: [1110],
        authors: [user.pubkey],
        limit: 100,
      };
      
      const checkInEvents = await nostr.query([filter], { signal: AbortSignal.timeout(5000) });
      
      // Extract event IDs and host pubkeys from the check-ins
      const eventRefs: Record<string, { ref: string; hostPubkey: string }> = {};
      
      checkInEvents.forEach(event => {
        const aTag = event.tags.find(t => t[0] === 'a');
        if (aTag && aTag[1]) {
          const parts = aTag[1].split(':');
          if (parts.length === 3 && parts[0] === '31110') {
            const hostPubkey = parts[1];
            const eventId = parts[2];
            eventRefs[event.id] = { ref: eventId, hostPubkey };
          }
        }
      });
      
      // Transform check-in events
      return checkInEvents.map(event => {
        const ref = eventRefs[event.id];
        let customData: Record<string, unknown> = {};
        
        try {
          if (event.content) {
            customData = JSON.parse(event.content);
          }
        } catch (e) {
          console.error("Error parsing custom data", e);
        }
        
        const timeStr = event.tags.find(t => t[0] === 'start')?.[1];
        const name = event.tags.find(t => t[0] === 'name')?.[1];
        const email = event.tags.find(t => t[0] === 'email')?.[1];
        const location = event.tags.find(t => t[0] === 'location')?.[1];
        
        return {
          id: event.id,
          pubkey: event.pubkey,
          eventId: ref?.ref || '',
          hostPubkey: ref?.hostPubkey || '',
          checkInTime: timeStr ? parseInt(timeStr) : event.created_at,
          name,
          email,
          location,
          customData
        };
      }).sort((a, b) => b.checkInTime - a.checkInTime); // Most recent first
    },
    enabled: !!user,
  });
  
  // Fetch details for all events that the user checked into
  const {
    data: eventDetails,
    isLoading: isLoadingEventDetails,
  } = useQuery({
    queryKey: ["event-details", checkIns?.map(c => c.eventId).filter(Boolean).join(',')],
    queryFn: async () => {
      if (!checkIns || checkIns.length === 0) return {};
      
      // Get unique event IDs
      const eventIds = Array.from(new Set(checkIns.map(c => c.eventId).filter(Boolean)));
      
      // Create filters for each event ID
      const filters = eventIds.map(eventId => ({
        kinds: [31110],
        "#d": [eventId],
      }));
      
      // Query all events
      const events = await nostr.query(filters, { signal: AbortSignal.timeout(8000) });
      
      // Create a map of event ID to event details
      const detailsMap: Record<string, EventDetails> = {};
      
      events.forEach(event => {
        const eventId = event.tags.find(t => t[0] === 'd')?.[1];
        if (!eventId) return;
        
        const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Event';
        const description = event.tags.find(t => t[0] === 'description')?.[1] || '';
        const startTimeStr = event.tags.find(t => t[0] === 'start')?.[1];
        const endTimeStr = event.tags.find(t => t[0] === 'end')?.[1];
        const location = event.tags.find(t => t[0] === 'location')?.[1];
        const organizer = event.tags.find(t => t[0] === 'organizer')?.[1];
        const image = event.tags.find(t => t[0] === 'image')?.[1];
        const category = event.tags.find(t => t[0] === 'category')?.[1];
        const credential = event.tags.find(t => t[0] === 'credential')?.[1];
        
        const startTime = startTimeStr ? parseInt(startTimeStr) : 0;
        const endTime = endTimeStr ? parseInt(endTimeStr) : 0;
        
        detailsMap[eventId] = {
          id: event.id,
          pubkey: event.pubkey,
          eventId,
          title,
          description,
          startTime,
          endTime,
          location,
          organizer,
          image,
          category,
          credential,
        };
      });
      
      return detailsMap;
    },
    enabled: !!checkIns && checkIns.length > 0,
  });
  
  // Filter check-ins based on search term
  const filteredCheckIns = checkIns?.filter(checkIn => {
    const event = eventDetails?.[checkIn.eventId];
    if (!event) return false;
    
    const searchString = `${event.title} ${event.description} ${event.location || ''} ${event.organizer || ''} ${event.category || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });
  
  // Get check-ins by date range
  const getCheckInsByDateRange = (days: number) => {
    if (!filteredCheckIns) return [];
    
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - (days * 86400); // days in seconds
    
    return filteredCheckIns.filter(checkIn => checkIn.checkInTime >= cutoff);
  };
  
  // Format date in a user-friendly way
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (!user) {
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

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Login Required</CardTitle>
            <CardDescription>You need to login with your Nostr identity to view your attendance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>To view your attendance history, you'll need to authenticate with your Nostr identity.</p>
            <LoginArea className="w-full" />
          </CardContent>
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Attendance</h1>
          <p className="text-muted-foreground">Your event check-in history</p>
        </div>
      </div>
      
      <div className="mb-6">
        <Input
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="recent">Recent (30 days)</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recent">
          {renderCheckInList(getCheckInsByDateRange(30))}
        </TabsContent>
        
        <TabsContent value="all">
          {renderCheckInList(filteredCheckIns || [])}
        </TabsContent>
      </Tabs>
    </div>
  );
  
  function renderCheckInList(checkIns: EventCheckIn[]) {
    if (isLoadingCheckIns || isLoadingEventDetails) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }
    
    if (checkInsError) {
      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Error Loading Check-ins</CardTitle>
            <CardDescription>
              There was a problem loading your attendance history.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => refetchCheckIns()}>Retry</Button>
          </CardFooter>
        </Card>
      );
    }
    
    if (checkIns.length === 0) {
      return (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No Check-ins Found</CardTitle>
            <CardDescription>
              {searchTerm
                ? "No events match your search. Try different search terms."
                : "You haven't checked in to any events yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p>Check in to events to build your attendance history</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate("/events/check-in")}>
              Check in to an Event
            </Button>
          </CardFooter>
        </Card>
      );
    }
    
    return (
      <div className="space-y-4">
        {checkIns.map((checkIn) => {
          const event = eventDetails?.[checkIn.eventId];
          if (!event) return null;
          
          const now = Math.floor(Date.now() / 1000);
          const isEventEnded = event.endTime && now > event.endTime;
          
          return (
            <Card key={checkIn.id} className={isEventEnded ? "opacity-75" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{event.title}</CardTitle>
                    <CardDescription>
                      {event.organizer || 'Unknown organizer'}
                    </CardDescription>
                  </div>
                  {event.credential && event.credential !== "none" && isEventEnded && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                      <Award className="h-3 w-3 mr-1" />
                      {event.credential}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <CheckSquare className="mr-2 h-4 w-4 text-green-500" />
                    <span className="text-sm">Checked in: {formatDate(checkIn.checkInTime)}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(event.startTime)}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center">
                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                  
                  {(checkIn.name || checkIn.email) && (
                    <div className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border">
                      <p>Checked in as: {checkIn.name || 'Anonymous'}</p>
                      {checkIn.email && <p>Email: {checkIn.email}</p>}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/events/view/${event.eventId}`)}
                >
                  View Event Details
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  }
}