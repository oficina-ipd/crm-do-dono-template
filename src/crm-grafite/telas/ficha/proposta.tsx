"use client";

import { useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataHora, formatarReais, oportunidadePrincipal, preencherTemplate, primeiroNome } from "@/domain/rules";
import type { ContatoCompleto, Pagamento } from "@/domain/types";
import { Button, Input, Panel, Select, Tag, Textarea, useToast } from "../../ui";
import { mascararEmail } from "../conversas/modelo";
import { mostraPropostaPagamento, textoInicialProposta, ultimaProposta } from "./modelo";

const ROTULO_PAGAMENTO: Record<Pagamento["status"], string> = { pendente: "Aguardando", pago: "Pago", falhou: "Não passou", reembolsado: "Reembolsado" };
const ROTULO_METODO: Record<Pagamento["metodo"], string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto" };

/**
 * Proposta e pagamento (o que a ficha antiga do template fazia em modais): escrever a proposta a
 * partir do briefing e enviar por WhatsApp ou e-mail; criar o link de pagamento com uma condição
 * verdadeira cadastrada no produto. Comandos gerarProposta, enviarProposta e criarLinkPagamento.
 */
export function PropostaPagamentoPainel({ c }: { c: ContatoCompleto }) {
  const { estado, despachar, operador } = useCRM();
  const toast = useToast();
  const soLeitura = !operador || operador.papel === "leitura";
  const o = oportunidadePrincipal(c.oportunidades);
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [criandoLink, setCriandoLink] = useState(false);
  if (!o || !mostraPropostaPagamento(c, o)) return null;
  const produto = estado.produtos.find((p) => p.id === o.produtoId) ?? null;
  const proposta = ultimaProposta(c, o.id);
  const pagamentos = c.pagamentos.filter((p) => p.oportunidadeId === o.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const por = operador?.id ?? "sistema";
  const podeLink = !o.perdida && ["briefing", "proposta", "oferta"].includes(o.etapa);

  function comecarProposta() {
    setTexto(textoInicialProposta(c, o!, produto, operador?.nome ?? null));
    setEscrevendo(true);
  }

  async function salvarProposta(canal: "whatsapp" | "email" | null) {
    const novo = await despachar({ tipo: "gerarProposta", oportunidadeId: o!.id, texto, por }, canal ? undefined : "Proposta salva");
    if (!novo) return;
    if (canal) {
      const p = novo.propostas.filter((x) => x.oportunidadeId === o!.id).at(-1);
      if (!p) return;
      const r = await despachar({ tipo: "enviarProposta", propostaId: p.id, canal, por }, canal === "whatsapp" ? "Proposta enviada na conversa" : "Proposta enviada por e-mail");
      if (!r) return;
    }
    setEscrevendo(false);
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.avisar({ tom: "sucesso", titulo: "Link copiado" });
    } catch {
      toast.avisar({ tom: "erro", titulo: "Não deu para copiar", texto: "Selecione o link e copie à mão." });
    }
  }

  return (
    <Panel titulo="Proposta e pagamento">
      <div className="v4-fi-sub">
        <div className="v4-fi-sub__cab">
          <h3 className="v4-t-ui v4-t-strong">Proposta</h3>
          {proposta && <Tag tom={proposta.abertaEm ? "sucesso" : "neutro"}>{proposta.abertaEm ? "Aberta pelo contato" : proposta.enviadaEm ? "Ainda não aberta" : "Não enviada"}</Tag>}
        </div>
        {proposta && !escrevendo && (
          <>
            <p className="v4-t-ui v4-fi-proposta__texto">{proposta.texto.length > 220 ? `${proposta.texto.slice(0, 220)}…` : proposta.texto}</p>
            <p className="v4-t-meta">
              {proposta.enviadaEm ? `Enviada por ${proposta.enviadaPor === "email" ? "e-mail" : "WhatsApp"} ${dataHora(proposta.enviadaEm)}` : `Escrita ${dataHora(proposta.criadaEm)}`}
              {proposta.abertaEm ? ` · aberta ${dataHora(proposta.abertaEm)}` : ""}
            </p>
            {!soLeitura && !proposta.enviadaEm && (
              <div className="v4-cv-form__acoes v4-fi-acoes-esq">
                <Button size="sm" variant="secondary" onClick={() => despachar({ tipo: "enviarProposta", propostaId: proposta.id, canal: "whatsapp", por }, "Proposta enviada na conversa")}>
                  Enviar por WhatsApp
                </Button>
                {c.email && (
                  <Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "enviarProposta", propostaId: proposta.id, canal: "email", por }, "Proposta enviada por e-mail")}>
                    Enviar por e-mail
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        {!proposta && !escrevendo && <p className="v4-t-meta">{o.briefing ? "Ainda sem proposta." : "A proposta sai do briefing: preencha dor, meta e data antes."}</p>}
        {!soLeitura && !escrevendo && o.briefing && !o.perdida && (
          <div>
            <Button size="sm" variant="ghost" icon="editar" onClick={comecarProposta}>
              {proposta ? "Escrever outra proposta" : "Escrever proposta"}
            </Button>
          </div>
        )}
        {escrevendo && (
          <form className="v4-cv-form" onSubmit={(e) => e.preventDefault()}>
            <Textarea label="Texto da proposta" help="Começa com a dor e a meta do briefing. Edite à vontade." rows={8} maxLength={6000} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <div className="v4-cv-form__acoes">
              <Button size="sm" variant="ghost" onClick={() => setEscrevendo(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="ghost" disabled={!texto.trim()} onClick={() => salvarProposta(null)}>
                Só salvar
              </Button>
              {c.email && (
                <Button size="sm" variant="secondary" disabled={!texto.trim()} onClick={() => salvarProposta("email")}>
                  Salvar e enviar por e-mail
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={!texto.trim()} onClick={() => salvarProposta("whatsapp")}>
                Salvar e enviar por WhatsApp
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="v4-fi-sub">
        <div className="v4-fi-sub__cab">
          <h3 className="v4-t-ui v4-t-strong">Pagamento</h3>
        </div>
        {pagamentos.length === 0 && !criandoLink && <p className="v4-t-meta">{podeLink ? "Nenhum link de pagamento ainda." : "Sem pagamentos."}</p>}
        {pagamentos.length > 0 && (
          <ul className="v4-fi-lista">
            {pagamentos.map((p) => (
              <li key={p.id} className="v4-fi-pagamento">
                <div className="v4-fi-sub__cab">
                  <span className="v4-t-ui">
                    {ROTULO_METODO[p.metodo]} · <span className="v4-tabular">{formatarReais(p.valor)}</span>
                  </span>
                  <Tag tom={p.status === "pago" ? "sucesso" : p.status === "falhou" ? "erro" : "neutro"}>{ROTULO_PAGAMENTO[p.status]}</Tag>
                </div>
                <p className="v4-t-meta">
                  {p.pagoEm ? `Pago ${dataHora(p.pagoEm)}` : `Criado ${dataHora(p.criadoEm)}${p.expiraEm && p.status === "pendente" ? ` · vale até ${dataHora(p.expiraEm)}` : ""}`}
                </p>
                {p.status === "pendente" && p.linkUrl && (
                  <div>
                    <Button size="sm" variant="ghost" onClick={() => copiar(p.linkUrl!)}>
                      Copiar link
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!soLeitura && podeLink && !criandoLink && (
          <div>
            <Button size="sm" variant="ghost" icon="mais_" onClick={() => setCriandoLink(true)}>
              Criar link de pagamento
            </Button>
          </div>
        )}
        {criandoLink && <FormLink c={c} aoFechar={() => setCriandoLink(false)} />}
      </div>
    </Panel>
  );
}

function FormLink({ c, aoFechar }: { c: ContatoCompleto; aoFechar: () => void }) {
  const { estado, despachar, operador } = useCRM();
  const o = oportunidadePrincipal(c.oportunidades)!;
  const produto = estado.produtos.find((p) => p.id === o.produtoId);
  const gatilhos = produto?.gatilhos ?? [];
  const [valor, setValor] = useState(String(o.valor));
  const [metodo, setMetodo] = useState<Pagamento["metodo"]>("pix");
  const [dias, setDias] = useState("3");
  const [condicao, setCondicao] = useState(gatilhos[0] ?? "");
  const valorN = Number(valor.replace(",", "."));
  const diasN = Number(dias);
  const pronto = gatilhos.length > 0 && condicao && valorN > 0 && Number.isInteger(diasN) && diasN >= 1 && diasN <= 30;

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!pronto) return;
    const r = await despachar(
      { tipo: "criarLinkPagamento", oportunidadeId: o.id, valor: valorN, metodo, validadeDias: diasN, condicao, por: operador?.id ?? "sistema" },
      "Link criado e enviado na conversa",
    );
    if (r) aoFechar();
  }

  return (
    <form className="v4-cv-form" onSubmit={criar}>
      <p className="v4-t-meta">O link vai na conversa com {primeiroNome(c.nome)}, com a condição e a validade. O card passa para Oferta com condição.</p>
      <Input label="Valor (R$)" type="number" min={1} step="0.01" inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} />
      <Select
        label="Forma de pagamento"
        value={metodo}
        onChange={(e) => setMetodo(e.target.value as Pagamento["metodo"])}
        options={[
          { value: "pix", label: "Pix" },
          { value: "cartao", label: "Cartão" },
          { value: "boleto", label: "Boleto" },
        ]}
      />
      <Input label="Validade (dias)" type="number" min={1} max={30} step={1} inputMode="numeric" required value={dias} onChange={(e) => setDias(e.target.value)} help="De 1 a 30 dias." />
      {gatilhos.length > 0 ? (
        <Select label="Condição" help="Só condições verdadeiras, cadastradas no produto." value={condicao} onChange={(e) => setCondicao(e.target.value)} options={gatilhos.map((g) => ({ value: g, label: g }))} />
      ) : (
        <p className="v4-t-meta" role="status">
          {produto ? `${produto.nome} não tem condição cadastrada.` : "O produto desta oportunidade não foi encontrado."} Cadastre uma condição verdadeira em Produtos antes de criar o link.
        </p>
      )}
      <div className="v4-cv-form__acoes">
        <Button size="sm" variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" variant="secondary" disabled={!pronto}>
          Criar link e enviar
        </Button>
      </div>
    </form>
  );
}

/** E-mail pela ficha: histórico e o formulário (recolhido). Modelos de e-mail preenchem assunto e texto. */
export function EmailPainel({ c }: { c: ContatoCompleto }) {
  const { estado, despachar, operador } = useCRM();
  const soLeitura = !operador || operador.papel === "leitura";
  const [aberto, setAberto] = useState(false);
  const [modelo, setModelo] = useState("");
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  if (!c.email && c.emails.length === 0) return null;
  const modelos = estado.templates.filter((t) => t.canal === "email");
  const o = oportunidadePrincipal(c.oportunidades);
  const vars = {
    nome: primeiroNome(c.nome),
    primeiroNome: primeiroNome(c.nome),
    empresa: estado.config.nomeEmpresa,
    produto: o ? estado.produtos.find((p) => p.id === o.produtoId)?.nome : undefined,
    operador: operador?.nome,
  };
  const emails = [...c.emails].reverse();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const r = await despachar({ tipo: "enviarEmail", contatoId: c.id, assunto: assunto.trim(), texto: texto.trim(), por: operador?.id ?? null }, "E-mail registrado no histórico");
    if (!r) return;
    setAssunto("");
    setTexto("");
    setModelo("");
    setAberto(false);
  }

  return (
    <Panel
      titulo="E-mail"
      acoes={
        !soLeitura && c.email ? (
          <Button size="sm" variant="ghost" iconEnd={aberto ? "chevronCima" : "chevronBaixo"} aria-expanded={aberto} aria-controls={`v4-fi-email-${c.id}`} onClick={() => setAberto((v) => !v)}>
            {aberto ? "Recolher" : "Escrever"}
          </Button>
        ) : undefined
      }
    >
      {emails.length > 0 ? (
        <ul className="v4-fi-emails">
          {emails.slice(0, 5).map((m) => (
            <li key={m.id} className="v4-fi-email">
              <div>
                <p className="v4-t-ui">{m.assunto}</p>
                <p className="v4-t-meta">{dataHora(m.em)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !aberto && <p className="v4-t-meta">Nenhum e-mail por aqui ainda.</p>
      )}
      {!soLeitura && c.email && (
        <form id={`v4-fi-email-${c.id}`} className="v4-cv-form" hidden={!aberto} onSubmit={enviar}>
          <p className="v4-t-meta">Vai para {mascararEmail(c.email)}.</p>
          {modelos.length > 0 && (
            <Select
              label="Modelo"
              value={modelo}
              placeholder="Escolher um modelo"
              onChange={(e) => {
                const t = modelos.find((x) => x.id === e.target.value);
                setModelo(e.target.value);
                if (t) {
                  setAssunto(preencherTemplate(t.assunto ?? "", vars));
                  setTexto(preencherTemplate(t.texto, vars));
                }
              }}
              options={modelos.map((t) => ({ value: t.id, label: t.nome }))}
            />
          )}
          <Input label="Assunto" required maxLength={150} value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          <Textarea label="Mensagem" required rows={7} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="v4-cv-form__acoes">
            <Button type="submit" variant="secondary" size="sm" disabled={!assunto.trim() || !texto.trim()}>
              Enviar e-mail
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
