export interface CasterFmConfig {
  publicToken: string | null;
  channelId: string | null;
  configured: boolean;
}

function readPublicValue(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

export function getCasterFmConfig(): CasterFmConfig {
  const publicToken = readPublicValue(import.meta.env.VITE_CASTERFM_PUBLIC_TOKEN);
  const channelId = readPublicValue(import.meta.env.VITE_CASTERFM_CHANNEL_ID);

  return {
    publicToken,
    channelId,
    configured: publicToken !== null,
  };
}
