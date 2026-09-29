import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError, MOCK_API } from "./api/client";
import { queryKeys } from "./api/queries";
import { router } from "./router";
// The two fonts ship with the app (Fontsource, SIL Open Font License): no request to Google, so no
// visitor data leaves the site. Only the weights the styles use.
import "@fontsource/press-start-2p/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./styles.css";

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // A 401 on any call means the session ended (signed out elsewhere, blocked, ...):
    // re-check who is signed in, so the UI falls back to its signed-out state.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx answers won't change by asking again; only retry network and server errors.
      retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
    },
  },
});

function isClientError(error: Error): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

// Mock mode loads the pretend API first; the import keeps it out of the production bundle.
if (MOCK_API) {
  const { startMockApi } = await import("./mocks/browser");
  await startMockApi();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
