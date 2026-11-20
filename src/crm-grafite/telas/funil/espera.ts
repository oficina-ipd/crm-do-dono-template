/**
 * Espera da busca (debounce) controlada pela tela, não pelo campo: assim "Limpar filtros"
 * consegue cancelar o disparo pendente e o termo digitado não volta depois de limpo.
 */
export type Espera = { mudar: (v: string) => void; cancelar: () => void };

export function criarEspera(ms: number, aoDisparar: (v: string) => void): Espera {
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    mudar(v) {
      if (t !== undefined) clearTimeout(t);
      t = setTimeout(() => {
        t = undefined;
        aoDisparar(v);
      }, ms);
    },
    cancelar() {
      if (t !== undefined) clearTimeout(t);
      t = undefined;
    },
  };
}
