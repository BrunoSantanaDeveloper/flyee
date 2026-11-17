"use client";

// Tela "Robô de atendimento". escopo="plataforma" é a tela do superadmin (as regras que valem para todos,
// o que cada cliente pode mudar, aprender com a equipe e o relatório); escopo="cliente" é a tela do
// administrador de cada cliente, que mostra só o que a plataforma liberou. A validação é a do servidor.

import { useEffect, useState } from "react";

import {
  DAYS,
  LIMITS,
  PERMISSION_GROUPS,
  validateSettings,
  type Day,
  type GroupSettings,
  type MediaSettings,
  type Mode,
  type PermissionGroup,
  type PlatformSettings,
  type ProfileSettings,
  type Scope,
} from "../atendimento/base/shared/settings.mjs";
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
  grupos: "Grupos do WhatsApp",
  midia: "Imagens, áudios, vídeos e arquivos",
  perfis: "O que muda para cada perfil de quem escreve",
};
const SEM_GRUPOS: GroupSettings = { mode: "fora", call_words: [], team_id: null };
const MIDIA_PADRAO: MediaSettings = { images: true, audio: true, video: true, documents: true, transcription_note: true };

// Feriados nacionais de data fixa (MM-DD). Os de data móvel (Carnaval, Sexta-feira Santa, Corpus Christi) e os
// estaduais e municipais entram à mão.
const FERIADOS_NACIONAIS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

function comFeriadosNacionais(atuais: string[], ano = new Date().getFullYear()): string[] {
  const nacionais = [ano, ano + 1].flatMap((year) => FERIADOS_NACIONAIS.map((dia) => `${year}-${dia}`));
  return [...new Set([...atuais, ...nacionais])].sort();
}

/** Um número inteiro maior que zero, ou null (o campo vazio vale o padrão). */
function inteiroOuVazio(text: string): number | null {
  const value = Number(text.trim());
  return text.trim() && Number.isInteger(value) && value > 0 ? value : null;
}

/** O bloco do perfil só com o que foi preenchido: o que fica vazio vale o padrão. */
function blocoLimpo(bloco: ProfileSettings): ProfileSettings {
  return Object.fromEntries(Object.entries(bloco).filter(([, value]) => value !== null && value !== undefined && value !== "")) as ProfileSettings;
}

