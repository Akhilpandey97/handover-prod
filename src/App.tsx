import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { LabelsProvider } from "@/contexts/LabelsContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Switching browser tabs should not remount/refresh the whole app
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <AuthProvider>
          <LabelsProvider>
            <ProjectProvider>
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/projects/:projectId" element={<ProjectWorkspace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </ProjectProvider>
          </LabelsProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
