# Análisis: Soporte para Grupos de WhatsApp en Pulse Hub

# Investigación de OpenClaw + Arquitectura Actual

## Fecha: 19 de Febrero 2026

---

## 1. ¿Qué es OpenClaw?

**OpenClaw** (`github.com/openclaw/openclaw`) es un asistente personal de IA open-source creado por Peter Steinberger (@steipete). Es un proyecto con 150k+ estrellas en GitHub que funciona como un agente AI que se conecta a múltiples plataformas de mensajería.

### Características principales:

- **Multi-canal**: WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Microsoft Teams, WebChat
- **Self-hosted / Local-first**: Corre en tu máquina, los datos quedan locales
- **Gateway architecture**: Un daemon siempre activo que es el control plane
- **Baileys para WhatsApp**: Usa la misma librería que Pulse (`@whiskeysockets/baileys`)
- **Soporte COMPLETO de grupos**: Con whitelist, menciones, comandos `/`, y activación configurable

### Nombres anteriores:

- Antes se llamó **Clawdbot** y luego **Moltbot**

---

## 2. Cómo OpenClaw Maneja Grupos de WhatsApp

### 2.1 Arquitectura (Gateway Pattern)

```
WhatsApp / Telegram / Slack / Discord / etc.
                    │
                    ▼
          ┌─────────────────────────┐
          │        Gateway          │
          │    (control plane)      │
          │  ws://127.0.0.1:18789  │
          └────────────┬────────────┘
                       │
               ├─ Agent (RPC)
               ├─ CLI (openclaw …)
               ├─ WebChat UI
               ├─ macOS app
               └─ iOS / Android nodes
```

### 2.2 Configuración de Grupos (openclaw.json)

OpenClaw usa un archivo de configuración JSON central (`~/.openclaw/openclaw.json`) donde se define todo:

```json
{
  "channels": {
    "whatsapp": {
      // ─── Política de DMs (mensajes directos) ───
      "dmPolicy": "pairing", // "pairing" | "allowlist" | "open" | "disabled"
      "allowFrom": ["+5215512345678"], // whitelist de números para DMs

      // ─── Política de Grupos ───
      "groupPolicy": "allowlist", // "open" | "allowlist" | "disabled"
      "groupAllowFrom": ["+5215512345678"], // quién puede invocar al bot en grupos
      "groups": ["120363xxxxxxxx@g.us"], // qué grupos están permitidos ("*" = todos)

      // ─── Configuración de activación en grupos ───
      // Se controla con el comando /activation (ver sección de comandos)

      // ─── Reacciones de confirmación ───
      "ackReaction": {
        "emoji": "👀",
        "direct": true,
        "group": "mentions" // "always" | "mentions" | "never"
      },

      // ─── Historial de contexto en grupos ───
      "historyLimit": 50, // mensajes previos inyectados como contexto
      "textChunkLimit": 4000, // máximo chars por mensaje
      "chunkMode": "newline", // "length" | "newline"

      // ─── Media ───
      "mediaMaxMb": 50, // límite de archivos entrantes
      "sendReadReceipts": false
    }
  }
}
```

### 2.3 Sistema de Activación en Grupos

OpenClaw tiene **dos modos de activación** en grupos, controlados con el comando `/activation`:

| Modo                  | Comando               | Comportamiento                                                                                                     |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Mention** (default) | `/activation mention` | Solo responde cuando: ① lo mencionan con @, ② usan regex patterns configurados, ③ hacen reply a un mensaje del bot |
| **Always**            | `/activation always`  | Responde a TODOS los mensajes del grupo (como funciona Pulse en DMs actualmente)                                  |

### 2.4 Mention Patterns (Regex configurable)

OpenClaw permite configurar patrones regex para detectar invocaciones:

```json
{
  "agents": {
    "list": [
      {
        "groupChat": {
          "mentionPatterns": ["@soflia", "@bot", "hey soflia"]
        }
      }
    ]
  }
}
```

