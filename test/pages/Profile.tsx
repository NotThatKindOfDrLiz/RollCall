import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useNostrLogin } from "@nostrify/react/login";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LoginArea } from "@/components/auth/LoginArea";
import { AppLayout } from "@/components/layout/AppLayout";
import { Camera, Download, Eye, EyeOff, User, Wallet, Save, Settings } from "lucide-react";
import { genUserName } from "@/lib/genUserName";

export default function Profile() {
  const navigate = useNavigate();
  const { user, metadata } = useCurrentUser();
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userNsec, setUserNsec] = useState<string>("");

  // Get the current login to access nsec
  const currentLogin = logins[0];

  const [formData, setFormData] = useState({
    name: metadata?.name || "",
    display_name: metadata?.display_name || "",
    about: metadata?.about || "",
    website: metadata?.website || "",
    nip05: metadata?.nip05 || "",
    lud06: metadata?.lud06 || "",
    lud16: metadata?.lud16 || "",
    picture: metadata?.picture || "",
  });

  // Check if user has any metadata events (indicates if they're new)
  const { data: hasMetadata } = useQuery({
    queryKey: ['user-metadata', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey) return false;
      
      const events = await nostr.query(
        [{ kinds: [0], authors: [user.pubkey], limit: 1 }],
        { signal: AbortSignal.timeout(1500) }
      );
      
      return events.length > 0;
    },
    enabled: !!user?.pubkey,
  });

  // Detect if this is a new user (created through signup process)
  useEffect(() => {
    // Only treat as new user if they were created through the signup process
    // This is indicated by having the nsec stored from signup AND no existing metadata
    if (hasMetadata === false && user?.method === 'nsec' && currentLogin?.type === 'nsec') {
      const loginData = currentLogin as { data: { nsec: string } };
      // Only treat as new user if we have the nsec from signup (indicating they just created the account)
      if (loginData.data?.nsec) {
        setIsNewUser(true);
        setUserNsec(loginData.data.nsec);
        
        // Only auto-generate username if they don't have any name set
        if (user?.pubkey && !metadata?.name && !formData.name) {
          const generatedName = genUserName(user.pubkey);
          setFormData(prev => ({
            ...prev,
            name: generatedName
          }));
        }
      } else {
        setIsNewUser(false);
      }
    } else {
      setIsNewUser(false);
    }
  }, [hasMetadata, user?.method, currentLogin, user?.pubkey, metadata?.name, formData.name]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const [[_, url]] = await uploadFile(file);
      setFormData(prev => ({
        ...prev,
        picture: url
      }));
      toast({
        title: "Image uploaded",
        description: "Your profile picture has been updated.",
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Filter out empty fields
    const metadata = Object.fromEntries(
      Object.entries(formData).filter(([_, value]) => value.trim() !== "")
    );

    publishEvent(
      {
        kind: 0,
        content: JSON.stringify(metadata),
      },
      {
        onSuccess: () => {
          toast({
            title: "Profile updated",
            description: "Your profile has been successfully updated.",
          });
          
          // For new users, keep showing their private key after saving
          if (isNewUser) {
            toast({
              title: "Account setup complete!",
              description: "Your profile is saved and your private key is still available below. Please save it securely.",
            });
          }
        },
        onError: (_error) => {
          toast({
            title: "Update failed",
            description: "Failed to update profile. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const downloadPrivateKey = () => {
    // Only available for nsec login method
    if (user?.method !== 'nsec') {
      toast({
        title: "Private key not available",
        description: "Private key download is only available when using nsec login method.",
        variant: "destructive",
      });
      return;
    }

    // For new users, download the nsec
    if (isNewUser && userNsec) {
      const blob = new Blob([userNsec], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rollcall-nsec.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Private key downloaded",
        description: "Your private key has been downloaded. Keep it safe!",
      });
      return;
    }

    toast({
      title: "Private key download",
      description: "To download your private key, please use your Nostr client or extension settings.",
    });
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="container max-w-md py-6">
          <Card className="action-card border border-border/50 bg-background/95">
            <CardHeader>
              <CardTitle className="text-xl">Login Required</CardTitle>
              <CardDescription>You need to login to view and edit your profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">To view and edit your profile, you'll need to authenticate with your Nostr identity.</p>
              <LoginArea className="w-full" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-md py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Profile Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile information and preferences</p>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full mb-6 bg-secondary/50 p-0.5 h-auto rounded-full">
            <TabsTrigger 
              value="basic" 
              className="flex-1 py-1.5 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"
            >
              Basic Info
            </TabsTrigger>
            <TabsTrigger 
              value="advanced" 
              className="flex-1 py-1.5 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"
            >
              Advanced
            </TabsTrigger>
            <TabsTrigger 
              value="wallet" 
              className="flex-1 py-1.5 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm" 
              disabled
            >
              <Wallet className="h-3 w-3 mr-1" />
              Wallet
              <Badge variant="secondary" className="ml-2 text-[10px] py-0 h-4">Soon</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture Section */}
              <Card className="action-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Profile Picture</CardTitle>
                  <CardDescription className="text-xs">Upload a new profile picture</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={formData.picture} alt={formData.name || "Profile"} />
                      <AvatarFallback>
                        {formData.name ? formData.name.charAt(0) : <User className="h-6 w-6" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Label htmlFor="picture-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Camera className="h-4 w-4" />
                          {isUploading ? "Uploading..." : "Choose image"}
                        </div>
                      </Label>
                      <input
                        id="picture-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                      {formData.picture && (
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                          {formData.picture}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Basic Information */}
              <Card className="action-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Basic Information</CardTitle>
                  <CardDescription className="text-xs">Your name and personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name" className="text-xs font-medium">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder="Your name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="display_name" className="text-xs font-medium">Display Name</Label>
                      <Input
                        id="display_name"
                        value={formData.display_name}
                        onChange={(e) => handleInputChange("display_name", e.target.value)}
                        placeholder="Display name (optional)"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="about" className="text-xs font-medium">About</Label>
                    <Textarea
                      id="about"
                      value={formData.about}
                      onChange={(e) => handleInputChange("about", e.target.value)}
                      placeholder="Tell us about yourself"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website" className="text-xs font-medium">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange("website", e.target.value)}
                      placeholder="https://example.com"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Private Key Management */}
              <Card className="action-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Account Security</CardTitle>
                  <CardDescription className="text-xs">
                    {user?.method === 'nsec'
                      ? isNewUser
                        ? "This is your private key. Save it securely. You will need it to log in again."
                        : "Your private key is used to sign actions. Never share it."
                      : "Private key management is only available for nsec logins."
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Private Key</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          disabled={user?.method !== 'nsec'}
                          className="h-8 text-xs"
                        >
                          {showPrivateKey ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showPrivateKey ? "Hide" : "Show"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={downloadPrivateKey}
                          disabled={user?.method !== 'nsec'}
                          className="h-8 text-xs"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <code className="text-xs break-all">
                        {showPrivateKey && user?.method === 'nsec'
                          ? (isNewUser && userNsec ? userNsec : "Private key available for nsec login method")
                          : (user?.method === 'nsec' ? "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••" : "Private key not available for current login method")
                        }
                      </code>
                    </div>
                    {user?.method === 'nsec' && (
                      <div className="text-xs text-muted-foreground">
                        {isNewUser
                          ? "Download and store your private key securely. This is your only way to access your account."
                          : "Download your private key as a backup and store it securely offline."
                        }
                      </div>
                    )}
                    {user?.method === 'extension' && (
                      <div className="text-xs text-muted-foreground">
                        Your private key is stored securely in your browser extension. To access it, check your extension's settings or export options.
                      </div>
                    )}
                    {user?.method === 'bunker' && (
                      <div className="text-xs text-muted-foreground">
                        Your private key is stored on a remote server. Contact your signer provider to access your private key.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  size="sm"
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-primary text-white hover:bg-primary/90 h-9"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="advanced">
            <div className="space-y-6">
              <Card className="action-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" />
                    <div>
                      <CardTitle className="text-base font-medium">Advanced Settings</CardTitle>
                      <CardDescription className="text-xs">
                        Technical settings for Nostr integration
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* NIP-05 Identifier */}
                  <div>
                    <Label htmlFor="nip05" className="text-xs font-medium">NIP-05 Identifier</Label>
                    <Input
                      id="nip05"
                      value={formData.nip05}
                      onChange={(e) => handleInputChange("nip05", e.target.value)}
                      placeholder="user@domain.com"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This verifies your identity on Nostr. Leave empty if you don't have one.
                    </p>
                  </div>

                  {/* Lightning Addresses */}
                  <div>
                    <Label className="text-xs font-medium">Lightning Addresses</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      For receiving payments and tips (optional)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="lud06" className="text-xs font-medium">LUD-06 Address</Label>
                        <Input
                          id="lud06"
                          value={formData.lud06}
                          onChange={(e) => handleInputChange("lud06", e.target.value)}
                          placeholder="Lightning address"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lud16" className="text-xs font-medium">LUD-16 Address</Label>
                        <Input
                          id="lud16"
                          value={formData.lud16}
                          onChange={(e) => handleInputChange("lud16", e.target.value)}
                          placeholder="user@domain.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Public Key Display */}
                  <div>
                    <Label className="text-xs font-medium">Your Public Key</Label>
                    <p className="text-xs text-muted-foreground mb-1">
                      This is your unique Nostr identifier
                    </p>
                    <div className="bg-muted p-2.5 rounded-md">
                      <code className="text-xs break-all">{user.pubkey}</code>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button for Advanced Settings */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  size="sm"
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="bg-primary text-white hover:bg-primary/90 h-9"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {isPending ? "Saving..." : "Save Advanced Settings"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="wallet">
            <Card className="action-card">
              <CardHeader className="text-center pt-6 pb-2">
                <Wallet className="h-10 w-10 mx-auto mb-4 text-primary opacity-50" />
                <CardTitle className="text-lg font-medium">Coming Soon</CardTitle>
                <CardDescription>
                  Wallet and payment features will be available in a future update.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pb-6">
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  We're working on integrating Lightning payments and wallet functionality 
                  for a seamless event experience.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
} 