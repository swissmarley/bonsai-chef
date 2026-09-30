import { useQueryClient } from '@tanstack/react-query';
import { TreeDeciduous } from 'lucide-react';
import { useEffect } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, ScrollRestoration, useRouteError } from 'react-router';
import { EmptyState, ErrorState, Splash } from './components/States';
import { TabBar } from './components/TabBar';
import { syncPushSubscription } from './lib/push';
import { useMe, useReminders } from './lib/queries';
import { BonsaiDetailPage } from './pages/BonsaiDetailPage';
import { BonsaiFormPage } from './pages/BonsaiFormPage';
import { ListPage } from './pages/ListPage';
import { LoginPage } from './pages/LoginPage';
import { ToolDetailPage } from './pages/ToolDetailPage';
import { ToolFormPage } from './pages/ToolFormPage';

/** Auth gate: splash while checking the session, login when signed out, the app otherwise. */
function Root() {
  const me = useMe();
  const qc = useQueryClient();

  if (me.isPending) return <Splash />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void qc.resetQueries({ queryKey: ['me'] })} />;
  if (!me.data) return <LoginPage />;
  return (
    <>
      <SignedInEffects />
      <Outlet />
      <ScrollRestoration />
    </>
  );
}

function SignedInEffects() {
  useReminders(); // keep pending reminders warm for the detail pages
  const qc = useQueryClient();
  useEffect(() => {
    syncPushSubscription().catch(() => {}); // this device's notifications belong to the current account
  }, []);
  useEffect(() => {
    // Refresh data when coming back to the app (e.g. after a reminder notification).
    const onVisible = () => {
      if (document.visibilityState === 'visible') void qc.invalidateQueries({ queryKey: ['reminders'] });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [qc]);
  return null;
}

function TabsLayout() {
  return (
    <div className="app">
      <main className="app-main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

function FormLayout() {
  return (
    <div className="app is-form">
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <EmptyState icon={TreeDeciduous} title="Pagina non trovata" text="Il link che hai seguito non esiste.">
      <Link to="/tutti" className="btn btn-primary">
        Vai ai tuoi bonsai
      </Link>
    </EmptyState>
  );
}

function RouteError() {
  const error = useRouteError();
  console.error(error);
  return <ErrorState error={new Error('Si è verificato un errore imprevisto. Ricarica la pagina.')} onRetry={() => location.reload()} />;
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        element: <TabsLayout />,
        children: [
          { index: true, element: <Navigate to="/tutti" replace /> },
          { path: 'tutti', element: <ListPage view="tutti" /> },
          { path: 'esterno', element: <ListPage view="esterno" /> },
          { path: 'interno', element: <ListPage view="interno" /> },
          { path: 'strumenti', element: <ListPage view="strumenti" /> },
          { path: 'bonsai/:id', element: <BonsaiDetailPage /> },
          { path: 'strumenti/:id', element: <ToolDetailPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        element: <FormLayout />,
        children: [
          { path: 'bonsai/nuovo', element: <BonsaiFormPage /> },
          { path: 'bonsai/:id/modifica', element: <BonsaiFormPage /> },
          { path: 'strumenti/nuovo', element: <ToolFormPage /> },
          { path: 'strumenti/:id/modifica', element: <ToolFormPage /> },
        ],
      },
    ],
  },
]);
