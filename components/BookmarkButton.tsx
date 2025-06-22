import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEventBookmarks } from '@/hooks/useEventBookmarks';
import { useToast } from '@/hooks/useToast';

interface BookmarkButtonProps {
  eventId: string;
  eventTitle: string;
  startTime: number;
  location?: string;
  organizer?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function BookmarkButton({
  eventId,
  eventTitle,
  startTime,
  location,
  organizer,
  variant = 'outline',
  size = 'default',
  className
}: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useEventBookmarks();
  const { toast } = useToast();

  const handleToggle = () => {
    const event = {
      id: eventId,
      title: eventTitle,
      startTime,
      location,
      organizer
    };

    toggleBookmark(event);

    const bookmarked = isBookmarked(eventId);
    toast({
      title: bookmarked ? "Event Removed" : "Event Bookmarked",
      description: bookmarked 
        ? `${eventTitle} removed from bookmarks`
        : `${eventTitle} added to bookmarks`,
      variant: "default",
    });
  };

  const bookmarked = isBookmarked(eventId);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      className={className}
    >
      {bookmarked ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </Button>
  );
} 