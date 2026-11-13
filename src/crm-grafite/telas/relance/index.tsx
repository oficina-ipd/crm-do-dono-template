"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import Link from "@/crm-grafite/link";
import { Button, Dialog, DropdownMenu, EmptyState, ErrorState, Icon, Panel, Skeleton, SkeletonGroup, Tabs, Tag, Textarea, useToast } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import { lerIa, lerWhatsapp, type EstadoIa, type EstadoWhatsapp } from "../agentes/fonte";
import { AbaConfig, AbaFila, AbaImportar, AbaIncidentes, AbaNaoContatar, FormNova } from "./abas";
import { acaoCampanha, emergenciaGeral, lerDetalhe, lerVisao, processarLote, type DetalheRelance, type VisaoRelance } from "./fonte";
import { ACAO_OK, EXPLICA_CAMPANHA, STATUS_CAMPANHA, TOM_CAMPANHA, incidentesUnificados, indicadores, textoTick, type Aviso } from "./relance-logica";
import "../../styles/telas/relance.css";

type Aba = "fila" | "config" | "importar" | "naocontatar" | "incidentes";

/**
 * Relance (Ember): a fila da campanha abre a tela; os indicadores ficam numa linha; intenção e
 * limites, importação, "não contatar" e incidentes em abas. Mesmas rotas da tela antiga
 * (/api/reciclador); com a campanha ativa, o Ember envia sozinho dentro dos limites.
 */
