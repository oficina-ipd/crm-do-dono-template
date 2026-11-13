"use client";

import * as React from "react";
import { useCRM } from "@/components/crm/provider";
import { EspecimesV4 } from "./especimes/especimes";
import { usePathname } from "./link";
import { badgesNavV4, type CrmPapelNav } from "./nav";
import type { PreferenciasGrafite } from "./shell/raiz";
import { CrmV4Shell } from "./shell/shell";
import { ProvedorBuscaPessoas } from "./shell/fonte-busca";
import type { BuscarPessoas } from "./shell/palette";
import { buscarPessoasV4, type LinhaPessoaV4 } from "./busca";
import { rotaDoCaminho, SO_GESTOR, type TelaId } from "./rotas";
import { PermissionState } from "./ui/states";
import { FaixaTopo } from "./ui/estrutura";
import { TelaPendente } from "./telas/pendente";
import { TelaAgentes } from "./telas/agentes";
import { TelaConversas } from "./telas/conversas";
import { TelaEquipe } from "./telas/equipe";
import { TelaFicha } from "./telas/ficha";
import { TelaFila } from "./telas/fila";
import { TelaFunil } from "./telas/funil";
import { TelaIntegrar } from "./telas/integrar";
import { TelaLigacoes } from "./telas/ligacoes";
import { TelaMetas } from "./telas/metas";
import { TelaModelos } from "./telas/modelos";
import { TelaOcorrencias } from "./telas/ocorrencias";
import { TelaOrigem } from "./telas/origem";
import { TelaPessoas } from "./telas/pessoas";
import { TelaPlaybook } from "./telas/playbook";
import { TelaProdutos } from "./telas/produtos";
import { TelaRelance } from "./telas/relance";
import { TelaResultados } from "./telas/resultados";
import { TelaSessaoFechada } from "./telas/sessao-fechada";
import { TelaTarefas } from "./telas/tarefas";
import { categoria } from "@/domain/rules";

/** Papel do operador do template → papel da navegação. `leitura` e `bot` navegam como vendedor. */
export function papelNavGrafite(papel: string | undefined): CrmPapelNav {
  return papel === "dono" ? "gestor" : "vendedor";
}

const TELAS: Record<Exclude<TelaId, "ficha" | "especimes" | "desconhecida">, () => React.ReactNode> = {
  fila: () => <TelaFila />,
  conversas: () => <TelaConversas />,
  funil: () => <TelaFunil />,
  pessoas: () => <TelaPessoas />,
  tarefas: () => <TelaTarefas />,
  agentes: () => <TelaAgentes />,
  relance: () => <TelaRelance />,
  resultados: () => <TelaResultados />,
  origem: () => <TelaOrigem />,
  metas: () => <TelaMetas />,
  "sessao-fechada": () => <TelaSessaoFechada />,
  ocorrencias: () => <TelaOcorrencias />,
  ligacoes: () => <TelaLigacoes />,
  integrar: () => <TelaIntegrar />,
  produtos: () => <TelaProdutos />,
  equipe: () => <TelaEquipe />,
  modelos: () => <TelaModelos />,
  playbook: () => <TelaPlaybook />,
};

/** Casca Grafite + a tela da rota atual. O operador já entrou. */
export function CrmGrafiteApp({ prefs }: { prefs: PreferenciasGrafite }) {
  const { estado, operador, sair, contatos } = useCRM();
  const caminho = usePathname();
  const rota = rotaDoCaminho(caminho);
  const papel = papelNavGrafite(operador?.papel);
  const nome = operador?.nome ?? "Operador";

  const badges = React.useMemo(() => {
    const handoffs = estado.contatos.filter((c) => c.handoffPendente).length;
    const fimDoDia = new Date();
    fimDoDia.setHours(23, 59, 59, 999);
    const tarefas = estado.tarefas.filter((t) => !t.feita && (!t.venceEm || Date.parse(t.venceEm) <= fimDoDia.getTime())).length;
    return badgesNavV4({ handoffs, tarefas });
  }, [estado.contatos, estado.tarefas]);

  // ⌘K busca pessoas no estado local (nome ou telefone), sempre com contato mascarado.
  const buscar = React.useCallback<BuscarPessoas>(
    async (q) => {
      const { pessoas } = await buscarPessoasV4(q, async (c, limite) => {
        const termo = c.tipo === "nome" ? c.termo.toLocaleLowerCase("pt-BR") : c.digitos;
        const linhas: LinhaPessoaV4[] = [];
        for (const p of contatos) {
          const casa =
            c.tipo === "nome"
              ? `${p.nome} ${p.empresa}`.toLocaleLowerCase("pt-BR").includes(termo)
              : p.telefone.replace(/\D/g, "").includes(termo);
          if (!casa) continue;
          linhas.push({ id: p.id, nome: p.nome, empresa: p.empresa, whatsapp: p.telefone, email: p.email, tipo: categoria(p.oportunidades) });
          if (linhas.length >= limite) break;
        }
        return linhas;
      });
      return pessoas;
    },
    [contatos],
  );

  let tela: React.ReactNode;
  if (rota.tela === "ficha") {
    tela = <TelaFicha key={rota.id} contatoId={rota.id ?? ""} />;
  } else if (rota.tela === "especimes") {
    tela = <EspecimesV4 visual="grafite" />;
  } else if (rota.tela === "desconhecida") {
    tela = <TelaPendente titulo="Tela não encontrada" />;
  } else if (SO_GESTOR.includes(rota.tela) && papel !== "gestor") {
    tela = (
      <div className="v4-tela" data-v4-tela="sem-permissao">
        <FaixaTopo titulo="Sem permissão" />
        <PermissionState nivel={2} titulo="Esta tela é do dono" texto="Peça ao dono do CRM para fazer este ajuste ou para mudar o seu papel em Equipe." />
      </div>
    );
  } else {
    tela = TELAS[rota.tela]();
  }

  return (
    <ProvedorBuscaPessoas buscar={buscar}>
      <CrmV4Shell
        papel={papel}
        nome={nome}
        badges={badges}
        densidade={prefs.densidade}
        solido={prefs.solido}
        menu={prefs.menu}
        grafite
        relanceLigado
        ligacoesLigadas
        marca={`CRM · ${estado.config.nomeEmpresa}`}
        aoSair={sair}
      >
        {tela}
      </CrmV4Shell>
    </ProvedorBuscaPessoas>
  );
}