Esto significa que el bot responde cuando:

1. **Mención explícita de WhatsApp** → `@BotNumber` (detección nativa de Baileys via `mentionedJid`)
2. **Regex patterns** → Cualquier texto que matchee los patterns configurados
3. **Reply al bot** → Cuando un usuario hace reply a un mensaje del bot

### 2.5 Sesiones Aisladas por Grupo

Cada grupo tiene su **sesión aislada**:

```
agent:<agentId>:whatsapp:group:<jid>
```

Esto significa que la conversación de un grupo NO se mezcla con las conversaciones de DM. Cada grupo tiene su propio contexto/historial.

### 2.6 Inyección de Historial de Grupo

OpenClaw inyecta los mensajes recientes del grupo como contexto:

```
[Chat messages since your last reply - for context]
  Usuario1: Hola equipo, cómo vamos con el sprint?
  Usuario2: Yo terminé mis tareas
  Usuario3: @SofLIA dame un resumen
[Current message - respond to this]
  Usuario3: @SofLIA ¿cuáles son las tareas pendientes?
```

Configuración: `channels.whatsapp.historyLimit` (default: 50 mensajes)

### 2.7 Chat Commands de OpenClaw

Estos comandos funcionan tanto en DMs como en grupos:

| Comando                       | Función                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `/status`                     | Estado del sesión (modelo, tokens, costo)                     |
| `/new` o `/reset`             | Resetea la sesión/conversación                                |
| `/compact`                    | Compacta el contexto (resumen)                                |
| `/think <level>`              | Nivel de razonamiento: off\|minimal\|low\|medium\|high\|xhigh |
| `/verbose on\|off`            | Modo verbose                                                  |
| `/usage off\|tokens\|full`    | Footer de uso por respuesta                                   |
| `/restart`                    | Reinicia gateway (solo owner en grupos)                       |
| `/activation mention\|always` | **Toggle de activación en grupos**                            |

### 2.8 Seguridad en Grupos

OpenClaw implementa un modelo de seguridad por capas:

```
Capa 1: ¿Está el grupo en la allowlist? (channels.whatsapp.groups)
         ↓ SÍ
Capa 2: ¿El sender está autorizado? (groupPolicy + groupAllowFrom)
         ↓ SÍ
Capa 3: ¿El bot fue activado? (mention / always)
         ↓ SÍ
Capa 4: ¿Qué herramientas están disponibles?
         → Sesiones non-main pueden ejecutarse en sandbox Docker
         → agents.defaults.sandbox.mode: "non-main"
```

**Sandbox para grupos**: OpenClaw permite que las sesiones de grupo corran en **Docker sandboxes** aislados:

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main" // Sesiones de grupo corren en sandbox
      }
    }
  }
}
```

Herramientas permitidas en sandbox: `bash, process, read, write, edit, sessions_*`
Herramientas bloqueadas en sandbox: `browser, canvas, nodes, cron, discord, gateway`

---

## 3. Arquitectura Actual de Pulse (Comparación)

### 3.1 Archivos Involucrados

| Archivo                            | Rol                                              |
| ---------------------------------- | ------------------------------------------------ |
| `electron/whatsapp-service.ts`     | Servicio Baileys — conexión, QR, envío/recepción |
| `electron/whatsapp-agent.ts`       | Loop agéntico Gemini + 30+ herramientas          |
| `electron/main.ts`                 | Bridge: conecta servicio ↔ agente ↔ renderer     |
| `src/components/WhatsAppSetup.tsx` | UI de configuración                              |

### 3.2 Flujo de Mensajes Actual

```
[WhatsApp Web] ←→ [Baileys (@whiskeysockets/baileys)]
                          ↓
              [WhatsAppService] (EventEmitter)
                    ↓ emit('message', { jid, senderNumber, text })
              [WhatsAppAgent.handleMessage()]
                    ↓
              [Gemini AI Loop + Function Calling + Tools]
                    ↓
              [waService.sendText(jid, response)]
