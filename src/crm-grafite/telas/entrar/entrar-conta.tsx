"use client";

import "@fontsource-variable/onest";
import "../../styles/tokens.css";
import "../../styles/grafite.css";
import "../../styles/base.css";
import "../../styles/components.css";
import "../../styles/shell.css";
import "../../styles/fontes.css";
import { useRef, useState, type FormEvent } from "react";
import { travaDeEnvio } from "../base-demais/formulario";
import { Button, Icon, Input, classesBotao, iniciaisV4 } from "../../ui";
import { CampoSenha } from "./campo-senha";
import {
  destinoSeguro,
  emailDiscreto,
  estadoDaRespostaLink,
  estadoDaRespostaSenha,
  validarEmail,
  validarSenhaDigitada,
  type Aviso,
  type EstadoLink,
  type EstadoSenha,
} from "./acesso-logica";
import "../../styles/telas/base-demais.css";
import "../../styles/telas/entrar.css";
import "../../styles/telas/acesso.css";

const MARCA = "CRM do dono";

type Modo = "senha" | "link";

async function pedirLink(corpo: { email: string; next: string }): Promise<number | null> {
  try {
    const r = await fetch("/api/auth/magic-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    return r.status;
  } catch {
    return null;
  }
}

async function entrarComSenha(corpo: { email: string; senha: string; next: string }) {
  try {
    const r = await fetch("/api/auth/senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(corpo),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string; destino?: string };
    return { status: r.status, error: j.error, destino: j.destino };
  } catch {
    return { status: null };
  }
}

function proximo(): string {
  return destinoSeguro(new URLSearchParams(window.location.search).get("next"));
}

function CaixaAviso({ aviso }: { aviso: Aviso }) {
  return (
    <div className={`v4-entrar__aviso v4-entrar__aviso--${aviso.tom}`} role={aviso.tom === "info" ? "status" : "alert"}>
      <Icon name={aviso.tom === "erro" ? "erro" : aviso.tom === "info" ? "info" : "alerta"} />
      <div>
        <p className="v4-t-ui v4-t-strong">{aviso.titulo}</p>
        <p className="v4-t-ui v4-t-2">{aviso.texto}</p>
      </div>
    </div>
  );
}

/**
 * /entrar no visual Grafite (fora do app em hash). Com o Supabase ligado: e-mail e senha como
 * caminho principal e o link por e-mail como alternativa. Sem o Supabase: diz isso e leva ao
 * modo demo em "/". A raiz é a do Grafite, sem a casca (ainda não há operador).
 */
export function PaginaEntrar({ supabaseLigado, avisoInicial }: { supabaseLigado: boolean; avisoInicial?: Aviso | null }) {
  return (
    <div className="crm-v4-root" data-visual="grafite" data-density="compact">
      <main className="v4-entrar v4-entrar--conta" data-v4-tela="entrar">
        <div className="v4-entrar__caixa">
          <div className="v4-entrar__marca">
            <span className="v4-brand__mark" aria-hidden="true">
              {iniciaisV4(MARCA)}
            </span>
            <span className="v4-t-ui v4-t-medium">{MARCA}</span>
          </div>
          {supabaseLigado ? <EntrarComConta avisoInicial={avisoInicial ?? null} /> : <SemSupabase />}
        </div>
      </main>
    </div>
  );
}

function SemSupabase() {
  return (
    <section className="v4-entrar__painel" aria-labelledby="v4-entrar-titulo">
      <h1 id="v4-entrar-titulo" className="v4-t-title">
        Entrar no CRM
      </h1>
      <CaixaAviso
        aviso={{
          tom: "info",
          titulo: "Este CRM ainda não está ligado ao Supabase",
          texto: "Sem ele não há contas nem senhas. Você pode usar o CRM agora em modo demo: na entrada, é só escolher o seu nome.",
        }}
      />
      <a className={classesBotao({ variant: "primary", block: true })} href="/">
        <span className="v4-btn__label">Abrir em modo demo</span>
      </a>
      <p className="v4-t-meta v4-entrar__guia">
        Para a equipe entrar com e-mail e senha, ligue o Supabase seguindo o guia IMPLEMENTAR.md, que vem junto com o CRM (passo “Ligar o Supabase”).
      </p>
    </section>
  );
}

function EntrarComConta({ avisoInicial }: { avisoInicial: Aviso | null }) {
  const [modo, setModo] = useState<Modo>("senha");
  const [estadoSenha, setEstadoSenha] = useState<EstadoSenha>({ fase: "inicial" });
  const [estadoLink, setEstadoLink] = useState<EstadoLink>({ fase: "inicial" });
  const [avisoUrl, setAvisoUrl] = useState<Aviso | null>(avisoInicial);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const trava = useRef(travaDeEnvio());

  async function entrar(e: FormEvent) {
    e.preventDefault();
    const eEmail = validarEmail(email);
    const eSenha = validarSenhaDigitada(senha);
    setErroEmail(eEmail);
    setErroSenha(eSenha);
    if (eEmail || eSenha) return;
    await trava.current(async () => {
      setAvisoUrl(null);
      setEstadoSenha({ fase: "entrando" });
      const novo = estadoDaRespostaSenha(await entrarComSenha({ email: email.trim().toLowerCase(), senha, next: proximo() }));
      setEstadoSenha(novo);
      if (novo.fase === "entrou") {
        setSenha("");
        // Navegação inteira: o CRM nasce de novo, já com a sessão nos cookies.
        window.location.assign(novo.destino);
      }
    });
  }

  async function pedir(e: FormEvent) {
    e.preventDefault();
    const eEmail = validarEmail(email);
    setErroEmail(eEmail);
    if (eEmail) return;
    const alvo = email.trim().toLowerCase();
    // Um pedido por vez: Enter duplo não manda dois links (nem gasta o limite de tentativas).
    await trava.current(async () => {
      setAvisoUrl(null);
      setEstadoLink({ fase: "enviando" });
      setEstadoLink(estadoDaRespostaLink(await pedirLink({ email: alvo, next: proximo() }), alvo));
    });
  }

  function trocarModo(novo: Modo) {
    setModo(novo);
    setErroEmail(null);
    setErroSenha(null);
    setSenha("");
    setEstadoSenha({ fase: "inicial" });
    setEstadoLink({ fase: "inicial" });
  }

  const aviso: Aviso | null =
    modo === "senha"
      ? estadoSenha.fase === "erro"
        ? estadoSenha.aviso
        : avisoUrl
      : estadoLink.fase === "erro"
        ? { tom: "erro", titulo: "O link não foi enviado", texto: estadoLink.texto }
        : avisoUrl;

  const campoEmail = (
    <Input
      label="E-mail"
      type="email"
      autoComplete={modo === "senha" ? "username" : "email"}
      inputMode="email"
      placeholder="voce@empresa.com"
      required
      value={email}
      error={erroEmail ?? undefined}
      onChange={(e) => {
        setEmail(e.target.value);
        if (erroEmail) setErroEmail(null);
      }}
    />
  );

  if (modo === "link" && estadoLink.fase === "enviado") {
    return (
      <section className="v4-entrar__painel" aria-labelledby="v4-entrar-titulo">
        <div className="v4-entrar__ok">
          <Icon name="sucesso" />
          <h1 id="v4-entrar-titulo" className="v4-t-title">
            Link a caminho
          </h1>
        </div>
        <p className="v4-t-ui v4-t-2" role="status">
          Se {emailDiscreto(estadoLink.email)} tiver acesso ao CRM, o link de entrada chega em instantes.
        </p>
        <p className="v4-t-meta">Não chegou em alguns minutos? Confira o spam ou peça de novo.</p>
        <Button variant="secondary" block onClick={() => setEstadoLink({ fase: "inicial" })}>
          Usar outro e-mail
        </Button>
        <Button variant="ghost" block onClick={() => trocarModo("senha")}>
          Entrar com e-mail e senha
        </Button>
      </section>
    );
  }

  return (
    <section className="v4-entrar__painel" aria-labelledby="v4-entrar-titulo">
      <h1 id="v4-entrar-titulo" className="v4-t-title">
        Entrar no CRM
      </h1>
      <p className="v4-t-ui v4-t-2">
        {modo === "senha"
          ? "Entre com o seu e-mail e a sua senha. Só quem está ativo na equipe entra."
          : "Você recebe um link de entrada no seu e-mail, sem senha. Só quem está ativo na equipe entra."}
      </p>
      {aviso && <CaixaAviso aviso={aviso} />}
      {modo === "senha" ? (
        <>
          {/* method="post" e campos sem `name`: mesmo sem JavaScript, a senha nunca vai para o endereço. */}
          <form className="v4-form" method="post" action="/api/auth/senha" onSubmit={entrar} noValidate>
            {campoEmail}
            <CampoSenha
              label="Senha"
              autoComplete="current-password"
              required
              value={senha}
              error={erroSenha ?? undefined}
              onChange={(e) => {
                setSenha(e.target.value);
                if (erroSenha) setErroSenha(null);
              }}
            />
            <Button type="submit" variant="primary" block busy={estadoSenha.fase === "entrando" || estadoSenha.fase === "entrou"} busyLabel="Entrando">
              Entrar
            </Button>
          </form>
          <div className="v4-entrar__alt">
            <Button variant="ghost" block onClick={() => trocarModo("link")}>
              Entrar com link por e-mail
            </Button>
            <p className="v4-t-meta">Ainda não tem senha ou esqueceu? Entre pelo link e peça uma senha a quem cuida do CRM.</p>
          </div>
        </>
      ) : (
        <>
          <form className="v4-form" method="post" action="/api/auth/magic-link" onSubmit={pedir} noValidate>
            {campoEmail}
            <Button type="submit" variant="primary" block busy={estadoLink.fase === "enviando"} busyLabel="Enviando o link">
              Receber link de entrada
            </Button>
          </form>
          <div className="v4-entrar__alt">
            <Button variant="ghost" block onClick={() => trocarModo("senha")}>
              Entrar com e-mail e senha
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
