import { NavLink, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/aujourdhui", label: "Aujourd'hui" },
  { to: "/camps", label: "Mes camps" },
  { to: "/profil", label: "Profil" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <header className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-surface flex md:flex-col justify-between">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-8 h-8 rounded bg-accent flex items-center justify-center font-display font-bold text-bg text-lg">
              C
            </span>
            <span className="font-display text-lg tracking-wide uppercase">Camp</span>
          </div>
          <nav className="hidden md:flex md:flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? "bg-accent/15 text-accent" : "text-muted hover:text-text hover:bg-surface2"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="p-6 hidden md:block">
          {user && <p className="text-xs text-muted mb-2 truncate">{user.name}</p>}
          <button
            onClick={() => {
              logout();
              navigate("/connexion");
            }}
            className="text-sm text-muted hover:text-accent transition-colors"
          >
            Se deconnecter
          </button>
        </div>
      </header>

      <nav className="md:hidden flex justify-around bg-surface border-b border-border order-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 text-center py-3 text-xs font-medium ${isActive ? "text-accent" : "text-muted"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-5 md:p-10 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  );
}