```

### 3.3 Problema Actual: No Diferencia DM vs Grupo

En `whatsapp-service.ts` línea 147:

```typescript
const senderNumber = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
```

**¡BUG!** En un grupo:

- `jid` = `"120363xxxxxxxx@g.us"` (ID del grupo)
- `senderNumber` = `"120363xxxxxxxx"` (ID del grupo, NO del usuario real)
- El participante real está en `msg.key.participant` → **NO SE USA**

### 3.4 Pulse vs OpenClaw — Comparación Directa

| Feature                         | OpenClaw                | Pulse Actual        | Pulse Necesita      |
| ------------------------------- | ----------------------- | -------------------- | -------------------- |
| Conexión WhatsApp               | Baileys ✅              | Baileys ✅           | —                    |
| DM (1:1)                        | ✅                      | ✅                   | —                    |
| Whitelist de números            | ✅ (allowFrom)          | ✅ (allowedNumbers)  | —                    |
| Soporte de grupos               | ✅ Completo             | ❌ No funciona       | ✅ Implementar       |
| Grupo allowlist                 | ✅ (groups)             | ❌                   | ✅                   |
| Activación por mención          | ✅ (mentionJid + regex) | ❌                   | ✅                   |
| Activación por comando          | ✅ (/activation)        | ❌                   | ✅                   |
| Activación por reply            | ✅ (reply-to-bot)       | ❌                   | ✅                   |
| Sesiones aisladas por grupo     | ✅                      | ❌ (solo por número) | ✅                   |
| Chat commands (/status, /reset) | ✅                      | ❌                   | ✅ (opcional)        |
| Historial de grupo inyectado    | ✅ (50 msgs)            | ❌                   | ✅ (opcional)        |
| Reacción de ACK (👀)            | ✅                      | ❌                   | ✅ (nice to have)    |
| Sandbox para grupos             | ✅ (Docker)             | ❌                   | ✅ (tools limitados) |

---

## 4. Plan de Implementación para Pulse

### Fase 1: Detección Correcta de Grupos (CRÍTICO)

**Archivo**: `electron/whatsapp-service.ts`

Cambios necesarios en el handler de mensajes:

```typescript
// NUEVO: Detección correcta de participante en grupos
const jid = msg.key.remoteJid!;
const isGroup = jid.endsWith("@g.us");

let senderNumber: string;
if (isGroup) {
  // En grupo: el participante real está en msg.key.participant
  const participant = msg.key.participant || "";
  senderNumber = participant
    .replace("@s.whatsapp.net", "")
    .replace(/@lid$/, "")
    .split(":")[0]; // Remove device suffix
} else {
  senderNumber = jid.replace("@s.whatsapp.net", "");
}
```

### Fase 2: Sistema de Activación en Grupos (estilo OpenClaw)

```typescript
// NUEVO: Configuración ampliada
interface WhatsAppConfig {
  allowedNumbers: string[];       // Whitelist DMs
  allowedGroups: string[];        // Whitelist de grupos (@g.us JIDs)
  groupPolicy: 'open' | 'allowlist' | 'disabled'; // Política de acceso
  groupAllowFrom: string[];       // Quién puede invocar en grupos
  groupActivation: 'mention' | 'always'; // Cómo se activa el bot
  groupPrefix: string;            // Comando prefix (default: "/soflia")
  autoConnect: boolean;
  apiKey?: string;
}

