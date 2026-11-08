"use client";

// Tela "Conectar WhatsApp": o cliente escolhe a API oficial (credenciais da Meta) ou a conexão
// não oficial (QR do WhatsApp Web, depois de ler o aviso de risco). Os passos vêm de base/ui/connect.mjs.
// Com o número já ligado, mostra o que a conferência viu e retoma a mesma caixa quando ele para: o QR de
// novo na não oficial, o token novo na oficial.

import { useEffect, useReducer, useState } from "react";

import { connectReducer, initialConnectState, OFFICIAL_FIELDS, pollingDelay, UNOFFICIAL_RISK, validateOfficial } from "../atendimento/base/ui/connect.mjs";
import { supportApi, type WhatsappStatus } from "../atendimento/base/ui/client.mjs";
import { Alert, Button, Card, Choice, Loading, Stack, Text, TextField, Toggle } from "./primitives";

const api = supportApi();

const SEM_LEITURA: WhatsappStatus = { connected: false, route: null, status: null, qrCode: null, level: null, findings: [] };

function Achados({ itens }: { itens: WhatsappStatus["findings"] }) {
  return (
    <Stack gap={8}>
      {itens.map((item) => (
        <Text key={item.code}>
          {item.detail} {item.fix}
        </Text>
      ))}
    </Stack>
  );
}

