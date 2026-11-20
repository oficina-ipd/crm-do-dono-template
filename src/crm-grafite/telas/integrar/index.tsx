"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { estadoExemplo, estadoVazio } from "@/data/exemplo";
import { ETAPAS } from "@/domain/funil";
import { dataCurta } from "@/domain/rules";
import type { Escopo, EstadoCRM } from "@/domain/types";
import { ROTULO_NIVEL, CRM_MCP_NIVEIS } from "@/lib/mcp/niveis";
import { apagarEstadoLocal } from "@/repo/local";
import { Button, Dialog, ErrorState, Icon, Input, Panel, Select, Spinner, Table, Tabs, Tag, Textarea, useToast } from "../../ui";
import { CabecalhoTela, EstadoSalvar, TelaV4, useEnvio } from "../base-demais/tela";
import { podeEscrever } from "../equipe/gravar";
import { ConfirmarExclusao } from "../equipe/painel-edicao";
import { useGravar } from "../equipe/use-gravar";
import {
  AJUDA_ESCOPO,
  ROTULO_ESCOPO,
  chaveCriada,
  configMcpWeb,
  contarAtivas,
  erroDoArquivo,
  linhasChaves,
  nomeArquivoExportacao,
  promptAgente,
  resumoDoEstado,
  testeMcpWeb,
  urlMcpWeb,
  validarNomeChave,
  type LinhaChave,
} from "./integrar-logica";
import { PainelWhatsApp } from "./whatsapp";
import "../../styles/telas/config.css";

function useCopiar() {
  const toast = useToast();
  return useCallback(
    async (texto: string, ok: string) => {
      try {
        await navigator.clipboard.writeText(texto);
        toast.avisar({ tom: "sucesso", titulo: ok });
      } catch {
        toast.avisar({ tom: "atencao", titulo: "Não deu para copiar", texto: "Selecione o texto e copie com ⌘C." });
      }
    },
    [toast],
  );
}

function useOrigem() {
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);
  return origem;
}

/**
 * Integrações (Grafite): WhatsApp, agentes (chave da IA e MCP), chaves de API e dados
 * (exportar, importar, recomeçar). Uma aba por assunto; cada ação grava de verdade.
 */
export function TelaIntegrar() {
  const { estado, repo } = useCRM();
  const ativas = contarAtivas(estado);
  return (
    <TelaV4 area="integrar">
      <CabecalhoTela
        titulo="Integrações"
        meta={`${repo.origem === "local" ? "Dados só neste navegador" : "Dados no servidor do CRM"} · ${ativas} ${ativas === 1 ? "chave ativa" : "chaves ativas"}`}
      />
      <Tabs
        label="Integrações"
        urlParam="aba"
        tabs={[
          { id: "whatsapp", label: "WhatsApp" },
          { id: "agentes", label: "Agentes e MCP" },
          { id: "chaves", label: "Chaves de API", count: ativas },
          { id: "dados", label: "Dados" },
        ]}
      >
        {(aba) => (aba === "agentes" ? <AbaAgentes /> : aba === "chaves" ? <AbaChaves /> : aba === "dados" ? <AbaDados /> : <AbaWhatsApp />)}
      </Tabs>
    </TelaV4>
  );
}

function AbaWhatsApp() {
  const { operador } = useCRM();
  return (
    <div className="v4-pilha">
      <PainelWhatsApp podeConectar={podeEscrever(operador)} />
      <p className="v4-nota v4-nota--atencao">
        <Icon name="alerta" />
        <span>
          WhatsApp por QR não é o canal oficial da Meta: o número pode ser limitado ou bloqueado se mandar demais. Use um número aquecido e
          mande pouco no começo.
        </span>
      </p>
    </div>
  );
}

/* ---------- Agentes e MCP ---------- */

type StatusLlm = { configurada: boolean; mascara: string | null; model: string; origem: string | null };

