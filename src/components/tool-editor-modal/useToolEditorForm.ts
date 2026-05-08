import { useEffect, useState, type FormEvent } from 'react';
import {
  createUserTool,
  updateUserTool,
  type CreateUserToolInput,
  type ToolCategory,
} from '../../services/tools-service';
import type { ToolEditorFormState, ToolEditorModalProps } from './types';

const DEFAULT_ICON = '⚙️';

export function useToolEditorForm({
  tool,
  initialPromptText,
  onClose,
  onSave,
}: Pick<ToolEditorModalProps, 'tool' | 'initialPromptText' | 'onClose' | 'onSave'>) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [category, setCategory] = useState<ToolCategory | ''>('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [starterPrompts, setStarterPrompts] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form: ToolEditorFormState = {
    name,
    description,
    icon,
    category,
    systemPrompt,
    starterPrompts,
    saving,
    error,
  };

  const patch = (next: Partial<ToolEditorFormState>) => {
    if (next.name !== undefined) setName(next.name);
    if (next.description !== undefined) setDescription(next.description);
    if (next.icon !== undefined) setIcon(next.icon);
    if (next.category !== undefined) setCategory(next.category);
    if (next.systemPrompt !== undefined) setSystemPrompt(next.systemPrompt);
    if (next.starterPrompts !== undefined) setStarterPrompts(next.starterPrompts);
    if (next.saving !== undefined) setSaving(next.saving);
    if (next.error !== undefined) setError(next.error);
  };

  useEffect(() => {
    setName(tool?.name ?? '');
    setDescription(tool?.description ?? '');
    setIcon(tool?.icon ?? DEFAULT_ICON);
    setCategory(tool?.category ?? '');
    setSystemPrompt(tool?.system_prompt ?? initialPromptText ?? '');
    setStarterPrompts(tool?.starter_prompts?.join('\n') ?? '');
    setError(null);
  }, [tool, initialPromptText]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('El nombre es obligatorio');
    if (!systemPrompt.trim()) return setError('El prompt del sistema es obligatorio');

    setSaving(true);
    try {
      const toolData: CreateUserToolInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        category: category ? (category as ToolCategory) : undefined,
        system_prompt: systemPrompt.trim(),
        starter_prompts: starterPrompts.split('\n').map((prompt) => prompt.trim()).filter(Boolean),
      };
      const savedTool = tool ? await updateUserTool(tool.id, toolData) : await createUserTool(toolData);
      onSave(savedTool);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    patch,
    handleSubmit,
  };
}