export function ConectarWhatsApp({ permitirNaoOficial = true }: { permitirNaoOficial?: boolean }) {
  const [state, dispatch] = useReducer(connectReducer, initialConnectState);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [situacao, setSituacao] = useState<WhatsappStatus | null>(null);
  const [outroNumero, setOutroNumero] = useState(false);
  const noInicio = state.step === "escolher";

  useEffect(() => {
    if (!noInicio) return;
    api
      .whatsappStatus()
      .then(setSituacao)
      .catch(() => setSituacao(SEM_LEITURA));
  }, [noInicio]);

  useEffect(() => {
    const delay = pollingDelay(state.step);
    if (!delay) return;
    const timer = setInterval(async () => {
      try {
        const status = await api.whatsappStatus();
        dispatch({ type: "estado", status: status.status ?? "unknown", qrCode: status.qrCode });
      } catch (error) {
        dispatch({ type: "erro", message: (error as Error).message });
      }
    }, delay);
    return () => clearInterval(timer);
  }, [state.step]);

  async function enviarOficial() {
    const encontrados = validateOfficial(valores);
    setProblemas(encontrados);
    if (Object.keys(encontrados).length) return;
    dispatch({ type: "enviar" });
    try {
      const { metaWebhook } = await api.connectOfficial(valores);
      dispatch({ type: "conectou_oficial", metaWebhook });
    } catch (error) {
      dispatch({ type: "erro", message: (error as Error).message });
    }
  }

  async function criarSessao() {
    dispatch({ type: "enviar" });
    try {
      await api.connectUnofficial();
      dispatch({ type: "criou_sessao" });
    } catch (error) {
      dispatch({ type: "erro", message: (error as Error).message });
    }
  }

  async function lerQrDeNovo() {
    dispatch({ type: "enviar" });
    try {
      await api.reconnect();
      dispatch({ type: "criou_sessao" });
    } catch (error) {
      dispatch({ type: "erro", message: (error as Error).message });
    }
  }

  if (situacao === null) return <Loading />;
  if (noInicio && situacao.route && situacao.connected) {
    return (
      <Card title="WhatsApp conectado">
        <Stack>
          <Text>O número já está ligado ao atendimento. As conversas chegam no painel de atendimento.</Text>
          {situacao.findings.length ? (
            <Alert tone="warning">
              <Achados itens={situacao.findings} />
            </Alert>
          ) : null}
        </Stack>
      </Card>
    );
  }
  if (noInicio && situacao.route && !outroNumero) {
    return (
      <Card title={situacao.level === "fora" ? "O WhatsApp do atendimento parou" : "O WhatsApp do atendimento pede atenção"}>
        <Stack>
          <Alert tone={situacao.level === "fora" ? "danger" : "warning"}>
            <Achados itens={situacao.findings} />
          </Alert>
          <Stack direction="row" gap={8}>
            {situacao.route === "nao_oficial" ? (
              <Button onClick={lerQrDeNovo}>Ler o QR de novo</Button>
            ) : (
              <Button onClick={() => dispatch({ type: "escolher_rota", route: "oficial" })}>Trocar o token da Meta</Button>
            )}
            <Button variant="secondary" onClick={() => setOutroNumero(true)}>
              Conectar outro número
            </Button>
          </Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <Card title="Conectar WhatsApp">
      <Stack>
        {state.step === "escolher" ? (
          <Choice
            label="Como conectar o número"
            value={"" as "oficial" | "nao_oficial"}
            onChange={(route) => dispatch({ type: "escolher_rota", route })}
            options={[
              { value: "oficial", label: "API oficial do WhatsApp (recomendado)", hint: "Pela Meta, com o número verificado. Sem risco de banimento por uso da API." },
              ...(permitirNaoOficial
                ? [{ value: "nao_oficial" as const, label: "Conexão pelo WhatsApp Web (não oficial)", hint: "Lê um QR no celular, como um aparelho conectado. Tem risco de banimento." }]
                : []),
            ]}
          />
        ) : null}

        {state.step === "formulario_oficial" ? (
          <Stack>
            {OFFICIAL_FIELDS.map((field) => (
              <TextField
                key={field.name}
                label={field.label}
                hint={field.hint}
                secret={field.secret}
                value={valores[field.name] ?? ""}
                error={problemas[field.name]}
                onChange={(value) => setValores({ ...valores, [field.name]: value })}
              />
            ))}
            <Stack direction="row" gap={8}>
              <Button onClick={enviarOficial}>Conectar</Button>
              <Button variant="secondary" onClick={() => dispatch({ type: "voltar" })}>
                Voltar
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {state.step === "configurar_meta" ? (
          <Alert tone="success">
            <Stack gap={8}>
              <Text>Falta um passo no app da Meta: em WhatsApp, Configuração, cadastre o retorno abaixo e assine o campo messages.</Text>
              <Text>URL de retorno: {state.metaWebhook?.callbackUrl ?? "veja na caixa do painel de atendimento"}</Text>
              <Text>Token de verificação: {state.metaWebhook?.verifyToken ?? "veja na caixa do painel de atendimento"}</Text>
            </Stack>
          </Alert>
        ) : null}

        {state.step === "aviso_nao_oficial" || state.step === "pronto_para_criar" ? (
          <Stack>
            <Alert tone="warning">
              <Stack gap={8}>
                {UNOFFICIAL_RISK.map((line) => (
                  <Text key={line}>{line}</Text>
                ))}
              </Stack>
            </Alert>
            <Toggle label="Li e entendi os riscos" checked={state.accepted} onChange={(checked) => checked && dispatch({ type: "aceitar_risco" })} />
            <Stack direction="row" gap={8}>
              <Button disabled={!state.accepted} onClick={criarSessao}>
                Gerar QR
              </Button>
              <Button variant="secondary" onClick={() => dispatch({ type: "voltar" })}>
                Voltar
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {state.step === "conectando" || state.step === "aguardando_qr" ? <Loading label="Preparando a conexão" /> : null}

        {state.step === "mostrar_qr" && state.qrCode ? (
          <Stack>
            <Text>No celular do número, abra o WhatsApp, vá em Aparelhos conectados, toque em Conectar um aparelho e leia o QR.</Text>
            <img src={state.qrCode} alt="QR para conectar o WhatsApp" width={264} height={264} />
          </Stack>
        ) : null}

        {state.step === "conectado" ? <Alert tone="success">WhatsApp conectado. As conversas chegam no painel de atendimento.</Alert> : null}

        {state.step === "erro" ? (
          <Stack>
            <Alert tone="danger">{state.error}</Alert>
            <Button variant="secondary" onClick={() => dispatch({ type: "voltar" })}>
              Começar de novo
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
