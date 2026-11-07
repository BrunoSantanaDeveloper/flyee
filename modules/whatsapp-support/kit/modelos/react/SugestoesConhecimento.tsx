"use client";

// Tela "Sugestões para o robô": perguntas e respostas que a IA tirou das conversas que o robô passou para
// a equipe e a equipe resolveu. Nada entra no conhecimento sem alguém aprovar; dá para editar antes.
// escopo="plataforma" mostra as do superadmin (com o cliente de origem); "cliente", as do cliente logado.

import { useEffect, useState } from "react";

import type { Scope } from "../atendimento/base/shared/settings.mjs";
import { supportApi, type Suggestion } from "../atendimento/base/ui/client.mjs";
import { Alert, Button, Card, Loading, Stack, Text, TextArea, TextField } from "./primitives";

const api = supportApi();

export function SugestoesConhecimento({ escopo = "cliente" }: { escopo?: Scope }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [edits, setEdits] = useState<Record<string, { q: string; a: string }>>({});
  const [aviso, setAviso] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    api
      .suggestions(escopo)
      .then((result) => setItems(result.suggestions))
      .catch((error: Error) => setAviso({ tone: "danger", text: error.message }));
  }, [escopo]);

  if (!items) return aviso ? <Alert tone="danger">{aviso.text}</Alert> : <Loading />;

  async function decidir(item: Suggestion, decisao: "aprovar" | "descartar") {
    try {
      await api.decideSuggestion(item.id, decisao, edits[item.id] ?? { q: item.q, a: item.a });
      setItems((current) => (current ?? []).filter((entry) => entry.id !== item.id));
      setAviso({ tone: "success", text: decisao === "aprovar" ? "Entrou no conhecimento do robô." : "Sugestão descartada." });
    } catch (error) {
      setAviso({ tone: "danger", text: (error as Error).message });
    }
  }

  return (
    <Stack>
      {aviso ? <Alert tone={aviso.tone}>{aviso.text}</Alert> : null}
      {!items.length ? <Text tone="muted">Nenhuma sugestão esperando. Elas aparecem quando a equipe resolve conversas que o robô passou adiante.</Text> : null}
      {items.map((item) => {
        const value = edits[item.id] ?? { q: item.q, a: item.a };
        const set = (patch: Partial<{ q: string; a: string }>) => setEdits({ ...edits, [item.id]: { ...value, ...patch } });
        return (
          <Card key={item.id} title={item.tenant ? `Sugestão de ${item.tenant}` : "Sugestão"}>
            <Stack gap={8}>
              <TextField label="Pergunta" value={value.q} onChange={(q) => set({ q })} />
              <TextArea label="Resposta" value={value.a} onChange={(a) => set({ a })} />
              {item.why ? <Text tone="muted">Por que serve a outras pessoas: {item.why}</Text> : null}
              <Text tone="muted">Confira se a resposta vale para todos e se não ficou nenhum dado de uma pessoa.</Text>
              <Stack direction="row" gap={8}>
                <Button onClick={() => decidir(item, "aprovar")}>Aprovar</Button>
                <Button variant="secondary" onClick={() => decidir(item, "descartar")}>
                  Descartar
                </Button>
              </Stack>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
