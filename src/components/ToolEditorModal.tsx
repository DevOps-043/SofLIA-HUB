/**
 * Tool Editor Modal - Create/Edit saved prompts
 */

import React, { useState, useEffect } from 'react';
import {
  UserTool,
  ToolCategory,
  TOOL_CATEGORIES,
  CreateUserToolInput,
  createUserTool,
  updateUserTool,
} from '../services/tools-service';

interface ToolEditorModalProps {
  isOpen: boolean;
  tool?: UserTool | null;
  initialPromptText?: string;
  onClose: () => void;
  onSave: (tool: UserTool) => void;
}

const EMOJI_OPTIONS = ['⚙️', '🔧', '💡', '🎯', '📝', '💻', '🎨', '📊', '🔬', '🚀', '⭐', '🎓', '📣', '🤖', '✨', '🧠'];

export function ToolEditorModal({ isOpen, tool, initialPromptText, onClose, onSave }: ToolEditorModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('⚙️');
  const [category, setCategory] = useState<ToolCategory | ''>('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [starterPrompts, setStarterPrompts] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (tool) {
      setName(tool.name);
      setDescription(tool.description || '');
      setIcon(tool.icon);
      setCategory(tool.category || '');
      setSystemPrompt(tool.system_prompt);
      setStarterPrompts(tool.starter_prompts?.join('\n') || '');
    } else {
      setName('');
      setDescription('');
      setIcon('⚙️');
      setCategory('');
      setSystemPrompt(initialPromptText || '');
      setStarterPrompts('');
    }
    setError(null);
  }, [tool, isOpen, initialPromptText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!systemPrompt.trim()) { setError('El prompt del sistema es obligatorio'); return; }

    setSaving(true);
    try {
      const toolData: CreateUserToolInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        category: category as ToolCategory || undefined,
        system_prompt: systemPrompt.trim(),
        starter_prompts: starterPrompts.split('\n').map(s => s.trim()).filter(s => s.length > 0),
      };

      const savedTool = tool
        ? await updateUserTool(tool.id, toolData)
        : await createUserTool(toolData);

      onSave(savedTool);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#1a1f2e] rounded-2xl w-[90%] max-w-[500px] max-h-[90vh] overflow-auto p-6 border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white mb-5">
          {tool ? 'Editar Prompt' : initialPromptText ? 'Guardar Prompt' : 'Nuevo Prompt'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Icon & Name */}
          <div className="flex gap-3 items-center">
            <div className="relative">
              <button
                type="button"
                className="w-12 h-12 text-2xl bg-white/5 border border-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {icon}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 bg-[#252b3d] rounded-xl p-2 grid grid-cols-4 gap-1 z-50 border border-white/10 shadow-xl">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className="w-9 h-9 text-xl bg-transparent border-none rounded-lg cursor-pointer flex items-center justify-center hover:bg-white/10 transition-colors"
                      onClick={() => { setIcon(emoji); setShowEmojiPicker(false); }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Nombre de la herramienta"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none focus:border-accent/50 transition-colors"
              maxLength={50}
            />
          </div>

          {/* Description */}
          <input
            type="text"
            placeholder="Descripción breve (opcional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none focus:border-accent/50 transition-colors"
            maxLength={200}
          />

          {/* Category */}
          <select
            value={category}
            onChange={e => setCategory(e.target.value as ToolCategory)}
            className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none cursor-pointer focus:border-accent/50 transition-colors"
          >
            <option value="">Sin categoría</option>
            {TOOL_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
            ))}
          </select>

          {/* System Prompt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white">Instrucciones del Sistema *</label>
            <p className="text-xs text-gray-500 m-0">Define cómo debe comportarse la IA cuando uses esta herramienta.</p>
            <textarea
              placeholder="Ej: Eres un experto en marketing digital..."
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none resize-y font-sans leading-relaxed focus:border-accent/50 transition-colors"
              rows={6}
            />
          </div>

          {/* Starter Prompts */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white">Prompts de Inicio (opcional)</label>
            <p className="text-xs text-gray-500 m-0">Sugerencias que aparecerán al usar la herramienta. Una por línea.</p>
            <textarea
              placeholder={"¿Cómo puedo mejorar mi copy?\nEscribe un titular para...\nAnaliza esta campaña"}
              value={starterPrompts}
              onChange={e => setStarterPrompts(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none resize-y font-sans leading-relaxed focus:border-accent/50 transition-colors"
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="bg-transparent border border-white/20 rounded-xl px-5 py-2.5 text-gray-400 text-sm cursor-pointer hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-accent border-none rounded-xl px-6 py-2.5 text-white text-sm font-semibold cursor-pointer hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : (tool ? 'Guardar Cambios' : 'Guardar Prompt')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ToolEditorModal;
