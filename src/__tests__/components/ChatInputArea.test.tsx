import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInputArea } from '../../adapters/desktop_ui/chat-ui/ChatInputArea';
import type { ChatUIController } from '../../adapters/desktop_ui/chat-ui/useChatUIController';

vi.mock('../../adapters/desktop_ui/chat-ui/input/AttachmentPreviewStrip', () => ({ AttachmentPreviewStrip: () => null }));
vi.mock('../../adapters/desktop_ui/chat-ui/input/ModeBadges', () => ({ ModeBadges: () => null }));
vi.mock('../../adapters/desktop_ui/chat-ui/input/ToolMenu', () => ({ ToolMenu: () => <button type="button">Adjuntar</button> }));

function createController(compact: boolean): ChatUIController {
  return {
    props: { compact, canSendMessages: true },
    state: {
      input: { value: '', set: vi.fn() },
      modes: { imageGen: false, promptOptimizer: false },
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
