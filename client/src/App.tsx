import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Invite from "@/pages/invite";
import Account from "@/pages/account";
import MyServices from "@/pages/my-services";
import MyBookings from "@/pages/my-bookings";
import Administration from "@/pages/administration";
import AppHeader from "@/components/app-header";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/invite" component={Invite} />
      <Route path="/account" component={Account} />
      <Route path="/administration" component={Administration} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/my-services/*?" component={MyServices} />
      <Route path="/dashboard"><Redirect to="/my-services" /></Route>
      <Route path="/" component={isLoading || !isAuthenticated ? Landing : Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppHeader />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
