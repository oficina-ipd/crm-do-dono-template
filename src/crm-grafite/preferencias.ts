/**
 * Preferências visuais da v4 (densidade e modo sólido).
 * Gravadas em cookie (o servidor lê e já renderiza o atributo certo: sem piscar) e
 * espelhadas em localStorage (sobrevivem se o cookie for limpo; o script de entrada
 * reaplica antes da pintura).
 */
export const COOKIE_DENSIDADE_V4 = "crm_v4_densidade";
export const COOKIE_SOLIDO_V4 = "crm_v4_solido";
/** Menu do Grafite: só ícones (56 px, padrão) ou com os nomes (184 px). */
export const COOKIE_MENU_V4 = "crm_v4_menu";

export type DensidadeV4 = "compact" | "comfortable";

export function densidadeV4(v: unknown): DensidadeV4 {
  return v === "comfortable" ? "comfortable" : "compact";
}

export function solidoV4(v: unknown): boolean {
  return v === "1";
}

export type MenuV4 = "icones" | "nomes";

export function menuV4(v: unknown): MenuV4 {
  return v === "nomes" ? "nomes" : "icones";
}

const UM_ANO = 60 * 60 * 24 * 365;

function gravar(nome: string, valor: string) {
  document.cookie = `${nome}=${valor}; path=/; max-age=${UM_ANO}; samesite=lax`;
  try {
    window.localStorage.setItem(nome, valor);
  } catch {
    /* armazenamento bloqueado: o cookie basta */
  }
}

/** Só no cliente. Aplica na raiz e grava. */
export function definirDensidadeV4(d: DensidadeV4) {
  document.querySelectorAll<HTMLElement>(".crm-v4-root").forEach((el) => el.setAttribute("data-density", d));
  gravar(COOKIE_DENSIDADE_V4, d);
}

export function definirSolidoV4(ligado: boolean) {
  document.querySelectorAll<HTMLElement>(".crm-v4-root").forEach((el) => {
    if (ligado) el.setAttribute("data-solid", "1");
    else el.removeAttribute("data-solid");
  });
  gravar(COOKIE_SOLIDO_V4, ligado ? "1" : "0");
}

/** Só no cliente. Abre (nomes) ou fecha (ícones) o menu do Grafite e grava. */
export function definirMenuV4(m: MenuV4) {
  document.querySelectorAll<HTMLElement>('.crm-v4-root[data-visual="grafite"]').forEach((el) => el.setAttribute("data-menu", m));
  gravar(COOKIE_MENU_V4, m);
}

/**
 * Roda antes da pintura, logo após a abertura da raiz: se o cookie sumiu mas o
 * localStorage tem a escolha, reaplica e recria o cookie.
 */
export const scriptPreferenciasV4 = `(function(){try{var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;var c=document.cookie;function tem(n){return c.indexOf(n+'=')>-1}var d=localStorage.getItem('${COOKIE_DENSIDADE_V4}');if(d&&!tem('${COOKIE_DENSIDADE_V4}')&&(d==='compact'||d==='comfortable')){r.setAttribute('data-density',d);document.cookie='${COOKIE_DENSIDADE_V4}='+d+'; path=/; max-age=${UM_ANO}; samesite=lax'}var s=localStorage.getItem('${COOKIE_SOLIDO_V4}');if(s&&!tem('${COOKIE_SOLIDO_V4}')){if(s==='1')r.setAttribute('data-solid','1');document.cookie='${COOKIE_SOLIDO_V4}='+s+'; path=/; max-age=${UM_ANO}; samesite=lax'}var m=localStorage.getItem('${COOKIE_MENU_V4}');if(m&&!tem('${COOKIE_MENU_V4}')&&(m==='icones'||m==='nomes')){if(r.getAttribute('data-visual')==='grafite')r.setAttribute('data-menu',m);document.cookie='${COOKIE_MENU_V4}='+m+'; path=/; max-age=${UM_ANO}; samesite=lax'}}catch(e){}})();`;
