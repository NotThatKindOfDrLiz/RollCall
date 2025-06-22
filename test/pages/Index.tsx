import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoginArea } from "@/components/auth/LoginArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, ChevronRight, Sparkles, Users, Award } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

// Built with MKStack: https://soapbox.pub/mkstack

export default function Home() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "RollCall - Event Check-in";
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Compact Hero Section */}
        <div className="container max-w-2xl mx-auto pt-4 pb-1 px-4">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white mb-1">
              Event attendance management made simple.
            </h1>
            {!user && (
              <div className="flex justify-center mt-1">
                <LoginArea className="w-full max-w-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-6xl py-4 px-4">
          <Tabs defaultValue="actions" className="w-full">
            <TabsList className="w-full mb-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-1 h-auto rounded-2xl border border-white/20 dark:border-slate-700/20">
              <TabsTrigger 
                value="actions" 
                className="flex-1 py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-sm font-medium transition-all duration-200"
              >
                Quick Actions
              </TabsTrigger>
              <TabsTrigger 
                value="about" 
                className="flex-1 py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-sm font-medium transition-all duration-200"
              >
                About RollCall
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="actions" className="space-y-3">
              {user ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                        Create & Manage
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
                        Create new events or manage existing ones
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="p-4 pt-0 mt-auto">
                      <Button 
                        size="sm"
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                        onClick={() => navigate('/events/create')}
                      >
                        Create & Manage →
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                        Check In
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
                        Enter an event code to check in
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="p-4 pt-0 mt-auto">
                      <Button 
                        size="sm"
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                        onClick={() => navigate('/events/check-in')}
                      >
                        Check In →
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                        My Attendance
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
                        View events you've attended
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="p-4 pt-0 mt-auto">
                      <Button 
                        size="sm"
                        className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
                        onClick={() => navigate('/events/attendance')}
                      >
                        View Attendance →
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                        Flockstr Events
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
                        Browse and import events from Flockstr calendar
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="p-4 pt-0 mt-auto">
                      <Button 
                        size="sm"
                        className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
                        onClick={() => navigate('/events/flockstr')}
                      >
                        Browse Events →
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <User className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Get Started with RollCall</h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      Sign in above to access all features and start managing your events.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="about" className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="relative pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">For Hosts</CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">Create and manage your events</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative pb-4">
                    <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 mt-2 flex-shrink-0"></div>
                        <span>Create events</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 mt-2 flex-shrink-0"></div>
                        <span>Generate unique check-in codes and QR codes</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 mt-2 flex-shrink-0"></div>
                        <span>View real-time attendance with insightful analytics</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 mt-2 flex-shrink-0"></div>
                        <span>Export attendance certificates, badges, and more</span>
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter className="relative pt-0">
                    <Button 
                      onClick={() => navigate("/events/create")} 
                      disabled={!user}
                      className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 group/btn"
                      size="lg"
                    >
                      <span>{user ? "Create & Manage Events" : "Sign in above to get started"}</span>
                      <ChevronRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="relative pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Award className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">For Participants</CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">Check in and manage your attendance</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative pb-4">
                    <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-2 flex-shrink-0"></div>
                        <span>Securely check in to events with one tap</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-2 flex-shrink-0"></div>
                        <span>Maintain a certified attendance record</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-2 flex-shrink-0"></div>
                        <span>View your attendance history</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-2 flex-shrink-0"></div>
                        <span>Receive verifiable digital certificates</span>
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter className="relative pt-0">
                    <Button 
                      onClick={() => navigate("/events/check-in")}
                      disabled={!user}
                      className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 group/btn"
                      size="lg"
                    >
                      <span>{user ? "Check In" : "Sign in above to get started"}</span>
                      <ChevronRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <footer className="py-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Built with 💜 and{" "}
            <a
              href="https://soapbox.pub/mkstack"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              MKStack
            </a>
          </p>
        </footer>
      </div>
    </AppLayout>
  );
}