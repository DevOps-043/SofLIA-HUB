export function TimelineEmptyState() {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-secondary font-medium text-sm">Sin actividad registrada</h3>
    </div>
  );
}
