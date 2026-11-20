"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Icon, Input, Panel, Tag } from "../../ui";
import { EstadoSalvar, useEnvio } from "../base-demais/tela";
import { esperandoQr, situacaoWhatsapp, validarTelefoneSessao } from "./integrar-logica";

type Info = { label: string; signupUrl: string; consoleUrl: string; connected: boolean; sessionId: string | null };
type Sessao = { sessionId: string; status: string; qr?: string | null; qrExpiresAt?: string | null; telefone?: string | null; coldWarning?: boolean };

const ENGINE_PADRAO = "https://wpp-engine.oneclient.com.br";

/**
 * WhatsApp no visual Grafite: mesmas chamadas de `WhatsAppOnboarding` (/api/whatsapp: info,
 * status, bootstrap, refresh_qr). Cola a chave uma vez; o CRM cria a sessão, mostra o QR e
 * registra o endereço das mensagens. `compacto` tira a explicação longa (tela Entrar).
 */
export function PainelWhatsApp({ compacto = false, podeConectar = true }: { compacto?: boolean; podeConectar?: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [chave, setChave] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erros, setErros] = useState<{ chave?: string; telefone?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const { estado: envio, enviar, editar } = useEnvio();

  const carregar = useCallback(async () => {
    setFalhou(false);
    try {
      const j = (await (await fetch("/api/whatsapp?action=info")).json()) as Info;
      setInfo(j);
      if (j.sessionId) setSessao(await (await fetch(`/api/whatsapp?session=${encodeURIComponent(j.sessionId)}`)).json());
    } catch {
      setFalhou(true);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Enquanto espera a leitura do QR, renova o código e confere a situação a cada 8 s.
  useEffect(() => {
    if (!sessao?.sessionId || !esperandoQr(sessao.status)) return;
    const id = sessao.sessionId;
    const t = setInterval(async () => {
      try {
        const r = await (await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh_qr", sessionId: id }) })).json();
        if (r.ok) setSessao((s) => (s ? { ...s, qr: r.qr, qrExpiresAt: r.expiresAt } : s));
        setSessao(await (await fetch(`/api/whatsapp?session=${encodeURIComponent(id)}`)).json());
      } catch {
        /* a próxima rodada tenta de novo */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [sessao?.sessionId, sessao?.status]);

  async function conectar(e: FormEvent) {
    e.preventDefault();
    const er = {
      chave: !chave.trim() ? "Cole a chave do WPP Engine (começa com wae_live_)." : !chave.trim().startsWith("wae_") ? "A chave do WPP Engine começa com wae_live_." : undefined,
      telefone: validarTelefoneSessao(telefone) ?? undefined,
    };
    setErros(er);
    if (er.chave || er.telefone) return;
    setAviso(null);
    await enviar(async () => {
      const r = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bootstrap", apiKey: chave.trim(), phone: telefone.replace(/[\s()-]/g, "") }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) return { ok: false, erro: j.erro ?? "o WPP Engine não aceitou a conexão." };
      setSessao(j.session);
      setAviso(j.aviso ?? null);
      setChave("");
      await carregar();
      return { ok: true };
    });
  }

  const sit = situacaoWhatsapp(info, sessao);
  const qr = sessao?.qr && esperandoQr(sessao.status) ? (sessao.qr.startsWith("data:") || sessao.qr.startsWith("http") ? sessao.qr : `data:image/png;base64,${sessao.qr}`) : null;
  return (
    <Panel
      titulo={`WhatsApp · ${info?.label ?? "WPP Engine"}`}
      acoes={<Tag tom={sit.tom}>{sit.rotulo}</Tag>}
    >
      <div className="v4-form">
        {!compacto && (
          <p className="v4-t-ui v4-t-2">
            Cole a chave do WPP Engine uma vez: o CRM cria a sessão, mostra o QR e registra sozinho o endereço que recebe as mensagens.
          </p>
        )}
        {falhou && (
          <p className="v4-salvar v4-salvar--erro" role="alert">
            <Icon name="erro" />
            <span>Não deu para ver a situação do WhatsApp. Nada foi alterado.</span>
          </p>
        )}
        {sessao?.status === "conectado" && (
          <p className="v4-t-ui">
            Conectado{sessao.telefone ? ` ao ${sessao.telefone}` : ""}. As mensagens novas chegam em Conversas.
          </p>
        )}
        {qr && (
          <div className="v4-integ__qr">
            <p className="v4-t-ui v4-t-strong">No celular, abra o WhatsApp › Aparelhos conectados › Conectar um aparelho e leia o código.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="v4-integ__qr-img" src={qr} alt="Código QR para conectar o WhatsApp" width={220} height={220} />
            {sessao?.qrExpiresAt && <p className="v4-t-meta">O código se renova sozinho enquanto esta tela está aberta.</p>}
          </div>
        )}
        {podeConectar && sessao?.status !== "conectado" && (
          <form className="v4-form" onSubmit={conectar} noValidate>
            <div className="v4-form__campos">
              <Input
                label="Chave do WPP Engine"
                type="password"
                autoComplete="off"
                placeholder="wae_live_…"
                value={chave}
                error={erros.chave}
                help={compacto ? undefined : "Fica guardada no servidor; não precisa colar de novo."}
                onChange={(e) => {
                  setChave(e.target.value);
                  setErros((x) => ({ ...x, chave: undefined }));
                  editar();
                }}
              />
              <Input
                label="Número do WhatsApp"
                type="tel"
                inputMode="tel"
                placeholder="+5511999999999"
                value={telefone}
                error={erros.telefone}
                onChange={(e) => {
                  setTelefone(e.target.value);
                  setErros((x) => ({ ...x, telefone: undefined }));
                  editar();
                }}
              />
            </div>
            <div className="v4-form__acoes">
              <Button type="submit" variant="primary" icon="conversas" busy={envio.fase === "salvando"} busyLabel="Conectando">
                Conectar o WhatsApp
              </Button>
              <Button variant="ghost" onClick={() => window.open(info?.signupUrl || info?.consoleUrl || ENGINE_PADRAO, "_blank", "noopener,noreferrer")}>
                Criar conta no WPP Engine
              </Button>
              <EstadoSalvar estado={envio} />
            </div>
          </form>
        )}
        {aviso && <p className="v4-t-meta" role="status">{aviso}</p>}
        {sessao?.coldWarning && (
          <p className="v4-nota v4-nota--atencao">
            <Icon name="alerta" />
            <span>Número novo: aumente o volume aos poucos. O limite é de 5.000 mensagens por dia e uma sessão no plano self-service.</span>
          </p>
        )}
        <div className="v4-form__acoes">
          <Button size="sm" variant="ghost" icon="recarregar" onClick={carregar}>
            Atualizar situação
          </Button>
        </div>
      </div>
    </Panel>
  );
}
