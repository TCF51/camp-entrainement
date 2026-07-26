import { NavLink, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

const desktopNavItems = [
  { to: "/aujourdhui", label: "Aujourd'hui" },
  { to: "/camps", label: "Mes camps" },
  { to: "/chrono", label: "Chrono" },
  { to: "/exercices", label: "Exercices" },
  { to: "/messages", label: "Messages" },
  { to: "/historique", label: "Historique" },
  { to: "/profil", label: "Profil" },
];

// Sur mobile, la barre du bas ne montre que l'essentiel : le Chrono a sa propre bulle
// centrale, les autres onglets (Exercices, Historique) restent accessibles depuis le menu
// complet sur ordinateur, ou via des liens dans "Mes camps" / "Profil" sur mobile.
const mobileLeftItems = [
  { to: "/aujourdhui", label: "Aujourd'hui", icon: "📅" },
  { to: "/camps", label: "Camps", icon: "🏕️" },
];
const mobileRightItems = [
  { to: "/messages", label: "Messages", icon: "💬" },
  { to: "/profil", label: "Profil", icon: "👤" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <header className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-surface flex md:flex-col justify-between">
        <div className="p-4 md:p-6 w-full">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-0 md:mb-8">
            <img src="/logo-mark.png" alt="" className="w-11 h-11 md:w-8 md:h-8 object-contain" />
            <span className="font-display text-xl md:text-lg tracking-wide uppercase">GoTeam</span>
          </div>
          <nav className="hidden md:flex md:flex-col gap-1">
            {desktopNavItems.map((item) => (
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

      <main className="flex-1 p-5 pb-24 md:p-10 md:pb-10 max-w-4xl mx-auto w-full order-1">{children}</main>

      {/* Barre de navigation mobile, fixee en bas, avec le Chrono en bulle centrale */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border flex items-end justify-around pb-1 pt-2 z-40">
        {mobileLeftItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium ${
                isActive ? "text-accent" : "text-muted"
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <NavLink to="/chrono" className="flex-1 flex flex-col items-center -mt-7">
          {({ isActive }) => (
            <>
              <span
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg border-4 border-bg ${
                  isActive ? "bg-accentSoft" : "bg-accent"
                } text-bg`}
              >
                ⏱
              </span>
              <span className={`text-[10px] font-medium mt-0.5 ${isActive ? "text-accent" : "text-muted"}`}>
                Chrono
              </span>
            </>
          )}
        </NavLink>

        {mobileRightItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium ${
                isActive ? "text-accent" : "text-muted"
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
