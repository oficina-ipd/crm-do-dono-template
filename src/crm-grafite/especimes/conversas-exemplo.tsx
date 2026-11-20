"use client";

import { useState } from "react";
import {
  Avatar,
  Button,
  CallEvent,
  ChatBubble,
  Composer,
  DaySeparator,
  DropdownMenu,
  IconButton,
  ListRow,
  NoResults,
  OwnershipBar,
  SearchInput,
  SegmentedControl,
  SidePanel,
  Tag,
  TipoTag,
  useToast,
  type Condutor,
} from "../ui";
import { semAcento } from "../shell/palette";
import { useAlturaNoPai } from "../ui/flutuante";

/**
 * Composição de exemplo de Conversas em três regiões (lista 340 / conversa / contexto 320).
 * DADOS ILUSTRATIVOS: nomes, mensagens e números inventados para o preview local.
 */

type Filtro = "voce" | "humano" | "claudio" | "paradas";
type ConversaIlus = {
  id: string;
  nome: string;
  tipo: "lead" | "member";
  etapa: string;
  hora: string;
  ultima: string;
  filtro: Filtro;
  naoLida?: boolean;
};

const CONVERSAS: ConversaIlus[] = [
  { id: "c1", nome: "Marina Albuquerque", tipo: "lead", etapa: "Handoff", hora: "14:32", ultima: "Pode me ligar depois das 16h? Quero entender o valor.", filtro: "voce", naoLida: true },
  { id: "c2", nome: "Beatriz Nogueira", tipo: "lead", etapa: "Handoff", hora: "14:05", ultima: "Prefiro falar com alguém da equipe.", filtro: "voce", naoLida: true },
  { id: "c3", nome: "Rafael Tanaka", tipo: "member", etapa: "Dentro", hora: "13:48", ultima: "Você: Combinado, te mando o link da aula.", filtro: "humano" },
  { id: "c4", nome: "Marcos Vilela", tipo: "lead", etapa: "Cláudio", hora: "12:10", ultima: "Cláudio: Me conta um pouco do seu negócio?", filtro: "claudio" },
  { id: "c5", nome: "Mariana Prado", tipo: "member", etapa: "Dentro", hora: "Ontem", ultima: "Cláudio: Que bom que deu certo!", filtro: "claudio" },
  { id: "c6", nome: "Henrique Duarte", tipo: "lead", etapa: "Proposta", hora: "Seg", ultima: "Vou ver com meu sócio e te falo.", filtro: "paradas" },
  { id: "c7", nome: "Luana Ferraz", tipo: "lead", etapa: "Briefing", hora: "Seg", ultima: "Cláudio: Qual é o maior gargalo hoje?", filtro: "claudio" },
];

const TOTAL_ILUSTRATIVO = 62;

