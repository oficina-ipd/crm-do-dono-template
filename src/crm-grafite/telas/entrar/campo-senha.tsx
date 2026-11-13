"use client";

import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Button, Field } from "../../ui";
import "../../styles/telas/acesso.css";

/**
 * Campo de senha (do CRM do IPD): o campo de sempre, com o botão "Mostrar" ao lado (texto, não
 * só ícone). Sem `name`: o valor só sai daqui pelo envio em JSON da tela que o usa, nunca por um
 * formulário comum (que poderia mandar a senha no endereço).
 */
export function CampoSenha({
  label,
  help,
  error,
  required,
  ref,
  ...rest
}: { label: ReactNode; help?: ReactNode; error?: ReactNode; ref?: Ref<HTMLInputElement> } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "name">) {
  const [visivel, setVisivel] = useState(false);
  return (
    <Field label={label} help={help} error={error} required={required}>
      {(ids) => (
        <div className="v4-senha">
          <input
            ref={ref}
            {...ids}
            {...rest}
            required={required}
            type={visivel ? "text" : "password"}
            className="v4-input"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button variant="ghost" aria-pressed={visivel} aria-controls={ids.id} onClick={() => setVisivel((v) => !v)}>
            {visivel ? "Ocultar" : "Mostrar"}
            <span className="v4-sr"> a senha</span>
          </Button>
        </div>
      )}
    </Field>
  );
}
