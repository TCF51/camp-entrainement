import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  relatedId: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function loadUnreadCount() {
    api.get<{ count: number }>("/notifications/unread-count").then((res) => setUnreadCount(res.count));
  }

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function toggleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      const list = await api.get<NotificationItem[]>("/notifications");
      setNotifications(list);
    }
  }

  async function onItemClick(n: NotificationItem) {
    if (!n.read) {
      await api.post(`/notifications/${n.id}/read`, {});
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function markAllRead() {
    await api.post("/notifications/read-all", {});
    setUnreadCount(0);
    setNotifications((prev) => prev?.map((x) => ({ ...x, read: true })) ?? null);
  }

  async function respondToTeammateRequest(n: NotificationItem, accept: boolean) {
    if (!n.relatedId) return;
    if (accept) {
      await api.post(`/connections/${n.relatedId}/accept`, {});
    } else {
      await api.del(`/connections/${n.relatedId}`);
    }
    await api.post(`/notifications/${n.id}/read`, {});
    setNotifications((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
    setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
  }

  const typeEmoji: Record<string, string> = {
    REACTION: "👏",
    CAMP_MESSAGE: "💬",
    DIRECT_MESSAGE: "💬",
    TEAMMATE_REQUEST: "🤝",
    CAMP_UPDATED: "📋",
    REMINDER: "💪",
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggleOpen}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface2 transition-colors"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] max-h-[70vh] overflow-y-auto bg-surface border border-border rounded-xl shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-surface">
            <p className="font-display uppercase tracking-wide text-sm">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:text-accentSoft">
                Tout marquer lu
              </button>
            )}
          </div>

          {notifications === null && <p className="text-muted text-sm p-4">Chargement...</p>}
          {notifications?.length === 0 && (
            <p className="text-muted text-sm p-4 text-center">Rien de nouveau pour l'instant.</p>
          )}

          <div className="divide-y divide-border">
            {notifications?.map((n) => (
              <div key={n.id} className={`p-3 ${n.read ? "" : "bg-accent/5"}`}>
                <button onClick={() => onItemClick(n)} className="w-full text-left">
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">{typeEmoji[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted">{n.body}</p>
                      <p className="text-[10px] text-muted mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1" />}
                  </div>
                </button>
                {n.type === "TEAMMATE_REQUEST" && !n.read && (
                  <div className="flex gap-2 mt-2 ml-7">
                    <button
                      onClick={() => respondToTeammateRequest(n, true)}
                      className="text-xs bg-accent text-white font-semibold rounded-md px-3 py-1"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => respondToTeammateRequest(n, false)}
                      className="text-xs text-muted hover:text-accent"
                    >
                      Refuser
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
