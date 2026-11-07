"use client";

// Tela "Robô de atendimento": como o robô trabalha, o que ele sabe, quando passa para a equipe e quais
// dados do sistema ele pode consultar. A validação é a mesma do servidor (base/shared/settings.mjs).

import { useEffect, useState } from "react";

import { DAYS, LIMITS, validateSettings, type BotSettings, type Day } from "../atendimento/base/shared/settings.mjs";
import { supportApi } from "../atendimento/base/ui/client.mjs";
import { Alert, Button, Card, Choice, Loading, Stack, Text, TextArea, TextField, Toggle } from "./primitives";

const api = supportApi();

const DAY_LABELS: Record<Day, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };

export function RoboAtendimento() {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [tools, setTools] = useState<Array<{ name: string; description: string }>>([]);
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((result) => {
        setSettings(result.settings);
        setTools(result.tools);
      })
      .catch((error: Error) => setAviso({ tone: "danger", text: error.message }));
  }, []);

  if (!settings) return aviso ? <Alert tone="danger">{aviso.text}</Alert> : <Loading />;
  const update = (patch: Partial<BotSettings>) => setSettings({ ...settings, ...patch });

  async function salvar() {
    if (!settings) return;
    const encontrados = validateSettings(settings, { declaredTools: tools.map((tool) => tool.name) });
    setProblemas(Object.fromEntries(encontrados.map((problem) => [problem.field, problem.message])));
    if (encontrados.length) {
      setAviso({ tone: "danger", text: "Confira os campos marcados." });
      return;
    }
    setSalvando(true);
    try {
      await api.saveSettings(settings);
      setAviso({ tone: "success", text: "Robô atualizado. Vale a partir da próxima mensagem, em até um minuto." });
    } catch (error) {
      setAviso({ tone: "danger", text: (error as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  const hours = settings.hours ?? { timezone: "America/Sao_Paulo", days: {}, holidays: [] };
  const setDay = (day: Day, text: string) => {
    const ranges = text
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(/\s*(?:a|às|as)\s*/).slice(0, 2) as [string, string]);
    update({ hours: { ...hours, days: { ...hours.days, [day]: ranges } } });
  };

  return (
    <Stack>
      {aviso ? <Alert tone={aviso.tone}>{aviso.text}</Alert> : null}

      <Card title="Como o robô trabalha">
        <Choice
          label="Modo"
          value={settings.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: "auto", label: "Responde sozinho", hint: "Responde o que sabe e passa para a equipe quando precisa." },
            { value: "sugestao", label: "Sugere a resposta", hint: "Escreve uma nota interna com a resposta; alguém da equipe revisa e envia." },
            { value: "desligado", label: "Desligado", hint: "Toda conversa vai direto para a equipe." },
          ]}
        />
      </Card>

      <Card title="Quem é o robô">
        <Stack>
          <TextField label="Nome da empresa que o robô representa" value={settings.brand} onChange={(brand) => update({ brand })} />
          <TextArea
            label="Apresentação e jeito de falar"
            hint={`Por exemplo: "Você é a Ana, da equipe da loja. Fala de um jeito simples e gentil." Até ${LIMITS.persona} caracteres.`}
            value={settings.persona}
            error={problemas.persona}
            onChange={(persona) => update({ persona })}
          />
          <TextArea
            label="Instruções"
            hint="O que o robô deve fazer e não fazer, prazos, políticas e o que sempre passa para a equipe."
            rows={6}
            value={settings.instructions}
            error={problemas.instructions}
            onChange={(instructions) => update({ instructions })}
          />
        </Stack>
      </Card>

      <Card title="Perguntas e respostas">
        <Stack>
          {settings.knowledge.map((item, index) => (
            <Stack key={index} gap={8}>
              <TextField
                label={`Pergunta ${index + 1}`}
                value={item.q}
                error={problemas[`knowledge.${index}.q`] ?? problemas[`knowledge.${index}`]}
                onChange={(q) => update({ knowledge: settings.knowledge.map((entry, position) => (position === index ? { ...entry, q } : entry)) })}
              />
              <TextArea
                label="Resposta"
                value={item.a}
                error={problemas[`knowledge.${index}.a`]}
                onChange={(a) => update({ knowledge: settings.knowledge.map((entry, position) => (position === index ? { ...entry, a } : entry)) })}
              />
              <Button variant="secondary" onClick={() => update({ knowledge: settings.knowledge.filter((_, position) => position !== index) })}>
                Remover
              </Button>
            </Stack>
          ))}
          {problemas.knowledge ? <Text tone="danger">{problemas.knowledge}</Text> : null}
          <Button variant="secondary" onClick={() => update({ knowledge: [...settings.knowledge, { q: "", a: "" }] })}>
            Adicionar pergunta
          </Button>
        </Stack>
      </Card>

      <Card title="Horário da equipe">
        <Stack>
          <Text tone="muted">Fora do horário, o robô avisa que a equipe responde quando voltar. Escreva as faixas assim: 08:00 a 12:00, 13:00 a 18:00.</Text>
          {DAYS.map((day) => (
            <TextField
              key={day}
              label={DAY_LABELS[day]}
              value={(hours.days[day] ?? []).map(([start, end]) => `${start} a ${end}`).join(", ")}
              error={Object.entries(problemas).find(([field]) => field.startsWith(`hours.days.${day}`))?.[1]}
              placeholder="Sem atendimento"
              onChange={(text) => setDay(day, text)}
            />
          ))}
        </Stack>
      </Card>

      <Card title="Quando passar para a equipe">
        <Stack>
          <TextField
            label="Palavras que chamam a equipe"
            hint="Separadas por vírgula. Vazio usa as do sistema: atendente, humano, falar com uma pessoa."
            value={(settings.handoff.keywords ?? []).join(", ")}
            onChange={(text) =>
              update({ handoff: { ...settings.handoff, keywords: text.trim() ? text.split(",").map((word) => word.trim()).filter(Boolean) : null } })
            }
          />
          <TextField
            label="Respostas do robô antes de chamar a equipe"
            value={String(settings.handoff.max_bot_turns)}
            error={problemas["handoff.max_bot_turns"]}
            onChange={(text) => update({ handoff: { ...settings.handoff, max_bot_turns: Number.parseInt(text, 10) || 0 } })}
          />
          <TextArea
            label="Mensagem ao passar para a equipe"
            hint="Vazio usa a mensagem padrão."
            value={settings.messages.handoff ?? ""}
            onChange={(handoff) => update({ messages: { ...settings.messages, handoff } })}
          />
          <TextArea
            label="Mensagem fora do horário"
            hint="Vazio usa a mensagem padrão."
            value={settings.messages.handoff_fora_do_horario ?? ""}
            onChange={(text) => update({ messages: { ...settings.messages, handoff_fora_do_horario: text } })}
          />
        </Stack>
      </Card>

      {tools.length ? (
        <Card title="O que o robô pode consultar no sistema">
          <Stack gap={8}>
            <Text tone="muted">O robô só vê os dados da própria pessoa da conversa, e só nas consultas ligadas aqui.</Text>
            {tools.map((tool) => (
              <Toggle
                key={tool.name}
                label={tool.description}
                checked={settings.tools_enabled.includes(tool.name)}
                onChange={(checked) =>
                  update({ tools_enabled: checked ? [...settings.tools_enabled, tool.name] : settings.tools_enabled.filter((name) => name !== tool.name) })
                }
              />
            ))}
          </Stack>
        </Card>
      ) : null}

      <Stack direction="row" gap={8}>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </Stack>
    </Stack>
  );
}
