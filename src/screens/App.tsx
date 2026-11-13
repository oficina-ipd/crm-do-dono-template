"use client";
import * as React from "react";
import { Card } from "@/ds";
import { CRMProvider, useCRM } from "@/components/crm/provider";
import type { EstadoCRM } from "@/domain/types";
import type { RepositorioCRM } from "@/repo";
import { WhatsAppOnboarding } from "@/components/crm/WhatsAppOnboarding";
// A raiz vem antes do app: o CSS base do Grafite carrega antes do CSS de cada tela.
import { RaizGrafite, type PreferenciasGrafite } from "@/crm-grafite/shell/raiz";
import { CrmGrafiteApp } from "@/crm-grafite/app";
import { useToast as useAvisoGrafite } from "@/crm-grafite/ui/toast";
import { TelaEntrar } from "@/crm-grafite/telas/entrar";
import { ModalLigacao } from "./modais/Ligacao";
import { ModalDiscagem } from "./modais/Discagem";

/** Raiz: carrega o estado do repositório, pede o operador e monta o shell v3. */
export function App({ repo }: { repo: RepositorioCRM }) {
  const [estado, setEstado] = React.useState<EstadoCRM | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ligacao, setLigacao] = React.useState<string | null>(null);
  const [discagem, setDiscagem] = React.useState(false);

  React.useEffect(() => {
    repo.carregar().then(setEstado).catch((e) => setErro(String(e.message ?? e)));
  }, [repo]);

  if (erro) {
    return (
      <div className="ds-gate">
        <Card className="ds-gate__card">
          <h1 style={{ margin: 0 }}>Não consegui carregar o CRM</h1>
          <p>{erro}</p>
          <p className="ds-muted">
            Se você definiu NEXT_PUBLIC_API_URL, confira se o servidor está no ar (<code>npm run dev</code>).
          </p>
        </Card>
      </div>
    );
  }
  if (!estado) {
    return (
      <div className="ds-gate">
        <span className="ds-label">Carregando…</span>
      </div>
    );
  }

  return (
    <RaizGrafite>
      {(prefs) => (
        <ComAvisos repo={repo} estado={estado} prefs={prefs} aoLigar={setLigacao} aoDiscar={() => setDiscagem(true)}>
          <ModalLigacao contatoId={ligacao} onClose={() => setLigacao(null)} />
          <ModalDiscagem
            open={discagem}
            onClose={() => setDiscagem(false)}
            aoLigar={(id) => {
              setDiscagem(false);
              setLigacao(id);
            }}
          />
        </ComAvisos>
      )}
    </RaizGrafite>
  );
}

/** Liga os avisos do Grafite ao provedor (sucesso e erro de regra aparecem no aviso v4). */
function ComAvisos({ repo, estado, prefs, aoLigar, aoDiscar, children }: { repo: RepositorioCRM; estado: EstadoCRM; prefs: PreferenciasGrafite; aoLigar: (id: string) => void; aoDiscar: () => void; children: React.ReactNode }) {
  const { avisar } = useAvisoGrafite();
  const avisarCrm = React.useCallback(
    (texto: string, tom: "sucesso" | "erro") => {
      avisar({ tom, titulo: texto });
    },
    [avisar],
  );
  return (
    <CRMProvider repo={repo} estadoInicial={estado} aoLigar={aoLigar} aoDiscar={aoDiscar} avisar={avisarCrm}>
      <Interno prefs={prefs} />
      {children}
    </CRMProvider>
  );
}

function Interno({ prefs }: { prefs: PreferenciasGrafite }) {
  const crm = useCRM();
  if (!crm.operador) {
    return (
      <TelaEntrar
        nomeEmpresa={crm.estado.config.nomeEmpresa}
        operadores={crm.estado.operadores.filter((o) => o.tipo === "humano" && o.ativo)}
        aoEntrar={crm.entrar}
        rodape={<WhatsAppOnboarding compact />}
      />
    );
  }
  return <CrmGrafiteApp prefs={prefs} />;
}
