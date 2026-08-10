import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SkillsSettingsPanel } from '../../components/skills-settings/SkillsSettingsPanel';
import { PRESENTACIONES_SKILL } from '../../shared/skills/presentaciones-skill';
import type { SkillCatalog } from '../../services/skills-service';
import type { UserSkill } from '../../shared/skills/types';

const SKILL_USUARIO: UserSkill = {
  skillClass: 'usuario',
  id: 'user-skill-1',
  userId: 'user-1',
  name: 'Resumen ejecutivo',
  command: 'resumen',
  description: 'Resume documentos largos.',
  icon: 'resumen',
  category: 'documentos',
  instructions: 'Resume en tres puntos.',
  starterPrompts: [],
  isFavorite: false,
  usageCount: 0,
  createdAt: '2026-08-07T10:00:00.000Z',
  updatedAt: '2026-08-07T10:00:00.000Z',
};

const resolveSkillCatalog = vi.fn(async (): Promise<SkillCatalog> => ({
  system: [PRESENTACIONES_SKILL],
  user: [SKILL_USUARIO],
  all: [PRESENTACIONES_SKILL, SKILL_USUARIO],
}));
const createUserSkill = vi.fn(async (input: unknown) => { void input; return SKILL_USUARIO; });
const updateUserSkill = vi.fn(async (id: string, input: unknown) => { void id; void input; return SKILL_USUARIO; });
const deleteUserSkill = vi.fn(async (id: string) => void id);

vi.mock('../../services/skills-service', () => ({
  resolveSkillCatalog: () => resolveSkillCatalog(),
  createUserSkill: (input: unknown) => createUserSkill(input),
  updateUserSkill: (id: string, input: unknown) => updateUserSkill(id, input),
  deleteUserSkill: (id: string) => deleteUserSkill(id),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('configuracion de skills', () => {
  it('lista las skills del usuario con su comando', async () => {
    render(<SkillsSettingsPanel />);

    expect(await screen.findByText('Resumen ejecutivo')).toBeInTheDocument();
    expect(screen.getByText('/resumen')).toBeInTheDocument();
  });

  it('muestra las del sistema como referencia, sin acciones de edicion', async () => {
    render(<SkillsSettingsPanel />);

    expect(await screen.findByText('Presentaciones')).toBeInTheDocument();
    expect(screen.getByText('/presentacion')).toBeInTheDocument();
    // Solo la skill del usuario ofrece editar y eliminar.
    expect(screen.getAllByText('Editar')).toHaveLength(1);
    expect(screen.getAllByText('Eliminar')).toHaveLength(1);
  });

  it('abre el formulario de creacion', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Nueva skill'));

    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Comando de invocacion')).toBeInTheDocument();
    expect(screen.getByLabelText('Instrucciones')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Icono de la skill' })).toBeInTheDocument();
  });

  it('deriva el comando del nombre cuando se deja vacio', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Nueva skill'));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Informe semanal' } });

    expect(screen.getByText('Se invoca escribiendo /informe-semanal en el chat.')).toBeInTheDocument();
  });

  it('avisa cuando el comando ya lo usa otra skill', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Nueva skill'));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otra cosa' } });
    fireEvent.change(screen.getByLabelText('Comando de invocacion'), { target: { value: 'presentacion' } });

    expect(screen.getByText('Ya usas /presentacion en otra skill.')).toBeInTheDocument();
  });

  it('no guarda una skill cuyo comando choca', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Nueva skill'));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otra cosa' } });
    fireEvent.change(screen.getByLabelText('Comando de invocacion'), { target: { value: 'resumen' } });
    fireEvent.change(screen.getByLabelText('Instrucciones'), { target: { value: 'Haz algo.' } });
    fireEvent.click(screen.getByText('Crear skill'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ya usas /resumen'));
    expect(createUserSkill).not.toHaveBeenCalled();
  });

  it('exige nombre e instrucciones', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Nueva skill'));
    fireEvent.click(screen.getByText('Crear skill'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('El nombre es obligatorio'));
    expect(createUserSkill).not.toHaveBeenCalled();
  });

  it('crea una skill con icono y comando', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Nueva skill'));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Informe semanal' } });
    fireEvent.change(screen.getByLabelText('Instrucciones'), { target: { value: 'Redacta el informe.' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Grafica' }));
    fireEvent.click(screen.getByText('Crear skill'));

    await waitFor(() => expect(createUserSkill).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Informe semanal',
      command: 'informe-semanal',
      icon: 'grafica',
      instructions: 'Redacta el informe.',
    })));
  });

  it('edita una skill existente cargando sus valores', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Editar'));

    expect(screen.getByLabelText('Nombre')).toHaveValue('Resumen ejecutivo');
    expect(screen.getByLabelText('Comando de invocacion')).toHaveValue('resumen');
    expect(screen.getByLabelText('Instrucciones')).toHaveValue('Resume en tres puntos.');
  });

  it('al editar, su propio comando no cuenta como conflicto', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Editar'));

    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(updateUserSkill).toHaveBeenCalledWith('user-skill-1', expect.objectContaining({
      command: 'resumen',
    })));
  });

  it('elimina una skill del usuario', async () => {
    render(<SkillsSettingsPanel />);
    fireEvent.click(await screen.findByText('Eliminar'));

    await waitFor(() => expect(deleteUserSkill).toHaveBeenCalledWith('user-skill-1'));
  });

  it('avisa cuando el usuario no tiene skills', async () => {
    resolveSkillCatalog.mockResolvedValueOnce({
      system: [PRESENTACIONES_SKILL],
      user: [],
      all: [PRESENTACIONES_SKILL],
    });

    render(<SkillsSettingsPanel />);

    expect(await screen.findByText(/Todavia no has creado ninguna skill/)).toBeInTheDocument();
  });
});
