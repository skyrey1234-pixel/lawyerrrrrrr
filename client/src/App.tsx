/**
 * The Litigator's Desk shell: dark, focused, and intentionally single-purpose.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Admin from "./pages/Admin";
import Audit from "./pages/Audit";
import BillingCopilot from "./pages/BillingCopilot";
import Compare from "./pages/Compare";
import MatterDetail from "./pages/MatterDetail";
import MatterIntelligence from "./pages/MatterIntelligence";
import Matters from "./pages/Matters";
import PilotDashboard from "./pages/PilotDashboard";
import SessionReview from "./pages/SessionReview";
import Sessions from "./pages/Sessions";

function Protected({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/matters/:matterId">{params => <Protected><MatterDetail matterId={Number(params.matterId)} /></Protected>}</Route>
      <Route path="/sessions/:sessionId">{params => <Protected><SessionReview sessionId={Number(params.sessionId)} /></Protected>}</Route>
      <Route path="/matters"><Protected><Matters /></Protected></Route>
      <Route path="/sessions"><Protected><Sessions /></Protected></Route>
      <Route path="/intelligence"><Protected><MatterIntelligence /></Protected></Route>
      <Route path="/billing"><Protected><BillingCopilot /></Protected></Route>
      <Route path="/compare"><Protected><Compare /></Protected></Route>
      <Route path="/audit"><Protected><Audit /></Protected></Route>
      <Route path="/admin"><Protected><Admin /></Protected></Route>
      <Route path="/dictate"><Protected><Home /></Protected></Route>
      <Route path="/"><Protected><PilotDashboard /></Protected></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="bottom-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
