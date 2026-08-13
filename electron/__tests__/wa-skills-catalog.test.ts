import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSystemSkillEnabled, systemSkillsForSurface } from '../../src/shared/skills/registry';
import { PRESENTACIONES_SKILL, PRESENTACIONES_SKILL_ID } from '../../src/shared/skills/presentaciones-skill';
import type { SystemSkillRow } from '../../src/shared/skills/types';

/**
 * El catalogo de Skills en WhatsApp debe respetar las guardas de la
 * superficie: una Skill no habilitada aqui no se ejecuta, y una bloqueada en
 * grupos no puede invocarse desde una conversacion de grupo.
 *
 * Desde que el catalogo vive en la base de datos, se comprueba ademas que
 * WhatsApp resuelve LO MISMO que el chat: leer de sitios distintos dejaria una
 * Skill retirada viva en una de las dos superficies.
 */

const filas = vi.hoisted(() => ({ valor: null as SystemSkillRow[] | null }));

vi.mock('../hub-db-client', () => ({
  getHubDbClient: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve(
          filas.valor === null
            ? { data: null, error: { message: 'sin conexion' } }
            : { data: filas.valor, error: null },
        ),
      }),
    }),
  }),
}));

const { availableWhatsAppSkills, buildSkillsCommandText, resolveWhatsAppSkill } =
  await import('../wa-agent/chat-commands/skills');
const { resetSystemSkillsCache, systemSkillsFor } =
  await import('../skill-catalog/system-skills-store');

function fila(extra: Partial<SystemSkillRow> = {}): SystemSkillRow {
  return {
    id: PRESENTACIONES_SKILL_ID,
    name: 'Presentaciones',
    instructions: 'Instrucciones de la skill.',
    surfaces: ['chat', 'whatsapp'],
    enabled: true,
    blocked_in_groups: true,
    ...extra,
  };
}

