import { useState } from 'react';

/**
 * ChangelogFeatures — Muestra las versiones de Pulse Hub en una línea de tiempo
 * interactiva de alta fidelidad, minimalista y premium.
 */

interface VersionData {
  version: string;
  date: string;
  rawDate: string;
  mejoras: string[];      // Added
  cambios: string[];      // Changed
  correcciones: string[];  // Fixed
}

const RECENT_VERSIONS: VersionData[] = [
  {
    version: '0.5.3',
    rawDate: '2026-06-20',
    date: '20 de junio de 2026',
    mejoras: [
      'Tareas programadas en WhatsApp: El agente ahora puede crear, listar y cancelar tareas programadas directamente desde la conversación con contexto de memoria activa.',
      'Auto-extracción de hechos: Gemini extrae automáticamente hechos estructurados tras cada resumen de sesión (preferencias, contexto de trabajo, personas clave, compromisos).',
      'Gestión de aplicaciones: Nuevas herramientas para gestionar procesos y aplicaciones desde WhatsApp con verificación post-lanzamiento.'
    ],
    cambios: [
      'Memoria de largo plazo reforzada: El contexto del agente ahora incluye los últimos 5 resúmenes de sesión (antes solo el más reciente) para recordar conversaciones de semanas atrás.',
      'Timeline recall ampliado: Las consultas de memoria temporal ("hace dos semanas", "la semana pasada") ahora recuperan hasta 30 mensajes del periodo en lugar de 16.',
      'Sección de resúmenes con contexto cronológico: El formateador de contexto etiqueta cada bloque de resumen con su rango de fechas.',
      'UNIQUE INDEX en tabla facts: Se agregó el índice único sobre (COALESCE(phone_number,\'\'), category, fact_key) para funcionamiento correcto de upsert.',
      'Historial en SQLite guarda ambos roles: sqlite guarda tanto el mensaje del usuario como la respuesta del modelo en SQLite para pares completos.'
    ],
    correcciones: [
      'Pérdida de contexto entre mensajes: Corregido bug crítico donde el agente olvidaba lo conversado por falta de sincronización del historial.',
      'open_application reportaba éxito: Se corrigió la coincidencia de procesos de sistema sin título como explorer.exe agregando filtro de título.',
      'Lanzamiento sin verificación de ventana: open_application ahora espera 1.8 segundos post-lanzamiento y verifica si la ventana existe.'
    ]
  },
  {
    version: '0.5.2',
    rawDate: '2026-05-29',
    date: '29 de mayo de 2026',
    mejoras: [
      'Guardia de intención para herramientas operativas: El agentic loop bloquea herramientas operativas (computadora, archivos, comandos) cuando el mensaje actual no solicita una acción explícita.',
      'Cobertura de regresión para interacciones pasivas: Nuevos tests verifican que stickers, reacciones o saludos vacíos no activan respuestas ni herramientas.'
    ],
    cambios: [
      'Prompt de WhatsApp menos agresivo: Las reglas distinguen entre solicitud clara e interacciones pasivas, evitando ejecuciones accidentales.',
      'Detección de acciones más precisa: La palabra "puedes" ya no activa herramientas por sí sola si no acompaña un verbo operativo claro.',
      'Confirmaciones HITL más claras: Se mejoró el texto de confirmación indicando explícitamente cómo cancelar si no fue solicitada la acción.'
    ],
    correcciones: [
      'Stickers y reacciones activos: WhatsApp ahora registra interacciones pasivas de stickers/reacciones sin enviar mensajes al agente.',
      'Archivos y flujos sin solicitud: Se bloqueó el envío de archivos si el usuario no lo ha pedido explícitamente en el turno actual.',
      'Fuga de razonamiento interno: Se eliminan bloques de procesamiento interno como custom_theme o slides_json del texto final enviado.'
    ]
  },
  {
    version: '0.5.1',
    rawDate: '2026-05-28',
    date: '28 de mayo de 2026',
    mejoras: [],
    cambios: [
      'Migración a Gemini 3.5 Flash como modelo principal: Actualizado en el agente de WhatsApp, memoria, resúmenes, proactivo y desktop agent.',
      'Migración a Gemini 3.1 Flash-Lite como modelo de respaldo: Reemplaza a gemini-2.5-flash en resúmenes diarios, transcripciones y flujos de trabajo.',
      'Modelo Pro actualizado: gemini-2.5-pro reemplazado por gemini-3.1-pro-preview en desktop agent y flujos de presentaciones.',
      'Selector de modelos actualizado: UI ofrece opciones actualizadas (SofLIA, SofLIA Pro, SofLIA Lite) y elimina modelos obsoletos.'
    ],
    correcciones: [
      'Búsquedas web con CAPTCHA: Se migró la herramienta de búsqueda de DuckDuckGo a la API oficial googleSearchRetrieval de Gemini para evitar bloqueos.'
    ]
  },
  {
    version: '0.5.0',
    rawDate: '2026-05-28',
    date: '28 de mayo de 2026',
    mejoras: [
      'Sistema de control de acceso WhatsApp: Implementado número maestro, permisos granulares por contacto en 11 categorías y filtrado de herramientas.',
      'Tarjeta de Acceso Maestro en la UI: Nuevo panel visual para configurar el número maestro y gestionar individualmente los permisos de contactos.',
      'Comando /permisos en WhatsApp: Permite listar, otorgar y revocar permisos de chats mediante comandos directos del número maestro.',
      'Nombre del agente dinámico: Reemplazo dinámico de AGENT_NAME por el displayName del perfil activo en el system prompt.',
      'Tareas programadas de ejecución única: Soporte para programar una tarea para ejecutarse una sola vez y auto-eliminarse después de su ejecución.',
      'Flexibilidad tonal en personalización: Instrucciones de tono adaptativas (profesional vs. casual) con reglas para conversaciones informales.'
    ],
    cambios: [
      'Visibilidad de herramientas por permisos: buildWhatsAppToolDeclarations excluye automáticamente herramientas que el remitente no tiene permitidas.',
      'Guardias de ejecución: evaluateToolGuards comprueba los privilegios del emisor antes de disparar herramientas e informa sobre permisos faltantes.',
      'Whitelist bypass para número maestro: Bypass automático de seguridad para el número administrador en todas las comprobaciones.'
    ],
    correcciones: [
      'Tareas cron de ejecución única: Corregido el disparo erróneo de tareas programadas validando los minutos exactos antes del trigger.'
    ]
  },
  {
    version: '0.4.0',
    rawDate: '2026-05-27',
    date: '27 de mayo de 2026',
    mejoras: [
      'Historial de conversaciones WhatsApp en JSONL: Almacenamiento local estructurado de todos los eventos del chat con filtros por contacto, fecha y contenido.',
      'Timeline Recall de memoria: Recuperación en lenguaje natural de fragmentos de historial indexados mediante consultas temporales ("¿qué hablamos ayer?").',
      'Tarjeta de Historial en la UI de WhatsApp: Visor en tiempo real con estadísticas de mensajes, herramientas ejecutadas y multimedia de la sesión.'
    ],
    cambios: [
      'Retención de memoria extendida a 10 años: CompactOldData extendida a 3650 días para no perder historial de conversaciones histórico.',
      'Contexto de memoria con recuerdos fechados: El system prompt ahora inyecta recuerdos recuperados por timeline recall bajo un bloque fechado.'
    ],
    correcciones: [
      'Pérdida de JID en llamadas indirectas: Corregido mapeo de identificadores al normalizar el formato de números telefónicos.'
    ]
  }
];

function formatSpanishDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  
  return `${day} de ${months[monthIndex] || ''} de ${year}`;
}

export function parseReleaseNotes(notes: string, fallbackVersion: string): VersionData {
  const data: VersionData = {
    version: fallbackVersion,
    date: '',
    rawDate: '',
    mejoras: [],
    cambios: [],
    correcciones: []
  };

  if (!notes) return data;

  const lines = notes.split('\n');
  let currentSection: 'added' | 'changed' | 'fixed' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#')) {
      const headerMatch = trimmed.match(/#+\s*(?:v|\[)?([0-9.]+)(?:\])?\s*-\s*([0-9-]+)/i) || 
                          trimmed.match(/#+\s*(?:v|\[)?([0-9.]+)(?:\])?\s*\(([^)]+)\)/i);
      if (headerMatch) {
        data.version = headerMatch[1];
        data.rawDate = headerMatch[2].trim();
        data.date = formatSpanishDate(data.rawDate);
      }
      continue;
    }

    const lower = trimmed.toLowerCase();
    if (lower.includes('added') || lower.includes('implementadas') || lower.includes('novedades')) {
      currentSection = 'added';
      continue;
    } else if (lower.includes('changed') || lower.includes('mejoras') || lower.includes('cambios')) {
      currentSection = 'changed';
      continue;
    } else if (lower.includes('fixed') || lower.includes('correcciones') || lower.includes('soluciones')) {
      currentSection = 'fixed';
      continue;
    }

    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
      const content = trimmed.replace(/^[-*•]\s*/, '').trim();
      if (!content) continue;

      if (currentSection === 'added') {
        data.mejoras.push(content);
      } else if (currentSection === 'changed') {
        data.cambios.push(content);
      } else if (currentSection === 'fixed') {
        data.correcciones.push(content);
      }
    }
  }

  if (data.mejoras.length === 0 && data.cambios.length === 0 && data.correcciones.length === 0) {
    const plainLines = lines
      .map(l => l.replace(/^[-*•]\s*/, '').trim())
      .filter(l => l && !l.startsWith('#'));
    data.mejoras = plainLines;
  }

  return data;
}

