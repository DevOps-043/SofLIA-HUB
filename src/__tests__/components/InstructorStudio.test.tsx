import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { InstructorStudio } from '../../components/learning-live/instructor/InstructorStudio';
import { StudioClock } from '../../components/learning-live/instructor/StudioClock';
import type { StudioExamples } from '../../components/learning-live/instructor/studio-types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => vi.useRealTimers());
const examples: StudioExamples = { participants: 10, resources: [], messages: [
  { id: '1', authorId: 'a', author: 'Ana', role: 'participant', text: '¿Cómo empiezo?', question: 'Cómo empezar', time: '12:01' },
  { id: '2', authorId: 'a', author: 'Ana', role: 'participant', text: 'Otra pregunta', question: 'Cómo empezar', time: '12:02' },
] };
const openStudio = () => render(<InstructorStudio examples={examples} onBack={vi.fn()} onClose={vi.fn()} />);

describe('diseño del estudio del instructor', () => {
  it('ajusta ambos laterales y escenas sin perder mensaje ni lienzo',()=>{
    openStudio();const canvas=screen.getByLabelText('Monitor de salida del curso');
    fireEvent.change(screen.getByRole('textbox',{name:'Tu mensaje como instructor'}),{target:{value:'Preparando explicación'}});
    const left=screen.getByRole('separator',{name:'Cambiar ancho del chat del instructor'}),right=screen.getByRole('separator',{name:'Cambiar ancho de actividades del instructor'}),scenes=screen.getByRole('separator',{name:'Cambiar altura de escenas y vista previa'});
    fireEvent.keyDown(left,{key:'ArrowRight'});expect(left).toHaveAttribute('aria-valuenow','326');fireEvent.keyDown(right,{key:'ArrowLeft'});expect(right).toHaveAttribute('aria-valuenow','326');fireEvent.keyDown(scenes,{key:'ArrowUp'});expect(scenes).toHaveAttribute('aria-valuenow','160');
    expect(screen.getByLabelText('Monitor de salida del curso')).toBe(canvas);expect(screen.getByRole('textbox',{name:'Tu mensaje como instructor'})).toHaveValue('Preparando explicación');
  });
  it('restringe participantes por comando y conserva el envío del instructor con insignia', () => {
    openStudio();
    const message = screen.getByRole('textbox', { name: 'Tu mensaje como instructor' });
    fireEvent.change(message, { target: { value: '/silenciar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje al grupo' }));
    expect(screen.getByText('Participantes en modo lectura')).toBeInTheDocument();
    fireEvent.change(message, { target: { value: 'Seguimos con la práctica' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje al grupo' }));
    expect(screen.getByText('Seguimos con la práctica').closest('article')).toHaveTextContent('INSTRUCTOR');
    expect(screen.getByRole('region', { name: 'Estadísticas de participación' })).toHaveTextContent('2 mensajes');
  });
  it('permite restringir y excluir mensajes de un usuario solo en la vista local', () => {
    openStudio();
    fireEvent.click(screen.getAllByRole('button', { name: 'Moderar a Ana' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Restringir chat' })[0]);
    expect(screen.getAllByText('Chat restringido · diseño')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Moderar a Ana' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Bloquear de la transmisión' })[0]);
    expect(screen.queryByText('¿Cómo empiezo?')).not.toBeInTheDocument();
  });
  it('prepara salas equilibradas por tamaño y por cantidad sin perder participantes', () => {
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: /Salas de práctica/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preparar salas' }));
    const rooms = screen.getByRole('region', { name: 'Salas preparadas' });
    expect(rooms).toHaveTextContent('3 salas preparadas');
    expect(rooms).toHaveTextContent('Sala 14Sala 23Sala 33');
    fireEvent.click(screen.getByRole('button', { name: /Salas de práctica/ }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Distribuir por' }));
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('listbox'));
    fireEvent.click(screen.getByRole('option', { name: 'Número de salas' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad de salas' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar salas' }));
    expect(rooms).toHaveTextContent('2 salas preparadas');
    expect(rooms).toHaveTextContent('Sala 15Sala 25');
  });
  it('valida opciones únicas del quiz y selecciona material sin subirlo', () => {
    openStudio();
    fireEvent.click(within(screen.getByRole('region', { name: 'Material de la sesión' })).getByRole('button', { name: 'Crear quiz' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu pregunta' }), { target: { value: '¿Qué aprendiste?' } });
    for (const index of [1, 2, 3]) fireEvent.change(screen.getByRole('textbox', { name: `Opción ${index}` }), { target: { value: 'Igual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar quiz' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Escribe una pregunta y respuestas distintas.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Opción 2' }), { target: { value: 'Dos' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Opción 3' }), { target: { value: 'Tres' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar quiz' }));
    expect(screen.getByLabelText('Quiz preparado')).toHaveTextContent('¿Qué aprendiste?');
    fireEvent.change(screen.getByLabelText('Elegir material local'), { target: { files: [new File(['lectura'], 'Guía.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByText('Guía.pdf')).toBeInTheDocument();
    expect(screen.getByText('Material añadido al diseño. No se ha subido.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Subir quiz' }));
    fireEvent.change(screen.getByLabelText('Elegir material local'), { target: { files: [new File(['{}'], 'Evaluación.json', { type: 'application/json' })] } });
    expect(screen.getByText('Evaluación.json')).toBeInTheDocument();
    expect(screen.getByText('Evaluación.json').closest('article')).toHaveTextContent('Quiz · 1 KB · solo local');
    expect(screen.getByText('Quiz añadido al diseño. No se ha subido.')).toBeInTheDocument();
  });
  it('cambia fuentes y conserva la selección de audio al reabrir la configuración', () => {
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: 'Activar micrófono' }));
    fireEvent.click(screen.getByRole('button', { name: 'Configurar audio' }));
    fireEvent.click(screen.getByRole('combobox', { name: /Micrófono · entrada/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Micrófono USB (ejemplo)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Configurar audio' }));
    expect(screen.getByRole('combobox', { name: /Micrófono · entrada/ })).toHaveTextContent('Micrófono USB (ejemplo)');
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apagar cámara' }));
    expect(screen.queryByText('Cámara de ejemplo')).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Controles de la transmisión' })).getByRole('button', { name: 'Activar cámara' })).toHaveAttribute('aria-pressed', 'false');
  });
});
describe('reloj local de actividades', () => {
  it('ajusta la duración con controles propios y respeta límites y reloj activo', () => {
    render(<StudioClock />);
    const duration = screen.getByRole('spinbutton', { name: 'Duración en minutos' });
    const increase = screen.getByRole('button', { name: 'Aumentar duración en minutos' });
    const decrease = screen.getByRole('button', { name: 'Reducir duración en minutos' });
    fireEvent.click(increase);
    expect(screen.getByLabelText('Tiempo de actividad')).toHaveTextContent('06:00');
    fireEvent.change(duration, { target: { value: '1' } });
    expect(decrease).toBeDisabled();
    fireEvent.change(duration, { target: { value: '180' } });
    expect(increase).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar reloj' }));
    expect(duration).toBeDisabled();
    expect(decrease).toBeDisabled();
  });
  it('se detiene al llegar a cero y libera el intervalo al desmontar', () => {
    vi.useFakeTimers();
    const view = render(<StudioClock />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Duración en minutos' }), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar reloj' }));
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByLabelText('Tiempo de actividad')).toHaveTextContent('00:00');
    expect(screen.getByRole('button', { name: 'Iniciar reloj' })).toBeDisabled();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cronómetro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar reloj' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByLabelText('Tiempo de actividad')).toHaveTextContent('00:03');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