describe('catalogo de skills en WhatsApp', () => {
  const originalFlag = process.env.VITE_SKILL_PRESENTACIONES_ENABLED;

  beforeEach(() => {
    process.env.VITE_SKILL_PRESENTACIONES_ENABLED = 'true';
    // Por defecto, sin catalogo remoto: se resuelve el respaldo en codigo.
    filas.valor = null;
    resetSystemSkillsCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.VITE_SKILL_PRESENTACIONES_ENABLED;
    else process.env.VITE_SKILL_PRESENTACIONES_ENABLED = originalFlag;
    vi.restoreAllMocks();
  });

  it('ofrece las skills habilitadas para la superficie en conversacion individual', async () => {
    const skills = await availableWhatsAppSkills(false);

    expect(skills.map((skill) => skill.id)).toContain(PRESENTACIONES_SKILL_ID);
  });

  it('oculta en grupos las skills bloqueadas para grupos', async () => {
    const skills = await availableWhatsAppSkills(true);

    expect(skills.map((skill) => skill.id)).not.toContain(PRESENTACIONES_SKILL_ID);
  });

  it('permite ejecutar la skill por privado', async () => {
    const result = await resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, false);

    expect(result.ok).toBe(true);
  });

  it('rechaza la skill en un grupo explicando el motivo', async () => {
    const result = await resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('grupos');
      // El rechazo no debe filtrar contenido de la conversacion individual.
      expect(result.message).not.toContain('@s.whatsapp.net');
    }
  });

  it('rechaza una skill desconocida', async () => {
    const result = await resolveWhatsAppSkill('sistema:inexistente', false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('No conozco');
  });

  it('rechaza una skill deshabilitada por bandera e indica donde usarla', async () => {
    process.env.VITE_SKILL_PRESENTACIONES_ENABLED = 'false';

    const result = await resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('No conozco');
  });

  it('el comando /skills lista las disponibles', async () => {
    const texto = await buildSkillsCommandText(false);

    expect(texto).toContain('Presentaciones');
  });

  it('el comando /skills en grupo explica que no hay ninguna', async () => {
    const texto = await buildSkillsCommandText(true);

    expect(texto).toContain('privado');
  });

  /**
   * La bandera local es el interruptor de emergencia: debe leerse del entorno
   * REAL en cada llamada. Una version anterior resolvia el entorno una sola vez
   * desde `import.meta.env`, lo que congelaba el valor en tiempo de build.
   */
  it('la bandera se relee del entorno en cada consulta', async () => {
    expect(await availableWhatsAppSkills(false)).not.toHaveLength(0);

    process.env.VITE_SKILL_PRESENTACIONES_ENABLED = 'false';

    expect(await availableWhatsAppSkills(false)).toHaveLength(0);
  });

  it('una capacidad publicada NO desaparece porque falte su variable', async () => {
    // Es el fallo reportado: el instalador se genero sin
    // VITE_SKILL_PRESENTACIONES_ENABLED, el build termino en verde y la version
    // publicada salio sin la Skill —ni comando, ni biblioteca— para todos.
    delete process.env.VITE_SKILL_PRESENTACIONES_ENABLED;

    expect(await availableWhatsAppSkills(false)).not.toHaveLength(0);
    expect(systemSkillsForSurface('chat')).not.toHaveLength(0);
    expect(systemSkillsForSurface('whatsapp')).not.toHaveLength(0);
  });

  it('la bandera sigue sirviendo para apagarla sin publicar version', () => {
    expect(systemSkillsForSurface('chat', { VITE_SKILL_PRESENTACIONES_ENABLED: 'false' })).toHaveLength(0);
    expect(systemSkillsForSurface('chat', { VITE_SKILL_PRESENTACIONES_ENABLED: '0' })).toHaveLength(0);
  });

  it('una capacidad en desarrollo si queda apagada mientras no se declare', () => {
    // El valor por defecto solo cambia para las Skills que lo piden: una nueva
    // sin `enabledByDefault` no puede aparecer sola en una version publicada.
    const enDesarrollo = { ...PRESENTACIONES_SKILL, enabledByDefault: undefined };

    expect(isSystemSkillEnabled(enDesarrollo)).toBe(false);
    expect(isSystemSkillEnabled(enDesarrollo, { VITE_SKILL_PRESENTACIONES_ENABLED: 'true' })).toBe(true);
  });

  describe('catalogo remoto', () => {
    it('la fila manda sobre la version instalada', async () => {
      filas.valor = [fila({ name: 'Presentaciones ejecutivas' })];
      resetSystemSkillsCache();

      const skills = await availableWhatsAppSkills(false);

      expect(skills.map((skill) => skill.name)).toContain('Presentaciones ejecutivas');
    });

    it('una fila deshabilitada la retira tambien de WhatsApp', async () => {
      filas.valor = [fila({ enabled: false })];
      resetSystemSkillsCache();

      expect(await availableWhatsAppSkills(false)).toHaveLength(0);
      const result = await resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, false);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain('No conozco');
    });

    it('una skill sin la superficie whatsapp no se ofrece ni se puede invocar', async () => {
      filas.valor = [fila({ surfaces: ['chat'] })];
      resetSystemSkillsCache();

      expect(await availableWhatsAppSkills(false)).toHaveLength(0);
      const result = await resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, false);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain('no esta disponible por WhatsApp');
    });

    it('chat y WhatsApp resuelven la misma fila con el mismo acotado', async () => {
      filas.valor = [fila({
        name: 'Informes',
        tools: ['workspace_write_file', 'execute_command'],
      })];
      resetSystemSkillsCache();

      const enChat = await systemSkillsFor('chat');
      const enWhatsApp = await systemSkillsFor('whatsapp');

      expect(enChat[0].name).toBe(enWhatsApp[0].name);
      expect(enChat[0].tools).toEqual(['workspace_write_file']);
      expect(enWhatsApp[0].tools).toEqual(['workspace_write_file']);
    });

    it('sin cliente de base de datos se resuelve el respaldo en codigo', async () => {
      filas.valor = null;
      resetSystemSkillsCache();

      const skills = await availableWhatsAppSkills(false);

      expect(skills.map((skill) => skill.id)).toContain(PRESENTACIONES_SKILL_ID);
    });
  });
});
