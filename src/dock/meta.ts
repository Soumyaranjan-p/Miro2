import type { ProviderUsage } from "../ipc/types";

export interface ProviderMeta {
  id: string;
  name: string;
  monogram: string;
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  zcode: { id: "zcode", name: "Zcode", monogram: "Z" },
  opencode: { id: "opencode", name: "OpenCode", monogram: "O" },
  claude: { id: "claude", name: "Claude Code", monogram: "C" },
  codex: { id: "codex", name: "Codex", monogram: "X" },
  devin: { id: "devin", name: "Devin", monogram: "D" },
};

export function metaFor(provider: ProviderUsage): ProviderMeta {
  return (
    PROVIDER_META[provider.id] ?? {
      id: provider.id,
      name: provider.id,
      monogram: provider.id.charAt(0).toUpperCase(),
    }
  );
}
