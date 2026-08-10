import { useState, type FormEvent } from 'react';
import { Button, TextArea, TextField } from '../ui';
import { toSkillCommand } from '../../services/skills/slash-commands';
import { SKILL_CATEGORIES, type CreateUserSkillInput, type SkillCategory, type UserSkill } from '../../shared/skills/types';
import { resolveSkillIcon, type SkillIconId } from '../skill-library/skill-icons-catalog';
import { SkillIconPicker } from './SkillIconPicker';

/**
 * Editor UNICO de una Skill del usuario: nombre, comando de invocacion,
 * icono, categoria, instrucciones y prompts de inicio.
 *
 * Lo usan tanto la configuracion como el atajo "Crear Skill" del compositor.
 * Tener un solo formulario evita que las dos superficies acaben ofreciendo
 * campos distintos para el mismo registro.
 *
 * No hay campo para declarar herramientas, y no lo habra: una Skill del
 * usuario solo aporta instrucciones. Las capacidades privilegiadas las decide
 * el producto, no un texto escrito aqui.
 */
export function SkillEditorForm(props: {
  skill: UserSkill | null;
  /** Texto que el usuario tenia escrito al pulsar "Crear Skill". */
  initialInstructions?: string;
  /** Comandos ya usados por otras skills, para avisar del choque. */
  takenCommands: string[];
  onSubmit: (input: CreateUserSkillInput) => Promise<void>;
  onCancel: () => void;
}) {
  // El estado arranca de las props y NO se sincroniza con un efecto: los dos
  // llamadores montan el formulario con una `key` por skill, de modo que
  // cambiar de skill lo remonta con valores limpios.
  const [name, setName] = useState(props.skill?.name ?? '');
  const [command, setCommand] = useState(props.skill?.command ?? '');
  const [description, setDescription] = useState(props.skill?.description ?? '');
  const [icon, setIcon] = useState<SkillIconId>(() => resolveSkillIcon(props.skill?.icon));
  const [category, setCategory] = useState<SkillCategory | ''>(props.skill?.category ?? '');
  const [instructions, setInstructions] = useState(
    props.skill?.instructions ?? props.initialInstructions ?? '',
  );
  const [starterPrompts, setStarterPrompts] = useState(
    props.skill?.starterPrompts.join('\n') ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El comando efectivo: lo escrito, o el derivado del nombre si se deja vacio.
  const effectiveCommand = toSkillCommand(command || name);
  const conflict = Boolean(effectiveCommand) && props.takenCommands.includes(effectiveCommand);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError('El nombre es obligatorio.');
    if (!instructions.trim()) return setError('Las instrucciones son obligatorias.');
    if (!effectiveCommand) return setError('El nombre debe contener letras o numeros para poder invocarla con "/".');
    if (conflict) return setError(`Ya usas /${effectiveCommand} en otra skill. Elige otro comando.`);

    setSaving(true);
    try {
      await props.onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        command: effectiveCommand,
        category: category || undefined,
        instructions: instructions.trim(),
        starterPrompts: starterPrompts.split('\n').map((prompt) => prompt.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la skill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="skill-nombre"
          label="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Resumen ejecutivo"
          maxLength={60}
        />
        <div>
          <TextField
            id="skill-comando"
            label="Comando de invocacion"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={toSkillCommand(name) || 'resumen-ejecutivo'}
            maxLength={40}
          />
          <p className={`mt-1 text-[11px] ${conflict ? 'text-danger' : 'text-secondary'}`}>
            {conflict
              ? `Ya usas /${effectiveCommand} en otra skill.`
              : effectiveCommand
                ? `Se invoca escribiendo /${effectiveCommand} en el chat.`
                : 'Se deriva del nombre si lo dejas vacio.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="skill-descripcion"
          label="Descripcion (opcional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Que hace esta skill, en una linea."
          maxLength={140}
        />
        <div>
          <label htmlFor="skill-categoria" className="mb-1.5 block text-xs font-medium text-secondary">
            Categoria (opcional)
          </label>
          <select
            id="skill-categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value as SkillCategory | '')}
            className="w-full cursor-pointer rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 dark:text-white"
          >
            <option value="">Sin categoria</option>
            {SKILL_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </div>
      </div>

      <SkillIconPicker value={icon} onChange={setIcon} />

      <TextArea
        id="skill-instrucciones"
        label="Instrucciones"
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        placeholder="Como debe comportarse SofLIA cuando esta skill esta activa. Se anexa a su prompt base."
        rows={8}
      />

      <TextArea
        id="skill-prompts"
        label="Prompts de inicio (opcional)"
        value={starterPrompts}
        onChange={(event) => setStarterPrompts(event.target.value)}
        placeholder={'Una por linea. Apareceran como sugerencias al activar la skill.\nResume este documento en tres puntos\nExtrae los acuerdos y responsables'}
        rows={3}
      />

      {error && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={props.onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : props.skill ? 'Guardar cambios' : 'Crear skill'}
        </Button>
      </div>
    </form>
  );
}
