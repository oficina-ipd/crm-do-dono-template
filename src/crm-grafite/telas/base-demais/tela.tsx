"use client";

import { useCallback, useReducer, type ReactNode } from "react";
import { ButtonLink, ErrorState, Icon, PageHeader, PermissionState, type Passo } from "../../ui";
import { ENVIO_OCIOSO, horaCurta, proximoEnvio, rotuloEnvio, type EstadoEnvio } from "./formulario";
import "../../styles/telas/base-demais.css";

/**
 * Raiz de uma tela v4 que já foi migrada. A casca v4 envolve tudo em `.crm-v4-legado`
 * (tokens do v3) para as telas antigas; a marca `data-v4-tela` faz o invólucro sumir pela regra
 * única da casca (styles/base.css) e devolve a herança da v4 (fonte, cor, foco).
 * `v4-tela--demais` marca as telas desta leva para o tema Grafite (cabeçalho na faixa do topo,
 * tabelas com cabeçalho fixo); no visual neutro nenhuma regra usa essa classe.
 */
export function TelaV4({ area, children }: { area: string; children: ReactNode }) {
  return (
    <div data-v4-tela className={`v4-tela v4-tela--demais v4-tela--${area}`}>
      {children}
    </div>
  );
}

/** Cabeçalho padrão das telas desta leva: título, meta e ações, sem slogan. */
export function CabecalhoTela({ titulo, meta, acoes, caminho }: { titulo: string; meta?: ReactNode; acoes?: ReactNode; caminho?: Passo[] }) {
  return <PageHeader titulo={titulo} meta={meta} acoes={acoes} caminho={caminho} />;
}

/** Sem permissão, com a condição de acesso e um caminho de volta (nunca redirecionamento mudo). */
export function SemPermissaoV4({ titulo, texto, voltar = { href: "/fila", label: "Voltar para a Fila" } }: { titulo: string; texto: string; voltar?: { href: string; label: string } }) {
  return (
    <TelaV4 area="sem-permissao">
      <div className="v4-tela__estado">
        <PermissionState nivel={1} titulo={titulo} texto={texto} acoes={<ButtonLink href={voltar.href}>{voltar.label}</ButtonLink>} />
      </div>
    </TelaV4>
  );
}

/** Erro ao montar a tela: diz o impacto e oferece tentar de novo no lugar. */
export function ErroTelaV4({ titulo, area, aoTentar }: { titulo: string; area: string; aoTentar: () => unknown }) {
  return (
    <TelaV4 area={area}>
      <CabecalhoTela titulo={titulo} />
      <div className="v4-tela__estado">
        <ErrorState
          nivel={2}
          titulo="Não deu para carregar esta tela"
          texto="Nada foi alterado. Tente de novo; se continuar, confira a conexão com o servidor do CRM."
          aoTentar={aoTentar}
        />
      </div>
    </TelaV4>
  );
}

/** Estado de envio ligado a uma função que grava. Só marca "salvo" quando a Promise resolve. */
export function useEnvio() {
  const [estado, despachar] = useReducer(proximoEnvio, ENVIO_OCIOSO);
  const enviar = useCallback(async (fn: () => Promise<{ ok: true } | { ok: false; erro: string; parcial?: string }>) => {
    despachar({ tipo: "enviar" });
    try {
      const r = await fn();
      if (r.ok) despachar({ tipo: "ok", em: horaCurta() });
      else despachar({ tipo: "erro", erro: r.erro, parcial: r.parcial });
      return r.ok;
    } catch (e) {
      despachar({ tipo: "erro", erro: e instanceof Error ? e.message : "tente de novo." });
      return false;
    }
  }, []);
  const editar = useCallback(() => despachar({ tipo: "editar" }), []);
  return { estado, enviar, editar };
}

/** Linha de estado ao lado do botão de salvar: salvando, salvo (com hora) ou falhou (fica). */
export function EstadoSalvar({ estado }: { estado: EstadoEnvio }) {
  const texto = rotuloEnvio(estado);
  if (estado.fase === "falhou") {
    return (
      <p className="v4-salvar v4-salvar--erro" role="alert">
        <Icon name="erro" />
        <span>{texto}</span>
      </p>
    );
  }
  return (
    <p className={["v4-salvar", estado.fase === "salvo" ? "v4-salvar--ok" : ""].filter(Boolean).join(" ")} role="status" aria-live="polite">
      {estado.fase === "salvo" && <Icon name="sucesso" />}
      {texto && <span>{texto}</span>}
    </p>
  );
}
