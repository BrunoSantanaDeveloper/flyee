"use client";

// O painel do Chatwoot dentro da moldura do projeto (o menu e o cabeçalho do projeto ficam em volta).
// Só funciona com o modo moldura ligado no proxy (frame-ancestors com a origem do projeto) e com o
// painel num subdomínio do mesmo domínio do projeto; sem isso, use o AtendimentoBotao em nova aba.

import { useEffect, useState } from "react";

import { supportApi } from "../atendimento/base/ui/client.mjs";
import { Alert, Loading } from "./primitives";

const api = supportApi();

export function PainelAtendimento({ altura = "calc(100vh - 64px)" }: { altura?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .enter()
      .then(({ url: entrada }) => ativo && setUrl(entrada))
      .catch((error: Error) => ativo && setErro(error.message));
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) return <Alert tone="danger">{erro}</Alert>;
  if (!url) return <Loading label="Abrindo o atendimento" />;
  return (
    <iframe
      title="Atendimento"
      src={url}
      style={{ width: "100%", height: altura, border: 0 }}
      allow="microphone; clipboard-read; clipboard-write; notifications"
    />
  );
}
