"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { REGRA_SENHA_TEXTO } from "@/lib/auth/senha/regra";
import { Button, Dialog, ErrorState, Icon, Panel, classesBotao, useToast } from "../../ui";
import { CabecalhoTela, EstadoSalvar, TelaV4, useEnvio } from "../base-demais/tela";
import { travaDeEnvio } from "../base-demais/formulario";
import { ROTULO_PAPEL } from "../equipe/equipe-logica";
import { CampoSenha } from "../entrar/campo-senha";
import { ROTULO_PAPEL_CONTA, modeloConta, resultadoDaTroca, temErro, validarTroca, type ErrosTroca, type ModeloConta } from "./conta-logica";
import "../../styles/telas/config.css";
import "../../styles/telas/acesso.css";

type Carga = { fase: "carregando" } | ModeloConta;

async function lerConta(): Promise<ModeloConta> {
  try {
    const r = await fetch("/api/auth/conta", { cache: "no-store", credentials: "same-origin" });
    return modeloConta(r.status, await r.json().catch(() => null));
  } catch {
    return modeloConta(null, null);
  }
}

async function postar(url: string, corpo: unknown): Promise<{ status: number | null; corpo: Record<string, unknown> | null }> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(corpo),
    });
    return { status: r.status, corpo: (await r.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { status: null, corpo: null };
  }
}

function minuscula(s: string): string {
  return s ? s[0].toLocaleLowerCase("pt-BR") + s.slice(1) : s;
}

/**
 * Minha conta. Com o CRM ligado ao Supabase e uma sessão de operador: o e-mail, trocar a
 * própria senha (pede a atual) e sair de todos os dispositivos. No modo local (demo), explica
 * que conta e senha existem quando o CRM está ligado ao Supabase.
 */
