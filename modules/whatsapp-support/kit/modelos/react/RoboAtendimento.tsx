"use client";

// Tela "Robô de atendimento". escopo="plataforma" é a tela do superadmin (as regras que valem para todos,
// o que cada cliente pode mudar, aprender com a equipe e o relatório); escopo="cliente" é a tela do
// administrador de cada cliente, que mostra só o que a plataforma liberou. A validação é a do servidor.

import { useEffect, useState } from "react";

import { DAYS, LIMITS, PERMISSION_GROUPS, validateSettings, type Day, type PermissionGroup, type PlatformSettings, type Scope } from "../atendimento/base/shared/settings.mjs";
import { supportApi, type SettingsResponse } from "../atendimento/base/ui/client.mjs";
import { Alert, Button, Card, Choice, Loading, Stack, Text, TextArea, TextField, Toggle } from "./primitives";

const api = supportApi();

const DAY_LABELS: Record<Day, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
const GROUP_LABELS: Record<PermissionGroup, string> = {
  apresentacao: "Nome e apresentação do robô",
  instrucoes: "Instruções da empresa",
  conhecimento: "Perguntas e respostas",
  horario: "Horário da equipe",
  mensagens: "Mensagens ao passar para a equipe",
  transferencia: "Quando passar para a equipe",
  consultas: "Quais consultas ao sistema ligar",
  modo: "Como o robô trabalha",
};

export function RoboAtendimento({ escopo = "cliente" }: { escopo?: Scope }) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .settings(escopo)
      .then((result) => {
        setData(result);
        setSettings(result.settings as PlatformSettings);
      })
      .catch((error: Error) => setAviso({ tone: "danger", text: error.message }));
  }, [escopo]);

  if (!settings || !data) return aviso ? <Alert tone="danger">{aviso.text}</Alert> : <Loading />;
  const can = (group: string) => data.editable.includes(group);
  const update = (patch: Partial<PlatformSettings>) => setSettings({ ...settings, ...patch });
  const isPlatform = escopo === "plataforma";

  if (!isPlatform && !data.editable.length) {
    return <Alert tone="info">O robô deste atendimento é configurado pela plataforma.</Alert>;
  }

  async function salvar() {
    if (!settings) return;
    const encontrados = validateSettings(settings, { declaredTools: data!.tools.map((tool) => tool.name), scope: escopo });
    setProblemas(Object.fromEntries(encontrados.map((problem) => [problem.field, problem.message])));
    if (encontrados.length) {
      setAviso({ tone: "danger", text: "Confira os campos marcados." });
      return;
    }
    setSalvando(true);
    try {
      await api.saveSettings(settings, escopo);
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
  const toggleList = (list: string[] | null | undefined, name: string, on: boolean) => {
    const current = list ?? [];
    return on ? [...new Set([...current, name])] : current.filter((item) => item !== name);
  };

  return (
    <Stack>
      {aviso ? <Alert tone={aviso.tone}>{aviso.text}</Alert> : null}
      {isPlatform && data.model === "por-cliente" ? (
        <Alert tone="info">Estas regras e este conhecimento valem para todos os clientes e ficam acima do que cada um escreve.</Alert>
      ) : null}

      {can("modo") ? (
        <Card title="Como o robô trabalha">
          <Choice
            label="Modo"
            value={settings.mode}
            onChange={(mode) => update({ mode })}
            options={[
              { value: "auto", label: "Responde sozinho", hint: "Responde o que sabe e passa para a equipe quando precisa." },
              { value: "sugestao", label: "Sugere a resposta", hint: "Escreve uma nota interna com a resposta; alguém da equipe revisa e envia." },
              { value: "desligado", label: "Desligado", hint: isPlatform ? "Desliga o robô de todos os atendimentos." : "Toda conversa vai direto para a equipe." },
            ]}
          />
        </Card>
      ) : null}

      {can("apresentacao") ? (
        <Card title="Quem é o robô">
          <Stack>
            <TextField label="Nome da empresa que o robô representa" value={settings.brand} onChange={(brand) => update({ brand })} />
            <TextArea
              label="Apresentação e jeito de falar"
              hint={`Por exemplo: "Você é a Ana, da equipe. Fala de um jeito simples e gentil." Até ${LIMITS.persona} caracteres.`}
              value={settings.persona}
              error={problemas.persona}
              onChange={(persona) => update({ persona })}
            />
          </Stack>
        </Card>
      ) : null}

      {can("instrucoes") ? (
        <Card title={isPlatform && data.model === "por-cliente" ? "Regras da plataforma" : "Instruções"}>
          <TextArea
            label={isPlatform && data.model === "por-cliente" ? "Regras que todo robô segue" : "O que o robô deve fazer e não fazer"}
            hint="Prazos, políticas, o que nunca responder e o que sempre passa para a equipe."
            rows={8}
            value={settings.instructions}
            error={problemas.instructions}
            onChange={(instructions) => update({ instructions })}
          />
        </Card>
      ) : null}

      {can("conhecimento") ? (
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
      ) : null}

      {can("horario") ? (
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
      ) : null}

      {can("transferencia") || can("mensagens") ? (
        <Card title="Quando passar para a equipe">
          <Stack>
            {can("transferencia") ? (
              <>
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
              </>
            ) : null}
            {can("mensagens") ? (
              <>
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
              </>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {can("consultas") && data.tools.length ? (
        <Card title="O que o robô pode consultar no sistema">
          <Stack gap={8}>
            <Text tone="muted">O robô só vê os dados da própria pessoa da conversa, e só nas consultas ligadas aqui.</Text>
            {data.tools.map((tool) => (
              <Toggle
                key={tool.name}
                label={tool.description}
                checked={settings.tools_enabled.includes(tool.name)}
                onChange={(checked) => update({ tools_enabled: toggleList(settings.tools_enabled, tool.name, checked) })}
              />
            ))}
            {isPlatform && data.model === "por-cliente" ? (
              <>
                <Text tone="muted">Consultas que os clientes podem ligar (vazio oferece todas):</Text>
                {data.tools.map((tool) => (
                  <Toggle
                    key={`oferta-${tool.name}`}
                    label={tool.description}
                    checked={(settings.tools_available ?? []).includes(tool.name)}
                    onChange={(checked) => update({ tools_available: toggleList(settings.tools_available, tool.name, checked) })}
                  />
                ))}
              </>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {can("permissoes") ? (
        <Card title="O que cada cliente pode mudar no robô dele">
          <Stack gap={8}>
            {PERMISSION_GROUPS.map((group) => (
              <Toggle
                key={group}
                label={GROUP_LABELS[group]}
                checked={settings.client_permissions?.[group] === true}
                onChange={(checked) => update({ client_permissions: { ...settings.client_permissions, [group]: checked } })}
              />
            ))}
          </Stack>
        </Card>
      ) : null}

      {can("aprendizado") ? (
        <Card title="Aprender com a equipe">
          <Stack gap={8}>
            <Toggle
              label="Sugerir perguntas e respostas a partir das conversas que a equipe resolveu"
              hint="Nada entra sozinho: cada sugestão espera aprovação."
              checked={settings.learning?.enabled !== false}
              onChange={(checked) => update({ learning: { enabled: checked } })}
            />
            <Toggle
              label="Registrar o que o robô passou para a equipe, para o relatório das lacunas"
              checked={settings.report?.enabled !== false}
              onChange={(checked) => update({ report: { enabled: checked } })}
            />
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
