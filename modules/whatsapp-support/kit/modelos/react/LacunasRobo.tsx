"use client";

// Tela "O que o robô não soube responder": as passagens para a equipe dos últimos dias, agrupadas por
// assunto, com quantas vezes e exemplos já sem dado pessoal. É o mapa do que falta no conhecimento.
// onCriarPergunta recebe o assunto, para a tela do robô abrir uma pergunta nova já com ele.

import { useEffect, useState } from "react";

import type { GapGroup } from "../atendimento/base/shared/report.mjs";
import type { Scope } from "../atendimento/base/shared/settings.mjs";
import { supportApi } from "../atendimento/base/ui/client.mjs";
import { Alert, Button, Card, Choice, Loading, Stack, Text } from "./primitives";

const api = supportApi();

export function LacunasRobo({ escopo = "cliente", onCriarPergunta }: { escopo?: Scope; onCriarPergunta?: (assunto: string) => void }) {
  const [dias, setDias] = useState<"7" | "30" | "90">("30");
  const [data, setData] = useState<{ groups: GapGroup[]; categories: Record<string, string> } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api
      .gaps(escopo, Number(dias))
      .then(setData)
      .catch((error: Error) => setErro(error.message));
  }, [escopo, dias]);

  if (erro) return <Alert tone="danger">{erro}</Alert>;
  if (!data) return <Loading />;

  return (
    <Stack>
      <Choice
        label="Período"
        value={dias}
        onChange={setDias}
        options={[
          { value: "7", label: "Últimos 7 dias" },
          { value: "30", label: "Últimos 30 dias" },
          { value: "90", label: "Últimos 90 dias" },
        ]}
      />
      {!data.groups.length ? <Text tone="muted">O robô não passou nenhuma conversa para a equipe neste período.</Text> : null}
      {data.groups.map((group) => (
        <Card key={group.topic} title={`${group.topic}: ${group.count} ${group.count === 1 ? "vez" : "vezes"}`}>
          <Stack gap={8}>
            <Text tone="muted">
              {Object.entries(group.categories)
                .map(([category, count]) => `${data.categories[category] ?? category} (${count})`)
                .join(" · ")}
            </Text>
            {group.examples.map((example) => (
              <Text key={example}>"{example}"</Text>
            ))}
            {onCriarPergunta && group.categories.nao_sei ? (
              <Button variant="secondary" onClick={() => onCriarPergunta(group.topic)}>
                Criar pergunta e resposta sobre isso
              </Button>
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