export function TelaConta() {
  const { operador } = useCRM();
  const [carga, setCarga] = useState<Carga>({ fase: "carregando" });

  const carregar = useCallback(async () => {
    setCarga({ fase: "carregando" });
    setCarga(await lerConta());
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const meta =
    carga.fase === "conta"
      ? `${carga.email} · ${ROTULO_PAPEL_CONTA[carga.papel] ?? carga.papel}`
      : operador
        ? `${operador.nome} · ${ROTULO_PAPEL[operador.papel]}`
        : undefined;

  return (
    <TelaV4 area="conta">
      <CabecalhoTela titulo="Minha conta" meta={meta} />
      {carga.fase === "carregando" ? (
        <p className="v4-t-meta v4-conta__carregando" role="status">
          Conferindo a sua conta…
        </p>
      ) : carga.fase === "erro" ? (
        <div className="v4-tela__estado">
          <ErrorState
            nivel={2}
            titulo="Não deu para conferir a sua conta"
            texto="Nada foi alterado. Confira a conexão com o servidor do CRM e tente de novo."
            aoTentar={carregar}
          />
        </div>
      ) : carga.fase === "local" ? (
        <ContaLocal nome={operador?.nome ?? null} />
      ) : carga.fase === "sem_sessao" ? (
        <ContaSemSessao />
      ) : (
        <ContaComSessao email={carga.email} aoPerderSessao={carregar} />
      )}
    </TelaV4>
  );
}

function ContaLocal({ nome }: { nome: string | null }) {
  return (
    <div className="v4-grade">
      <Panel elevado titulo="Conta e senha">
        <div className="v4-conta__texto">
          <p className="v4-t-ui v4-t-strong">Neste modo não há conta nem senha</p>
          <p className="v4-t-ui v4-t-2">
            {nome ? `Você entrou como ${nome}, escolhendo o seu nome na entrada. ` : "Você entrou escolhendo o seu nome na entrada. "}O que você faz no
            CRM fica registrado nesse nome.
          </p>
          <p className="v4-t-ui v4-t-2">
            Entrar com e-mail e senha, trocar a senha e sair de todos os aparelhos de uma vez passam a existir quando o CRM é ligado ao Supabase, o serviço que
            guarda as contas da equipe.
          </p>
          <p className="v4-nota">
            <Icon name="livro" />
            <span>Para ligar, siga o guia IMPLEMENTAR.md, que vem junto com o CRM, no passo “Ligar o Supabase”.</span>
          </p>
        </div>
      </Panel>
    </div>
  );
}

function ContaSemSessao() {
  return (
    <div className="v4-grade">
      <Panel elevado titulo="Conta e senha">
        <div className="v4-conta__texto">
          <p className="v4-t-ui v4-t-strong">Você não entrou com a sua conta neste navegador</p>
          <p className="v4-t-ui v4-t-2">
            Este CRM está ligado ao Supabase, mas aqui você entrou escolhendo o seu nome. Entre com o seu e-mail e a sua senha (ou pelo link por e-mail) para
            trocar a senha ou sair de todos os aparelhos.
          </p>
          <div className="v4-form__acoes">
            <a className={classesBotao({ variant: "primary" })} href="/entrar">
              <span className="v4-btn__label">Entrar com a minha conta</span>
            </a>
          </div>
        </div>
      </Panel>
    </div>
  );
}

const SEM_ERROS: ErrosTroca = { atual: null, nova: null, repeticao: null };

function ContaComSessao({ email, aoPerderSessao }: { email: string; aoPerderSessao: () => unknown }) {
  const { avisar } = useToast();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repeticao, setRepeticao] = useState("");
  const [erros, setErros] = useState<ErrosTroca>(SEM_ERROS);
  const [outrosFicaram, setOutrosFicaram] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [erroSaida, setErroSaida] = useState<string | null>(null);
  const { estado, enviar, editar } = useEnvio();
  const trava = useRef(travaDeEnvio());

  async function trocar(e: FormEvent) {
    e.preventDefault();
    const conferidos = validarTroca(atual, nova, repeticao, email);
    setErros(conferidos);
    if (temErro(conferidos)) return;
    await trava.current(() =>
      enviar(async () => {
        const r = await postar("/api/auth/conta/senha", { senhaAtual: atual, senhaNova: nova });
        const res = resultadoDaTroca(r.status, r.corpo as Parameters<typeof resultadoDaTroca>[1]);
        if (!res.ok) {
          if (res.campo) {
            setErros((x) => ({ ...x, [res.campo as "atual" | "nova"]: res.erro }));
            return { ok: false, erro: "confira o campo marcado." };
          }
          if (res.sessao) void aoPerderSessao();
          return { ok: false, erro: minuscula(res.erro) };
        }
        setAtual("");
        setNova("");
        setRepeticao("");
        setOutrosFicaram(!res.outrosDesconectados);
        avisar({ tom: "sucesso", titulo: "Senha trocada", texto: res.outrosDesconectados ? "Os outros aparelhos foram desconectados." : undefined });
        return { ok: true };
      }),
    );
  }

  async function sair() {
    setErroSaida(null);
    const r = await postar("/api/auth/conta/sair-de-todos", {});
    // 401: a sessão deste navegador já não existia; não há o que encerrar aqui, só entrar de novo.
    if (r.status !== 200 && r.status !== 401) {
      const erro = typeof r.corpo?.error === "string" ? r.corpo.error : "sem conexão. Confira a internet e tente de novo.";
      setErroSaida(minuscula(erro));
      return;
    }
    setConfirmandoSaida(false);
    window.location.assign("/entrar");
  }

  function campo(nome: keyof ErrosTroca, valor: string, set: (v: string) => void) {
    return {
      value: valor,
      error: erros[nome] ?? undefined,
      onChange: (ev: { target: { value: string } }) => {
        set(ev.target.value);
        if (erros[nome]) setErros((x) => ({ ...x, [nome]: null }));
        editar();
      },
    };
  }

  return (
    <>
      <div className="v4-grade">
        <Panel elevado titulo="Senha">
          {/* method="post" e campos sem `name`: a senha só sai daqui no corpo JSON. */}
          <form className="v4-form" method="post" action="/api/auth/conta/senha" onSubmit={trocar} noValidate>
            <p className="v4-t-ui v4-t-2">
              Você entra com <strong className="v4-t-strong">{email}</strong>. Ao trocar a senha, os outros aparelhos em que você entrou são desconectados; este
              continua dentro.
            </p>
            {/* Para o gerenciador de senhas saber de qual conta é a senha nova. */}
            <input type="email" autoComplete="username" value={email} readOnly hidden />
            <CampoSenha label="Senha atual" autoComplete="current-password" required {...campo("atual", atual, setAtual)} />
            <CampoSenha label="Senha nova" autoComplete="new-password" required help={REGRA_SENHA_TEXTO} {...campo("nova", nova, setNova)} />
            <CampoSenha label="Repita a senha nova" autoComplete="new-password" required {...campo("repeticao", repeticao, setRepeticao)} />
            <div className="v4-form__acoes">
              <Button type="submit" variant="primary" busy={estado.fase === "salvando"} busyLabel="Trocando a senha">
                Trocar senha
              </Button>
              <EstadoSalvar estado={estado} />
            </div>
            {outrosFicaram && (
              <p className="v4-nota v4-nota--atencao" role="status">
                <Icon name="alerta" />
                <span>A senha foi trocada, mas não conseguimos desconectar os outros aparelhos. Use “Sair de todos os dispositivos”.</span>
              </p>
            )}
            <p className="v4-t-meta">Nunca teve senha e sempre entrou pelo link por e-mail? Peça a quem cuida do CRM para criar a sua no Supabase.</p>
          </form>
        </Panel>

        <Panel titulo="Sessões">
          <div className="v4-conta__texto">
            <p className="v4-t-ui v4-t-2">
              Perdeu um aparelho ou entrou num computador que não é seu? Encerre todas as sessões da sua conta de uma vez, inclusive esta.
            </p>
            <div className="v4-form__acoes">
              <Button variant="destructive" icon="sair" onClick={() => setConfirmandoSaida(true)}>
                Sair de todos os dispositivos
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Dialog
        open={confirmandoSaida}
        onClose={() => {
          setConfirmandoSaida(false);
          setErroSaida(null);
        }}
        title="Sair de todos os dispositivos?"
        description="Todos os aparelhos em que a sua conta está aberta são desconectados na hora, inclusive este. Você vai precisar entrar de novo."
        footer={({ fechar }) => (
          <>
            <Button variant="secondary" onClick={fechar}>
              Continuar dentro
            </Button>
            <Button variant="destructive" busyLabel="Saindo" onClick={sair}>
              Sair de todos
            </Button>
          </>
        )}
      >
        {erroSaida ? (
          <p className="v4-nota v4-nota--erro" role="alert">
            <Icon name="erro" />
            <span>Você continua dentro: {erroSaida}</span>
          </p>
        ) : (
          <span className="v4-sr">Confirmação de saída</span>
        )}
      </Dialog>
    </>
  );
}
