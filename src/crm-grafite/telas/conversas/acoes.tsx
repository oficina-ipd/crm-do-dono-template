"use client";

/**
 * Ações de contexto usadas em Conversas e na Ficha: revelar contato, mover etapa (com motivo quando
 * a regra pede), marcar como perdida, reabrir, criar tarefa e nota. Tudo por `despachar` (comandos
 * reais de src/domain/comandos.ts); erro de regra vira aviso sozinho.
 */
import { useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { etapaDe, indiceEtapa } from "@/domain/funil";
import type { EtapaId, Oportunidade } from "@/domain/types";
import { Button, Dialog, DropdownMenu, Input, Select, Textarea, type ItemMenu } from "../../ui";
import { destinosManuais, exigenciaParaMover } from "./modelo";

/** Mostra o dado mascarado; "Revelar" mostra o completo só nesta tela, até ocultar ou sair. */
export function RevelarDado({ rotulo, mascarado, completo, numero }: { rotulo: string; mascarado: string; completo: string; numero?: boolean }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="v4-cv-dado">
      <div className="v4-cv-dado__linha">
        <span className={numero ? "v4-num" : "v4-cv-dado__valor"}>
          <span className="v4-sr">{rotulo}: </span>
          {visivel ? completo : mascarado}
        </span>
        <Button size="sm" variant="ghost" icon="olho" aria-pressed={visivel} onClick={() => setVisivel((v) => !v)}>
          {visivel ? "Ocultar" : "Revelar"}
          <span className="v4-sr"> {rotulo}</span>
        </Button>
      </div>
    </div>
  );
}

type Pedido = { tipo: "motivo"; para: EtapaId; nome: string; pulo: "pular" | "voltar" } | { tipo: "perder" } | null;

/**
 * "Mover para…": só as etapas que uma pessoa move (as automáticas ficam com o sistema). Pular ou
 * voltar etapa pede o motivo; "Briefing feito" sem briefing aparece desabilitado e diz por quê.
 * Com `comPerda`, oferece "Marcar como perdida…"; perdida, oferece "Reabrir".
 */
export function MenuMoverEtapa({
  oportunidade: o,
  comPerda = false,
  rotulo = "Mover para…",
  size = "sm",
}: {
  oportunidade: Oportunidade;
  comPerda?: boolean;
  rotulo?: string;
  size?: "sm" | "md";
}) {
  const { despachar, operador } = useCRM();
  const [pedido, setPedido] = useState<Pedido>(null);
  const [motivo, setMotivo] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");
  const [outro, setOutro] = useState("");
  const por = operador?.id ?? "sistema";
  const etapa = etapaDe(o.etapa);
  const motivos = etapa?.motivosPerda ?? [];

  async function mover(para: EtapaId, nome: string, m?: string) {
    const r = await despachar({ tipo: "moverEtapa", oportunidadeId: o.id, para, por, motivo: m }, `Movida para ${nome}`);
    return r !== null;
  }

  const destinos = destinosManuais(o);
  const itens: ItemMenu[] = [];
  if (o.perdida) {
    itens.push({ id: "reabrir", label: `Reabrir em ${etapa?.nome ?? o.etapa}`, icon: "recarregar", onSelect: () => void despachar({ tipo: "reabrir", oportunidadeId: o.id, por }, "Oportunidade reaberta") });
  } else if (destinos.length) {
    itens.push({ tipo: "rotulo", id: "rot", label: "Mover para" });
    for (const d of destinos) {
      const ex = exigenciaParaMover(o, d.id);
      itens.push({
        id: d.id,
        label: ex === "briefing" ? `${d.nome} (preencha o briefing antes)` : d.nome,
        icon: "chevronDireita",
        disabled: ex === "briefing",
        onSelect: () => {
          if (ex === "motivo") {
            setMotivo("");
            setPedido({ tipo: "motivo", para: d.id, nome: d.nome, pulo: indiceEtapa(d.id) < indiceEtapa(o.etapa) ? "voltar" : "pular" });
          } else void mover(d.id, d.nome);
        },
      });
    }
  }
  if (comPerda && !o.perdida && motivos.length) {
    itens.push({ tipo: "separador", id: "sep" }, { id: "perder", label: "Marcar como perdida…", danger: true, onSelect: () => { setMotivoPerda(motivos[0] ?? ""); setOutro(""); setPedido({ tipo: "perder" }); } });
  }
  if (itens.length === 0) return null;

  const motivoFinal = motivoPerda === "__outro" ? outro.trim() : motivoPerda;

  return (
    <div className="v4-cv-mover">
      <DropdownMenu
        label="Mover a oportunidade"
        lado="baixo-fim"
        itens={itens}
        gatilho={(p) => (
          <Button
            ref={p.ref}
            size={size}
            variant="secondary"
            iconEnd="chevronBaixo"
            aria-haspopup={p["aria-haspopup"]}
            aria-expanded={p["aria-expanded"]}
            aria-controls={p["aria-controls"]}
            onClick={p.onClick}
            onKeyDown={p.onKeyDown}
          >
            {o.perdida ? "Reabrir…" : rotulo}
          </Button>
        )}
      />
      <Dialog
        open={pedido?.tipo === "motivo"}
        onClose={() => setPedido(null)}
        title={pedido?.tipo === "motivo" ? `Mover para ${pedido.nome}` : ""}
        description={
          pedido?.tipo === "motivo"
            ? pedido.pulo === "voltar"
              ? "Voltar uma etapa precisa de um motivo. Ele fica no histórico da oportunidade."
              : "Pular etapa precisa de um motivo. Ele fica no histórico da oportunidade."
            : undefined
        }
        dirty={motivo.trim().length > 0}
        perda="o motivo que você escreveu"
        footer={({ fechar }) => (
          <>
            <Button variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={motivo.trim().length < 3}
              onClick={async () => {
                if (pedido?.tipo !== "motivo") return;
                if (await mover(pedido.para, pedido.nome, motivo.trim())) setPedido(null);
              }}
            >
              Mover
            </Button>
          </>
        )}
      >
        <Textarea label="Motivo" required rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} help="Pelo menos 3 letras." />
      </Dialog>
      <Dialog
        open={pedido?.tipo === "perder"}
        onClose={() => setPedido(null)}
        title="Marcar a oportunidade como perdida"
        description="O card sai do funil com o motivo escolhido. Dá para reabrir depois, por este mesmo menu."
        footer={({ fechar }) => (
          <>
            <Button variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!motivoFinal}
              onClick={async () => {
                const r = await despachar({ tipo: "marcarPerdida", oportunidadeId: o.id, motivo: motivoFinal, por }, "Marcada como perdida");
                if (r) setPedido(null);
              }}
            >
              Marcar como perdida
            </Button>
          </>
        )}
      >
        <Select
          label="Motivo"
          value={motivoPerda}
          onChange={(e) => setMotivoPerda(e.target.value)}
          options={[...motivos.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) })), { value: "__outro", label: "Outro motivo" }]}
        />
        {motivoPerda === "__outro" && <Input label="Qual motivo" required value={outro} onChange={(e) => setOutro(e.target.value)} maxLength={200} />}
      </Dialog>
    </div>
  );
}

