import type { ReactNode } from "react";
import SelectDropdown from "../ui/SelectDropdown";
import { Button } from "../ui/Button";
import { text, type DataRecord } from "./dashboard-data";

export const fieldClass =
  "mt-1 w-full rounded-2xl border border-border bg-surface-2 px-3 py-2 text-sm";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-xs text-secondary">
      {label}
      {children}
    </label>
  );
}
export function Choice({
  label,
  value,
  onChange,
  rows,
  id,
  empty = "Sin asignar",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: DataRecord[];
  id: string;
  empty?: string;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 text-xs text-secondary">
      <span>{label}</span>
      <SelectDropdown
        aria-label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1"
        options={[
          { value: "", label: empty },
          ...rows
            .filter((row) => Boolean(row[id]))
            .map((row) => ({
              value: text(row[id]),
              label:
                text(row.name) ||
                text(row.display_name) ||
                text(row.title) ||
                text(row.email) ||
                text(row[id]),
            })),
        ]}
      />
    </div>
  );
}
export function MutationNotice({ message }: { message: string }) {
  return message ? (
    <p role="status" className="text-sm text-secondary">
      {message}
    </p>
  ) : null;
}
export function MoreButton({
  hasMore,
  loading,
  onMore,
}: {
  hasMore: boolean;
  loading?: boolean;
  onMore: () => void;
}) {
  return hasMore ? (
    <Button size="sm" variant="secondary" loading={loading} onClick={onMore}>
      Cargar más
    </Button>
  ) : null;
}