export function ConversasExemplo({ altura = "cheia" }: { altura?: "cheia" | "fixa" }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro | "todas">("todas");
  const [q, setQ] = useState("");
  const [aberta, setAberta] = useState("c1");
  const [condutor, setCondutor] = useState<Condutor>({ tipo: "claudio" });
  const [contexto, setContexto] = useState(false);
  const [revelado, setRevelado] = useState(false);
  const dock = useAlturaNoPai("--v4-dock-h");

  const lista = CONVERSAS.filter((c) => (filtro === "todas" || c.filtro === filtro) && (!q || semAcento(c.nome).includes(semAcento(q))));
  const atual = CONVERSAS.find((c) => c.id === aberta) ?? CONVERSAS[0];
  const contar = (f: Filtro) => CONVERSAS.filter((c) => c.filtro === f).length;

  const painelContexto = (px: string) => (
    <div className="v4-conv__ctx-body">
      <section className="v4-conv__sec" aria-labelledby={`${px}-motivo`}>
        <h3 id={`${px}-motivo`} className="v4-conv__sec-title">
          Por que pediu uma pessoa
        </h3>
        <p className="v4-t-ui">Quer saber o valor e se cabe no caixa deste mês.</p>
        <p className="v4-t-meta">Falta saber: faturamento mensal e quem decide.</p>
      </section>
      <section className="v4-conv__sec" aria-labelledby={`${px}-etapa`}>
        <h3 id={`${px}-etapa`} className="v4-conv__sec-title">
          Etapa do funil
        </h3>
        <div className="v4-conv__line">
          <Tag tom="etapa">{atual.etapa}</Tag>
          <span className="v4-t-meta">há 2 dias</span>
          <DropdownMenu
            label="Mover para a etapa"
            lado="baixo-fim"
            itens={["Briefing", "Proposta", "Oferta"].map((e) => ({
              id: e,
              label: e,
              onSelect: () => toast.avisar({ tom: "sucesso", titulo: `Movido para ${e}`, texto: "Exemplo ilustrativo: nada foi gravado." }),
            }))}
            gatilho={(p) => (
              <Button
                ref={p.ref}
                size="sm"
                variant="secondary"
                iconEnd="chevronBaixo"
                aria-haspopup={p["aria-haspopup"]}
                aria-expanded={p["aria-expanded"]}
                aria-controls={p["aria-controls"]}
                onClick={p.onClick}
                onKeyDown={p.onKeyDown}
              >
                Mover
              </Button>
            )}
          />
        </div>
      </section>
      <section className="v4-conv__sec" aria-labelledby={`${px}-tarefa`}>
        <h3 id={`${px}-tarefa`} className="v4-conv__sec-title">
          Próxima tarefa
        </h3>
        <p className="v4-t-ui">Ligar às 16h para falar de valores</p>
        <p className="v4-t-meta">Hoje · com você</p>
      </section>
      <section className="v4-conv__sec" aria-labelledby={`${px}-contato`}>
        <h3 id={`${px}-contato`} className="v4-conv__sec-title">
          Contato
        </h3>
        <div className="v4-conv__line">
          <span className="v4-num">{revelado ? "+55 11 90000-1234" : "***1234"}</span>
          <Button size="sm" variant="ghost" icon="olho" aria-pressed={revelado} onClick={() => setRevelado((v) => !v)}>
            {revelado ? "Ocultar" : "Revelar"}
          </Button>
        </div>
        <p className="v4-t-meta">Revelar fica registrado na auditoria.</p>
      </section>
      <section className="v4-conv__sec" aria-labelledby={`${px}-notas`}>
        <h3 id={`${px}-notas`} className="v4-conv__sec-title">
          Notas
        </h3>
        <p className="v4-t-ui">Tem padaria com duas lojas; o filho cuida do Instagram.</p>
        <p className="v4-t-meta">Otávio · 08/11</p>
      </section>
    </div>
  );

  return (
    <div className={["v4-conv", altura === "fixa" ? "v4-conv--fixa" : ""].filter(Boolean).join(" ")}>
      <section className="v4-conv__list" aria-labelledby="conv-lista-titulo">
        <div className="v4-conv__list-head">
          <div className="v4-conv__title-row">
            <h2 id="conv-lista-titulo" className="v4-t-section">
              Conversas
            </h2>
            <span className="v4-t-meta v4-tabular">{TOTAL_ILUSTRATIVO} no total</span>
          </div>
          <SearchInput label="Buscar nas conversas" placeholder="Buscar por nome" atalho="/" value={q} onChange={setQ} />
          <SegmentedControl
            label="Filtrar conversas"
            value={filtro}
            onChange={(v) => setFiltro(v as Filtro | "todas")}
            options={[
              { value: "todas", label: "Todas" },
              { value: "voce", label: "Precisa de você", count: contar("voce") },
              { value: "humano", label: "Com humano" },
              { value: "claudio", label: "Com Cláudio" },
              { value: "paradas", label: "Paradas" },
            ]}
          />
        </div>
        <div className="v4-conv__scroll">
          {lista.length === 0 ? (
            <NoResults
              termo={q || undefined}
              aoLimpar={() => {
                setQ("");
                setFiltro("todas");
              }}
            />
          ) : (
            <ul className="v4-list" aria-label="Lista de conversas">
              {lista.map((c) => (
                <li key={c.id}>
                  <ListRow
                    onClick={() => setAberta(c.id)}
                    atual={c.id === aberta}
                    naoLida={c.naoLida}
                    inicio={<Avatar nome={c.nome} />}
                    titulo={c.nome}
                    meta={c.hora}
                    texto={c.ultima}
                    tags={
                      <>
                        <TipoTag tipo={c.tipo} />
                        <Tag tom="etapa">{c.etapa}</Tag>
                        {c.filtro === "voce" && <Tag tom="suavez">Precisa de você</Tag>}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="v4-conv__more">
            <span className="v4-t-meta v4-tabular">
              Mostrando {lista.length} de {TOTAL_ILUSTRATIVO}
            </span>
            <Button size="sm" variant="ghost">
              Carregar mais
            </Button>
          </div>
        </div>
      </section>

      <section className="v4-conv__main" aria-labelledby="conv-atual-titulo">
        <div className="v4-conv__main-head">
          <Avatar nome={atual.nome} />
          <div className="v4-conv__who">
            <h2 id="conv-atual-titulo" className="v4-t-section">
              {atual.nome}
            </h2>
            <span className="v4-conv__line">
              <TipoTag tipo={atual.tipo} />
              <Tag tom="etapa">{atual.etapa}</Tag>
            </span>
          </div>
          <IconButton className="v4-conv__ctx-toggle" icon="info" label="Mostrar contexto" aria-haspopup="dialog" onClick={() => setContexto(true)} />
          <IconButton icon="telefone" label="Ligar" />
        </div>
        <div className="v4-conv__thread" tabIndex={0} aria-label="Mensagens">
          <div className="v4-conv__earlier">
            <Button size="sm" variant="ghost" icon="chevronCima">
              Carregar mensagens anteriores
            </Button>
          </div>
          <div className="v4-thread">
            <DaySeparator rotulo="Ontem" />
            <ChatBubble direcao="in" autor={{ tipo: "lead", nome: atual.nome }} hora="18:20">
              Oi! Vi a live de terça. Como funciona a comunidade?
            </ChatBubble>
            <ChatBubble direcao="out" autor={{ tipo: "claudio" }} hora="18:21" estado="enviada">
              Oi, Marina! Que bom que assistiu. Me conta: o que você mais quer resolver no negócio agora?
            </ChatBubble>
            <ChatBubble direcao="in" autor={{ tipo: "lead", nome: atual.nome }} hora="18:40">
              Atendimento. Respondo cliente até meia-noite.
            </ChatBubble>
            <DaySeparator rotulo="Hoje" />
            <CallEvent segundos={540} hora="10:15" quem="Otávio" />
            <ChatBubble direcao="out" autor={{ tipo: "humano", nome: "Otávio" }} hora="10:30" estado="incerta">
              Te mandei o resumo da nossa ligação por aqui.
            </ChatBubble>
            <ChatBubble direcao="in" autor={{ tipo: "lead", nome: atual.nome }} hora="14:32">
              Pode me ligar depois das 16h? Quero entender o valor.
            </ChatBubble>
            <ChatBubble direcao="out" autor={{ tipo: "humano", nome: "Você" }} hora="14:33" estado="falhou" aoTentarDeNovo={() => toast.avisar({ tom: "erro", titulo: "Ainda não foi", texto: "Exemplo ilustrativo: o envio não é real.", acao: { label: "Tentar de novo", onClick: () => undefined } })}>
              Posso sim! Te ligo às 16h.
            </ChatBubble>
          </div>
        </div>
        {/* Junta posse + resposta: no Grafite vira a barra flutuante; no neutro não muda nada (display: contents). */}
        <div className="v4-dock" ref={dock}>
        <OwnershipBar
          condutor={condutor}
          precisaDeVoce={atual.filtro === "voce"}
          avisoAutomatico="Oi, Marina! Aqui é o Otávio, da equipe do João. Vou seguir com você por aqui."
          operadores={[
            { id: "o1", nome: "Otávio" },
            { id: "o2", nome: "Camila" },
          ]}
          aoAssumir={async () => {
            await new Promise((r) => setTimeout(r, 500));
            setCondutor({ tipo: "voce" });
          }}
          aoDevolver={() => setCondutor({ tipo: "claudio" })}
          aoTransferir={(id) => toast.avisar({ tom: "info", titulo: `Transferida para ${id === "o1" ? "Otávio" : "Camila"}`, texto: "Exemplo ilustrativo." })}
        />
        <Composer
          motivoBloqueio={condutor.tipo === "voce" ? undefined : "O Cláudio está conduzindo. Assuma a conversa para responder."}
          aoEnviar={async () => {
            await new Promise((r) => setTimeout(r, 600));
            toast.avisar({ tom: "sucesso", titulo: "Mensagem na fila de envio", texto: "Exemplo ilustrativo: nada foi enviado." });
            return true;
          }}
        />
        </div>
      </section>

      <aside className="v4-conv__ctx" aria-label="Contexto da conversa">
        {painelContexto("ctx")}
      </aside>

      <SidePanel open={contexto} onClose={() => setContexto(false)} title="Contexto da conversa">
        {painelContexto("ctx-painel")}
      </SidePanel>
    </div>
  );
}