/** Data "AAAA-MM-DD" do campo vira o fim daquele dia no fuso do navegador. */
export function fimDoDia(data: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const d = new Date(`${data}T23:59:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function FormTarefa({ contatoId, aoCriar, aoCancelar }: { contatoId: string; aoCriar: () => void; aoCancelar?: () => void }) {
  const { despachar } = useCRM();
  const [titulo, setTitulo] = useState("");
  const [vence, setVence] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    const r = await despachar({ tipo: "criarTarefa", contatoId, texto: titulo.trim(), venceEm: fimDoDia(vence), origem: "manual" }, "Tarefa criada");
    setSalvando(false);
    if (!r) return;
    setTitulo("");
    setVence("");
    aoCriar();
  }

  return (
    <form className="v4-cv-form" onSubmit={enviar}>
      <Input label="Tarefa" required value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} autoFocus />
      <Input label="Vence em" type="date" value={vence} onChange={(e) => setVence(e.target.value)} help="Opcional. Vale até o fim do dia." />
      <div className="v4-cv-form__acoes">
        {aoCancelar && (
          <Button variant="ghost" size="sm" onClick={aoCancelar}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="secondary" size="sm" busy={salvando} busyLabel="Salvando" disabled={!titulo.trim()}>
          Criar tarefa
        </Button>
      </div>
    </form>
  );
}

export function FormNota({ contatoId, aoCriar, aoCancelar }: { contatoId: string; aoCriar: () => void; aoCancelar?: () => void }) {
  const { despachar, operador } = useCRM();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim() || salvando) return;
    setSalvando(true);
    const r = await despachar({ tipo: "adicionarNota", contatoId, texto: texto.trim(), autorId: operador?.id ?? null }, "Nota salva");
    setSalvando(false);
    if (!r) return;
    setTexto("");
    aoCriar();
  }

  return (
    <form className="v4-cv-form" onSubmit={enviar}>
      <Textarea label="Nova nota" required value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={4000} autoFocus help="Só a equipe vê. O contato não recebe." />
      <div className="v4-cv-form__acoes">
        {aoCancelar && (
          <Button variant="ghost" size="sm" onClick={aoCancelar}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="secondary" size="sm" busy={salvando} busyLabel="Salvando" disabled={!texto.trim()}>
          Salvar nota
        </Button>
      </div>
    </form>
  );
}
