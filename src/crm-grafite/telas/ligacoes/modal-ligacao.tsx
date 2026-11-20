"use client";

import { useEffect, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { adapters } from "@/lib/adapters";
import { oportunidadePrincipal, primeiroNome } from "@/domain/rules";
import type { Ligacao, Termometro, TrechoLigacao } from "@/domain/types";
import { Button, Checkbox, Dialog, Icon, Input, SegmentedControl, Textarea } from "../../ui";
import { EstadoSalvar } from "../base-demais/tela";
import { useEnvioReiniciavel, useGravar } from "../equipe/use-gravar";
import { RESULTADO, ROTULO_MARCA, TERMOMETRO, cronometro } from "./ligacoes-logica";
import "../../styles/telas/config.css";

type Fase = "antes" | "ligando" | "depois";
type Follow = { texto: string; quando: string; marcado: boolean };

/**
 * Ligação no visual Grafite (substitui src/screens/modais/Ligacao.tsx, mesmas props e mesmo
 * comando): aviso de gravação → cronômetro → encerrar → transcrição com trechos marcados,
 * termômetro obrigatório, resumo e follow-ups que viram tarefas.
 * A discagem e a transcrição são simuladas (src/lib/adapters) e a tela diz isso.
 */
export function ModalLigacaoGrafite({ contatoId, onClose }: { contatoId: string | null; onClose: () => void }) {
  const { contato, operador, estado } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, zerar } = useEnvioReiniciavel();
  const c = contatoId ? contato(contatoId) : null;
  const [fase, setFase] = useState<Fase>("antes");
  const [aviso, setAviso] = useState(false);
  const [inicio, setInicio] = useState(0);
  const [seg, setSeg] = useState(0);
  const [resultado, setResultado] = useState<Ligacao["resultado"]>("atendeu");
  const [termometro, setTermometro] = useState<Termometro | "">("");
  const [erroTermo, setErroTermo] = useState<string | null>(null);
  const [resumo, setResumo] = useState("");
  const [trechos, setTrechos] = useState<TrechoLigacao[]>([]);
  const [termometroIA, setTermometroIA] = useState<Termometro>("morno");
  const [follows, setFollows] = useState<Follow[]>([]);
  const [novoFollow, setNovoFollow] = useState("");

  useEffect(() => {
    if (!contatoId) return;
    setFase("antes");
    setAviso(false);
    setSeg(0);
    setResultado("atendeu");
    setTermometro("");
    setErroTermo(null);
    setResumo("");
    setTrechos([]);
    setFollows([]);
    setNovoFollow("");
    zerar();
  }, [contatoId, zerar]);

  useEffect(() => {
    if (fase !== "ligando") return;
    const t = setInterval(() => setSeg(Math.round((Date.now() - inicio) / 1000)), 500);
    return () => clearInterval(t);
  }, [fase, inicio]);

  const o = c ? oportunidadePrincipal(c.oportunidades) : null;
  const nome = c ? primeiroNome(c.nome) : "";

  async function ligar() {
    if (!c) return;
    await adapters.telefonia.ligar(c.telefone, { avisoDeGravacao: true });
    setInicio(Date.now());
    setFase("ligando");
  }

  async function encerrar() {
    if (!c) return;
    const dur = Math.max(1, Math.round((Date.now() - inicio) / 1000));
    setSeg(dur);
    if (resultado === "atendeu") {
      const t = await adapters.transcricao.transcrever("sim", { nome, dor: o?.briefing?.dor, segmento: c.segmento });
      setTrechos(t.trechos);
      setTermometroIA(t.termometroIA);
      setResumo(t.resumo);
      setFollows(t.followups.map((f) => ({ texto: f.texto, quando: f.quando, marcado: true })));
    }
    setFase("depois");
  }

  async function salvar() {
    if (!c) return;
    if (!termometro) {
      setErroTermo("Escolha como foi a ligação: fria, morna ou quente.");
      return;
    }
    const l: Omit<Ligacao, "id"> = {
      contatoId: c.id,
      operadorId: operador?.id ?? null,
      iniciouEm: new Date(inicio).toISOString(),
      duracaoSeg: seg,
      resultado,
      avisoGravacaoDado: aviso,
      trechos: resultado === "atendeu" ? trechos : [],
      followups: follows.filter((f) => f.marcado).map((f) => ({ texto: f.texto, quando: f.quando, origem: "ligação" })),
      resumo: resumo.trim(),
      termometroVendedor: termometro,
      termometroIA,
    };
    const marcados = l.followups.length;
    const ok = await enviar(async () => {
      const r = await gravar({ tipo: "registrarLigacao", ligacao: l }, marcados ? `Ligação salva na ficha. ${marcados === 1 ? "1 follow-up virou tarefa" : `${marcados} follow-ups viraram tarefas`}.` : "Ligação salva na ficha.");
      return r.ok ? { ok: true } : r;
    });
    if (ok) onClose();
  }

  const relogio = cronometro(seg);
  return (
    <Dialog
      open={Boolean(c)}
      onClose={onClose}
      title={c ? `Ligação · ${c.nome}` : "Ligação"}
      dirty={fase !== "antes"}
      perda={fase === "ligando" ? "esta ligação (ela ainda não foi registrada)" : "o registro desta ligação"}
      closeOnBackdrop={fase === "antes"}
      footer={({ fechar }) => (
        <div className="v4-cfg__rodape">
          <EstadoSalvar estado={envio} />
          <div className="v4-cfg__rodape-acoes">
            {fase === "antes" && (
              <>
                <Button variant="secondary" onClick={fechar}>
                  Cancelar
                </Button>
                <Button variant="primary" icon="telefone" disabled={!aviso} onClick={ligar}>
                  Ligar para {c?.telefone}
                </Button>
              </>
            )}
            {fase === "ligando" && (
              <Button variant="destructive" onClick={encerrar}>
                Encerrar ligação
              </Button>
            )}
            {fase === "depois" && (
              <Button variant="primary" onClick={salvar} busy={envio.fase === "salvando"} busyLabel="Salvando">
                Salvar na ficha
              </Button>
            )}
          </div>
        </div>
      )}
    >
      {c && fase === "antes" && (
        <div className="v4-form">
          <p className="v4-t-ui">
            A ligação é gravada e transcrita. <span className="v4-t-strong">Sem avisar o contato, não grava.</span> Diga nos primeiros segundos: “esta
            ligação está sendo gravada para registro, tudo bem?”
          </p>
          <Checkbox checked={aviso} onChange={(e) => setAviso(e.target.checked)} label="Vou avisar que a ligação é gravada" />
          {o?.briefing && (
            <dl className="v4-fatos">
              <dt>Dor</dt>
              <dd>{o.briefing.dor}</dd>
              <dt>Meta</dt>
              <dd>{o.briefing.meta}</dd>
              <dt>Data</dt>
              <dd>{o.briefing.data}</dd>
            </dl>
          )}
          <p className="v4-nota v4-nota--atencao">
            <Icon name="alerta" />
            <span>Neste CRM a discagem ainda é simulada: nenhum número é chamado de verdade. O registro da ligação, o termômetro e as tarefas são reais.</span>
          </p>
        </div>
      )}
      {c && fase === "ligando" && (
        <div className="v4-form">
          <p className="v4-lig__relogio v4-tabular" role="timer" aria-label={`Tempo de ligação: ${relogio}`}>
            {relogio}
          </p>
          <SegmentedControl
            label="Resultado"
            value={resultado}
            onChange={(v) => setResultado(v as Ligacao["resultado"])}
            options={(Object.keys(RESULTADO) as Ligacao["resultado"][]).map((r) => ({ value: r, label: RESULTADO[r].rotulo }))}
          />
          <p className="v4-t-meta">Enquanto fala, lembre da Pergunta Matadora da etapa. Ao encerrar, a transcrição aparece aqui.</p>
        </div>
      )}
      {c && fase === "depois" && (
        <div className="v4-form">
          <p className="v4-t-meta">
            Duração {relogio} · {RESULTADO[resultado].rotulo}
            {resultado === "atendeu" ? " · transcrição simulada" : ""}
          </p>
          {resultado === "atendeu" && trechos.length > 0 && (
            <ol className="v4-cfg__trechos" aria-label="Transcrição">
              {trechos.map((t, i) => (
                <li key={i} className="v4-cfg__trecho">
                  <span className="v4-t-meta">
                    <span className="v4-tabular">{t.hora}</span> · {t.quem === "vendedor" ? "Você" : nome}
                    {t.marca ? ` · ${ROTULO_MARCA[t.marca]}` : ""}
                  </span>
                  <span>{t.texto}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="v4-form__grupo">
            <p className="v4-t-ui v4-t-strong" id="lig-termo">
              Como foi? <span className="v4-field__req">obrigatório</span>
            </p>
            <SegmentedControl
              label="Como foi a ligação"
              value={termometro}
              onChange={(v) => {
                setTermometro(v as Termometro);
                setErroTermo(null);
              }}
              options={(["frio", "morno", "quente"] as Termometro[]).map((t) => ({ value: t, label: TERMOMETRO[t] }))}
            />
            {erroTermo && (
              <p className="v4-field__error" role="alert">
                <Icon name="alerta" />
                <span>{erroTermo}</span>
              </p>
            )}
            {resultado === "atendeu" && <p className="v4-t-meta">Leitura da IA: {TERMOMETRO[termometroIA].toLowerCase()}. Vale a sua.</p>}
          </div>
          <Textarea label="Resumo" rows={3} maxLength={2000} value={resumo} onChange={(e) => setResumo(e.target.value)} />
          <fieldset className="v4-form__grupo">
            <legend>Follow-ups (os marcados viram tarefas)</legend>
            {follows.map((f, i) => (
              <Checkbox
                key={i}
                checked={f.marcado}
                onChange={(e) => setFollows((xs) => xs.map((x, j) => (j === i ? { ...x, marcado: e.target.checked } : x)))}
                label={
                  <span>
                    {f.texto} <span className="v4-t-meta">· {f.quando}</span>
                  </span>
                }
              />
            ))}
            <div className="v4-integ__copiar">
              <Input label="Novo follow-up (vence amanhã)" value={novoFollow} maxLength={200} onChange={(e) => setNovoFollow(e.target.value)} />
              <Button
                icon="mais_"
                onClick={() => {
                  if (!novoFollow.trim()) return;
                  setFollows((xs) => [...xs, { texto: novoFollow.trim(), quando: "amanhã", marcado: true }]);
                  setNovoFollow("");
                }}
              >
                Incluir
              </Button>
            </div>
          </fieldset>
          <p className="v4-t-meta">
            {estado.config.nomeRobo} ainda não ouve a ligação: os follow-ups sugeridos vêm da transcrição simulada.
          </p>
        </div>
      )}
    </Dialog>
  );
}
