"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, IconButton } from "./button";
import { Icon, type IconeV4 } from "./icon";
import { trazerParaFrente } from "./flutuante";
import { proximoAnuncio } from "./anuncio";

export type TomAviso = "sucesso" | "info" | "atencao" | "erro";

export type Aviso = {
  id: number;
  tom: TomAviso;
  titulo: string;
  texto?: string;
  acao?: { label: string; onClick: () => void };
};

type Ctx = {
  avisar: (a: Omit<Aviso, "id">) => number;
  dispensar: (id: number) => void;
};

const AvisoCtx = createContext<Ctx | null>(null);

const ICONE: Record<TomAviso, IconeV4> = { sucesso: "sucesso", info: "info", atencao: "alerta", erro: "erro" };

/** Quanto tempo o aviso fica. Erro não some sozinho: quem decide é a pessoa. */
export function duracaoAviso(tom: TomAviso): number | null {
  return tom === "erro" ? null : 5000;
}

/**
 * O que o leitor de tela ouve de um aviso e em qual canal. Erro interrompe (assertive);
 * sucesso, informação e atenção esperam a fala atual (polite).
 */
export function anuncioDoAviso(a: Pick<Aviso, "tom" | "titulo" | "texto">): { canal: "polite" | "assertive"; texto: string } {
  return { canal: a.tom === "erro" ? "assertive" : "polite", texto: [a.titulo, a.texto].filter(Boolean).join(". ") };
}

export type FalaAvisos = { polite: string; assertive: string };
export const FALA_VAZIA: FalaAvisos = { polite: "", assertive: "" };

/** Estado das duas regiões depois de um aviso novo (só a região do canal dele muda). */
export function registrarAnuncio(fala: FalaAvisos, a: Pick<Aviso, "tom" | "titulo" | "texto">): FalaAvisos {
  const an = anuncioDoAviso(a);
  return { ...fala, [an.canal]: proximoAnuncio(fala[an.canal], an.texto) };
}

/**
 * Avisos breves. Sucesso e informação somem em 5 s (pausam com o ponteiro ou o foco em cima);
 * erro fica até ser dispensado e pode trazer a ação de recuperação ("Tentar de novo").
 * O anúncio sai por duas regiões vivas que existem desde a montagem (fora do popover, que
 * fica escondido sem avisos): região criada junto com o texto costuma não ser lida.
 * Sucesso/informação com educação (polite); erro, na hora (assertive).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [fala, setFala] = useState<FalaAvisos>(FALA_VAZIA);
  const seq = useRef(0);
  const regiao = useRef<HTMLDivElement>(null);

  const dispensar = useCallback((id: number) => setAvisos((l) => l.filter((a) => a.id !== id)), []);
  const avisar = useCallback((a: Omit<Aviso, "id">) => {
    seq.current += 1;
    const id = seq.current;
    setAvisos((l) => [...l.slice(-3), { ...a, id }]);
    setFala((f) => registrarAnuncio(f, a));
    return id;
  }, []);

  useEffect(() => {
    if (avisos.length > 0) trazerParaFrente(regiao.current);
  }, [avisos.length]);

  const valor = useMemo(() => ({ avisar, dispensar }), [avisar, dispensar]);
  return (
    <AvisoCtx.Provider value={valor}>
      {children}
      <div className="v4-sr" aria-live="polite" aria-atomic="true">
        {fala.polite}
      </div>
      <div className="v4-sr" aria-live="assertive" aria-atomic="true">
        {fala.assertive}
      </div>
      <div ref={regiao} className="v4-toasts" popover="manual" role="region" aria-label="Avisos">
        {avisos.map((a) => (
          <ItemAviso key={a.id} aviso={a} dispensar={dispensar} />
        ))}
      </div>
    </AvisoCtx.Provider>
  );
}

function ItemAviso({ aviso, dispensar }: { aviso: Aviso; dispensar: (id: number) => void }) {
  const [pausado, setPausado] = useState(false);
  const ms = duracaoAviso(aviso.tom);
  useEffect(() => {
    if (ms === null || pausado) return;
    const t = window.setTimeout(() => dispensar(aviso.id), ms);
    return () => window.clearTimeout(t);
  }, [ms, pausado, aviso.id, dispensar]);
  return (
    <div
      className={`v4-toast v4-toast--${aviso.tom}`}
      onPointerEnter={() => setPausado(true)}
      onPointerLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <Icon name={ICONE[aviso.tom]} />
      <div className="v4-toast__body">
        <p className="v4-toast__title">{aviso.titulo}</p>
        {aviso.texto && <p className="v4-toast__text">{aviso.texto}</p>}
      </div>
      <IconButton icon="fechar" label="Dispensar aviso" size="sm" semTooltip onClick={() => dispensar(aviso.id)} />
      {aviso.acao && (
        <div className="v4-toast__actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              aviso.acao?.onClick();
              dispensar(aviso.id);
            }}
          >
            {aviso.acao.label}
          </Button>
        </div>
      )}
    </div>
  );
}

export function useToast(): Ctx {
  const c = useContext(AvisoCtx);
  if (!c) throw new Error("useToast precisa de <ToastProvider> (casca v4).");
  return c;
}

/** Vitrine estática (espécimes). */
export function ToastPreview({ tom, titulo, texto, acao }: { tom: TomAviso; titulo: string; texto?: string; acao?: string }) {
  return (
    <div className={`v4-toast v4-toast--${tom}`}>
      <Icon name={ICONE[tom]} />
      <div className="v4-toast__body">
        <p className="v4-toast__title">{titulo}</p>
        {texto && <p className="v4-toast__text">{texto}</p>}
      </div>
      <IconButton icon="fechar" label="Dispensar aviso" size="sm" semTooltip />
      {acao && (
        <div className="v4-toast__actions">
          <Button size="sm" variant="secondary">
            {acao}
          </Button>
        </div>
      )}
    </div>
  );
}
