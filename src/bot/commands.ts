export interface ParsedCommand {
  name: string;
  args: string;
  rawArgs: string[];
  flags: Set<string>;
}

export const PUBLIC_COMMANDS = new Set([
  "play", "add", "queue", "list", "now", "lyrics", "vote", "help",
  "playlist", "album", "fm", "prev", "next", "skip", "pause", "resume",
  "artist", "ai",
]);

export const ADMIN_COMMANDS = new Set([
  "stop", "clear", "move", "vol", "mode", "follow", "remove",
]);

export function parseCommand(
  message: string,
  prefix: string,
  aliases: Record<string, string> = {},
): ParsedCommand | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith(prefix)) return null;

  const withoutPrefix = trimmed.slice(prefix.length);
  if (!withoutPrefix) return null;

  const parts = withoutPrefix.split(/\s+/);
  let name = parts[0].toLowerCase();

  if (aliases[name]) {
    name = aliases[name];
  }

  const flags = new Set<string>();
  const argParts: string[] = [];

  for (let i = 1; i < parts.length; i++) {
    if (
      parts[i].startsWith("-") &&
      parts[i].length === 2 &&
      /[a-zA-Z]/.test(parts[i][1])
    ) {
      flags.add(parts[i][1].toLowerCase());
    } else {
      argParts.push(parts[i]);
    }
  }

  return {
    name,
    args: argParts.join(" "),
    rawArgs: argParts,
    flags,
  };
}

export function isAdminCommand(commandName: string): boolean {
  return ADMIN_COMMANDS.has(commandName);
}