// NUEVO: Método de activación
private shouldRespondInGroup(msg: any): boolean {
  if (this.config.groupPolicy === 'disabled') return false;

  const activation = this.config.groupActivation || 'mention';
  if (activation === 'always') return true;

  // Modo mention: verificar mención, prefijo, o reply
  const text = msg.message?.conversation
    || msg.message?.extendedTextMessage?.text || '';

  // 1. Mención nativa de WhatsApp
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  const mentionedJids = contextInfo?.mentionedJid || [];
  const botNumber = this.sock?.user?.id?.split(':')[0] || '';
  const isMentioned = mentionedJids.some(j => j.includes(botNumber));

  // 2. Prefijo de comando
  const prefix = this.config.groupPrefix || '/soflia';
  const hasPrefix = text.toLowerCase().startsWith(prefix);

  // 3. Reply al bot
  const isReplyToBot = contextInfo?.participant?.includes(botNumber);

  // 4. Regex patterns (como OpenClaw)
  const patterns = ['@soflia', 'soflia', 'hey soflia'];
  const matchesPattern = patterns.some(p => text.toLowerCase().includes(p));

  return isMentioned || hasPrefix || isReplyToBot || matchesPattern;
}
```

### Fase 3: Sesiones Aisladas por Grupo

En `whatsapp-agent.ts`, usar un identificador compuesto para el historial:

```typescript
// ANTES: conversations.get(senderNumber)
// DESPUÉS: usar groupJid como scope
const sessionKey = isGroup
  ? `group:${jid}:${senderNumber}` // Aislado por grupo y participante
  : senderNumber; // DM: por número como antes

if (!conversations.has(sessionKey)) {
  conversations.set(sessionKey, []);
}
```

### Fase 4: Chat Commands (inspirados en OpenClaw)

```typescript
// Detectar comandos antes de enviar al agente
if (text.startsWith("/")) {
  const [cmd, ...args] = text.slice(1).split(" ");
  switch (cmd.toLowerCase()) {
    case "status":
      return "🤖 Pulse activa. Modelo: Gemini 2.5 Flash";
    case "reset":
    case "new":
      conversations.delete(sessionKey);
      return "🔄 Conversación reiniciada.";
    case "activation":
      if (!isGroup) return "Este comando solo funciona en grupos.";
      const mode = args[0]; // 'mention' | 'always'
      if (mode === "mention" || mode === "always") {
        this.config.groupActivation = mode;
        await saveConfig(this.config);
        return `✅ Activación cambiada a: *${mode}*`;
      }
      return "Uso: /activation mention | always";
    case "help":
      return "📋 Comandos disponibles:\n/status - Estado\n/reset - Reiniciar conversación\n/activation - Modo de grupo\n/help - Esta ayuda";
  }
}
```

### Fase 5: Reacción de ACK (como OpenClaw)

```typescript
// Al recibir un mensaje que el bot va a procesar, enviar reacción 👀
if (this.sock && msg.key) {
  await this.sock.sendMessage(jid, {
    react: { text: "👀", key: msg.key },
  });
}

// Al terminar de procesar, cambiar a ✅
await this.sock.sendMessage(jid, {
  react: { text: "✅", key: msg.key },
});
```

### Fase 6: Restricción de Tools en Grupos

```typescript
// En whatsapp-agent.ts:
const GROUP_BLOCKED_TOOLS = new Set([
  "execute_command",
  "open_application",
  "kill_process",
  "lock_session",
  "shutdown_computer",
  "restart_computer",
  "sleep_computer",
  "toggle_wifi",
  "run_in_terminal",
  "run_claude_code",
  "use_computer",
  "delete_item",
  "write_file",
  "clipboard_write",
]);

// En runAgentLoop, filtrar herramientas según contexto:
const toolDeclarations = isGroup
  ? WA_TOOL_DECLARATIONS.functionDeclarations.filter(
      (t) => !GROUP_BLOCKED_TOOLS.has(t.name),
    )
  : WA_TOOL_DECLARATIONS.functionDeclarations;
