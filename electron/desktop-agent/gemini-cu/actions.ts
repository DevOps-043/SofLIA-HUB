import { z } from 'zod';
import type { FunctionTool } from 'openai/resources/responses/responses';
import type { CuEnvironment } from './types';

const coordinate = z.number().min(0).max(999);
const point = { x: coordinate, y: coordinate };
const safety = {
  intent: z.string().max(2000),
  safety_decision: z.object({ decision: z.enum(['allowed', 'require_confirmation', 'blocked']), explanation: z.string().max(2000).optional() }).strict(),
};
const actions = {
  click_at: z.object(point), double_click: z.object(point), right_click: z.object(point), middle_click: z.object(point),
  hover_at: z.object(point), mouse_down: z.object(point), mouse_up: z.object(point),
  type_text_at: z.object({ ...point, text: z.string().max(20_000), press_enter: z.boolean().optional(), clear_before_typing: z.boolean().optional() }),
  press_key: z.object({ keys: z.string().min(1).max(200) }),
  scroll: z.object({ direction: z.enum(['up', 'down', 'left', 'right']), magnitude: z.number().positive().max(20), x: coordinate.optional(), y: coordinate.optional() }),
  drag_and_drop: z.object({ ...point, destination_x: coordinate, destination_y: coordinate }),
  wait: z.object({ ms: z.number().int().min(1).max(15_000) }),
  navigate: z.object({ url: z.string().max(4096).url() }),
  go_back: z.object({}), go_forward: z.object({}), take_screenshot: z.object({}),
  open_application: z.object({ app_name: z.string().min(1).max(200) }),
};

export function computerActionCatalog(environment: CuEnvironment, excluded: string[] = []) {
  const schemas = new Map<string, z.ZodType>();
  const tools: FunctionTool[] = [];
  for (const [name, fields] of Object.entries(actions)) {
    if (excluded.includes(name) || (name === 'open_application' && environment !== 'ENVIRONMENT_DESKTOP')) continue;
    const schema = fields.extend(safety).strict();
    schemas.set(name, schema);
    const parameters = z.toJSONSchema(schema);
    delete parameters.$schema;
    tools.push({ type: 'function', name, description: `Acción ${name} sobre la superficie autorizada. Coordenadas normalizadas 0–999; declara intención y seguridad.`, parameters, strict: false });
  }
  return { tools, schemas };
}
