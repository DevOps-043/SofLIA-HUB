import { normalizeForMatch } from './text-utils';
import type { InternalAssetRecord } from './types';

export function resolveAssetByReference(assets: InternalAssetRecord[], assetRef: string): InternalAssetRecord {
  const rawRef = String(assetRef || '').trim();
  if (!rawRef) {
    throw new Error('Debes indicar el archivo o asset que quieres recuperar.');
  }

  const exact = assets.find((asset) => asset.asset_ref === rawRef);
  if (exact) {
    return exact;
  }

  const normalizedRef = normalizeForMatch(rawRef);
  const scored = assets
    .map((asset) => {
      const normalizedName = normalizeForMatch(asset.file_name);
      let score = 0;
      if (normalizedName === normalizedRef) score = 1000;
      else if (normalizedName.startsWith(normalizedRef)) score = 800;
      else if (normalizedName.includes(normalizedRef)) score = 700;
      else if (asset.kind === 'message_image' && ['imagen', 'image', 'img'].includes(normalizedRef)) score = 500;
      return { asset, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) =>
      right.score !== left.score
        ? right.score - left.score
        : new Date(right.asset.created_at).getTime() - new Date(left.asset.created_at).getTime(),
    );

  if (scored.length === 0) {
    throw new Error(`No encontre un archivo o asset que coincida con "${rawRef}".`);
  }
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    const options = scored.slice(0, 5).map((item) => `- ${item.asset.file_name} (${item.asset.asset_ref})`).join('\n');
    throw new Error(`La referencia "${rawRef}" es ambigua. Opciones:\n${options}`);
  }
  return scored[0].asset;
}
