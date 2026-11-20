"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, Icon, Input, Panel, Spinner, TipoTag } from "../../ui";
import { interpretarConsultaV4, type PessoaBuscaV4 } from "../../busca";
import type { BuscarPessoas } from "../../shell/palette";
import { hojeLocal, isoDeLocal } from "./logica";

type EstadoBusca = { tipo: "ocioso" } | { tipo: "curta" } | { tipo: "buscando" } | { tipo: "ok"; pessoas: PessoaBuscaV4[] } | { tipo: "erro" };

/**
 * Busca de pessoa para ligar a tarefa (combobox): a mesma busca da paleta ⌘K (até 8, telefone
 * mascarado), espera a pessoa parar de digitar e cancela a busca anterior. Setas andam, Enter
 * escolhe, Escape fecha a lista.
 */
function BuscaPessoa({
  buscar,
  valor,
  aoEscolher,
  erro,
  idCampo,
}: {
  buscar: BuscarPessoas;
  valor: PessoaBuscaV4 | null;
  aoEscolher: (p: PessoaBuscaV4 | null) => void;
  erro?: string;
  idCampo: string;
}) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoBusca>({ tipo: "ocioso" });
  const [ativo, setAtivo] = useState(0);
  const [aberta, setAberta] = useState(false);
  const listaId = useId();
  const ajudaId = `${idCampo}-ajuda`;
  const erroId = `${idCampo}-erro`;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = interpretarConsultaV4(q);
    if (!q.trim()) {
      setEstado({ tipo: "ocioso" });
      return;
    }
    if (c.tipo === "vazia") {
      setEstado({ tipo: "curta" });
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setEstado({ tipo: "buscando" });
      try {
        const pessoas = await buscar(q, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setEstado({ tipo: "ok", pessoas });
          setAtivo(0);
        }
      } catch {
        if (!ctrl.signal.aborted) setEstado({ tipo: "erro" });
      }
    }, 150);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q, buscar]);

  if (valor) {
    return (
      <div className="v4-field">
        <span className="v4-field__label" id={`${idCampo}-rot`}>
          Pessoa<span className="v4-field__req">obrigatório</span>
        </span>
        <div className="v4-nova__pessoa" role="group" aria-labelledby={`${idCampo}-rot`}>
          <Icon name="pessoas" />
          <span className="v4-nova__pessoa-nome">{valor.nome}</span>
          <TipoTag tipo={valor.tipo} />
          {valor.telefone && <span className="v4-t-meta v4-num">{valor.telefone}</span>}
          <Button
            variant="ghost"
            onClick={() => {
              aoEscolher(null);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            Trocar<span className="v4-sr"> a pessoa</span>
          </Button>
        </div>
      </div>
    );
  }

  const opcoes = estado.tipo === "ok" ? estado.pessoas : [];
  const mostrarLista = aberta && estado.tipo !== "ocioso";

  function escolher(p: PessoaBuscaV4) {
    aoEscolher(p);
    setQ("");
    setAberta(false);
  }

  function teclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && opcoes.length) {
      e.preventDefault();
      setAberta(true);
      setAtivo((i) => Math.min(i + 1, opcoes.length - 1));
    } else if (e.key === "ArrowUp" && opcoes.length) {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Enter não envia o formulário enquanto a pessoa está escolhendo
      e.preventDefault();
      const p = opcoes[ativo];
      if (p) escolher(p);
    } else if (e.key === "Escape" && mostrarLista) {
      e.preventDefault();
      setAberta(false);
    }
  }

  const describedby = [erro ? erroId : "", ajudaId].filter(Boolean).join(" ");

  return (
    <div className="v4-field v4-nova__busca">
      <label className="v4-field__label" htmlFor={idCampo}>
        Pessoa<span className="v4-field__req">obrigatório</span>
      </label>
      <div className="v4-search">
        <Icon name="busca" />
        <input
          ref={inputRef}
          id={idCampo}
          className="v4-input"
          type="search"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostrarLista && opcoes[ativo] ? `${listaId}-${opcoes[ativo].id}` : undefined}
          aria-describedby={describedby}
          aria-invalid={erro ? true : undefined}
          aria-required
          autoComplete="off"
          spellCheck={false}
          placeholder="Nome ou final do telefone"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          onKeyDown={teclar}
        />
      </div>
      {mostrarLista && (
        <div className="v4-nova__resultados">
          {estado.tipo === "curta" && <p className="v4-nova__estado">Digite pelo menos 2 letras do nome ou 4 dígitos do telefone.</p>}
          {estado.tipo === "buscando" && (
            <p className="v4-nova__estado">
              <Spinner label="Buscando pessoas" mostrarTexto />
            </p>
          )}
          {estado.tipo === "erro" && (
            <p className="v4-nova__estado v4-nova__estado--erro" role="alert">
              <Icon name="erro" />A busca falhou. Mude o texto para tentar de novo.
            </p>
          )}
          {estado.tipo === "ok" && opcoes.length === 0 && (
            <p className="v4-nova__estado" role="status">
              Ninguém encontrado com “{q.trim()}”. Confira o nome ou busque pelo telefone.
            </p>
          )}
          <ul id={listaId} role="listbox" aria-label="Pessoas encontradas" className="v4-nova__lista" hidden={opcoes.length === 0}>
            {opcoes.map((p, i) => (
              <li
                key={p.id}
                id={`${listaId}-${p.id}`}
                role="option"
                aria-selected={i === ativo}
                className="v4-nova__opcao"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(p)}
                onMouseEnter={() => setAtivo(i)}
              >
                <span className="v4-nova__opcao-nome">{p.nome}</span>
                <TipoTag tipo={p.tipo} />
                <span className="v4-t-meta">{[p.empresa, p.telefone].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {erro && (
        <p className="v4-field__error" id={erroId}>
          <Icon name="alerta" />
          <span>{erro}</span>
        </p>
      )}
      <p className="v4-field__help" id={ajudaId}>
        A tarefa fica na ficha dessa pessoa.
      </p>
    </div>
  );
}

/**
 * Criar tarefa ligada a uma pessoa, no lugar (sem diálogo): pessoa, o que fazer, data e hora.
 * Grava pelo comando `criarTarefa` (origem "manual"). Em falha, os campos ficam e o aviso diz o
 * que aconteceu. Escape (fora da lista de pessoas) cancela.
 */
export function NovaTarefa({
  agora,
  buscarPessoas,
  pessoaInicial = null,
  criar,
  aoCancelar,
}: {
  agora: Date;
  buscarPessoas: BuscarPessoas;
  pessoaInicial?: PessoaBuscaV4 | null;
  /** Grava; devolve false se a regra recusou (o aviso de erro já saiu). */
  criar: (dados: { contatoId: string; texto: string; venceEm: string | null }) => Promise<boolean>;
  aoCancelar: () => void;
}) {
  const base = useId();
  const [pessoa, setPessoa] = useState<PessoaBuscaV4 | null>(pessoaInicial);
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(() => hojeLocal(agora));
  const [hora, setHora] = useState("");
  const [erros, setErros] = useState<{ pessoa?: string; titulo?: string; data?: string; geral?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const tituloRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // abre com o foco no primeiro campo que falta
    if (pessoaInicial) tituloRef.current?.focus();
    else formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [pessoaInicial]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    const novo: typeof erros = {};
    if (!pessoa) novo.pessoa = "Escolha a pessoa da tarefa na busca acima.";
    if (!titulo.trim()) novo.titulo = "Escreva o que precisa ser feito.";
    const vence = data ? isoDeLocal(data, hora) : null;
    if (data && !vence) novo.data = "Data ou hora inválida. Use o seletor do campo.";
    if (!data && hora) novo.data = "Para pôr hora, escolha também a data.";
    setErros(novo);
    if (Object.keys(novo).length || !pessoa) return;
    setSalvando(true);
    const ok = await criar({ contatoId: pessoa.id, texto: titulo.trim(), venceEm: vence });
    setSalvando(false);
    if (!ok) setErros({ geral: "A tarefa não foi criada. Os campos continuam preenchidos." });
  }

  return (
    <Panel titulo="Nova tarefa">
      <form
        ref={formRef}
        className="v4-nova"
        onSubmit={enviar}
        noValidate
        aria-busy={salvando || undefined}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !e.defaultPrevented && !salvando) {
            e.preventDefault();
            aoCancelar();
          }
        }}
      >
        <BuscaPessoa
          buscar={buscarPessoas}
          valor={pessoa}
          aoEscolher={(p) => {
            setPessoa(p);
            if (p) {
              setErros((x) => ({ ...x, pessoa: undefined }));
              window.setTimeout(() => tituloRef.current?.focus(), 0);
            }
          }}
          erro={erros.pessoa}
          idCampo={`${base}-pessoa`}
        />
        <Input
          ref={tituloRef}
          label="O que fazer"
          required
          maxLength={200}
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            if (erros.titulo) setErros((x) => ({ ...x, titulo: undefined }));
          }}
          placeholder="Ex.: ligar para falar da proposta"
          error={erros.titulo}
        />
        <div className="v4-nova__quando">
          <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} error={erros.data} help="Vazio: a tarefa fica sem data." />
          <Input label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} help="Vazio: até o fim do dia." />
        </div>
        {erros.geral && (
          <p className="v4-nova__erro" role="alert">
            <Icon name="erro" />
            <span>{erros.geral}</span>
          </p>
        )}
        <div className="v4-nova__acoes">
          <Button type="submit" variant="primary" icon="check" busy={salvando} busyLabel="Criando a tarefa">
            Criar tarefa
          </Button>
          <Button variant="ghost" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </Button>
        </div>
      </form>
    </Panel>
  );
}
