/**
 * 1–10 scales shown as a row of weight plates: difficulty ("load"), how hard an exercise felt,
 * and the athlete's own grade of their answer.
 */
import type { ReactNode } from "react";

export const MAX_LOAD = 10;

export const loads = Array.from({ length: MAX_LOAD }, (_, index) => index + 1);

/** Effort colours: green warm-up, amber working sets, red max effort. */
export function plateColor(load: number): string {
  if (load > 7) return "bg-danger";
  if (load > 4) return "bg-amber";
  return "bg-pixel";
}

/** Grade colours, the other way round: red poor form, amber okay, green nailed it. */
export function gradeColor(grade: number): string {
  if (grade > 6) return "bg-pixel";
  if (grade > 3) return "bg-amber";
  return "bg-danger";
}

/** Read-only load display, e.g. on an exercise. */
export function LoadMeter({
  load,
  colorOf = plateColor,
}: {
  load: number;
  colorOf?: (plate: number) => string;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${load} of ${MAX_LOAD}`}
    >
      {loads.map((plate) => (
        <span
          key={plate}
          className={`h-3 w-1.5 border border-line ${plate <= load ? colorOf(plate) : "bg-paper"}`}
        />
      ))}
    </span>
  );
}

/** Pick a value from 1 to 10 by tapping a plate; `value` null means nothing picked yet. */
export function PlatePicker({
  label,
  value,
  onChange,
  colorOf = plateColor,
  lowLabel,
  highLabel,
  valueLabel,
  status,
  disabled = false,
  hint,
}: {
  label: string;
  value: number | null;
  /** The plate tapped; the caller decides what a tap on the picked plate means. */
  onChange: (value: number) => void;
  colorOf?: (plate: number) => string;
  lowLabel: string;
  highLabel: string;
  /** Shown next to the label, e.g. "nailed it"; defaults to "7/10". */
  valueLabel?: string;
  /** Shown after the value, e.g. a "✓ saved" marker. */
  status?: ReactNode;
  /** Plates can't be picked yet, e.g. before the set they belong to exists. */
  disabled?: boolean;
  /** Shown in place of "not set", e.g. why the plates are disabled. */
  hint?: string;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="flex flex-wrap items-center gap-x-2 font-display text-[9px] text-ink/70">
        {label}
        <span className="font-body text-[10px] text-faded">
          {value === null ? (hint ?? "not set") : (valueLabel ?? `${value}/${MAX_LOAD}`)}
        </span>
        {status}
      </legend>
      <div className="mt-2 flex items-center gap-1">
        {loads.map((plate) => (
          <button
            key={plate}
            type="button"
            aria-label={`${label.toLowerCase()} ${plate} of ${MAX_LOAD}`}
            aria-pressed={plate === value}
            disabled={disabled}
            onClick={() => onChange(plate)}
            className={`h-7 flex-1 border-2 border-line transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 ${
              value !== null && plate <= value ? colorOf(plate) : "bg-paper"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 flex justify-between text-[11px] text-faded">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </p>
    </fieldset>
  );
}
