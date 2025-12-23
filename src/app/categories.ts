import * as OBC from "@thatopen/components";

export type CategoryPreset = {
  key: string;
  label: string;
  regex: RegExp;
};

export const CATEGORY_PRESETS: CategoryPreset[] = [
  { key: "walls", label: "Walls", regex: /WALL/i },
  { key: "slabs", label: "Floors / Slabs", regex: /SLAB|FLOOR/i },
  { key: "columns", label: "Columns", regex: /COLUMN/i },
  { key: "beams", label: "Beams", regex: /BEAM/i },
  { key: "doors", label: "Doors", regex: /DOOR/i },
  { key: "windows", label: "Windows", regex: /WINDOW/i },
  { key: "spaces", label: "Spaces", regex: /SPACE/i },
];

export type CategoryCounts = {
  preset: CategoryPreset;
  total: number;
  byModel: Record<string, number>;
};

export async function computeCategoryCounts(
  fragments: OBC.FragmentsManager,
): Promise<CategoryCounts[]> {
  const out: CategoryCounts[] = [];

  for (const preset of CATEGORY_PRESETS) {
    const byModel: Record<string, number> = {};
    let total = 0;

    for (const [, model] of fragments.list as any) {
      if (!model?.getItemsOfCategories) continue;

      const items = await model.getItemsOfCategories([preset.regex]);
      const localIds = Object.values(items ?? {}).flat() as number[];
      const count = localIds.length;

      if (count > 0) byModel[model.modelId] = count;
      total += count;
    }

    out.push({ preset, total, byModel });
  }

  return out;
}

export async function buildModelIdMapForCategory(
  fragments: OBC.FragmentsManager,
  preset: CategoryPreset,
): Promise<OBC.ModelIdMap> {
  const modelIdMap: OBC.ModelIdMap = {};

  for (const [, model] of fragments.list as any) {
    if (!model?.getItemsOfCategories) continue;

    const items = await model.getItemsOfCategories([preset.regex]);
    const localIds = Object.values(items ?? {}).flat() as number[];
    if (localIds.length === 0) continue;

    modelIdMap[model.modelId] = new Set(localIds);
  }

  return modelIdMap;
}
