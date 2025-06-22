import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Calendar, MapPin, Clock, Trash2 } from "lucide-react";
import { useEventBookmarks } from "@/hooks/useEventBookmarks";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Bookmarks() {
  const { bookmarks, isLoading, clearAllBookmarks } = useEventBookmarks();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleClearAll = () => {
    clearAllBookmarks();
    toast({
      title: "Bookmarks Cleared",
      description: "All bookmarks have been removed",
      variant: "default",
    });
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

  const getEventStatus = (startTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    if (now < startTime) {
      return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
    } else {
      return { status: 'past', label: 'Past', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200' };
    }
  };

  return (
    <AppLayout>
      <div className="container px-4 py-6 mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              My Bookmarks
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Your saved events and check-in links
            </p>
          </div>
          {bookmarks.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 px-8 text-center">
              <div className="max-w-sm mx-auto space-y-6">
                <Bookmark className="h-12 w-12 mx-auto text-slate-400" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    No bookmarks yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Save events you're interested in to find them here later
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  Browse Events
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookmarks.map((bookmark) => {
              const eventStatus = getEventStatus(bookmark.startTime);
              return (
                <Card key={bookmark.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                            {bookmark.title}
                          </h3>
                          <Badge className={eventStatus.color}>
                            {eventStatus.label}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(bookmark.startTime)}</span>
                          </div>
                          
                          {bookmark.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{bookmark.location}</span>
                            </div>
                          )}
                          
                          {bookmark.organizer && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>Organized by {bookmark.organizer}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/events/check-in/${bookmark.id}`)}
                        >
                          Check In
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/events/${bookmark.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
} 