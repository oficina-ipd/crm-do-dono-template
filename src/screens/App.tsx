"use client";
import * as React from "react";
import { ErrorState } from "@/crm-grafite/ui/states";
import { CRMProvider, useCRM } from "@/components/crm/provider";
import type { EstadoCRM } from "@/domain/types";
import type { RepositorioCRM } from "@/repo";
import { PainelWhatsApp } from "@/crm-grafite/telas/integrar/whatsapp";
// A raiz vem antes do app: o CSS base do Grafite carrega antes do CSS de cada tela.
import { RaizGrafite, type PreferenciasGrafite } from "@/crm-grafite/shell/raiz";
import { CrmGrafiteApp } from "@/crm-grafite/app";
import { useToast as useAvisoGrafite } from "@/crm-grafite/ui/toast";
import { TelaEntrar } from "@/crm-grafite/telas/entrar";
import { ModalLigacaoGrafite as ModalLigacao } from "@/crm-grafite/telas/ligacoes/modal-ligacao";
import { ModalDiscagemGrafite as ModalDiscagem } from "@/crm-grafite/telas/ligacoes/modal-discagem";

/** Raiz: carrega o estado do repositório, pede o operador e monta o CRM no visual Grafite. */
export function App({ repo }: { repo: RepositorioCRM }) {
  const [estado, setEstado] = React.useState<EstadoCRM | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ligacao, setLigacao] = React.useState<string | null>(null);
  const [discagem, setDiscagem] = React.useState(false);

  React.useEffect(() => {
    repo.carregar().then(setEstado).catch((e) => setErro(String(e.message ?? e)));
  }, [repo]);

  if (erro || !estado) {
    return (
      <RaizGrafite>
        {() => (
          <main className="v4-entrada-estado" data-v4-tela="carregando">
            {erro ? (
              <ErrorState
                nivel={1}
                titulo="Não consegui carregar o CRM"
                texto={`${erro}. Se você definiu NEXT_PUBLIC_API_URL, confira se o servidor está no ar (npm run dev).`}
                aoTentar={() => window.location.reload()}
              />
            ) : (
              <p className="v4-t-meta" role="status">
                Carregando o CRM…
              </p>
            )}
          </main>
        )}
      </RaizGrafite>
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
        rodape={<PainelWhatsApp compacto />}
      />
    );
  }
  return <CrmGrafiteApp prefs={prefs} />;
}
