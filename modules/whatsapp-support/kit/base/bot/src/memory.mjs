// Memória curta de cada conversa, só em memória: as últimas mensagens e quantas vezes o robô respondeu.
// Some quando o robô reinicia; nesse caso o histórico vem do projeto (rota history), se ele a expõe.

export function createMemory({ maxConversations = 2000, maxEntries = 30, ttlMs = 24 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const conversations = new Map();

  const fresh = (key) => {
    const entry = conversations.get(key);
    if (!entry) return null;
    if (now() - entry.touched > ttlMs) {
      conversations.delete(key);
      return null;
    }
    return entry;
  };

  const touch = (key) => {
    let entry = fresh(key);
    if (!entry) {
      entry = { entries: [], turns: 0, seeded: false, touched: now(), seenIds: new Set() };
    } else {
      conversations.delete(key);
    }
    entry.touched = now();
    conversations.set(key, entry);
    while (conversations.size > maxConversations) conversations.delete(conversations.keys().next().value);
    return entry;
  };

  return {
    /** role: "cliente", "robo" ou "equipe". id evita guardar a mesma mensagem duas vezes. */
    add(key, { id, role, text, at }) {
      const entry = touch(key);
      if (id !== undefined && id !== null) {
        if (entry.seenIds.has(id)) return;
        entry.seenIds.add(id);
        while (entry.seenIds.size > maxEntries * 4) entry.seenIds.delete(entry.seenIds.values().next().value);
      }
      entry.entries.push({ role, text: String(text ?? ""), at: at ?? new Date(now()).toISOString() });
      if (entry.entries.length > maxEntries) entry.entries.splice(0, entry.entries.length - maxEntries);
    },
    /** Põe o histórico vindo do projeto antes do que já está na memória, sem repetir mensagens. */
    seed(key, history) {
      const entry = touch(key);
      entry.seeded = true;
      const known = new Set(entry.entries.map((item) => `${item.role}|${item.text}`));
      const older = (history ?? [])
        .filter((item) => item && typeof item.text === "string" && ["cliente", "robo", "equipe"].includes(item.role))
        .filter((item) => !known.has(`${item.role}|${item.text}`));
      entry.entries = [...older, ...entry.entries].slice(-maxEntries);
    },
    seeded: (key) => Boolean(fresh(key)?.seeded),
    transcript: (key) => [...(fresh(key)?.entries ?? [])],
    turns: (key) => fresh(key)?.turns ?? 0,
    countTurn(key) {
      touch(key).turns += 1;
    },
    size: () => conversations.size,
  };
}

/** Entregas já vistas (cabeçalho X-Chatwoot-Delivery), para não responder duas vezes ao mesmo aviso. */
export function createSeenSet(limit = 2000) {
  const seen = new Set();
  return {
    has: (id) => seen.has(id),
    add(id) {
      if (!id) return;
      seen.add(id);
      while (seen.size > limit) seen.delete(seen.values().next().value);
    },
  };
}
