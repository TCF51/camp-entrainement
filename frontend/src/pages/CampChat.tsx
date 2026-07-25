import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface CampMessage {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
}

export default function CampChat() {
  const { id: campId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<CampMessage[] | null>(null);
  const [text, setText] = useState("");
  const [campName, setCampName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    if (!campId) return;
    api.get<CampMessage[]>(`/camps/${campId}/messages`).then(setMessages);
  }

  useEffect(() => {
    if (!campId) return;
    api.get<{ name: string }>(`/camps/${campId}`).then((c) => setCampName(c.name));
    load();
    // Rafraichissement simple par sondage, suffisant pour un usage a deux/quelques personnes
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [campId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !campId) return;
    await api.post(`/camps/${campId}/messages`, { body: text.trim() });
    setText("");
    load();
  }

  return (
    <div className="max-w-xl flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
      <Link to={`/camps/${campId}`} className="text-sm text-muted hover:text-accent mb-2">
        ← Retour au camp
      </Link>
      <h1 className="font-display text-2xl uppercase tracking-wide mb-4">Discussion · {campName}</h1>

      <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-xl p-4 space-y-3 mb-3">
        {messages === null && <p className="text-muted text-sm">Chargement...</p>}
        {messages?.length === 0 && (
          <p className="text-muted text-sm text-center py-8">Aucun message pour l'instant, lance la discussion !</p>
        )}
        {messages?.map((m) => {
          const isMine = m.user.id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isMine ? "bg-accent/20" : "bg-surface2"}`}>
                {!isMine && <p className="text-[10px] text-muted mb-0.5">{m.user.name}</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className="text-[10px] text-muted mt-1">
                  {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ecris un message..."
          className="flex-1 bg-surface2 border border-border rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-4 py-2 text-sm"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
