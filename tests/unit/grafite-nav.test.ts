import { describe, expect, it } from "vitest";
import { caminhoV4, gruposNavV4, idAtivoV4, itensMenuUsuarioV4, itensNavV4 } from "@/crm-grafite/nav";
import { rotaDoCaminho, SO_GESTOR } from "@/crm-grafite/rotas";

describe("rotas do Grafite", () => {
  it("início e rotas antigas do v3 continuam valendo", () => {
    expect(rotaDoCaminho("/").tela).toBe("painel");
    expect(rotaDoCaminho("/fila").tela).toBe("fila");
    expect(rotaDoCaminho("/painel").tela).toBe("painel");
    expect(rotaDoCaminho("/hoje").tela).toBe("fila");
    expect(rotaDoCaminho("/leads").tela).toBe("pessoas");
    expect(rotaDoCaminho("/clientes?q=ana").tela).toBe("pessoas");
    expect(rotaDoCaminho("/integracoes").tela).toBe("integrar");
    expect(rotaDoCaminho("/relatorios").tela).toBe("resultados");
    expect(rotaDoCaminho("/funil/").tela).toBe("funil");
  });

  it("ficha pega o id do contato (com query e codificação)", () => {
    expect(rotaDoCaminho("/contatos/c1")).toEqual({ tela: "ficha", id: "c1" });
    expect(rotaDoCaminho("/contatos/c%201?de=conversas")).toEqual({ tela: "ficha", id: "c 1" });
    expect(rotaDoCaminho("/contatos/").tela).toBe("pessoas");
  });

  it("rota desconhecida não cai numa tela qualquer", () => {
    expect(rotaDoCaminho("/nao-existe").tela).toBe("desconhecida");
  });

  it("configuração é só do gestor", () => {
    for (const t of ["produtos", "equipe", "modelos", "playbook", "integrar", "metas"] as const) {
      expect(SO_GESTOR).toContain(t);
    }
    expect(SO_GESTOR).not.toContain("fila");
  });
});

describe("navegação do Grafite", () => {
  it("cada item do menu leva a uma tela conhecida", () => {
    const todos = [...itensNavV4("gestor"), ...itensMenuUsuarioV4("gestor")];
    for (const i of todos) expect(rotaDoCaminho(i.href).tela).not.toBe("desconhecida");
  });

  it("vendedor não vê itens de gestor nem a configuração", () => {
    const ids = itensNavV4("vendedor").map((i) => i.id);
    expect(ids).not.toContain("metas");
    expect(ids).not.toContain("sessao");
    expect(itensMenuUsuarioV4("vendedor").map((i) => i.id)).toEqual(["conta"]);
  });

  it("gestor tem Relance e Ligações no menu e configuração no menu do usuário", () => {
    const ids = itensNavV4("gestor").map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["fila", "conversas", "funil", "pessoas", "tarefas", "agentes", "relance", "ligacoes"]));
    expect(itensMenuUsuarioV4("gestor").map((i) => i.id)).toEqual(["conta", "produtos", "equipe", "modelos", "playbook", "integrar"]);
    expect(gruposNavV4("gestor").map((g) => g.id)).toEqual(["inicio", "atender", "vender", "agentes", "resultados", "rotina"]);
  });

  it("item ativo e caminho do cabeçalho", () => {
    const itens = itensNavV4("gestor");
    expect(idAtivoV4(itens, "/")).toBe("painel");
    expect(idAtivoV4(itens, "/fila")).toBe("fila");
    expect(idAtivoV4(itens, "/hoje")).toBe("fila");
    expect(idAtivoV4(itens, "/leads")).toBe("pessoas");
    expect(caminhoV4("gestor", "/contatos/c1")).toEqual({ grupo: "Pessoas", item: "Ficha" });
    expect(caminhoV4("gestor", "/config/produtos")).toEqual({ grupo: "Configuração", item: "Produtos" });
    expect(caminhoV4("gestor", "/integracoes")).toEqual({ grupo: "Configuração", item: "Integrações" });
  });
});
