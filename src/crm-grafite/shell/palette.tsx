"use client";

import { useRouter } from "@/crm-grafite/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/icon";
import { KeyHint, TipoTag } from "../ui/marcadores";
import { Button } from "../ui/button";
import { Spinner } from "../ui/feedback";
import { useIdV4 } from "../ui/flutuante";
import { interpretarConsultaV4, type PessoaBuscaV4 } from "../busca";
import type { ItemNavV4 } from "../nav";

export type BuscarPessoas = (q: string, sinal: AbortSignal) => Promise<PessoaBuscaV4[]>;

/** Busca real: GET /api/crm/v4/buscar (operador obrigatório, até 8, contato mascarado). */
export const buscarPessoasApi: BuscarPessoas = async (q, sinal) => {
  const tempo = AbortSignal.timeout(8000);
  const r = await fetch(`/api/crm/v4/buscar?q=${encodeURIComponent(q)}`, {
    signal: AbortSignal.any ? AbortSignal.any([sinal, tempo]) : sinal,
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`busca ${r.status}`);
  const j = (await r.json()) as { pessoas?: PessoaBuscaV4[] };
  return j.pessoas ?? [];
};

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Telas que casam com o texto (sem acento, por palavra do rótulo ou do grupo). */
export function filtrarTelas(itens: Array<ItemNavV4 & { grupo: string }>, q: string): Array<ItemNavV4 & { grupo: string }> {
  const t = semAcento(q.trim());
  if (!t) return itens;
  return itens.filter((i) => semAcento(`${i.label} ${i.grupo}`).includes(t));
}

type Opcao =
  | { tipo: "tela"; id: string; label: string; sub: string; href: string; item: ItemNavV4 }
  | { tipo: "pessoa"; id: string; label: string; sub: string; href: string; pessoa: PessoaBuscaV4 };

type EstadoBusca = "ocioso" | "buscando" | "ok" | "erro";

/**
 * Paleta ⌘K: vai para uma tela E busca pessoas por nome ou telefone.
 * Combobox com lista (setas, Enter abre, Escape fecha e devolve o foco).
 */
export function CommandPaletteV4({
  aberta,
  aoFechar,
  telas,
  buscarPessoas,
  podeBuscarPessoas,
}: {
  aberta: boolean;
  aoFechar: () => void;
  telas: Array<ItemNavV4 & { grupo: string }>;
  buscarPessoas: BuscarPessoas;
  podeBuscarPessoas: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  const listaId = useIdV4("v4-paleta-lista");
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [pessoas, setPessoas] = useState<PessoaBuscaV4[]>([]);
  const [estado, setEstado] = useState<EstadoBusca>("ocioso");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) {
      anterior.current = document.activeElement as HTMLElement | null;
      d.showModal();
      setQ("");
      setPessoas([]);
      setEstado("ocioso");
      setAtivo(0);
      inputRef.current?.focus();
    } else if (!aberta && d.open) {
      d.close();
      const alvo = anterior.current;
      anterior.current = null;
      if (alvo?.isConnected) alvo.focus();
    }
  }, [aberta]);

  const consulta = interpretarConsultaV4(q);
  useEffect(() => {
    if (!aberta || !podeBuscarPessoas || consulta.tipo === "vazia") {
      setPessoas([]);
      setEstado("ocioso");
      return;
    }
    const ctl = new AbortController();
    setEstado("buscando");
    const t = window.setTimeout(() => {
      buscarPessoas(q, ctl.signal)
        .then((p) => {
          setPessoas(p);
          setEstado("ok");
        })
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === "AbortError") return;
          setPessoas([]);
          setEstado("erro");
        });
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
    // consulta deriva de q
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, aberta, podeBuscarPessoas, tentativa, buscarPessoas]);

  const opcoes: Opcao[] = useMemo(() => {
    const ts: Opcao[] = filtrarTelas(telas, q).map((i) => ({
      tipo: "tela",
      id: `tela-${i.id}`,
      label: i.label,
      sub: i.grupo,
      href: i.href,
      item: i,
    }));
    const ps: Opcao[] = pessoas.map((p) => ({
      tipo: "pessoa",
      id: `pessoa-${p.id}`,
      label: p.nome,
      sub: [p.empresa, p.telefone, p.email].filter(Boolean).join(" · "),
      href: p.href,
      pessoa: p,
    }));
    return [...ps, ...ts];
  }, [telas, q, pessoas]);

  useEffect(() => {
    setAtivo((a) => Math.min(a, Math.max(0, opcoes.length - 1)));
  }, [opcoes.length]);

  function ir(o: Opcao | undefined) {
    if (!o) return;
    aoFechar();
    router.push(o.href);
  }

  const idOpcao = (o: Opcao) => `${listaId}-${o.id}`;
  const telasOps = opcoes.filter((o) => o.tipo === "tela");
  const pessoasOps = opcoes.filter((o) => o.tipo === "pessoa");
  const indice = (o: Opcao) => opcoes.indexOf(o);

  return (
    <dialog
      ref={ref}
      className="v4-dialog v4-palette"
      aria-label="Buscar pessoa ou ir para uma tela"
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClose={() => {
        if (aberta) aoFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div className="v4-palette__search">
        <Icon name="busca" />
        <input
          ref={inputRef}
          className="v4-palette__input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={opcoes[ativo] ? idOpcao(opcoes[ativo]) : undefined}
          aria-label="Buscar pessoa por nome ou telefone, ou ir para uma tela"
          placeholder={podeBuscarPessoas ? "Nome, telefone ou tela" : "Ir para uma tela"}
          value={q}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            setAtivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtivo((a) => (opcoes.length ? (a + 1) % opcoes.length : 0));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((a) => (opcoes.length ? (a - 1 + opcoes.length) % opcoes.length : 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              ir(opcoes[ativo]);
            }
          }}
        />
        <KeyHint teclas={["Esc"]} />
      </div>
      <div id={listaId} role="listbox" aria-label="Resultados" className="v4-palette__list">
        {podeBuscarPessoas && (
          <div role="group" aria-labelledby={`${listaId}-gp`}>
            <p id={`${listaId}-gp`} className="v4-palette__group" role="presentation">
              Pessoas
            </p>
            {consulta.tipo === "vazia" && (
              <p className="v4-palette__note" role="presentation">
                Digite um nome (2 letras ou mais) ou um telefone (4 dígitos ou mais).
              </p>
            )}
            {estado === "buscando" && (
              <p className="v4-palette__note" role="presentation">
                <Spinner label="Buscando pessoas" mostrarTexto />
              </p>
            )}
            {estado === "erro" && (
              <p className="v4-palette__note v4-palette__note--erro" role="presentation">
                <Icon name="erro" />
                Não foi possível buscar pessoas agora.
                <Button size="sm" variant="secondary" icon="recarregar" onClick={() => setTentativa((n) => n + 1)}>
                  Tentar de novo
                </Button>
              </p>
            )}
            {estado === "ok" && pessoasOps.length === 0 && (
              <p className="v4-palette__note" role="presentation">
                Ninguém com “{q.trim()}”.
              </p>
            )}
            {pessoasOps.map((o) => (
              <div
                key={o.id}
                id={idOpcao(o)}
                role="option"
                aria-selected={indice(o) === ativo}
                className="v4-palette__opt"
                onPointerMove={() => setAtivo(indice(o))}
                onClick={() => ir(o)}
              >
                <Icon name="pessoas" />
                <span className="v4-palette__opt-main">
                  <span className="v4-palette__opt-title">{o.label}</span>
                  {o.sub && <span className="v4-palette__opt-sub">{o.sub}</span>}
                </span>
                {o.tipo === "pessoa" && <TipoTag tipo={o.pessoa.tipo} />}
              </div>
            ))}
          </div>
        )}
        <div role="group" aria-labelledby={`${listaId}-gt`}>
          <p id={`${listaId}-gt`} className="v4-palette__group" role="presentation">
            Telas
          </p>
          {telasOps.length === 0 && (
            <p className="v4-palette__note" role="presentation">
              Nenhuma tela com “{q.trim()}”.
            </p>
          )}
          {telasOps.map((o) => (
            <div
              key={o.id}
              id={idOpcao(o)}
              role="option"
              aria-selected={indice(o) === ativo}
              className="v4-palette__opt"
              onPointerMove={() => setAtivo(indice(o))}
              onClick={() => ir(o)}
            >
              {o.tipo === "tela" && <Icon name={o.item.icone} />}
              <span className="v4-palette__opt-main">
                <span className="v4-palette__opt-title">{o.label}</span>
                <span className="v4-palette__opt-sub">{o.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="v4-palette__foot" aria-hidden="true">
        <span>
          <kbd className="v4-kbd">↑↓</kbd> navegar
        </span>
        <span>
          <kbd className="v4-kbd">↵</kbd> abrir
        </span>
        <span>
          <kbd className="v4-kbd">Esc</kbd> fechar
        </span>
      </div>
    </dialog>
  );
}
