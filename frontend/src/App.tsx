import { Navigate, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import CreateCamp from "./pages/CreateCamp";
import JoinCamp from "./pages/JoinCamp";
import CampDetail from "./pages/CampDetail";
import Today from "./pages/Today";
import Progress from "./pages/Progress";

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted">Chargement...</div>;
  if (!user) return <Navigate to="/connexion" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />

      <Route path="/aujourdhui" element={<Private><Today /></Private>} />
      <Route path="/profil" element={<Private><Profile /></Private>} />
      <Route path="/camps" element={<Private><Dashboard /></Private>} />
      <Route path="/camps/creer" element={<Private><CreateCamp /></Private>} />
      <Route path="/camps/rejoindre" element={<Private><JoinCamp /></Private>} />
      <Route path="/camps/:id" element={<Private><CampDetail /></Private>} />
      <Route path="/camps/:id/progression/:exerciseId" element={<Private><Progress /></Private>} />

      <Route path="*" element={<Navigate to="/aujourdhui" replace />} />
    </Routes>
  );
}
