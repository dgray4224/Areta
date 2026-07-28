import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={fieldClass} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={fieldClass} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={fieldClass} rows={props.rows ?? 3} />;
}

/** Use as `register(name, { setValueAs: optionalNumberValue })` for
 * optional numeric fields. react-hook-form's `valueAsNumber: true` turns an
 * empty input into `NaN` rather than `undefined`, which fails
 * `z.number().optional()` with a confusing "expected number, received NaN"
 * error instead of just treating a blank field as not answered. */
export function optionalNumberValue(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

/** Use as `register(name, { setValueAs: optionalStringValue })` for an
 * optional `<select>` with a blank placeholder option (`<option value="">`).
 * Without this, the placeholder submits `""`, which fails
 * `z.enum([...]).optional()` — only `undefined` is treated as "not
 * answered", not the empty string a blank <select> naturally produces. */
export function optionalStringValue(value: string): string | undefined {
  return value === "" ? undefined : value;
}
