import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useToast } from "@/hooks/useToast";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CalendarIcon, PlusCircle, Trash2, Edit, Plus, Calendar as CalendarIcon2, User, MapPin, Info, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { nanoid } from "nanoid";
import { LoginArea } from "@/components/auth/LoginArea";
import { Skeleton } from "@/components/ui/skeleton";
import { useChorusGroups } from "@/hooks/useChorusGroups";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const categoryOptions = [
  { label: "Education", value: "education" },
  { label: "Conference", value: "conference" },
  { label: "Meeting", value: "meeting" },
  { label: "Workshop", value: "workshop" },
  { label: "Webinar", value: "webinar" },
  { label: "Social", value: "social" },
  { label: "Other", value: "other" },
];

const credentialOptions = [
  { label: "Certificate", value: "certificate" },
  { label: "Credit", value: "credit" },
  { label: "Badge", value: "badge" },
  { label: "None", value: "none" },
];

const FormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string(),
  location: z.string(),
  website: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal("")),
  organizer: z.string(),
  eventId: z.string().min(3, { message: "Event ID must be at least 3 characters" }),
  category: z.string(),
  credential: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  requireEmail: z.boolean(),
  requireName: z.boolean(),
  customFields: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, { message: "Field name is required" }),
      required: z.boolean(),
    })
  ),
  tags: z.array(z.string()),
  proposeToCommunity: z.boolean().default(false),
  communityId: z.string().optional(),
});

