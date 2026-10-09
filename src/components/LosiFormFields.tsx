import type { FormAnswers, FormField } from "../lib/losi-forms";
export function LosiFormFields({
  fields,
  answers,
  onChange,
  disabled = false,
}: {
  fields: FormField[];
  answers: FormAnswers;
  onChange: (value: FormAnswers) => void;
  disabled?: boolean;
}) {
  const set = (id: string, value: string | string[]) =>
    onChange({ ...answers, [id]: value });
  return (
    <div className="lf-fields">
      {fields.map((f) => {
        const id = "lf-answer-" + f.id;
        const value = answers[f.id];
        if (f.type === "multi") {
          const selected = Array.isArray(value) ? value : [];
          return (
            <fieldset key={f.id} className="lf-multi" disabled={disabled}>
              <legend>
                {f.label}
                {f.required && (
                  <span className="lf-required"> (obrigatório)</span>
                )}
              </legend>
              {f.options.map((option, i) => (
                <label key={option} className="lf-check">
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    required={f.required && selected.length === 0 && i === 0}
                    onChange={(e) =>
                      set(
                        f.id,
                        e.target.checked
                          ? [...selected, option]
                          : selected.filter((x) => x !== option),
                      )
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          );
        }
        const stringValue = typeof value === "string" ? value : "";
        return (
          <label key={f.id} htmlFor={id}>
            {f.label}
            {f.required && <span className="lf-required"> (obrigatório)</span>}
            {f.type === "textarea" ? (
              <textarea
                id={id}
                value={stringValue}
                maxLength={6000}
                required={f.required}
                disabled={disabled}
                onChange={(e) => set(f.id, e.target.value)}
              />
            ) : f.type === "select" ? (
              <select
                id={id}
                value={stringValue}
                required={f.required}
                disabled={disabled}
                onChange={(e) => set(f.id, e.target.value)}
              >
                <option value="">Escolha uma opção</option>
                {f.options.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={
                  f.type === "phone"
                    ? "tel"
                    : f.type === "text"
                      ? "text"
                      : f.type
                }
                value={stringValue}
                maxLength={1000}
                step={f.type === "number" ? "any" : undefined}
                required={f.required}
                disabled={disabled}
                onChange={(e) => set(f.id, e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