function AbaAgentes() {
  const { estado } = useCRM();
  const origem = useOrigem();
  const copiar = useCopiar();
  const url = origem ? urlMcpWeb(origem) : "";
  const prompt = origem ? promptAgente(estado, origem, ETAPAS.filter((e) => e.id !== "perdido")) : "";
  return (
    <div className="v4-pilha">
      <div className="v4-grade">
        <PainelLlm />
        <Panel titulo="Conectar pelo MCP">
          <div className="v4-form">
            <p className="v4-t-ui v4-t-2">GrokBot, Cursor e outros agentes leem e mexem no CRM por este endereço, com um token por nível de acesso.</p>
            <div className="v4-integ__copiar">
              <Input label="Endereço do MCP" readOnly value={url} />
              <Button icon="nota" disabled={!url} onClick={() => copiar(url, "Endereço copiado")}>
                Copiar
              </Button>
            </div>
            <dl className="v4-fatos">
              {CRM_MCP_NIVEIS.map((n) => (
                <div key={n} className="v4-cfg__fato">
                  <dt>{n === "leitura" ? "Token de leitura" : n === "escrita" ? "Token de escrita" : "Token de admin"}</dt>
                  <dd>{ROTULO_NIVEL[n]}</dd>
                </div>
              ))}
            </dl>
            <p className="v4-t-meta">Os tokens ficam na configuração do servidor (CRM_MCP_TOKEN_LEITURA, CRM_MCP_TOKEN_ESCRITA e CRM_MCP_TOKEN_ADMIN no .env.local).</p>
            <Textarea label="Configuração para o Cursor (.cursor/mcp.json)" readOnly rows={10} value={url ? configMcpWeb(url) : ""} />
            <div className="v4-form__acoes">
              <Button icon="nota" disabled={!url} onClick={() => copiar(configMcpWeb(url), "Configuração copiada")}>
                Copiar configuração
              </Button>
              <Button variant="ghost" icon="nota" disabled={!url} onClick={() => copiar(testeMcpWeb(url), "Comando de teste copiado")}>
                Copiar comando de teste
              </Button>
            </div>
            <p className="v4-nota v4-nota--atencao">
              <Icon name="alerta" />
              <span>Por enquanto o MCP pela web responde com os dados de exemplo do template, não com os que estão neste CRM.</span>
            </p>
          </div>
        </Panel>
      </div>
      <Panel titulo="Prompt para colar no agente">
        <div className="v4-form">
          <Textarea label="Prompt montado com os dados do seu CRM" readOnly rows={14} value={prompt} help="Explica o CRM, as regras e os três jeitos de usar: MCP, código e navegador." />
          <div className="v4-form__acoes">
            <Button icon="nota" disabled={!prompt} onClick={() => copiar(prompt, "Prompt copiado")}>
              Copiar prompt
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** Chave da Anthropic dos agentes (rota /api/agents/llm). Sem chave, os agentes usam as regras locais. */
function PainelLlm() {
  const { operador } = useCRM();
  const [status, setStatus] = useState<StatusLlm | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const { estado: envio, enviar, editar } = useEnvio();
  const escreve = podeEscrever(operador);

  const carregar = useCallback(async () => {
    setFalhou(false);
    try {
      const j = await (await fetch("/api/agents/llm")).json();
      setStatus({ configurada: Boolean(j.configurada), mascara: j.mascara ?? null, model: j.model ?? "", origem: j.origem ?? null });
    } catch {
      setFalhou(true);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function postar(corpo: object) {
    const r = await fetch("/api/agents/llm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return { ok: false as const, erro: j.erro ?? "o servidor não aceitou a chave." };
    await carregar();
    return { ok: true as const };
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const v = chave.trim();
    const er = v.length < 20 ? "Cole a chave inteira, que começa com sk-ant-." : null;
    setErro(er);
    if (er) return;
    const ok = await enviar(() => postar({ apiKey: v }));
    if (ok) setChave("");
  }

  return (
    <Panel titulo="Inteligência dos agentes">
      <div className="v4-form">
        <p className="v4-t-ui v4-t-2">Com a sua chave da Anthropic, o robô e os outros agentes escrevem com IA. Sem chave, seguem as regras do CRM: mais limitados, mas não quebram.</p>
        {falhou ? (
          <ErrorState nivel={3} titulo="Não deu para ver a situação da chave" texto="Nada foi alterado." aoTentar={carregar} />
        ) : !status ? (
          <p className="v4-t-meta v4-cfg__carregando">
            <Spinner label="Conferindo a chave" />
            Conferindo a chave…
          </p>
        ) : (
          <dl className="v4-fatos">
            <dt>Situação</dt>
            <dd>{status.configurada ? <Tag tom="sucesso">Ligada{status.origem === "env" ? " pela configuração do servidor" : ""}</Tag> : <Tag>Regras locais, sem IA</Tag>}</dd>
            {status.mascara && (
              <>
                <dt>Chave</dt>
                <dd>{status.mascara}</dd>
              </>
            )}
            {status.model && (
              <>
                <dt>Modelo</dt>
                <dd>{status.model}</dd>
              </>
            )}
          </dl>
        )}
        {escreve && (
          <form className="v4-form" onSubmit={salvar} noValidate>
            <Input
              label="Chave da Anthropic"
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={chave}
              error={erro ?? undefined}
              help="Fica só no seu servidor; não aparece para o resto da equipe."
              onChange={(e) => {
                setChave(e.target.value);
                setErro(null);
                editar();
              }}
            />
            <div className="v4-form__acoes">
              <Button type="submit" variant="primary" busy={envio.fase === "salvando"} busyLabel="Salvando" disabled={!chave.trim()}>
                Salvar chave
              </Button>
              {status?.configurada && status.origem === "ui" && (
                <Button variant="ghost" onClick={() => enviar(() => postar({ clear: true }))}>
                  Remover chave
                </Button>
              )}
              <EstadoSalvar estado={envio} />
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

/* ---------- Chaves de API ---------- */

function AbaChaves() {
  const { estado, operador } = useCRM();
  const gravar = useGravar();
  const copiar = useCopiar();
  const escreve = podeEscrever(operador);
  const { estado: envio, enviar, editar } = useEnvio();
  const [nome, setNome] = useState("");
  const [escopo, setEscopo] = useState<Escopo>("leitura");
  const [operadorId, setOperadorId] = useState(() => estado.operadores.find((o) => o.ativo && o.papel === "leitura")?.id ?? "");
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [nova, setNova] = useState<{ nome: string; chave: string } | null>(null);
  const [revogando, setRevogando] = useState<LinhaChave | null>(null);
  const linhas = linhasChaves(estado);

  async function criar(e: FormEvent) {
    e.preventDefault();
    const er = validarNomeChave(nome);
    setErroNome(er);
    if (er) return;
    setNova(null);
    await enviar(async () => {
      const antes = estado.chaves;
      const r = await gravar({ tipo: "criarChaveApi", nome: nome.trim(), escopo, operadorId: operadorId || null }, "Chave criada. Copie agora.");
      if (!r.ok) return r;
      const k = chaveCriada(antes, r.estado.chaves);
      if (k) setNova({ nome: k.nome, chave: k.chave });
      setNome("");
      return { ok: true };
    });
  }

  async function revogar() {
    const alvo = revogando;
    if (!alvo) return;
    await gravar({ tipo: "revogarChaveApi", chaveId: alvo.id }, `Chave “${alvo.nome}” revogada.`);
    setRevogando(null);
  }

  return (
    <div className="v4-pilha">
      {escreve && (
        <Panel elevado titulo="Criar chave">
          <form className="v4-form" onSubmit={criar} noValidate>
            <p className="v4-t-ui v4-t-2">Para sistemas que falam com o CRM pela API. Uma chave por uso: assim dá para revogar uma sem parar as outras.</p>
            <div className="v4-form__campos">
              <Input
                label="Nome"
                required
                maxLength={80}
                value={nome}
                error={erroNome ?? undefined}
                placeholder="GrokBot leitura, formulário do site"
                onChange={(e) => {
                  setNome(e.target.value);
                  setErroNome(null);
                  editar();
                }}
              />
              <Select
                label="Acesso"
                value={escopo}
                help={AJUDA_ESCOPO[escopo]}
                options={(["leitura", "escrita"] as Escopo[]).map((s) => ({ value: s, label: ROTULO_ESCOPO[s] }))}
                onChange={(e) => {
                  setEscopo(e.target.value as Escopo);
                  editar();
                }}
              />
              <Select
                label="Ações ficam no nome de"
                value={operadorId}
                options={[{ value: "", label: "Ninguém" }, ...estado.operadores.filter((o) => o.ativo).map((o) => ({ value: o.id, label: o.nome }))]}
                onChange={(e) => {
                  setOperadorId(e.target.value);
                  editar();
                }}
              />
            </div>
            <div className="v4-form__acoes">
              <Button type="submit" variant="primary" busy={envio.fase === "salvando"} busyLabel="Criando">
                Criar chave
              </Button>
              <EstadoSalvar estado={envio} />
            </div>
          </form>
          {nova && (
            <div className="v4-integ__token" role="status">
              <p className="v4-t-ui v4-t-strong">Copie agora: a chave “{nova.nome}” aparece inteira só esta vez.</p>
              <code className="v4-integ__codigo">{nova.chave}</code>
              <div className="v4-form__acoes">
                <Button icon="nota" onClick={() => copiar(nova.chave, "Chave copiada")}>
                  Copiar chave
                </Button>
                <Button variant="ghost" onClick={() => setNova(null)}>
                  Já copiei
                </Button>
              </div>
            </div>
          )}
        </Panel>
      )}
      <Panel titulo="Chaves" semRecuo>
        <Table
          rotulo="Chaves de API"
          linhas={linhas}
          chave={(k) => k.id}
          colunas={[
            { id: "n", titulo: "Nome", celula: (k) => k.nome },
            { id: "e", titulo: "Acesso", celula: (k) => ROTULO_ESCOPO[k.escopo] },
            { id: "o", titulo: "No nome de", celula: (k) => k.operador },
            { id: "k", titulo: "Começa com", celula: (k) => <span className="v4-tabular">{k.inicio}</span> },
            { id: "d", titulo: "Criada em", celula: (k) => <span className="v4-tabular">{dataCurta(k.criadaEm)}</span> },
            { id: "s", titulo: "Situação", celula: (k) => (k.revogadaEm ? <Tag>Revogada em {dataCurta(k.revogadaEm)}</Tag> : <Tag tom="sucesso">Ativa</Tag>) },
            {
              id: "a",
              titulo: "Ação",
              celula: (k) =>
                k.revogadaEm || !escreve ? (
                  <span className="v4-t-3">—</span>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => setRevogando(k)}>
                    Revogar<span className="v4-sr"> a chave {k.nome}</span>
                  </Button>
                ),
            },
          ]}
          vazio={<p className="v4-t-meta v4-integ__vazio">Nenhuma chave ainda. Crie a primeira acima.</p>}
        />
      </Panel>
      <ConfirmarExclusao
        open={Boolean(revogando)}
        aoFechar={() => setRevogando(null)}
        titulo="Revogar esta chave?"
        texto={revogando ? `O que usa “${revogando.nome}” para de acessar o CRM na hora. Não dá para desfazer: para voltar, crie outra chave e troque no sistema que usava esta.` : ""}
        rotuloConfirmar="Revogar chave"
        rotuloManter="Manter chave"
        aoConfirmar={revogar}
      />
    </div>
  );
}

/* ---------- Dados ---------- */

type Recomeco = "exemplo" | "zero";

function AbaDados() {
  const { estado, repo, despachar, operador } = useCRM();
  const toast = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState<EstadoCRM | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [recomeco, setRecomeco] = useState<Recomeco | null>(null);
  const escreve = podeEscrever(operador);

  function exportar() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivoExportacao(new Date().toISOString());
    a.click();
    URL.revokeObjectURL(url);
    toast.avisar({ tom: "sucesso", titulo: "Arquivo baixado", texto: "Guarde num lugar seguro: ele tem os dados dos seus contatos." });
  }

  async function lerArquivo(f: File) {
    setErroArquivo(null);
    try {
      const dado = JSON.parse(await f.text());
      const er = erroDoArquivo(dado);
      if (er) setErroArquivo(er);
      else setImportando(dado as EstadoCRM);
    } catch {
      setErroArquivo("Não deu para ler o arquivo: ele não é um JSON válido.");
    }
  }

  async function confirmarImportacao() {
    if (!importando) return;
    if (await despachar({ tipo: "substituirEstado", estado: importando }, "Dados importados.")) window.location.reload();
    else setImportando(null);
  }

  async function confirmarRecomeco() {
    if (!recomeco) return;
    if (repo.origem === "local") apagarEstadoLocal(window.localStorage);
    await despachar({ tipo: "substituirEstado", estado: recomeco === "zero" ? estadoVazio() : estadoExemplo() });
    window.location.reload();
  }

  const resumoImport = importando ? resumoDoEstado(importando) : [];
  return (
    <div className="v4-grade">
      <Panel titulo="Exportar e importar">
        <div className="v4-form">
          <p className="v4-t-ui v4-t-2">Um arquivo com tudo o que está no CRM. Serve de cópia de segurança e para levar os dados para outro lugar.</p>
          <div className="v4-form__acoes">
            <Button icon="nota" onClick={exportar}>
              Baixar os dados
            </Button>
            {escreve && (
              <Button variant="ghost" onClick={() => arquivo.current?.click()}>
                Importar um arquivo
              </Button>
            )}
            <input
              ref={arquivo}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void lerArquivo(f);
              }}
            />
          </div>
          {erroArquivo && (
            <p className="v4-salvar v4-salvar--erro" role="alert">
              <Icon name="erro" />
              <span>Nada foi importado: {erroArquivo}</span>
            </p>
          )}
        </div>
      </Panel>
      <Panel titulo="O que tem no CRM agora">
        <dl className="v4-fatos">
          {resumoDoEstado(estado).map((r) => (
            <div key={r.rotulo} className="v4-cfg__fato">
              <dt>{r.rotulo}</dt>
              <dd className="v4-tabular">{r.n}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      {escreve && (
        <Panel titulo="Recomeçar">
          <div className="v4-form">
            <p className="v4-t-ui v4-t-2">Apaga o que está aqui. Baixe os dados antes se quiser guardar.</p>
            <div className="v4-form__acoes">
              <Button onClick={() => setRecomeco("exemplo")}>Voltar aos dados de exemplo</Button>
              <Button variant="destructive" onClick={() => setRecomeco("zero")}>
                Começar do zero
              </Button>
            </div>
          </div>
        </Panel>
      )}
      <Dialog
        open={Boolean(importando)}
        onClose={() => setImportando(null)}
        title="Trocar tudo pelos dados do arquivo?"
        description="O que está no CRM agora é substituído pelo arquivo. Não dá para desfazer; baixe os dados atuais antes se quiser guardar."
        footer={({ fechar }) => (
          <>
            <Button variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarImportacao} busyLabel="Importando">
              Trocar pelos dados do arquivo
            </Button>
          </>
        )}
      >
        <dl className="v4-fatos">
          {resumoImport.map((r) => (
            <div key={r.rotulo} className="v4-cfg__fato">
              <dt>{r.rotulo} no arquivo</dt>
              <dd className="v4-tabular">{r.n}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
      <ConfirmarExclusao
        open={Boolean(recomeco)}
        aoFechar={() => setRecomeco(null)}
        titulo={recomeco === "zero" ? "Começar do zero?" : "Voltar aos dados de exemplo?"}
        texto={
          recomeco === "zero"
            ? `Apaga contatos, conversas, funil e configuração. Fica só um dono e ${estado.config.nomeRobo}. Não dá para desfazer.`
            : "Troca tudo o que está aqui pelos dados de exemplo do template. O que você mexeu se perde. Não dá para desfazer."
        }
        rotuloConfirmar={recomeco === "zero" ? "Apagar tudo e começar do zero" : "Voltar aos dados de exemplo"}
        rotuloManter="Manter meus dados"
        aoConfirmar={confirmarRecomeco}
      />
    </div>
  );
}
