import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInputArea } from '../../adapters/desktop_ui/chat-ui/ChatInputArea';
import type { ChatUIController } from '../../adapters/desktop_ui/chat-ui/useChatUIController';

vi.mock('../../adapters/desktop_ui/chat-ui/input/AttachmentPreviewStrip', () => ({ AttachmentPreviewStrip: () => null }));
vi.mock('../../adapters/desktop_ui/chat-ui/input/ModeBadges', () => ({ ModeBadges: () => null }));
vi.mock('../../adapters/desktop_ui/chat-ui/input/ToolMenu', () => ({ ToolMenu: () => <button type="button">Adjuntar</button> }));

type Overrides = { skillCommands?: Partial<ChatUIController['skillCommands']> };

function createController(compact: boolean, overrides: Overrides = {}): ChatUIController {
  return {
    props: { compact, canSendMessages: true },
    state: {
      input: { value: '', set: vi.fn() },
      selection: { value: null, set: vi.fn() },
      modes: { imageGen: false, promptOptimizer: false },
      // Sin skill activa no hay sugerencias sobre el compositor.
      skillModals: { activeSkill: null },
    },
    runtime: { chat: { showLoadingUI: false } },
    files: { handlePaste: vi.fn() },
    dictation: {
      isRecording: false,
      isTranscribing: false,
      errorMessage: null,
      toggleDictation: vi.fn(),
      stopDictation: vi.fn(),
    },
    // Sin comandos activos: el compositor debe comportarse como siempre.
    skillCommands: {
      visible: false,
      matches: [],
      highlighted: 0,
      setHighlighted: vi.fn(),
      handleKeyDown: vi.fn(() => false),
      activate: vi.fn(),
      ...overrides.skillCommands,
    },
    onSendClick: vi.fn(),
    onStopClick: vi.fn(),
  } as unknown as ChatUIController;
}

describe('ChatInputArea compacto', () => {
  it('muestra un placeholder de una línea sin recorte vertical', () => {
    render(<ChatInputArea controller={createController(true)} />);

    expect(screen.getByText('Escribe a SofLIA...')).toHaveClass('truncate');
    expect(screen.getByRole('textbox', { name: 'Escribe a SofLIA...' })).toHaveStyle({ height: '30px' });
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', '');
  });

  it('conserva el compositor normal fuera del navegador', () => {
    render(<ChatInputArea controller={createController(false)} />);

    expect(screen.getByPlaceholderText('Mensaje a SOFLIA...')).toHaveStyle({ height: '36px' });
  });
});

describe('menu de comandos de skills', () => {
  const matches = [
    {
      command: 'presentacion',
      skill: {
        skillClass: 'sistema',
        id: 'sistema:presentaciones',
        name: 'Presentaciones',
        description: 'Crea presentaciones ejecutivas.',
        icon: '📊',
      },
    },
  ] as unknown as ChatUIController['skillCommands']['matches'];

  it('no aparece cuando no hay comando en curso', () => {
    render(<ChatInputArea controller={createController(false)} />);

    expect(screen.queryByRole('listbox', { name: 'Skills disponibles' })).not.toBeInTheDocument();
  });

  it('muestra las skills coincidentes', () => {
    render(<ChatInputArea controller={createController(false, { skillCommands: { visible: true, matches } })} />);

    expect(screen.getByRole('listbox', { name: 'Skills disponibles' })).toBeInTheDocument();
    expect(screen.getByText('/presentacion')).toBeInTheDocument();
  });

  /**
   * El compositor y el contenedor del chat tienen `overflow-hidden`, asi que
   * un menu posicionado en absoluto sobre el compositor queda recortado y solo
   * se ve una franja. jsdom no calcula layout, por lo que la regresion se
   * cubre por su consecuencia observable: el menu debe ir en flujo normal.
   */
  it('va en flujo normal para que el overflow del compositor no lo recorte', () => {
    render(<ChatInputArea controller={createController(false, { skillCommands: { visible: true, matches } })} />);

    const menu = screen.getByRole('listbox', { name: 'Skills disponibles' });
    const clases = menu.className.split(/\s+/);
    expect(clases).not.toContain('absolute');
    expect(clases).not.toContain('fixed');
  });

  it('se coloca encima de la fila del compositor', () => {
    render(<ChatInputArea controller={createController(false, { skillCommands: { visible: true, matches } })} />);

    const menu = screen.getByRole('listbox', { name: 'Skills disponibles' });
    const textarea = screen.getByRole('textbox');
    // DOCUMENT_POSITION_FOLLOWING: el compositor viene despues del menu.
    expect(menu.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
