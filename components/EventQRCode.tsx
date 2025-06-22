import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface EventQRCodeProps {
  eventId: string;
  eventTitle: string;
  className?: string;
}

export function EventQRCode({ eventId, eventTitle, className }: EventQRCodeProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsLoading(true);
        const eventUrl = `${window.location.origin}/events/check-in/${eventId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(eventUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeDataUrl(qrCodeDataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
        toast({
          title: "QR Code Error",
          description: "Failed to generate QR code",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    generateQRCode();
  }, [eventId, toast]);

  const downloadQRCode = async () => {
    try {
      const link = document.createElement('a');
      link.download = `rollcall-${eventId}-qr.png`;
      link.href = qrCodeDataUrl;
      link.click();
      
      toast({
        title: "QR Code Downloaded",
        description: "QR code saved to your device",
        variant: "default",
      });
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download QR code",
        variant: "destructive",
      });
    }
  };

  const copyEventUrl = async () => {
    try {
      const eventUrl = `${window.location.origin}/events/check-in/${eventId}`;
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Event URL Copied",
        description: "Event URL copied to clipboard",
        variant: "default",
      });
    } catch (error) {
      console.error('Error copying URL:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy event URL",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
          Event QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg shadow-lg">
                <img 
                  src={qrCodeDataUrl} 
                  alt={`QR code for ${eventTitle}`}
                  className="w-48 h-48"
                />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Scan this QR code to check in to the event
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 font-mono">
                {eventId}
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={downloadQRCode}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Download QR
              </Button>
              <Button 
                onClick={copyEventUrl}
                variant="outline"
                className="border-slate-200 dark:border-slate-600"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 