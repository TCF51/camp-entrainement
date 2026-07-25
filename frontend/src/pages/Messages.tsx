import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Contact {
  id: string;
  name: string;
}

interface DirectMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  recipientId: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<DirectMessage[] | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Contact[]>("/messages/contacts").then((list) => {
      setContacts(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadConversation() {
    if (!selected) return;
    api.get<DirectMessage[]>(`/messages/${selected.id}`).then(setMessages);
  }

  useEffect(() => {
    if (!selected) return;
    loadConversation();
    const interval = setInterval(loadConversation, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !selected) return;
    await api.post("/messages", { recipientId: selected.id, body: text.trim() });
    setText("");
    loadConversation();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Messages</h1>
      <p className="text-muted text-sm mb-6">
        Discute en prive avec les membres des camps que tu partages avec eux.
      </p>

      {contacts?.length === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm">
            Rejoins ou cree un camp pour pouvoir echanger en prive avec d'autres membres.
          </p>
        </div>
      )}

      {contacts && contacts.length > 0 && (
        <div className="flex gap-4 h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)]">
          <div className="w-40 shrink-0 space-y-1 overflow-y-auto">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  selected?.id === c.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface2"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-xl p-4 space-y-3 mb-3">
              {messages === null && <p className="text-muted text-sm">Chargement...</p>}
              {messages?.length === 0 && (
                <p className="text-muted text-sm text-center py-8">Aucun message avec {selected?.name} pour l'instant.</p>
              )}
              {messages?.map((m) => {
                const isMine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMine ? "bg-accent/20" : "bg-surface2"}`}>
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
                placeholder={`Ecrire a ${selected?.name ?? ""}...`}
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
        </div>
      )}
    </div>
  );
}
