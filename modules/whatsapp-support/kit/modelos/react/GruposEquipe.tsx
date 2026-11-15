"use client";

// Tela "Grupos da equipe": grupos de conversa interna dentro do painel do Chatwoot. Cada grupo é uma caixa
// sem número, vista só por quem está nele, onde a equipe escreve e chama um colega com @ na nota. Nada
// escrito num grupo sai do painel. Quem usa: o superadmin no modelo plataforma, quem administra o cliente
// no por-cliente (o servidor confere).

import { useEffect, useState } from "react";

import { supportApi, type TeamGroup } from "../atendimento/base/ui/client.mjs";
import { Alert, Button, Card, Loading, Stack, Text, TextField, Toggle } from "./primitives";

const api = supportApi();

type Rascunho = { chave?: string; nome: string; membros: string[]; etiquetas: string };
const NOVO: Rascunho = { nome: "", membros: [], etiquetas: "" };

export function GruposEquipe() {
  const [grupos, setGrupos] = useState<TeamGroup[] | null>(null);
  const [pessoas, setPessoas] = useState<Array<{ chave: string; nome: string }>>([]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [aviso, setAviso] = useState<{ tone: "success" | "info" | "danger"; text: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      const result = await api.teamGroups();
      setGrupos(result.grupos);
      setPessoas(result.pessoas);
    } catch (error) {
      setAviso({ tone: "danger", text: (error as Error).message });
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  if (!grupos) return aviso ? <Alert tone="danger">{aviso.text}</Alert> : <Loading />;
  const nomeDe = (chave: string) => pessoas.find((pessoa) => pessoa.chave === chave)?.nome ?? chave;

  async function salvar() {
    if (!rascunho) return;
    setSalvando(true);
    try {
      const etiquetas = rascunho.etiquetas.split(",").map((etiqueta) => etiqueta.trim()).filter(Boolean);
      const result = await api.saveTeamGroup({ chave: rascunho.chave, nome: rascunho.nome, membros: rascunho.membros, etiquetas });
      setRascunho(null);
      setAviso(
        result.fora.length
          ? { tone: "info", text: `Grupo salvo. Ficaram fora: ${result.fora.map(nomeDe).join(", ")}.` }
          : { tone: "success", text: "Grupo salvo. Ele aparece no painel para quem está nele." },
      );
      await carregar();
    } catch (error) {
      setAviso({ tone: "danger", text: (error as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  async function arquivar(grupo: TeamGroup) {
    try {
      await api.archiveTeamGroup(grupo.chave);
      setAviso({ tone: "success", text: `O grupo ${grupo.nome} foi arquivado. O histórico continua guardado.` });
      await carregar();
    } catch (error) {
      setAviso({ tone: "danger", text: (error as Error).message });
    }
  }

  const ativos = grupos.filter((grupo) => !grupo.arquivado);
  const arquivados = grupos.filter((grupo) => grupo.arquivado);

  return (
    <Stack>
      {aviso ? <Alert tone={aviso.tone}>{aviso.text}</Alert> : null}
      <Text tone="muted">
        Cada grupo aparece no painel de atendimento só para quem está nele. Escreva no grupo para conversar com a equipe e, numa nota, chame alguém com @. Nada escrito
        num grupo vai para clientes.
      </Text>

      {rascunho ? (
        <Card title={rascunho.chave ? "Mudar o grupo" : "Novo grupo"}>
          <Stack>
            <TextField label="Nome do grupo" placeholder="Comercial" value={rascunho.nome} onChange={(nome) => setRascunho({ ...rascunho, nome })} />
            <Text tone="muted">Quem participa</Text>
            {pessoas.map((pessoa) => (
              <Toggle
                key={pessoa.chave}
                label={pessoa.nome}
                checked={rascunho.membros.includes(pessoa.chave)}
                onChange={(checked) =>
                  setRascunho({
                    ...rascunho,
                    membros: checked ? [...new Set([...rascunho.membros, pessoa.chave])] : rascunho.membros.filter((chave) => chave !== pessoa.chave),
                  })
                }
              />
            ))}
            <TextField
              label="Etiquetas"
              hint="Separadas por vírgula, como vendas, clientes-grandes. A equipe também muda as etiquetas no painel."
              value={rascunho.etiquetas}
              onChange={(etiquetas) => setRascunho({ ...rascunho, etiquetas })}
            />
            <Stack direction="row" gap={8}>
              <Button onClick={salvar} disabled={salvando || !rascunho.nome.trim() || !rascunho.membros.length}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="secondary" onClick={() => setRascunho(null)}>
                Cancelar
              </Button>
            </Stack>
          </Stack>
        </Card>
      ) : (
        <Stack direction="row" gap={8}>
          <Button onClick={() => setRascunho(NOVO)}>Novo grupo</Button>
        </Stack>
      )}

      {!ativos.length ? <Text tone="muted">Nenhum grupo ainda.</Text> : null}
      {ativos.map((grupo) => (
        <Card key={grupo.chave} title={grupo.nome}>
          <Stack gap={8}>
            <Text>{grupo.membros.map(nomeDe).join(", ") || "Ninguém no grupo."}</Text>
            {grupo.etiquetas.length ? <Text tone="muted">Etiquetas: {grupo.etiquetas.join(", ")}</Text> : null}
            <Stack direction="row" gap={8}>
              <Button variant="secondary" onClick={() => setRascunho({ chave: grupo.chave, nome: grupo.nome, membros: grupo.membros, etiquetas: grupo.etiquetas.join(", ") })}>
                Mudar
              </Button>
              <Button variant="secondary" onClick={() => arquivar(grupo)}>
                Arquivar
              </Button>
            </Stack>
          </Stack>
        </Card>
      ))}

      {arquivados.length ? (
        <Card title="Arquivados">
          <Stack gap={8}>
            {arquivados.map((grupo) => (
              <Stack key={grupo.chave} direction="row" gap={8}>
                <Text>{grupo.nome}</Text>
                <Button variant="secondary" onClick={() => setRascunho({ chave: grupo.chave, nome: grupo.nome, membros: [], etiquetas: grupo.etiquetas.join(", ") })}>
                  Trazer de volta
                </Button>
              </Stack>
            ))}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
