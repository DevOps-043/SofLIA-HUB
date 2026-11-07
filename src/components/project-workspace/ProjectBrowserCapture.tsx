import { TextField } from "../ui/TextField";
import { useEffect, useState } from "react";
import {
  integratedBrowserService,
  type BrowserTabSummary,
} from "../../services/integrated-browser-service";
import { projectHubApi } from "../../services/project-hub-api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function ProjectBrowserCapture({
  workspaceId,
  projectId,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tabs, setTabs] = useState<BrowserTabSummary[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void integratedBrowserService
      .getTabSummaries()
      .then((result) => {
        if (!active) return;
        if (!result.success || !result.summaries) {
          setError(
            result.error || "No se pudieron consultar las páginas abiertas.",
          );
          return;
        }
        const rows = result.summaries.slice(0, 50);
        setTabs(rows);
        setSelected(
          new Set(rows.filter((row) => row.isCurrent).map((row) => row.tabId)),
        );
      })
      .catch(() => {
        if (active) setError("No se pudieron consultar las páginas abiertas.");
      });
    return () => {
      active = false;
    };
  }, []);
  const save = async () => {
    if (busy || !name.trim() || !selected.size) return;
    setBusy(true);
    setError("");
    try {
      const rows = (tabs || []).filter((row) => selected.has(row.tabId));
      const items = await Promise.all(
        rows.map(async (row, position) => {
          const content = row.text.slice(0, 51200);
          const bytes = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(content),
          );
          return {
            type: "tab" as const,
            position,
            title: row.title.slice(0, 500),
            source_url: row.url,
            content,
            source_hash: Array.from(new Uint8Array(bytes), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join(""),
            metadata: { captured_at: new Date().toISOString() },
          };
        }),
      );
      const result = await projectHubApi.createBrowserCollection(
        workspaceId,
        projectId,
        {
          name: name.trim(),
          external_reference: crypto.randomUUID(),
          version: 1,
          tabs: items,
        },
      );
      if (result.success) onSaved();
      else setError(result.error || "No se pudo guardar la investigación.");
    } catch {
      setError("No se pudo guardar la investigación.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <h3 className="text-sm font-semibold">
        Guardar investigación del navegador
      </h3>
      <p className="mt-2 text-xs text-secondary">
        Revisa las páginas y su contenido antes de compartirlos con este
        proyecto. No se guardan cookies ni sesiones.
      </p>
      <label className="mt-3 block text-xs">
        Nombre de la investigación
        <TextField
          required
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-border bg-surface-2 p-3 text-sm"
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
      {!tabs && !error && (
        <p className="mt-3 text-xs text-secondary">Consultando páginas…</p>
      )}
      <div className="my-3 max-h-72 overflow-y-auto">
        {tabs?.map((row) => (
          <label
            key={row.tabId}
            className="flex items-start gap-3 rounded-2xl p-3 text-xs hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={selected.has(row.tabId)}
              onChange={() =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(row.tabId)) next.delete(row.tabId);
                  else next.add(row.tabId);
                  return next;
                })
              }
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{row.title}</span>
              <span className="block break-all text-secondary">{row.url}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!name.trim() || !selected.size}
          loading={busy}
          onClick={() => void save()}
        >
          Guardar selección
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
