import { useEffect, useRef } from "react";
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { MobileNav, NavRail } from "./components/NavRail";
import { TopBar } from "./components/TopBar";
import HomePage from "./pages/Home";
import NewTask from "./pages/NewTask";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Player from "./pages/Player";
import Settings from "./pages/Settings";

function Shell() {
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface text-ink">
      <NavRail />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-4 sm:px-6 sm:pb-8 sm:pt-5">
            <div key={pathname} className="animate-fade-up">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/task/new" element={<NewTask />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/player/:id/:fileIdx" element={<Player />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}