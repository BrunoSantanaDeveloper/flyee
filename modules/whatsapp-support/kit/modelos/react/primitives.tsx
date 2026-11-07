// A ponte entre as telas do atendimento e o design system do projeto.
// As telas usam só estes componentes; para adaptar ao DS (MUI, shadcn, o próprio), troque o corpo
// de cada um pelo componente equivalente do projeto e mantenha as mesmas props.

import type { ReactNode } from "react";

export function Stack({ children, gap = 16, direction = "column" }: { children: ReactNode; gap?: number; direction?: "row" | "column" }) {
  return <div style={{ display: "flex", flexDirection: direction, gap, flexWrap: direction === "row" ? "wrap" : undefined }}>{children}</div>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section style={{ border: "1px solid var(--borda, #ddd)", borderRadius: 8, padding: 16 }}>
      {title ? <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Text({ children, tone = "normal" }: { children: ReactNode; tone?: "normal" | "muted" | "danger" }) {
  const color = tone === "muted" ? "var(--texto-suave, #666)" : tone === "danger" ? "var(--perigo, #b00020)" : undefined;
  return <p style={{ margin: 0, color }}>{children}</p>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  secret,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  secret?: boolean;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{label}</span>
      <input type={secret ? "password" : "text"} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} autoComplete="off" />
      {error ? <Text tone="danger">{error}</Text> : hint ? <Text tone="muted">{hint}</Text> : null}
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  hint,
  error,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  rows?: number;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? <Text tone="danger">{error}</Text> : hint ? <Text tone="muted">{hint}</Text> : null}
    </label>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input type="radio" checked={value === option.value} onChange={() => onChange(option.value)} />
          <span>
            {option.label}
            {option.hint ? <Text tone="muted">{option.hint}</Text> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        {label}
        {hint ? <Text tone="muted">{hint}</Text> : null}
      </span>
    </label>
  );
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "danger" | "success" }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} data-tone={tone} style={{ border: "1px solid currentColor", borderRadius: 8, padding: 12 }}>
      {children}
    </div>
  );
}

export function Loading({ label = "Carregando" }: { label?: string }) {
  return <Text tone="muted">{label}...</Text>;
}