export default function CreateEvent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: createEvent, isPending } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const { eventId } = useParams();
  
  // Parse URL search parameters
  const searchParams = new URLSearchParams(location.search);
  const editEventId = searchParams.get('edit');
  
  // Determine if we're editing (from URL params or route params)
  const isEditing = !!eventId || !!editEventId;
  const eventIdToEdit = eventId || editEventId;

  // Load existing event if editing
  const {
    data: existingEvent,
    isLoading: isLoadingEvent,
    error: eventError,
  } = useQuery({
    queryKey: ["event-edit", eventIdToEdit],
    queryFn: async () => {
      if (!eventIdToEdit || !user) return null;
      
      const events = await nostr.query(
        [
          {
            kinds: [31110],
            authors: [user.pubkey],
            "#d": [eventIdToEdit],
          },
        ],
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (events.length === 0) {
        throw new Error("Event not found or you don't have permission to edit it");
      }
      
      const event = events[0];
      const title = event.tags.find(t => t[0] === 'title')?.[1] || '';
      const description = event.tags.find(t => t[0] === 'description')?.[1] || '';
      const startTimeStr = event.tags.find(t => t[0] === 'start')?.[1];
      const endTimeStr = event.tags.find(t => t[0] === 'end')?.[1];
      const location = event.tags.find(t => t[0] === 'location')?.[1] || '';
      const organizer = event.tags.find(t => t[0] === 'organizer')?.[1] || '';
      const image = event.tags.find(t => t[0] === 'image')?.[1];
      const website = event.tags.find(t => t[0] === 'website')?.[1] || '';
      const category = event.tags.find(t => t[0] === 'category')?.[1] || 'education';
      const credential = event.tags.find(t => t[0] === 'credential')?.[1] || 'certificate';
      const reqFieldsStr = event.tags.find(t => t[0] === 'req_fields')?.[1] || '';
      const requiredFields = reqFieldsStr ? reqFieldsStr.split(',') : [];
      
      // Parse custom fields from content
      let customFields: Array<{ id: string; name: string; required: boolean }> = [];
      try {
        if (event.content) {
          const parsed = JSON.parse(event.content);
          if (Array.isArray(parsed)) {
            customFields = parsed.map(field => ({
              id: nanoid(6),
              name: field.name,
              required: field.required
            }));
          }
        }
      } catch (e) {
        console.error("Error parsing custom fields", e);
      }
      
      // Extract tags
      const tags = event.tags
        .filter(t => t[0] === 't')
        .map(t => t[1])
        .filter(Boolean);
      
      const startTime = startTimeStr ? parseInt(startTimeStr) : Date.now() / 1000;
      const endTime = endTimeStr ? parseInt(endTimeStr) : (Date.now() / 1000) + 3600;
      
      return {
        title,
        description,
        location,
        organizer,
        image,
        website,
        category,
        credential,
        startDate: new Date(startTime * 1000),
        endDate: new Date(endTime * 1000),
        requireEmail: requiredFields.includes('email'),
        requireName: requiredFields.includes('name'),
        customFields,
        tags,
      };
    },
    enabled: isEditing && !!user,
  });

  // Load user's events for management
  const {
    data: userEvents,
    isLoading: isLoadingUserEvents,
  } = useQuery({
    queryKey: ["user-events", user?.pubkey],
    queryFn: async () => {
      if (!user) return [];
      
      const events = await nostr.query(
        [
          {
            kinds: [31110],
            authors: [user.pubkey],
            limit: 50,
          },
        ],
        { signal: AbortSignal.timeout(5000) }
      );
      
      // Strict client-side filter for author
      return events
        .filter(event => event.pubkey === user.pubkey)
        .map(event => {
          const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Event';
          const eventId = event.tags.find(t => t[0] === 'd')?.[1] || '';
          const startTimeStr = event.tags.find(t => t[0] === 'start')?.[1];
          const endTimeStr = event.tags.find(t => t[0] === 'end')?.[1];
          const location = event.tags.find(t => t[0] === 'location')?.[1];
          
          const startTime = startTimeStr ? parseInt(startTimeStr) : 0;
          const endTime = endTimeStr ? parseInt(endTimeStr) : 0;
          
          return {
            id: event.id,
            eventId,
            title,
            location,
            startTime,
            endTime,
          };
        })
        .sort((a, b) => b.startTime - a.startTime);
    },
    enabled: !!user,
  });

  const chorusGroups = useChorusGroups(user?.pubkey);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate("/");
      toast({
        title: "Login Required",
        description: "You must be logged in to create events",
        variant: "destructive",
      });
    }
  }, [user, navigate, toast]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      website: "",
      organizer: "",
      eventId: eventIdToEdit || nanoid(8),
      category: "education",
      credential: "certificate",
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000), // Default to 1 hour from now
      requireEmail: true,
      requireName: false,
      customFields: [],
      tags: [],
      proposeToCommunity: false,
      communityId: "",
    },
  });

  // Update form when existing event is loaded
  useEffect(() => {
    if (existingEvent) {
      form.reset({
        title: existingEvent.title,
        description: existingEvent.description,
        location: existingEvent.location,
        website: existingEvent.website,
        organizer: existingEvent.organizer,
        eventId: eventIdToEdit || nanoid(8),
        category: existingEvent.category,
        credential: existingEvent.credential,
        startDate: existingEvent.startDate,
        endDate: existingEvent.endDate,
        requireEmail: existingEvent.requireEmail,
        requireName: existingEvent.requireName,
        customFields: existingEvent.customFields,
        tags: existingEvent.tags,
        proposeToCommunity: false,
        communityId: "",
      });
      if (existingEvent.image) {
        setImageUrl(existingEvent.image);
      }
    }
  }, [existingEvent, eventIdToEdit, form]);

  const addCustomField = () => {
    const currentFields = form.getValues("customFields");
    form.setValue("customFields", [
      ...currentFields,
      {
        id: nanoid(6),
        name: "",
        required: false,
      },
    ]);
  };

  const removeCustomField = (id: string) => {
    const currentFields = form.getValues("customFields");
    form.setValue(
      "customFields",
      currentFields.filter((field) => field.id !== id)
    );
  };

  const addTag = () => {
    if (tagInput.trim() && !form.getValues("tags").includes(tagInput.trim())) {
      const currentTags = form.getValues("tags");
      form.setValue("tags", [...currentTags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    const currentTags = form.getValues("tags");
    form.setValue(
      "tags",
      currentTags.filter((t) => t !== tag)
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const [[_, url]] = await uploadFile(file);
        setImageUrl(url);
        toast({
          title: "Image uploaded",
          description: "Your image has been uploaded successfully",
        });
      } catch (error) {
        console.error("Error uploading image:", error);
        toast({
          title: "Upload failed",
          description: "There was a problem uploading your image",
          variant: "destructive",
        });
      }
    }
  };

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!user) return;

    try {
      // Prepare required fields tag
      const reqFields: string[] = [];
      if (data.requireEmail) reqFields.push("email");
      if (data.requireName) reqFields.push("name");
      
      // Add custom required fields
      data.customFields.forEach(field => {
        if (field.required) reqFields.push(field.name);
      });

      // Create tags array for the event
      const eventTags: string[][] = [
        ["d", data.eventId],
        ["title", data.title],
        ["start", Math.floor(data.startDate.getTime() / 1000).toString()],
        ["end", Math.floor(data.endDate.getTime() / 1000).toString()],
      ];

      if (data.description) eventTags.push(["description", data.description]);
      if (data.location) eventTags.push(["location", data.location]);
      if (data.website) eventTags.push(["website", data.website]);
      if (data.organizer) eventTags.push(["organizer", data.organizer]);
      if (data.category) eventTags.push(["category", data.category]);
      if (data.credential) eventTags.push(["credential", data.credential]);
      if (imageUrl) eventTags.push(["image", imageUrl]);
      if (reqFields.length > 0) eventTags.push(["req_fields", reqFields.join(",")]);
      
      // Add topic tags
      data.tags.forEach(tag => {
        eventTags.push(["t", tag]);
      });

      // Custom fields as JSON in content
      const customFieldsConfig = data.customFields.map(field => ({
        name: field.name,
        required: field.required
      }));

      // Create the event
      await createEvent({
        kind: 31110,
        content: JSON.stringify(customFieldsConfig),
        tags: eventTags,
      });

      // If community proposal is enabled, create a proposal post
      if (data.proposeToCommunity && data.communityId) {
        try {
          const proposalContent = `🎉 **Event Proposal: ${data.title}**

📅 **Date**: ${format(data.startDate, "PPP")}
📍 **Location**: ${data.location || "TBD"}
👤 **Organizer**: ${data.organizer || "TBD"}

${data.description ? `📝 **Description**: ${data.description}` : ""}

🔗 **Event Link**: ${window.location.origin}/events/check-in/${data.eventId}

This event has been created in RollCall and is ready for check-ins! 

#event-proposal #rollcall`;

          // Create community proposal post (kind 1 with community reference)
          await createEvent({
            kind: 1,
            content: proposalContent,
            tags: [
              ["a", data.communityId], // Reference to the community
              ["t", "event-proposal"],
              ["t", "rollcall"],
              ["e", `31110:${user.pubkey}:${data.eventId}`], // Reference to the RollCall event
            ],
          });

          toast({
            title: "Event & Proposal Created",
            description: "Your event has been created and proposed to the community!",
          });
        } catch (proposalError) {
          console.error("Error creating community proposal:", proposalError);
          toast({
            title: "Event Created, Proposal Failed",
            description: "Event created successfully, but community proposal failed. You can manually share the event.",
          });
        }
      } else {
        toast({
          title: "Event created",
          description: "Your event has been successfully created",
        });
      }

      // Navigate to the event page
      navigate(`/events/create?manage=${data.eventId}`);
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        title: "Failed to create event",
        description: "There was a problem creating your event",
        variant: "destructive",
      });
    }
  };

  // Handle key press for tag input
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

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

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {isEditing ? "Edit Event" : "Create New Event"}
        </h1>
        <p className="text-muted-foreground">
          {isEditing 
            ? "Update your event details and settings"
            : "Set up a new event room where participants can check in"
          }
        </p>
      </div>

      <Tabs defaultValue={isEditing ? "edit" : "create"} className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="create" className="flex-1">
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex-1">
            <Edit className="mr-2 h-4 w-4" />
            Manage Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {isLoadingEvent ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : eventError ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Error Loading Event</CardTitle>
                <CardDescription>
                  {eventError instanceof Error ? eventError.message : "There was a problem loading the event"}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => navigate("/events/create")}>
                  Create New Event
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Event Details</CardTitle>
                    <CardDescription>
                      Basic information about your event
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Title*</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter event title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="eventId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event ID*</FormLabel>
                          <FormControl>
                            <Input placeholder="Unique identifier" {...field} />
                          </FormControl>
                          <FormDescription>
                            A unique identifier for your event. This will be used in the check-in URL.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your event"
                              className="min-h-24"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="Physical or virtual location" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="organizer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organizer</FormLabel>
                            <FormControl>
                              <Input placeholder="Host or organization name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categoryOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="credential"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credential Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select credential type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {credentialOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Event Schedule</CardTitle>
                    <CardDescription>
                      Set the start and end times for your event
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Start Date & Time</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>End Date & Time</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Check-in Fields</CardTitle>
                    <CardDescription>
                      Configure what information to collect from participants
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="requireEmail"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Require Email</FormLabel>
                              <FormDescription>
                                Collect email addresses from participants
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="requireName"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Require Name</FormLabel>
                              <FormDescription>
                                Collect full names from participants
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">Custom Fields</h4>
                          <p className="text-sm text-muted-foreground">
                            Add additional fields to collect from participants
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCustomField}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Field
                        </Button>
                      </div>

                      {form.watch("customFields").map((field, index) => (
                        <div key={field.id} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Field name (e.g., Company, Phone)"
                              value={field.name}
                              onChange={(e) => {
                                const currentFields = form.getValues("customFields");
                                currentFields[index].name = e.target.value;
                                form.setValue("customFields", [...currentFields]);
                              }}
                            />
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={field.required}
                                onCheckedChange={(checked) => {
                                  const currentFields = form.getValues("customFields");
                                  currentFields[index].required = checked;
                                  form.setValue("customFields", [...currentFields]);
                                }}
                              />
                              <Label className="text-sm">Required</Label>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCustomField(field.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Event Tags</CardTitle>
                    <CardDescription>
                      Add tags to help categorize and discover your event
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                      />
                      <Button type="button" variant="outline" onClick={addTag}>
                        Add
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {form.watch("tags").map((tag) => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Event Image</CardTitle>
                    <CardDescription>
                      Upload an image to represent your event
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="image-upload">Event Image</Label>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                    </div>

                    {imageUrl && (
                      <div className="space-y-2">
                        <Label>Preview</Label>
                        <img
                          src={imageUrl}
                          alt="Event preview"
                          className="w-full max-w-md h-48 object-cover rounded-md"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Engage your +chorus community
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>+chorus is a decentralized community platform built on Nostr that lets you create, join, and fund the groups and causes that matter to you.</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription>
                      Share this event with your groups on +chorus.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="proposeToCommunity"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Share on +chorus</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch("proposeToCommunity") && (
                      <>
                        {chorusGroups.isLoading ? (
                          <div className="space-y-2">
                            <Label>Community</Label>
                            <div className="flex items-center justify-center p-4 border rounded-md">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              Loading your communities...
                            </div>
                          </div>
                        ) : chorusGroups.data?.length === 0 ? (
                          <div className="space-y-2">
                            <Label>Community</Label>
                            <div className="p-4 border border-dashed rounded-md bg-muted/50">
                              <div className="text-center space-y-3">
                                <p className="text-sm text-muted-foreground">
                                  You're not a member of any +chorus communities yet.
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Join a community to share your events and get feedback from like-minded people.
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
                          <FormField
                            control={form.control}
                            name="communityId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Community</FormLabel>
                                <FormControl>
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
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
                                </FormControl>
                                <FormDescription>
                                  The community where you want to propose this event
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Creating..." : isEditing ? "Update Event" : "Create Event"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          {isLoadingUserEvents ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
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
          ) : userEvents?.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Events Found</CardTitle>
                <CardDescription>
                  You haven't created any events yet.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => navigate("/events/create")}>
                  Create Your First Event
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="space-y-4">
              {userEvents?.map((event) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                            {event.title}
                          </h3>
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {new Date(event.startTime * 1000) > new Date() ? "Upcoming" : "Past"}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <CalendarIcon2 className="h-4 w-4" />
                            <span>{new Date(event.startTime * 1000).toLocaleDateString()}</span>
                          </div>
                          
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/events/create?edit=${event.eventId}`)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/events/create?manage=${event.eventId}`)}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}