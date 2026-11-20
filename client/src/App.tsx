import { createBrowserRouter, Navigate, RouterProvider, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Button } from "./components/Button";
import { Spinner } from "./components/ui";
import { useAuth } from "./context/AuthContext";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { CreateRoomScreen } from "./screens/CreateRoomScreen";
import { JoinRoomScreen } from "./screens/JoinRoomScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { GpsPermissionScreen } from "./screens/GpsPermissionScreen";
import { GpsAccuracyScreen } from "./screens/GpsAccuracyScreen";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  return <AppShell />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-3xl font-black text-white">404</h1>
      <p className="mt-2 text-sm text-slate-400">That route does not exist.</p>
      <div className="mt-4">
        <a href="/dashboard">
          <Button>Back to dashboard</Button>
        </a>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <HomeScreen /> },
  { path: "/login", element: <LoginScreen /> },
  { path: "/register", element: <RegisterScreen /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: "/dashboard", element: <DashboardScreen /> },
      { path: "/create-room", element: <CreateRoomScreen /> },
      { path: "/join-room", element: <JoinRoomScreen /> },
      { path: "/lobby/:code", element: <LobbyScreen /> },
      { path: "/gps-permission", element: <GpsPermissionScreen /> },
      { path: "/gps-accuracy", element: <GpsAccuracyScreen /> },
      { path: "/game/:code", element: <GameScreen /> },
      { path: "/results/:code", element: <ResultsScreen /> },
      { path: "/profile", element: <ProfileScreen /> },
      { path: "/leaderboard", element: <LeaderboardScreen /> },
      { path: "/settings", element: <SettingsScreen /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