export function TelaRelance() {
  const { operador } = useCRM();
  const toast = useToast();
  const gestor = operador?.papel === "dono";
  const podeAgir = Boolean(operador) && operador?.papel !== "leitura";

  const [visao, setVisao] = useState<VisaoRelance | null>(null);
  const [erroVisao, setErroVisao] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState("");
  const [detalhe, setDetalhe] = useState<DetalheRelance | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [aba, setAba] = useState<Aba>("fila");
  const [criando, setCriando] = useState(false);
  const [ia, setIa] = useState<EstadoIa | null>(null);
  const [wpp, setWpp] = useState<EstadoWhatsapp | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ciclo, setCiclo] = useState(false);
  const [ultimoLote, setUltimoLote] = useState<string | null>(null);
  const [parando, setParando] = useState(false);
  const [motivoParada, setMotivoParada] = useState("");

  const carregarVisao = useCallback(async () => {
    try {
      const v = await lerVisao();
      setVisao(v);
      setErroVisao(null);
      setSelecionada((id) => (id && v.campanhas.some((c) => c.id === id) ? id : v.campanhas[0]?.id ?? ""));
      if (v.campanhas.length === 0) setCriando(false);
    } catch (e) {
      setErroVisao(e instanceof Error ? e.message : "Não foi possível carregar as campanhas.");
    }
  }, []);

  const carregarProntidao = useCallback(async () => {
    const [a, w] = await Promise.allSettled([lerIa(), lerWhatsapp()]);
    setIa(a.status === "fulfilled" ? a.value : null);
    setWpp(w.status === "fulfilled" ? w.value : null);
  }, []);

  useEffect(() => {
    void carregarVisao();
    void carregarProntidao();
  }, [carregarVisao, carregarProntidao]);

  useEffect(() => {
    if (!selecionada) {
      setDetalhe(null);
      return;
    }
    let vivo = true;
    setErroDetalhe(null);
    lerDetalhe(selecionada)
      .then((d) => vivo && setDetalhe(d))
      .catch((e: Error) => vivo && setErroDetalhe(e.message));
    return () => {
      vivo = false;
    };
  }, [selecionada, versao]);

  const recarregar = useCallback(async () => {
    setVersao((v) => v + 1);
    await carregarVisao();
  }, [carregarVisao]);

  const pronto = Boolean(detalhe && detalhe.campanha.id === selecionada);
  const campanha = pronto ? detalhe!.campanha : visao?.campanhas.find((c) => c.id === selecionada) ?? null;
  const emergenciaGeralLigada = Boolean(visao?.emergenciaGlobal);
  const emEmergencia = emergenciaGeralLigada || campanha?.status === "emergencia";

  // Ciclo automático desta aba: um lote por minuto enquanto a tela estiver aberta.
  const cicloRef = useRef({ selecionada, recarregar });
  cicloRef.current = { selecionada, recarregar };
  useEffect(() => {
    if (!ciclo || !selecionada || emEmergencia || campanha?.status !== "ativa") return;
    const t = window.setInterval(async () => {
      const { selecionada: id, recarregar: rec } = cicloRef.current;
      try {
        const r = await processarLote(id, false);
        setUltimoLote(r.executadoEm);
        if (r.pausadaPorIncidente) {
          setCiclo(false);
          setAviso({ tom: "atencao", texto: textoTick(r).texto });
        }
        await rec();
      } catch (e) {
        setCiclo(false);
        setAviso({ tom: "erro", texto: `O ciclo automático parou: ${e instanceof Error ? e.message : "erro no servidor."}` });
      }
    }, 60_000);
    return () => window.clearInterval(t);
  }, [ciclo, selecionada, emEmergencia, campanha?.status]);

  async function executarAcao(acao: "ativar" | "pausar" | "retomar_emergencia" | "sincronizar_crm") {
    if (!campanha) return;
    if (acao === "pausar") setCiclo(false);
    try {
      await acaoCampanha(campanha.id, acao);
      setAviso({ tom: "ok", texto: ACAO_OK[acao] });
      await recarregar();
    } catch (e) {
      setAviso({ tom: "erro", texto: `${e instanceof Error ? e.message : "A ação foi recusada."} A campanha continua como estava.` });
    }
  }

  async function pararTudo() {
    setCiclo(false);
    try {
      const r = await emergenciaGeral(motivoParada.trim() || "Parada de emergência acionada na tela Relance.");
      toast.avisar({
        tom: "sucesso",
        titulo: "Parada de emergência ligada",
        texto: r.pausadas > 0 ? `${r.pausadas} ${r.pausadas === 1 ? "campanha ativa foi congelada" : "campanhas ativas foram congeladas"}. Nenhum envio automático sai.` : "Nenhum envio automático sai até um gestor retomar.",
      });
      setParando(false);
      setMotivoParada("");
      await recarregar();
    } catch (e) {
      toast.avisar({ tom: "erro", titulo: "A parada não foi confirmada", texto: `${e instanceof Error ? e.message : "Tente de novo."} Se houver risco, desconecte o WhatsApp em Integração.` });
    }
  }

  if (erroVisao && !visao) {
    return (
      <TelaV4 area="relance">
        <CabecalhoTela titulo="Relance" />
        <div className="v4-tela__estado">
          <ErrorState nivel={2} titulo="Não deu para carregar as campanhas" texto={`${erroVisao} Nada foi alterado.`} aoTentar={carregarVisao} />
        </div>
      </TelaV4>
    );
  }
  if (!visao) return <RelanceCarregando />;

  const tabs = [
    { id: "fila", label: "Fila", count: pronto ? detalhe!.itens.length : undefined },
    { id: "config", label: "Intenção e limites" },
    ...(gestor ? [{ id: "importar", label: "Importar lista" }] : []),
    { id: "naocontatar", label: "Não contatar", count: visao.optOuts.length },
    { id: "incidentes", label: "Incidentes", count: pronto ? incidentesUnificados(detalhe!.incidentes, visao.incidentes).length : undefined },
  ];

  return (
    <TelaV4 area="relance">
      <CabecalhoTela
        titulo="Relance"
        meta={campanha && !criando ? <Tag tom={TOM_CAMPANHA[campanha.status]}>{STATUS_CAMPANHA[campanha.status]}</Tag> : undefined}
        acoes={
          <>
            {visao.campanhas.length > 0 && !criando && (
              <DropdownMenu
                label="Escolher campanha"
                itens={visao.campanhas.map((c) => ({
                  tipo: "radio" as const,
                  id: c.id,
                  label: `${c.nome} · ${STATUS_CAMPANHA[c.status]}`,
                  checked: c.id === selecionada,
                  onSelect: () => {
                    setSelecionada(c.id);
                    setAviso(null);
                    setCiclo(false);
                    setAba("fila");
                  },
                }))}
                gatilho={(p) => (
                  <Button {...p} iconEnd="chevronBaixo">
                    <span className="v4-rel__campanha">{campanha?.nome ?? "Escolher campanha"}</span>
                    <span className="v4-sr">, trocar campanha</span>
                  </Button>
                )}
              />
            )}
            {gestor && !criando && (
              <Button icon="mais_" onClick={() => setCriando(true)}>
                Nova campanha
              </Button>
            )}
            {podeAgir && (
              <Button variant="destructive" icon="alerta" disabled={emergenciaGeralLigada} onClick={() => setParando(true)}>
                Parada de emergência
              </Button>
            )}
          </>
        }
      />

      {emEmergencia && (
        <div className="v4-rel__emergencia" role="status">
          <p className="v4-nota v4-nota--erro">
            <Icon name="alerta" />
            <span>
              <span className="v4-t-strong">Parada de emergência ligada: nenhum envio automático sai deste CRM.</span> Revise os incidentes e o WhatsApp antes de
              retomar.
            </span>
          </p>
          {gestor && campanha && (
            <Button variant="secondary" onClick={() => executarAcao("retomar_emergencia")} busyLabel="Retomando">
              Retomar da emergência
            </Button>
          )}
        </div>
      )}

      <p className="v4-nota">
        <Icon name="info" />
        <span>
          {ia == null ? "Conexão com a IA não verificada." : ia.configurada ? "IA conectada." : "Sem chave de IA: o Ember não roda (ele nunca manda texto pronto)."}{" "}
          {wpp ? `${wpp.texto}.` : ""} Quem pediu para parar nunca recebe mensagem, e preço nunca entra na abertura.{" "}
          {gestor && (!ia?.configurada || !wpp?.conectado) && (
            <Link className="v4-link" href="/config/integrar">
              Conectar em Integração
            </Link>
          )}
        </span>
      </p>

      {criando ? (
        <Panel elevado titulo="Nova campanha">
          <FormNova
            modeloPadrao={ia?.modeloEmber ?? ""}
            aoCancelar={visao.campanhas.length > 0 ? () => setCriando(false) : undefined}
            aoCriar={async (id) => {
              setCriando(false);
              setSelecionada(id);
              setAba("fila");
              setAviso({ tom: "ok", texto: "Campanha criada como rascunho. Nada é enviado: simule em até 3 contatos antes de ativar." });
              await recarregar();
            }}
          />
        </Panel>
      ) : visao.campanhas.length === 0 ? (
        <div className="v4-tela__estado">
          <EmptyState
            nivel={2}
            titulo="Nenhuma campanha ainda"
            texto={
              gestor
                ? "Uma campanha diz quem o Ember procura (etapa e tempo parado) e o que ele pode usar de gancho. Ela começa como rascunho: nada é enviado até você ativar."
                : "O dono prepara a primeira campanha. A fila e os resultados aparecem aqui."
            }
            acoes={
              gestor && (
                <Button variant="primary" icon="mais_" onClick={() => setCriando(true)}>
                  Nova campanha
                </Button>
              )
            }
          />
        </div>
      ) : erroDetalhe ? (
        <div className="v4-tela__estado">
          <ErrorState nivel={2} titulo="Não deu para abrir a campanha" texto={`${erroDetalhe} Nada foi alterado.`} aoTentar={() => setVersao((v) => v + 1)} />
        </div>
      ) : !pronto ? (
        <RelanceCarregando soCorpo />
      ) : (
        <>
          <p className="v4-nota v4-rel__explica">
            <Icon name={campanha?.status === "ativa" ? "relance" : "info"} />
            <span>
              {EXPLICA_CAMPANHA[detalhe!.campanha.status]} <span className="v4-t-3">Objetivo: {detalhe!.campanha.objetivo}</span>
            </span>
          </p>
          <dl className="v4-indicadores" aria-label="Indicadores da campanha, cada estado contado separadamente">
            {indicadores(detalhe!.metricas).map((i) => (
              <div key={i.rotulo}>
                <dt>{i.rotulo}</dt>
                <dd>{i.valor}</dd>
              </div>
            ))}
          </dl>
          <Tabs label="Seções da campanha" value={aba} onChange={(v) => setAba(v as Aba)} tabs={tabs}>
            {(a) =>
              a === "fila" ? (
                <AbaFila
                  detalhe={detalhe!}
                  emergenciaGeral={emergenciaGeralLigada}
                  gestor={gestor}
                  aviso={aviso}
                  setAviso={setAviso}
                  ciclo={ciclo}
                  setCiclo={setCiclo}
                  ultimoLote={ultimoLote}
                  setUltimoLote={setUltimoLote}
                  executarAcao={executarAcao}
                  aoMudar={recarregar}
                />
              ) : a === "config" ? (
                <AbaConfig
                  key={`${detalhe!.campanha.id}-${detalhe!.campanha.atualizadaEm}`}
                  campanha={detalhe!.campanha}
                  gestor={gestor}
                  modeloPadrao={ia?.modeloEmber ?? ""}
                  aoSalvar={async () => {
                    await recarregar();
                    await carregarProntidao();
                  }}
                />
              ) : a === "importar" && gestor ? (
                <AbaImportar campanha={detalhe!.campanha} aoMudar={recarregar} />
              ) : a === "naocontatar" ? (
                <AbaNaoContatar optOuts={visao.optOuts} podeAgir={podeAgir} aoMudar={recarregar} />
              ) : (
                <AbaIncidentes incidentes={incidentesUnificados(detalhe!.incidentes, visao.incidentes)} />
              )
            }
          </Tabs>
        </>
      )}

      <Dialog
        open={parando}
        onClose={() => setParando(false)}
        title="Parar todos os envios automáticos agora?"
        description="Todas as campanhas ativas do Ember congelam na hora e nenhum lote roda até um gestor retomar. Nada já registrado é apagado; pedidos de não contato continuam valendo."
        footer={({ fechar }) => (
          <>
            <Button variant="secondary" onClick={fechar}>
              Continuar sem parar
            </Button>
            <Button variant="destructive" icon="alerta" onClick={pararTudo} busyLabel="Parando">
              Parar tudo agora
            </Button>
          </>
        )}
      >
        <Textarea
          label="Motivo"
          rows={2}
          maxLength={500}
          value={motivoParada}
          help="Opcional. Fica registrado nos incidentes."
          onChange={(e) => setMotivoParada(e.target.value)}
        />
      </Dialog>
    </TelaV4>
  );
}

function RelanceCarregando({ soCorpo }: { soCorpo?: boolean }) {
  const corpo = (
    <div className="v4-esq" aria-hidden="true">
      {!soCorpo && (
        <div className="v4-esq__head">
          <Skeleton forma="title" largura={20} />
          <Skeleton forma="control" largura={40} />
        </div>
      )}
      <Skeleton forma="control" largura={100} />
      <div className="v4-esq__painel">
        <Skeleton forma="control" largura={50} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="v4-esq__linha">
            <Skeleton largura={([60, 40, 70, 50, 60, 30] as const)[i]} />
          </div>
        ))}
      </div>
    </div>
  );
  if (soCorpo) return <SkeletonGroup label="Carregando campanha">{corpo}</SkeletonGroup>;
  return (
    <TelaV4 area="relance">
      <SkeletonGroup label="Carregando Relance" comoTitulo>
        {corpo}
      </SkeletonGroup>
    </TelaV4>
  );
}
