import { testTelegramConnection, updateTelegramConfig } from '../../../services/telegram-service';
import { inputClass, textareaClass } from './styles';
import type { AutomationOpsController } from './useAutomationOpsController';

export function TelegramSettings({ controller }: { controller: AutomationOpsController }) {
  const telegram = controller.forms.telegram;

  return (
    <details className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
      <summary className="cursor-pointer list-none text-xs font-semibold text-gray-600 dark:text-gray-400">Telegram (avanzado)</summary>
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={telegram.enabled} onChange={(event) => telegram.setEnabled(event.target.checked)} />
          Habilitar canal
        </label>
        <input className={inputClass} type="password" value={telegram.token} onChange={(event) => telegram.setToken(event.target.value)} placeholder="Bot token (opcional)" />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} type="number" min={2000} step={1000} value={telegram.pollInterval} onChange={(event) => telegram.setPollInterval(Math.max(2000, Number(event.target.value) || 2000))} />
          <input className={inputClass} value={controller.data.telegramStatus?.bot?.username ? `@${controller.data.telegramStatus.bot.username}` : ''} placeholder="Bot actual" disabled />
        </div>
        <textarea className={textareaClass} value={telegram.allowedChats} onChange={(event) => telegram.setAllowedChats(event.target.value)} placeholder="Chat IDs separados por coma" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white py-2 text-xs font-semibold transition disabled:opacity-40" onClick={() => void controller.runner.runAction('save-telegram', async () => {
            const result = await updateTelegramConfig({ enabled: telegram.enabled, bot_token: telegram.token.trim() || undefined, poll_interval_ms: telegram.pollInterval, allowed_chat_ids: telegram.allowedChats.split(',').map((item) => item.trim()).filter(Boolean) });
            if (!result.success) throw new Error(result.error || 'No pude guardar Telegram.');
            controller.data.setTelegramStatus(result);
            telegram.setToken('');
            await controller.data.refreshOverview(true);
            controller.runner.setNotice('Telegram actualizado.');
          })} disabled={controller.runner.actionKey === 'save-telegram'}>{controller.runner.actionKey === 'save-telegram' ? 'Guardando...' : 'Guardar'}</button>
          <button type="button" className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40" onClick={() => void controller.runner.runAction('test-telegram', async () => {
            const result = await testTelegramConnection();
            if (!result.success) throw new Error(result.error || 'No pude validar el bot.');
            await controller.data.refreshOverview(true);
            controller.runner.setNotice(`Bot conectado: ${result.bot?.username || 'sin nombre'}.`);
          })} disabled={controller.runner.actionKey === 'test-telegram'}>{controller.runner.actionKey === 'test-telegram' ? 'Probando...' : 'Probar bot'}</button>
        </div>
        {controller.data.recentChats.length > 0 && (
          <div className="space-y-1 pt-2">
            <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Actividad reciente</p>
            {controller.data.recentChats.slice(0, 3).map((chat) => (
              <div key={chat.chatId} className="rounded-lg border border-gray-200 dark:border-white/[0.06] px-2.5 py-2">
                <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate">{chat.title}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 truncate">{chat.lastMessagePreview}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
