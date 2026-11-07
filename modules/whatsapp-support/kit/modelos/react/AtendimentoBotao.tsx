"use client";

// O botão que leva a pessoa ao painel de atendimento já logada. A aba nova abre no clique (antes da
// espera), para o navegador não bloquear; o link de entrada chega em seguida e vale uma vez só.

import { useState } from "react";

import { supportApi } from "../atendimento/base/ui/client.mjs";
import { Button, Text } from "./primitives";

const api = supportApi();

export function AtendimentoBotao({ modo = "nova-aba", rotulo = "Atendimento" }: { modo?: "nova-aba" | "mesma-aba"; rotulo?: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  async function abrir() {
    setErro(null);
    setAbrindo(true);
    const janela = modo === "nova-aba" ? window.open("", "_blank") : null;
    try {
      const { url } = await api.enter();
      if (janela) janela.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      janela?.close();
      setErro((error as Error).message);
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <>
      <Button onClick={abrir} disabled={abrindo}>
        {abrindo ? "Abrindo..." : rotulo}
      </Button>
      {erro ? <Text tone="danger">{erro}</Text> : null}
    </>
  );
}