```

### Fase 7: UI de Configuración de Grupos (WhatsAppSetup.tsx)

Agregar nueva sección al modal:

```
┌─────────────────────────────────────┐
│ WhatsApp                            │
├─────────────────────────────────────┤
│ ● Conectado: +521551234xxxx         │
│                                     │
│ ─── Mensajes Directos ───           │
│ Números autorizados: [+521551...]   │
│                                     │
│ ─── Grupos ───                  NEW │
│ ☑ Habilitar soporte de grupos       │
│                                     │
│ Modo de activación:                 │
│ ○ Mención (@SofLIA)  ← default     │
│ ○ Siempre activo                    │
│                                     │
│ Prefijo de comando: [/soflia  ]     │
│                                     │
│ Grupos permitidos:                  │
│ ○ Todos los grupos                  │
│ ○ Solo estos grupos:                │
│   • Equipo de Desarrollo [x]        │
│   [+ Agregar grupo]                 │
│                                     │
│ Permisos en grupos:                 │
│ ☑ Consultas (search, web, IRIS)     │
│ ☑ Documentos (crear Word/Excel)     │
│ ☐ Control del sistema               │
│ ☐ Archivos locales                  │
└─────────────────────────────────────┘
```

---

## 5. Resumen de Similitudes Pulse ↔ OpenClaw

| Aspecto                    | OpenClaw                     | Pulse                             |
| -------------------------- | ---------------------------- | ---------------------------------- |
| **Librería WhatsApp**      | Baileys                      | Baileys ✅ (igual)                 |
| **Arquitectura**           | Gateway daemon (Node.js)     | Electron main process              |
| **AI Model**               | Claude/GPT (configurable)    | Gemini 2.5 Flash                   |
| **Tools/Function Calling** | Herramientas vía tool system | Function Calling de Gemini ✅      |
| **Memoria**                | Markdown files (MEMORY.md)   | JSON file (whatsapp-memories.json) |
| **Grupos**                 | Soporte completo + config    | **FALTA** — a implementar          |

### Lo que Pulse ya tiene que OpenClaw también tiene:

- ✅ Conexión Baileys con QR
- ✅ Whitelist de números (allowedNumbers ≈ allowFrom)
- ✅ Auto-reconnect con backoff exponencial
- ✅ Transcripción de audio
- ✅ Envío de archivos/media
- ✅ Sistema de memoria/lecciones
- ✅ Computer Use (Pulse tiene más → usa mouse/teclado directo)
- ✅ Integración con IRIS/Project Hub (Pulse unique)

### Lo que Pulse necesita adoptar de OpenClaw:

- 🔲 Detección correcta de `msg.key.participant` en grupos
- 🔲 `groupPolicy` + `groupAllowFrom`
- 🔲 `groupActivation`: mention | always
- 🔲 Mention patterns (regex + mención nativa)
- 🔲 Chat commands (/status, /reset, /activation)
- 🔲 Sesiones aisladas por grupo
- 🔲 ACK reactions (👀 → ✅)
- 🔲 Herramientas restringidas en grupos
- 🔲 Inyección de historial de grupo como contexto

---

## 6. Esfuerzo Estimado

| Fase | Descripción                            | Esfuerzo        |
| ---- | -------------------------------------- | --------------- |
| 1    | Detección correcta de grupos           | ~1-2 horas      |
| 2    | Sistema de activación (mention/always) | ~2-3 horas      |
| 3    | Sesiones aisladas por grupo            | ~1 hora         |
| 4    | Chat commands                          | ~1-2 horas      |
| 5    | ACK reactions                          | ~30 min         |
| 6    | Restricción de tools en grupos         | ~1 hora         |
| 7    | UI de configuración                    | ~2-3 horas      |
|      | **TOTAL**                              | **~9-13 horas** |

---

## 7. Próximos Pasos Recomendados

1. **Fase 1** primero — Es el fix más crítico (bug actual con `@g.us`)
2. **Fase 2** — Sistema de activación por mención (el approach de OpenClaw es el mejor)
3. **Fase 4** — Chat commands (`/activation`, `/status`, `/reset`)
4. **Fase 6** — Restricción de tools (seguridad en grupos)
5. **Fases 3, 5, 7** — Polishing (sesiones, reactions, UI)

**¿Quieres que empiece con la implementación de alguna fase?**
