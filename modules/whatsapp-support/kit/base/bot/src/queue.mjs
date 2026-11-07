// Fila por conversa: junta as mensagens que o cliente manda em sequência (espera curta depois da última)
// e processa uma conversa por vez, na ordem. Conversas diferentes andam em paralelo.

export function createConversationQueue({ debounceMs = 2500, run, onError = () => {} }) {
  const slots = new Map();
  let active = 0;
  const idleWaiters = [];

  const settleIdle = () => {
    if (active === 0 && [...slots.values()].every((slot) => !slot.timer)) {
      while (idleWaiters.length) idleWaiters.shift()();
    }
  };

  const flush = (key) => {
    const slot = slots.get(key);
    if (!slot) return;
    slot.timer = null;
    const items = slot.pending.splice(0);
    if (!items.length) return;
    active += 1;
    slot.running += 1;
    slot.chain = slot.chain
      .then(() => run(key, items))
      .catch((error) => onError(error, key))
      .finally(() => {
        active -= 1;
        slot.running -= 1;
        if (!slot.timer && !slot.pending.length && !slot.running && slots.get(key) === slot) slots.delete(key);
        settleIdle();
      });
  };

  return {
    push(key, item) {
      let slot = slots.get(key);
      if (!slot) {
        slot = { pending: [], timer: null, running: 0, chain: Promise.resolve() };
        slots.set(key, slot);
      }
      slot.pending.push(item);
      if (slot.timer) clearTimeout(slot.timer);
      slot.timer = setTimeout(() => flush(key), debounceMs);
    },
    /** Resolve quando não há nada esperando nem rodando (usado no desligamento e nos testes). */
    idle() {
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
        settleIdle();
      });
    },
    get size() {
      return slots.size;
    },
  };
}
