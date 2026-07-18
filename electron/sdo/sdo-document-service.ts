/**
 * Documentos como vistas del SDO.
 *
 * Genera minutas, decision records y tarjetas de contexto DESDE los
 * registros gobernados (nunca al reves) reutilizando document-designer.
 * Al aprobar un artefacto se congela el snapshot: sha256 del archivo,
 * aprobador, fecha y evento 'publicado' en la bitacora.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { SdoStore } from './sdo-store';
import { sha256Hex } from './sdo-shared';
import { registrarEvento } from './sdo-audit';
import {
  DECISION_RECORD_TEMPLATE_ID,
  DECISION_RECORD_TEMPLATE_VERSION,
  renderDecisionRecord,
} from './plantillas/plantilla-decision-record';
import { MINUTA_TEMPLATE_ID, MINUTA_TEMPLATE_VERSION, renderMinuta } from './plantillas/plantilla-minuta';
import {
  renderTarjetaContexto,
  TARJETA_TEMPLATE_ID,
  TARJETA_TEMPLATE_VERSION,
} from './plantillas/plantilla-tarjeta-contexto';

type Renderer = (options: {
  content: string;
  title: string;
  outputPath: string;
  type: 'word' | 'pdf';
  includeCover?: boolean;
}) => Promise<string>;

async function rendererPorDefecto(options: Parameters<Renderer>[0]): Promise<string> {
  const { createProfessionalDocument } = await import('./../document-designer');
  return createProfessionalDocument(options);
}

function directorioPorDefecto(): string {
  try {
    // Carga perezosa: en tests no hay proceso Electron.
    const cargar = createRequire(__filename);
    const { app } = cargar('electron');
    return path.join(app.getPath('userData'), 'sdo-artifacts');
  } catch {
    return path.join(process.cwd(), 'sdo-artifacts');
  }
}

function slug(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'documento';
}

export class SdoDocumentService {
  constructor(
    private readonly store: SdoStore,
    private readonly opts: { outputDir?: string; renderer?: Renderer } = {},
  ) {}

  private async renderizar(markdown: string, titulo: string): Promise<string> {
    const dir = this.opts.outputDir ?? directorioPorDefecto();
    fs.mkdirSync(dir, { recursive: true });
    const outputPath = path.join(dir, `${slug(titulo)}-${Date.now()}.pdf`);
    const renderer = this.opts.renderer ?? rendererPorDefecto;
    return renderer({ content: markdown, title: titulo, outputPath, type: 'pdf', includeCover: false });
  }

  async generarDecisionRecord(decisionId: string): Promise<{ artifactId: string; markdown: string; filePath: string }> {
    const decision = await this.store.obtenerDecision(decisionId);
    if (!decision) throw new Error('No encontre la decision solicitada en el SDO.');

    const approvals = await this.store.listarAprobaciones('decision', decisionId);
    const markdown = renderDecisionRecord(decision, approvals);
    const titulo = `Decision record — ${decision.statement.slice(0, 60)}`;
    const filePath = await this.renderizar(markdown, titulo);

    const artifact = await this.store.crearArtefacto({
      artifact_type: 'decision_record',
      title: titulo,
      template_id: DECISION_RECORD_TEMPLATE_ID,
      template_version: DECISION_RECORD_TEMPLATE_VERSION,
      record_refs: [{ object_type: 'decision', object_id: decisionId }],
      local_path: filePath,
      confidentiality: decision.confidentiality,
      owner_user_id: decision.owner_user_id,
      organization_id: decision.organization_id,
      trace_id: decision.trace_id,
    });

    return { artifactId: artifact.id as string, markdown, filePath };
  }

  async generarMinuta(originRef: string, titulo?: string): Promise<{ artifactId: string; markdown: string; filePath: string }> {
    const [decisiones, acciones, riesgos] = await Promise.all([
      this.store.listarDecisiones({ originRef }),
      this.store.listarAcciones({ originRef }),
      this.store.listarClaims({ originRef }),
    ]);

    if (decisiones.length === 0 && acciones.length === 0 && riesgos.length === 0) {
      throw new Error('No hay registros del SDO para esa reunion; no puedo generar la minuta desde datos vacios.');
    }

    const referencia = decisiones[0] ?? acciones[0] ?? riesgos[0];
    const tituloFinal = titulo
      || (decisiones[0]?.metadata_json?.meeting_title as string | undefined)
      || `Reunion ${originRef}`;

    const markdown = renderMinuta({
      titulo: tituloFinal,
      fecha: referencia.created_at ?? null,
      decisiones,
      acciones,
      riesgos: riesgos.filter((c) => c.claim_type === 'riesgo'),
    });

    // Confidencialidad heredada: el maximo de los registros incluidos.
    const niveles = ['P0', 'P1', 'P2', 'P3'];
    const heredada = [
      ...decisiones.map((d) => d.confidentiality),
      ...acciones.map((a) => a.confidentiality),
      ...riesgos.map((r) => r.confidentiality),
    ].reduce((max, actual) => (niveles.indexOf(actual) > niveles.indexOf(max) ? actual : max), 'P1');

    const filePath = await this.renderizar(markdown, `Minuta — ${tituloFinal}`);
    const artifact = await this.store.crearArtefacto({
      artifact_type: 'minuta',
      title: `Minuta — ${tituloFinal}`,
      template_id: MINUTA_TEMPLATE_ID,
      template_version: MINUTA_TEMPLATE_VERSION,
      record_refs: [
        ...decisiones.map((d) => ({ object_type: 'decision', object_id: d.id })),
        ...acciones.map((a) => ({ object_type: 'action', object_id: a.id })),
        ...riesgos.map((r) => ({ object_type: 'claim', object_id: r.id })),
      ],
      local_path: filePath,
      confidentiality: heredada,
      owner_user_id: referencia.owner_user_id,
      organization_id: referencia.organization_id,
      trace_id: referencia.trace_id,
    });

    return { artifactId: artifact.id as string, markdown, filePath };
  }

  /**
   * Tarjeta de contexto vigente sobre un sujeto. Devuelve el markdown
   * directamente (vista efimera): no crea artefacto salvo que se pida.
   */
  async generarTarjetaContexto(sujeto: string, opciones?: { persistir?: boolean; ownerUserId?: string }): Promise<{ markdown: string; artifactId?: string; filePath?: string }> {
    const [decisiones, claims, accionesTodas] = await Promise.all([
      this.store.listarDecisiones({ subject: sujeto }),
      this.store.listarClaims({ subject: sujeto }),
      this.store.listarAcciones({}),
    ]);

    const decisionIds = new Set(decisiones.map((d) => d.id));
    const acciones = accionesTodas.filter(
      (a) => (a.decision_id && decisionIds.has(a.decision_id)) || a.description.toLowerCase().includes(sujeto.toLowerCase()),
    );

    const markdown = renderTarjetaContexto({
      sujeto,
      decisiones,
      claims,
      acciones,
      verificadoEn: new Date().toISOString(),
    });

    if (!opciones?.persistir) return { markdown };

    const owner = opciones.ownerUserId || decisiones[0]?.owner_user_id || claims[0]?.owner_user_id;
    if (!owner) throw new Error('No puedo persistir la tarjeta sin un owner_user_id.');

    const filePath = await this.renderizar(markdown, `Tarjeta de contexto — ${sujeto}`);
    const artifact = await this.store.crearArtefacto({
      artifact_type: 'tarjeta_contexto',
      title: `Tarjeta de contexto — ${sujeto}`,
      template_id: TARJETA_TEMPLATE_ID,
      template_version: TARJETA_TEMPLATE_VERSION,
      record_refs: [
        ...decisiones.map((d) => ({ object_type: 'decision', object_id: d.id })),
        ...claims.map((c) => ({ object_type: 'claim', object_id: c.id })),
      ],
      local_path: filePath,
      owner_user_id: owner,
    });

    return { markdown, artifactId: artifact.id as string, filePath };
  }

  /**
   * Snapshot oficial: hash sha256 del archivo + aprobacion humana +
   * evento 'publicado'. Sin archivo no hay snapshot aprobable.
   */
  async aprobarArtefacto(artifactId: string, decidedByUserId: string, comment?: string): Promise<{ sha256: string }> {
    const artefacto = await this.store.obtenerArtefacto(artifactId);
    if (!artefacto) throw new Error('No encontre el artefacto solicitado en el SDO.');

    const localPath = artefacto.local_path as string | null;
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error('El artefacto no tiene archivo generado; no puedo congelar un snapshot sin archivo.');
    }

    const hash = sha256Hex(fs.readFileSync(localPath));
    const ahora = new Date().toISOString();

    await this.store.actualizarArtefacto(artifactId, {
      sha256: hash,
      approved_by_user_id: decidedByUserId,
      approved_at: ahora,
    });

    await this.store.aprobar({
      objectType: 'artifact',
      objectId: artifactId,
      decidedByUserId,
      comment,
    });

    await registrarEvento({
      actor_type: 'humano',
      actor_id: decidedByUserId,
      event_type: 'publicado',
      object_type: 'artifact',
      object_id: artifactId,
      after_json: { sha256: hash, local_path: localPath },
      trace_id: (artefacto.trace_id as string | null) ?? null,
    });

    return { sha256: hash };
  }
}
