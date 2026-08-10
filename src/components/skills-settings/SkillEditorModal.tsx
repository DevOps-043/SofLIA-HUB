import { useEffect, useState } from 'react';
import { createUserSkill, resolveSkillCatalog, updateUserSkill } from '../../services/skills-service';
import { buildSkillCommands } from '../../services/skills/slash-commands';
import type { CreateUserSkillInput, UserSkill } from '../../shared/skills/types';
import { SkillEditorForm } from './SkillEditorForm';

/**
 * Envoltorio modal del editor de Skills para el chat.
 *
 * Reutiliza el MISMO formulario que la configuracion: si las dos superficies
 * tuvieran formularios distintos, acabarian ofreciendo campos distintos para
 * el mismo registro.
 */
export function SkillEditorModal(props: {
  isOpen: boolean;
  skill: UserSkill | null;
  /** Texto que el usuario tenia escrito al pulsar "Crear Skill". */
  initialInstructions?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [takenCommands, setTakenCommands] = useState<string[]>([]);

  // Se cargan los comandos en uso para poder avisar del choque antes de
  // guardar, en vez de dejar que falle el indice unico de la base de datos.
  useEffect(() => {
    if (!props.isOpen) return undefined;

    let cancelled = false;
    void resolveSkillCatalog('chat')
      .then((catalog) => {
        if (cancelled) return;
        setTakenCommands(
          buildSkillCommands(catalog)
            .filter((entry) => entry.skill.id !== props.skill?.id)
            .map((entry) => entry.command),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [props.isOpen, props.skill?.id]);

  if (!props.isOpen) return null;

  const handleSubmit = async (input: CreateUserSkillInput) => {
    if (props.skill) await updateUserSkill(props.skill.id, input);
    else await createUserSkill(input);
    props.onSaved();
    props.onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <div
        role="dialog"
        aria-label={props.skill ? 'Editar skill' : 'Nueva skill'}
        className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">
          {props.skill ? `Editar ${props.skill.name}` : 'Nueva skill'}
        </h2>
        <SkillEditorForm
          key={props.skill?.id ?? 'nueva'}
          skill={props.skill}
          initialInstructions={props.initialInstructions}
          takenCommands={takenCommands}
          onSubmit={handleSubmit}
          onCancel={props.onClose}
        />
      </div>
    </div>
  );
}
