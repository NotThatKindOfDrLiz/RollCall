import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Bookmarks from "./pages/Bookmarks";
import CreateEvent from "./pages/events/CreateEvent";
import CheckIn from "./pages/events/CheckIn";
import EventDetails from "./pages/events/EventDetails";
import MyAttendance from "./pages/events/MyAttendance";
import FlockstrEvents from "@/pages/events/FlockstrEvents";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        
        {/* Profile Routes */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        
        {/* Event Routes */}
        <Route path="/events/create" element={<CreateEvent />} />
        <Route path="/events/edit/:eventId" element={<CreateEvent />} />
        <Route path="/events/check-in" element={<CheckIn />} />
        <Route path="/events/check-in/:eventId" element={<CheckIn />} />
        <Route path="/events/my-attendance" element={<MyAttendance />} />
        <Route path="/events/flockstr" element={<FlockstrEvents />} />
        <Route path="/events/manage/:eventId" element={<EventDetails />} />
        <Route path="/events/view/:eventId" element={<EventDetails />} />
        
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;