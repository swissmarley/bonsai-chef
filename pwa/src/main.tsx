import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './App';
import { ToastProvider } from './components/Toast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ApiError } from './lib/api';
import { clearUserData } from './lib/queries';
import './lib/install';
import './styles.css';

// Any 401 means the session ended (expired or logged out elsewhere): drop the user's data and show the login screen.
const onError = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) void clearUserData(queryClient);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry only network/server problems, never "not allowed"/"not found".
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
        {/* Registers the service worker on every screen, login included (offline start + install prompt). */}
        <UpdatePrompt />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
