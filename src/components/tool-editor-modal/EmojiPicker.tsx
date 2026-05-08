const EMOJI_OPTIONS = ['⚙️', '🔧', '💡', '🎯', '📝', '💻', '🎨', '📊', '🔬', '🚀', '⭐', '🎓', '📣', '🤖', '✨', '🧠'];

interface EmojiPickerProps {
  icon: string;
  show: boolean;
  onToggle: () => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ icon, show, onToggle, onSelect }: EmojiPickerProps) {
  return (
    <div className="relative">
      <button
        type="button"
        className="w-12 h-12 text-2xl bg-white/5 border border-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
        onClick={onToggle}
      >
        {icon}
      </button>
      {show && (
        <div className="absolute top-full left-0 mt-2 bg-[#252b3d] rounded-xl p-2 grid grid-cols-4 gap-1 z-50 border border-white/10 shadow-xl">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="w-9 h-9 text-xl bg-transparent border-none rounded-lg cursor-pointer flex items-center justify-center hover:bg-white/10 transition-colors"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
