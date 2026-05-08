export function parseTerminalCommand(message: string): string[] {
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const args: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(message)) !== null) {
    if (match[1] !== undefined) {
      args.push(match[1]);
    } else if (match[2] !== undefined) {
      args.push(match[2]);
    } else {
      args.push(match[0]);
    }
  }

  return args;
}
