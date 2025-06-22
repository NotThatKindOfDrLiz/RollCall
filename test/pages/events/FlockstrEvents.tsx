import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Clock, Users, ExternalLink, Plus, CheckCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";

interface FlockstrEvent {
  id: string;
  pubkey: string;
  title: string;
  description: string;
  startTime: number;
  endTime?: number;
  location?: string;
  organizer?: string;
  image?: string;
  website?: string;
  category?: string;
  tags: string[];
  isImported?: boolean;
  isOwned: boolean;
}

export default function FlockstrEvents() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutate: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const [importedEvents, setImportedEvents] = useState<Set<string>>(new Set());

  // Query Flockstr events (NIP-52 calendar events)
  const { data: flockstrEvents, isLoading } = useQuery({
    queryKey: ['flockstr-events'],
    queryFn: async () => {
      const events = await nostr.query([
        {
          kinds: [31922, 31923], // NIP-52 calendar events
          limit: 100 // Increased limit to get more events for filtering
        }
      ], { signal: AbortSignal.timeout(10000) });

      const now = Math.floor(Date.now() / 1000); // Current time in seconds

      const seen = new Set<string>();
      return events
        .map(event => {
          const dTag = event.tags.find(t => t[0] === 'd')?.[1];
          const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Event';
          const description = event.tags.find(t => t[0] === 'description')?.[1] || '';
          const startTimeStr = event.tags.find(t => t[0] === 'start')?.[1];
          const endTimeStr = event.tags.find(t => t[0] === 'end')?.[1];
          const location = event.tags.find(t => t[0] === 'location')?.[1];
          const organizer = event.tags.find(t => t[0] === 'organizer')?.[1];
          const image = event.tags.find(t => t[0] === 'image')?.[1];
          const website = event.tags.find(t => t[0] === 'website')?.[1];
          const category = event.tags.find(t => t[0] === 'category')?.[1];
          const tags = event.tags.filter(t => t[0] === 't').map(t => t[1]);
          
          const startTime = startTimeStr ? parseInt(startTimeStr) : 0;
          const endTime = endTimeStr ? parseInt(endTimeStr) : undefined;

          return {
            id: event.id,
            dTag,
            pubkey: event.pubkey,
            title,
            description,
            startTime,
            endTime,
            location,
            organizer,
            image,
            website,
            category,
            tags,
            isImported: importedEvents.has(event.id),
            isOwned: user ? event.pubkey === user.pubkey : false
          } as FlockstrEvent & { dTag?: string };
        })
        .filter(event => event.startTime > now)
        .filter(event => {
          // Deduplicate by d tag if present, else by pubkey + startTime + title
          const key = event.dTag ? `d:${event.dTag}` : `${event.pubkey}|${event.startTime}|${event.title}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => a.startTime - b.startTime);
    },
    enabled: !!nostr,
  });

  // Import event to RollCall
  const importEvent = async (event: FlockstrEvent) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to import events",
        variant: "destructive",
      });
      return;
    }

    // Check if user owns the event
    if (event.pubkey !== user.pubkey) {
      toast({
        title: "Not Authorized",
        description: "Only the event owner can import this event to RollCall",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate import
    try {
      const existing = await nostr.query([
        {
          kinds: [31110],
          authors: [user.pubkey],
          '#flockstr_id': [event.id],
        }
      ], { signal: AbortSignal.timeout(5000) });
      if (existing.length > 0) {
        toast({
          title: "Already Imported",
          description: "This event has already been imported to RollCall.",
          variant: "default",
        });
        setImportedEvents(prev => new Set([...prev, event.id]));
        return;
      }
    } catch (error) {
      // If the query fails, allow import to proceed (fail open)
      console.error("Error checking for duplicate import", error);
    }

    try {
      // Create a RollCall event based on the Flockstr event
      const rollcallEvent = {
        kind: 31110, // RollCall event kind
        content: JSON.stringify({
          originalEventId: event.id,
          importedFrom: 'flockstr',
          customFields: []
        }),
        tags: [
          ["d", `imported-${event.id}`],
          ["title", event.title],
          ["description", event.description],
          ["start", event.startTime.toString()],
          ["location", event.location || ""],
          ["organizer", event.organizer || ""],
          ["image", event.image || ""],
          ["website", event.website || ""],
          ["category", event.category || ""],
          ["req_fields", "name,email"], // Default required fields
          ["flockstr_id", event.id], // Reference to original Flockstr event
          ["t", "imported"],
          ["t", "flockstr-compatible"]
        ]
      };

      // Publish the imported event using the proper hook
      createEvent(rollcallEvent, {
        onSuccess: async (_publishedEvent) => {
          setImportedEvents(prev => new Set([...prev, event.id]));
          
          toast({
            title: "Event Imported",
            description: `${event.title} has been imported to RollCall`,
            variant: "default",
          });

          // Wait a moment for the relay to index the event
          toast({
            title: "Indexing Event",
            description: "Waiting for relay to index the event...",
            variant: "default",
          });

          // Wait 2 seconds for relay indexing
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Navigate to the imported event
          navigate(`/events/check-in/imported-${event.id}`);
        },
        onError: (error) => {
          console.error("Error importing event:", error);
          toast({
            title: "Import Failed",
            description: "Failed to import event. Please try again.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("Error importing event:", error);
      toast({
        title: "Import Failed",
        description: "Failed to import event. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container max-w-6xl py-8 px-4">
          <Card className="mb-8 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-grow">
                  <CardTitle className="text-2xl font-bold">Discover Events on Flockstr</CardTitle>
                  <CardDescription className="mt-2 text-base text-slate-600 dark:text-slate-300">
                    Flockstr is a decentralized event platform on Nostr. Browse upcoming events and import yours to RollCall to enable seamless, verifiable check-ins for your attendees.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={() => window.open("https://www.flockstr.com/", "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Visit Flockstr.com
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {flockstrEvents?.length || 0}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">Available Events</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {importedEvents.size}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">Imported Events</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {flockstrEvents?.filter(e => e.isOwned).length || 0}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">Your Events</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Events Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-4/5" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flockstrEvents?.map((event) => (
                <Card key={event.id} className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  {event.image && (
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={event.image} 
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">
                          {event.title}
                        </CardTitle>
                        {event.organizer && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            by {event.organizer}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {event.isOwned && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                            Yours
                          </Badge>
                        )}
                        {event.isImported && (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                            Imported
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-4">
                    {event.description && (
                      <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 mb-4">
                        {event.description}
                      </p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(event.startTime)}</span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <MapPin className="h-4 w-4" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      )}
                    </div>

                    {event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-4">
                        {event.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {event.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{event.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0">
                    <div className="flex gap-2 w-full">
                      {event.isImported ? (
                        <Button 
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => navigate(`/events/check-in/imported-${event.id}`)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          View in RollCall
                        </Button>
                      ) : event.isOwned ? (
                        <Button 
                          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                          onClick={() => importEvent(event)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Import to RollCall
                        </Button>
                      ) : (
                        <div className="flex-1 text-center py-2 px-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          Only the event owner can import
                        </div>
                      )}
                      
                      {event.website && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(event.website, '_blank')}
                          className="border-slate-200 dark:border-slate-600"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {flockstrEvents?.length === 0 && !isLoading && (
            <Card className="max-w-md mx-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="text-center py-12">
                <Calendar className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No Flockstr Events Found
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Try connecting to different relays or check back later for new events.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
} 