interface ChangelogFeaturesProps {
  releaseNotes?: string | null;
  newVersion?: string | null;
}

export function ChangelogFeatures({ releaseNotes, newVersion }: ChangelogFeaturesProps) {
  const newVersionData = (releaseNotes && newVersion) 
    ? parseReleaseNotes(releaseNotes, newVersion) 
    : null;

  return (
    <div className="flex flex-col h-full select-none">
      
      {/* Dynamic new version or timeline display */}
      <div className="flex items-center gap-2 mb-6 px-1">
        <div className="w-1 h-3.5 rounded-full bg-accent" />
        <span className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Historial de Cambios</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pr-1 relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-3.5 top-2 bottom-6 w-0.5 bg-border/40" />

        <div className="space-y-6">
          {newVersionData && (
            <TimelineNode 
              data={newVersionData} 
              isLatest={true} 
              isNewAvailable={true} 
            />
          )}

          {RECENT_VERSIONS.map((vData, index) => (
            <TimelineNode 
              key={vData.version} 
              data={vData} 
              isLatest={index === 0 && !newVersionData} 
              isNewAvailable={false}
            />
          ))}
        </div>
      </div>

    </div>
  );
}

interface TimelineNodeProps {
  data: VersionData;
  isLatest: boolean;
  isNewAvailable: boolean;
}

function TimelineNode({ data, isLatest, isNewAvailable }: TimelineNodeProps) {
  const [isOpen, setIsOpen] = useState(isLatest);
  const totalChanges = data.mejoras.length + data.cambios.length + data.correcciones.length;

  return (
    <div className="relative pl-9 group">
      
      {/* Node Bullet */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute left-[8px] top-1 w-[13px] h-[13px] rounded-full border-2 bg-background cursor-pointer flex items-center justify-center transition-all duration-300 z-10"
        style={{
          borderColor: isNewAvailable 
            ? 'var(--color-accent)' 
            : isLatest 
              ? 'var(--color-accent)' 
              : 'var(--color-border-val)'
        }}
      >
        {(isLatest || isNewAvailable) && (
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping absolute" />
        )}
        <div 
          className="w-1.5 h-1.5 rounded-full" 
          style={{
            backgroundColor: isNewAvailable 
              ? 'var(--color-accent)' 
              : isLatest 
                ? 'var(--color-accent)' 
                : 'var(--color-text-secondary-val)'
          }}
        />
      </div>

      {/* Node Content */}
      <div className="space-y-2 text-left">
        
        {/* Title / Version Line */}
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="flex flex-wrap items-center gap-2 cursor-pointer select-none"
        >
          <span className={`text-sm font-semibold tracking-tight leading-none transition-colors ${isLatest ? 'text-accent' : 'text-gray-900 dark:text-white group-hover:text-accent'}`}>
            v{data.version}
          </span>
          <span className="text-[10px] text-secondary font-mono">
            {data.date || formatSpanishDate(data.rawDate)}
          </span>
          
          {isNewAvailable && (
            <span className="bg-accent/10 text-accent text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
              Disponible
            </span>
          )}

          <span className="ml-auto text-[9px] text-secondary bg-surface-2 px-2 py-0.5 rounded-full font-medium">
            {totalChanges} cambios
          </span>
        </div>

        {/* Short summary always visible when collapsed */}
        {!isOpen && (
          <p className="text-[10px] text-secondary truncate max-w-sm">
            {data.mejoras[0] || data.cambios[0] || data.correcciones[0] || 'Ver los detalles de esta versión.'}
          </p>
        )}

        {/* Detailed accordion content */}
        {isOpen && (
          <div className="pt-1.5 pb-2.5 space-y-3 animate-in fade-in duration-200">
            {/* Mejoras */}
            {data.mejoras.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Mejoras</span>
                </div>
                <ul className="space-y-1 pl-1">
                  {data.mejoras.map((item, i) => (
                    <li key={i} className="text-[11px] text-secondary leading-relaxed flex items-start gap-1.5">
                      <span className="text-emerald-500/80 mt-1 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cambios */}
            {data.cambios.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Cambios</span>
                </div>
                <ul className="space-y-1 pl-1">
                  {data.cambios.map((item, i) => (
                    <li key={i} className="text-[11px] text-secondary leading-relaxed flex items-start gap-1.5">
                      <span className="text-amber-500/80 mt-1 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Correcciones */}
            {data.correcciones.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Correcciones</span>
                </div>
                <ul className="space-y-1 pl-1">
                  {data.correcciones.map((item, i) => (
                    <li key={i} className="text-[11px] text-secondary leading-relaxed flex items-start gap-1.5">
                      <span className="text-blue-500/80 mt-1 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
