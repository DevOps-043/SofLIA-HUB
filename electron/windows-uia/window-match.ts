export function findLikelyWindow(
  task: string,
  windows: Array<{ title: string; process: string; pid: number }>,
): { title: string; process: string; pid: number } | null {
  const normalizedTask = task.toLowerCase();
  let best: { title: string; process: string; pid: number } | null = null;
  let bestScore = 0;

  for (const window of windows) {
    const haystack = `${window.title} ${window.process}`.toLowerCase();
    let score = 0;
    if (normalizedTask.includes(window.title.toLowerCase()) || normalizedTask.includes(window.process.toLowerCase())) score += 3;
    for (const token of normalizedTask.split(/\s+/)) {
      if (token.length >= 4 && haystack.includes(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = window;
    }
  }

  return bestScore >= 2 ? best : null;
}
