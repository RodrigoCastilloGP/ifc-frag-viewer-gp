import * as OBC from "@thatopen/components";
import type { CatalogModel } from "./catalog";
import { resolveMaybeRelativeUrl } from "./url";
import { fetchArrayBufferWithProgress } from "./progress";

export type LoadedModelInfo = {
  modelId: string; // id del FRAG cargado (clave en fragments.list)
  packId: string; // id del paquete en models.json
  packLabel: string;
  fragmentLabel: string;
  url: string; // URL final resuelta
};

export type LoadProgress = {
  stage: "idle" | "download" | "load" | "done";
  message: string;
  overall01: number; // 0..1
  file01: number | null; // 0..1 o null indeterminado
  modelId?: string;
};

export class ModelManager {
  private registry = new Map<string, LoadedModelInfo>();
  private busy = false;
  private aborter: AbortController | null = null;

  private fragments: OBC.FragmentsManager;

  constructor(fragments: OBC.FragmentsManager) {
    this.fragments = fragments;
  }

  get isBusy() {
    return this.busy;
  }

  getLoaded(): LoadedModelInfo[] {
    return [...this.registry.values()];
  }

  getMeta(modelId: string): LoadedModelInfo | undefined {
    return this.registry.get(modelId);
  }

  /** Cancela una carga activa (si existe). */
  cancelActiveLoad() {
    this.aborter?.abort();
    this.aborter = null;
  }

  /** Elimina 1 modelo (FRAG) por modelId liberando memoria. */
  async disposeModel(modelId: string) {
    if (!this.registry.has(modelId)) return;
    await this.fragments.core.disposeModel(modelId);
    this.registry.delete(modelId);
  }

  /** Elimina todos los modelos cargados. */
  async disposeAll() {
    const ids: string[] = Array.from(this.fragments.list as any, (entry: any) => entry?.[0])
      .filter(Boolean)
      .map((x: any) => String(x));

    for (const id of ids) {
      await this.fragments.core.disposeModel(id);
    }

    this.registry.clear();
  }

  /** Carga un paquete (models.json) con soporte de federación. */
  async loadPack(
    pack: CatalogModel,
    opts: {
      replace: boolean;
      onProgress?: (p: LoadProgress) => void;
    },
  ) {
    if (this.busy) throw new Error("Ya hay una carga en curso.");
    this.busy = true;

    this.cancelActiveLoad();
    this.aborter = new AbortController();
    const signal = this.aborter.signal;

    const report = (p: LoadProgress) => opts.onProgress?.(p);

    try {
      if (opts.replace) {
        report({ stage: "idle", message: "Limpiando modelos…", overall01: 0, file01: null });
        await this.disposeAll();
      }

      const frags = pack.fragments;

      for (let i = 0; i < frags.length; i++) {
        const frag = frags[i];
        const modelId = frag.id;

        if (this.registry.has(modelId)) {
          report({
            stage: "idle",
            message: `⏭️ ${modelId} ya está cargado; se omite.`,
            overall01: (i + 1) / frags.length,
            file01: 1,
            modelId,
          });
          continue;
        }

        // ✅ AQUÍ se resuelve la ruta relativa del models.json a URL absoluta
        const url = resolveMaybeRelativeUrl(frag.url);

        report({
          stage: "download",
          message: `Descargando ${frag.label}… (${i + 1}/${frags.length})`,
          overall01: i / frags.length,
          file01: 0,
          modelId,
        });

        let buf: ArrayBuffer;
        try {
          buf = await fetchArrayBufferWithProgress(
            url,
            (f01) => {
              report({
                stage: "download",
                message: `Descargando ${frag.label}… ${
                  f01 === null ? "(sin content-length)" : `${Math.round(f01 * 100)}%`
                }`,
                overall01: (i + (f01 ?? 0)) / frags.length,
                file01: f01,
                modelId,
              });
            },
            signal,
          );
        } catch (e: any) {
          throw new Error(`No se pudo descargar FRAG "${frag.label}" (${url}). ${e?.message ?? e}`);
        }

        report({
          stage: "load",
          message: `Cargando al viewer: ${frag.label}…`,
          overall01: (i + 0.9) / frags.length,
          file01: 1,
          modelId,
        });

        await this.fragments.core.load(new Uint8Array(buf), { modelId });

        this.registry.set(modelId, {
          modelId,
          packId: pack.id,
          packLabel: pack.label,
          fragmentLabel: frag.label,
          url,
        });

        report({
          stage: "idle",
          message: `✅ Cargado: ${frag.label}`,
          overall01: (i + 1) / frags.length,
          file01: 1,
          modelId,
        });
      }

      report({
        stage: "done",
        message: `✅ Paquete cargado: ${pack.label}`,
        overall01: 1,
        file01: 1,
      });
    } catch (e) {
      if (signal.aborted) throw new Error("Carga cancelada.");
      throw e;
    } finally {
      this.busy = false;
      this.aborter = null;
    }
  }
}
