import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Clock, Calendar, Download } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface CheckIn {
  id: string;
  pubkey: string;
  eventId: string;
  checkInTime: number;
  name?: string;
  email?: string;
  location?: string;
  customData: Record<string, unknown>;
}

interface EventAnalyticsProps {
  eventId: string;
  _eventTitle: string;
  startTime: number;
  endTime: number;
  expectedAttendees?: number;
  checkIns: CheckIn[];
  className?: string;
}

export function EventAnalytics({
  eventId,
  _eventTitle,
  startTime,
  endTime,
  expectedAttendees = 0,
  checkIns,
  className
}: EventAnalyticsProps) {
  const { toast } = useToast();

  // Calculate analytics
  const totalCheckIns = checkIns.length;
  const checkInRate = expectedAttendees > 0 ? (totalCheckIns / expectedAttendees) * 100 : 0;
  const isEventActive = Date.now() / 1000 >= startTime && Date.now() / 1000 <= endTime;
  const isEventEnded = Date.now() / 1000 > endTime;
  const isEventUpcoming = Date.now() / 1000 < startTime;

  // Check-in timing analysis
  const earlyCheckIns = checkIns.filter(checkIn => checkIn.checkInTime < startTime).length;
  const onTimeCheckIns = checkIns.filter(checkIn => 
    checkIn.checkInTime >= startTime && checkIn.checkInTime <= startTime + 1800 // Within 30 minutes
  ).length;
  const lateCheckIns = checkIns.filter(checkIn => checkIn.checkInTime > startTime + 1800).length;

  // Export functionality
  const exportAttendanceList = () => {
    try {
      const csvData = [
        ['Name', 'Email', 'Check-in Time', 'Location'],
        ...checkIns.map(checkIn => [
          checkIn.name || 'Anonymous',
          checkIn.email || '',
          new Date(checkIn.checkInTime * 1000).toLocaleString(),
          checkIn.location || ''
        ])
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${eventId}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Attendance Exported",
        description: "Attendance list downloaded as CSV",
        variant: "default",
      });
    } catch (error) {
      console.error('Error exporting attendance:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export attendance list",
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
    <div className={`space-y-6 ${className}`}>
      {/* Event Status */}
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
            Event Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Event Status Badge */}
          <div className="flex items-center gap-2">
            {isEventUpcoming && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Clock className="mr-1 h-3 w-3" />
                Upcoming
              </Badge>
            )}
            {isEventActive && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                <TrendingUp className="mr-1 h-3 w-3" />
                Active
              </Badge>
            )}
            {isEventEnded && (
              <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <Calendar className="mr-1 h-3 w-3" />
                Ended
              </Badge>
            )}
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {formatDate(startTime)}
            </span>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalCheckIns}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Total Check-ins
              </div>
            </div>
            
            {expectedAttendees > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {checkInRate.toFixed(1)}%
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Check-in Rate
                </div>
              </div>
            )}

            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {earlyCheckIns}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Early Arrivals
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {onTimeCheckIns}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                On Time
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {expectedAttendees > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Attendance Progress
                </span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {totalCheckIns} / {expectedAttendees}
                </span>
              </div>
              <Progress value={checkInRate} className="h-2" />
            </div>
          )}

          {/* Check-in Timing Breakdown */}
          {totalCheckIns > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-900 dark:text-white">
                Check-in Timing
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Early ({earlyCheckIns})
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {((earlyCheckIns / totalCheckIns) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    On Time ({onTimeCheckIns})
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {((onTimeCheckIns / totalCheckIns) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Late ({lateCheckIns})
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {((lateCheckIns / totalCheckIns) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Export Button */}
          {totalCheckIns > 0 && (
            <Button
              onClick={exportAttendanceList}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Attendance List
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 