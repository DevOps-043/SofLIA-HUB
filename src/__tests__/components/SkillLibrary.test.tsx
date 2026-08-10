import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SkillLibrary } from '../../components/SkillLibrary';
import type { SkillCatalog } from '../../services/skills-service';
import type { SystemSkill, UserSkill } from '../../shared/skills/types';

const SKILL_SISTEMA: SystemSkill = {
  skillClass: 'sistema',
  id: 'sistema:presentaciones',
  name: 'Presentaciones',
  description: 'Crea presentaciones ejecutivas en HTML.',
  icon: '📊',
  category: 'documentos',
  instructions: 'INSTRUCCIONES DEL SISTEMA',
  starterPrompts: ['Crea una presentacion'],
  surfaces: ['chat'],
  tools: ['workspace_write_file'],
  workspace: {
    rootFolder: 'presentaciones',
    allowedExtensions: ['.html'],
    maxFileBytes: 1024,
    maxWorkspaceBytes: 4096,
    entryFile: 'index.html',
    protectedFiles: [],
  },
};

const SKILL_USUARIO: UserSkill = {
  skillClass: 'usuario',
  id: 'user-skill-1',
  userId: 'user-1',
  command: 'resumen',
  name: 'Resumen ejecutivo',
  description: 'Resume documentos largos.',
  icon: '📝',
  category: 'documentos',
  instructions: 'Resume en tres puntos.',
  starterPrompts: [],
  isFavorite: false,
  usageCount: 0,
  createdAt: '2026-08-06T10:00:00.000Z',
  updatedAt: '2026-08-06T10:00:00.000Z',
};

const resolveSkillCatalog = vi.fn(async (): Promise<SkillCatalog> => ({ system: [], user: [], all: [] }));
const deleteUserSkill = vi.fn(async (id: string) => void id);

vi.mock('../../services/skills-service', () => ({
  resolveSkillCatalog: () => resolveSkillCatalog(),
  deleteUserSkill: (id: string) => deleteUserSkill(id),
}));

type Callbacks = {
  onUseSkill?: (skill: SystemSkill | UserSkill) => void;
  onEditSkill?: (skill: UserSkill) => void;
};

function renderLibrary(overrides?: Callbacks) {
  const onUseSkill = overrides?.onUseSkill ?? vi.fn();
  const onEditSkill = overrides?.onEditSkill ?? vi.fn();
  render(
    <SkillLibrary isOpen onClose={vi.fn()} onUseSkill={onUseSkill} onEditSkill={onEditSkill} />,
  );
  return { onUseSkill, onEditSkill };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveSkillCatalog.mockResolvedValue({
    system: [SKILL_SISTEMA],
    user: [SKILL_USUARIO],
    all: [SKILL_SISTEMA, SKILL_USUARIO],
  });
});

describe('biblioteca de skills', () => {
  it('separa las skills del sistema de las del usuario', async () => {
    renderLibrary();

    expect(await screen.findByText('Skills del sistema')).toBeInTheDocument();
    expect(screen.getByText('Mis skills')).toBeInTheDocument();
    expect(screen.getByText('Presentaciones')).toBeInTheDocument();
    expect(screen.getByText('Resumen ejecutivo')).toBeInTheDocument();
  });

  it('marca visualmente las skills del sistema', async () => {
    renderLibrary();

    expect(await screen.findByText('Sistema')).toBeInTheDocument();
  });

  it('no ofrece editar ni eliminar una skill del sistema', async () => {
    renderLibrary();
    await screen.findByText('Presentaciones');

    // Solo la skill del usuario expone el boton de eliminar.
    expect(screen.queryByLabelText('Eliminar Presentaciones')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Eliminar Resumen ejecutivo')).toBeInTheDocument();
    expect(screen.getAllByText('Editar')).toHaveLength(1);
  });

  it('permite activar una skill del sistema', async () => {
    const { onUseSkill } = renderLibrary();
    await screen.findByText('Presentaciones');

    fireEvent.click(screen.getAllByText('Usar')[0]);

    expect(onUseSkill).toHaveBeenCalledWith(expect.objectContaining({ id: 'sistema:presentaciones' }));
  });

  it('permite editar una skill del usuario', async () => {
    const { onEditSkill } = renderLibrary();
    await screen.findByText('Resumen ejecutivo');

    fireEvent.click(screen.getByText('Editar'));

    expect(onEditSkill).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-skill-1' }));
  });

  it('elimina una skill del usuario', async () => {
    renderLibrary();
    await screen.findByText('Resumen ejecutivo');

    fireEvent.click(screen.getByLabelText('Eliminar Resumen ejecutivo'));

    await waitFor(() => expect(deleteUserSkill).toHaveBeenCalledWith('user-skill-1'));
  });

  it('avisa cuando no hay skills del usuario', async () => {
    resolveSkillCatalog.mockResolvedValue({ system: [SKILL_SISTEMA], user: [], all: [SKILL_SISTEMA] });

    renderLibrary();

    expect(await screen.findByText(/No has creado ninguna skill/)).toBeInTheDocument();
  });

  it('muestra el error cuando el catalogo falla', async () => {
    resolveSkillCatalog.mockRejectedValue(new Error('sin conexion'));

    renderLibrary();

    expect(await screen.findByRole('alert')).toHaveTextContent('sin conexion');
  });
});
