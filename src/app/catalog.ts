import { resolvePublicUrl } from "./url";

export type Catalog = { models: CatalogModel[] };

export type CatalogModel = {
  id: string;
  label: string;
  fragments: CatalogFragment[];
};

export type CatalogFragment = {
  id: string;     // este será el modelId del FRAG en fragments.core.load
  label: string;
  url: string;    // puede ser absoluta (https://...) o relativa (models/mi.frag)
};

export function defaultCatalogUrl(): string {
  return resolvePublicUrl("models.json");
}

export async function loadCatalog(catalogUrl: string): Promise<Catalog> {
  const res = await fetch(catalogUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo cargar models.json (${catalogUrl}). HTTP ${res.status}`);
  }

  const raw = await res.json();
  const modelsRaw = Array.isArray(raw) ? raw : raw?.models;

  if (!Array.isArray(modelsRaw)) {
    throw new Error(`models.json inválido. Se esperaba {"models":[...]} o un arreglo.`);
  }

  const models: CatalogModel[] = modelsRaw.map((m: any) => {
    const id = String(m.id ?? "");
    const label = String(m.label ?? m.name ?? id);
    const fragmentsRaw = m.fragments;

    if (!id || !label || !Array.isArray(fragmentsRaw) || fragmentsRaw.length === 0) {
      throw new Error(`Entrada inválida en models.json. Revisa id/label/fragments.`);
    }

    const fragments: CatalogFragment[] = fragmentsRaw.map((f: any) => {
      const fid = String(f.id ?? "");
      const flabel = String(f.label ?? f.name ?? fid);
      const url = String(f.url ?? "");
      if (!fid || !url) {
        throw new Error(`Fragment inválido en "${label}". Revisa fragments[].id y fragments[].url`);
      }
      return { id: fid, label: flabel, url };
    });

    return { id, label, fragments };
  });

  return { models };
}
