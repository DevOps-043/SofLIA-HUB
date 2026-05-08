interface ProjectEmptyStateProps {
  label: string;
  type: 'chats' | 'sources';
}

export function ProjectEmptyState({ label, type }: ProjectEmptyStateProps) {
  const path = type === 'chats'
    ? 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
    : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';

  return (
    <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
      <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
    </div>
  );
}