export function RoboAtendimento({ escopo = "cliente" }: { escopo?: Scope }) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tone: "success" | "info" | "danger"; text: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  // O texto dos feriados enquanto a pessoa digita: as linhas vazias ficam até ela terminar.
  const [feriadosTexto, setFeriadosTexto] = useState<string | null>(null);

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
    const encontrados = validateSettings(settings, { declaredTools: data!.tools.map((tool) => tool.name), declaredProfiles: data!.profiles ?? [], scope: escopo });
    setProblemas(Object.fromEntries(encontrados.map((problem) => [problem.field, problem.message])));
    if (encontrados.length) {
      setAviso({ tone: "danger", text: "Confira os campos marcados." });
      return;
    }
    setSalvando(true);
    try {
      const result = await api.saveSettings(settings, escopo);
      setAviso(result.aviso ? { tone: "info", text: result.aviso } : { tone: "success", text: "Robô atualizado. Vale a partir da próxima mensagem, em até um minuto." });
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
  const setFeriados = (text: string) => {
    setFeriadosTexto(text);
    update({ hours: { ...hours, holidays: text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) } });
  };
  const anoAtual = new Date().getFullYear();
  const grupos = settings.groups ?? SEM_GRUPOS;
  const midia = settings.media ?? MIDIA_PADRAO;
  const perfisDeclarados = data.profiles ?? [];
  const perfis = settings.profiles ?? {};
  const setPerfil = (chave: string, patch: ProfileSettings) => {
    const bloco = blocoLimpo({ ...(perfis[chave] ?? {}), ...patch });
    const next = { ...perfis };
    if (Object.keys(bloco).length) next[chave] = bloco;
    else delete next[chave];
    update({ profiles: next });
  };
  // Sem quem transcreva, "Ouvir áudios" some: ligar não mudaria nada. Quando não se sabe (null), mostra tudo.
  const semAudio = data.media?.audio === false;
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
            <TextArea
              label="Feriados"
              hint="Uma data por linha, no formato AAAA-MM-DD. No feriado, a equipe conta como fora do horário, e o robô sabe que hoje é feriado."
              rows={4}
              value={feriadosTexto ?? (hours.holidays ?? []).join("\n")}
              error={problemas["hours.holidays"]}
              onChange={setFeriados}
            />
            <Stack direction="row" gap={8}>
              <Button
                variant="secondary"
                onClick={() => {
                  setFeriadosTexto(null);
                  update({ hours: { ...hours, holidays: comFeriadosNacionais(hours.holidays ?? [], anoAtual) } });
                }}
              >
                {`Acrescentar os feriados nacionais de ${anoAtual} e ${anoAtual + 1}`}
              </Button>
            </Stack>
            <Text tone="muted">O botão acrescenta só os feriados nacionais de data fixa. Carnaval, Sexta-feira Santa, Corpus Christi e os feriados da cidade e do estado entram à mão.</Text>
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

      {can("perfis") && perfisDeclarados.length ? (
        <Card title="Perfis">
          <Stack>
            <Text tone="muted">
              O sistema diz quem está escrevendo, e o robô segue o bloco desse perfil depois da apresentação e das instruções gerais. Todos os campos são
              opcionais: vazio vale o padrão.
            </Text>
            {perfisDeclarados.map((perfil) => {
              const bloco = perfis[perfil.key] ?? {};
              const campo = (nome: string) => problemas[`profiles.${perfil.key}.${nome}`];
              return (
                <Stack key={perfil.key} gap={8}>
                  <Text>{perfil.label}</Text>
                  {perfil.description ? <Text tone="muted">{perfil.description}</Text> : null}
                  {problemas[`profiles.${perfil.key}`] ? <Text tone="danger">{problemas[`profiles.${perfil.key}`]}</Text> : null}
                  <TextArea
                    label="Instruções para este perfil"
                    hint={`O que muda para quem tem este perfil. Vazio vale o padrão. Até ${LIMITS.instructions} caracteres.`}
                    value={bloco.instructions ?? ""}
                    error={campo("instructions")}
                    onChange={(instructions) => setPerfil(perfil.key, { instructions })}
                  />
                  <TextField
                    label="Respostas do robô antes de chamar a equipe"
                    hint="Vazio vale o padrão."
                    value={bloco.max_bot_turns ? String(bloco.max_bot_turns) : ""}
                    error={campo("max_bot_turns")}
                    onChange={(text) => setPerfil(perfil.key, { max_bot_turns: inteiroOuVazio(text) })}
                  />
                  <TextField
                    label="Time do Chatwoot que recebe a conversa"
                    hint="O número do time. Vazio vale o padrão."
                    value={bloco.team_id ? String(bloco.team_id) : ""}
                    error={campo("team_id")}
                    onChange={(text) => setPerfil(perfil.key, { team_id: inteiroOuVazio(text) })}
                  />
                  <Choice<Mode | "">
                    label="Como o robô trabalha com este perfil"
                    value={bloco.mode ?? ""}
                    onChange={(mode) => setPerfil(perfil.key, { mode: mode || null })}
                    options={[
                      { value: "", label: "Como o padrão", hint: "Vazio vale o padrão." },
                      { value: "auto", label: "Responde sozinho" },
                      { value: "sugestao", label: "Sugere a resposta", hint: "Uma nota interna que alguém da equipe revisa e envia." },
                      { value: "desligado", label: "Desligado", hint: "A conversa de quem tem este perfil vai direto para a equipe." },
                    ]}
                  />
                </Stack>
              );
            })}
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

      {can("midia") ? (
        <Card title="Imagens, áudios, vídeos e arquivos">
          <Stack gap={8}>
            <Text tone="muted">O robô lê o que a pessoa manda e só passa para a equipe quando não consegue.</Text>
            {semAudio ? (
              <Text tone="muted">Áudios vão para a equipe, porque este atendimento ainda não transcreve o que é falado. Nos vídeos, o robô vê os quadros.</Text>
            ) : null}
            <Toggle label="Ler imagens e prints" checked={midia.images} onChange={(images) => update({ media: { ...midia, images } })} />
            {semAudio ? null : <Toggle label="Ouvir áudios" checked={midia.audio} onChange={(audio) => update({ media: { ...midia, audio } })} />}
            <Toggle
              label="Ver vídeos"
              hint={semAudio ? "O robô vê uma grade de quadros do vídeo, também em vídeo longo." : "O robô vê uma grade de quadros do vídeo e ouve a fala, também em vídeo longo."}
              checked={midia.video}
              onChange={(video) => update({ media: { ...midia, video } })}
            />
            <Toggle
              label="Ler PDFs, planilhas e documentos"
              hint="Comprovante, boleto, nota, planilha, CSV e documento de texto. Arquivo grande é lido só no começo."
              checked={midia.documents !== false}
              onChange={(documents) => update({ media: { ...midia, documents } })}
            />
            {semAudio ? null : (
              <Toggle
                label="Deixar a transcrição para a equipe"
                hint="Uma nota interna com o que foi falado, para quem atende ler sem ouvir."
                checked={midia.transcription_note}
                onChange={(transcription_note) => update({ media: { ...midia, transcription_note } })}
              />
            )}
          </Stack>
        </Card>
      ) : null}

      {can("grupos") ? (
        <Card title="Grupos do WhatsApp">
          <Stack>
            <Text tone="muted">Valem para o número conectado pelo WhatsApp Web. Pela API oficial, os grupos não chegam ao atendimento.</Text>
            <Choice
              label="O que fazer com os grupos de que o número participa"
              value={grupos.mode}
              onChange={(mode) => update({ groups: { ...grupos, mode } })}
              options={[
                { value: "fora", label: "Deixar fora do atendimento", hint: "Só as conversas com uma pessoa entram no painel." },
                { value: "equipe", label: "A equipe atende e o robô fica calado", hint: "Cada grupo vira uma conversa no painel, com o nome do grupo. O robô nunca escreve nele." },
                {
                  value: "chamado",
                  label: "O robô responde quando chamado",
                  hint: "A equipe atende o grupo, e o robô responde só à mensagem que o chama por uma das palavras abaixo, sem consultar dados de ninguém.",
                },
              ]}
            />
            {grupos.mode === "chamado" ? (
              <TextField
                label="Palavras que chamam o robô no grupo"
                hint="Separadas por vírgula, como o nome do robô. Chame pelo nome escrito: a menção com @ ao número não conta."
                value={grupos.call_words.join(", ")}
                error={problemas["groups.call_words"]}
                onChange={(text) => update({ groups: { ...grupos, call_words: text.split(",").map((word) => word.trim()).filter(Boolean) } })}
              />
            ) : null}
            {grupos.mode !== "fora" ? <Text tone="muted">As mensagens chegam a partir de agora; o que foi escrito antes no grupo não entra.</Text> : null}
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
