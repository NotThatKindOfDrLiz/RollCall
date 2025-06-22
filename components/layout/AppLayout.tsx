import { useNavigate, useLocation } from "react-router-dom";
import { LoginArea } from "@/components/auth/LoginArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface AppLayoutProps {
  children: React.ReactNode;
  hideHeaderLogin?: boolean;
}

export function AppLayout({ children, hideHeaderLogin = false }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();

  // Hide header login on homepage when user is not logged in
  const shouldHideLogin = hideHeaderLogin || (location.pathname === "/" && !user);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Elegant header */}
      <header className="border-b border-white/10 dark:border-slate-700/20 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-30">
        <div className="container flex justify-between items-center py-4">
          <button 
            onClick={() => navigate("/")}
            className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            RollCall
          </button>
          {!shouldHideLogin && <LoginArea className="min-w-24" />}
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}