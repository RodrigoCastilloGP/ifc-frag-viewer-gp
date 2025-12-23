import "./style.css";
import { defaultCatalogUrl, loadCatalog, type CatalogModel } from "./app/catalog";
import {
  getUI,
  renderCatalog,
  renderLoadedModelsText,
  setBusy,
  setProgress,
  setStatus,
} from "./app/ui";
import { initViewer } from "./app/viewer";
import { ModelManager } from "./app/model-manager";
import { InteractionManager } from "./app/interaction";
import * as OBC from "@thatopen/components";
import {
  CATEGORY_PRESETS,
  buildModelIdMapForCategory,
  computeCategoryCounts,
} from "./app/categories";

async function main() {
  const ui = getUI();

  // 2.7.1 ✅ Unhandled errors con UI visible
  window.addEventListener("unhandledrejection", (ev) => {
    console.error(ev.reason);
    const msg = (ev.reason as Error)?.message ?? String(ev.reason);
    setStatus(ui, `Unhandled promise: ${msg}`, "bad");
  });

  window.addEventListener("error", (ev) => {
    console.error((ev as ErrorEvent).error ?? (ev as ErrorEvent).message);
    setStatus(ui, `Error: ${(ev as ErrorEvent).message}`, "bad");
  });

  // 1) Viewer (core)
  const ctx = await initViewer(ui.viewer, (warn) => setStatus(ui, warn, "warn"));
  const modelManager = new ModelManager(ctx.fragments);

  // 2) Interacción BIM (2.4) + Panel props endurecido (2.5)
  const interaction = new InteractionManager(ctx, (id) => modelManager.getMeta(id));

  await interaction.init((sel) => {
    if (!sel) {
      ui.selectionInfo.textContent = "Ninguna selección.";
      ui.propsPanel.textContent = "{}";
      return;
    }

    const originText = sel.modelMeta
      ? `${sel.modelMeta.packLabel} / ${sel.modelMeta.fragmentLabel} (modelId=${sel.modelId})`
      : `modelId=${sel.modelId}`;

    ui.selectionInfo.textContent = `Seleccionado: ${originText} — localId=${sel.localId}`;

    const payload = {
      origin: {
        pack: sel.modelMeta?.packLabel ?? "N/A",
        fragment: sel.modelMeta?.fragmentLabel ?? "N/A",
        modelId: sel.modelId,
        localId: sel.localId,
        url: sel.modelMeta?.url ?? "N/A",
      },
      props: sel.itemData ?? {},
    };

    ui.propsPanel.textContent = JSON.stringify(payload, null, 2);
  });

  // 3) Catálogo
  ui.catalogUrl.value = defaultCatalogUrl();
  let catalogModels: CatalogModel[] = [];

  // 3.2) Render de categorías + click isolate por categoría (2.6)
  const refreshCategories = async () => {
    const loaded = modelManager.getLoaded();
    if (loaded.length === 0) {
      ui.categoriesPanel.textContent = "Carga un modelo para ver categorías…";
      ui.categoriesPanel.className = "small muted";
      return;
    }

    try {
      ui.categoriesPanel.className = "small";

      const counts = await computeCategoryCounts(ctx.fragments);

      const html = counts
        .map((c) => {
          const disabled = c.total === 0 ? "disabled" : "";
          return `
            <button data-cat="${c.preset.key}" class="secondary" style="width:100%; margin-bottom:8px;" ${disabled}>
              ${c.preset.label} <span style="opacity:.7">(${c.total})</span>
            </button>
          `;
        })
        .join("");

      ui.categoriesPanel.innerHTML = html;

      ui.categoriesPanel.querySelectorAll("button[data-cat]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const key = (btn as HTMLButtonElement).dataset.cat!;
          const preset = CATEGORY_PRESETS.find((p) => p.key === key);
          if (!preset) return;

          try {
            setStatus(ui, `Isolating categoría: ${preset.label}…`, "info");

            const map = await buildModelIdMapForCategory(ctx.fragments, preset);
            if (OBC.ModelIdMapUtils.isEmpty(map)) {
              setStatus(ui, `No se encontraron elementos para ${preset.label}.`, "warn");
              return;
            }

            await interaction.isolate(map);
            setStatus(ui, `Isolate: ${preset.label}`, "good");
          } catch (e) {
            setStatus(ui, `Categoría: ${(e as Error).message}`, "bad");
          }
        });
      });
    } catch (e) {
      console.error(e);
      ui.categoriesPanel.textContent = "Error calculando categorías (ver consola).";
      ui.categoriesPanel.className = "small bad";
    }
  };

  // 3.1) Render de modelos cargados
  const refreshLoadedModels = () => {
    const loaded = modelManager.getLoaded();
    if (loaded.length === 0) {
      renderLoadedModelsText(ui, `<div class="muted">Ninguno.</div>`);
      return;
    }

    const rows = loaded
      .map((m) => {
        return `
          <div style="border:1px solid rgba(35,48,68,0.6); border-radius:10px; padding:8px; margin-bottom:8px;">
            <div><b>${m.fragmentLabel}</b></div>
            <div class="muted">modelId: ${m.modelId}</div>
            <div class="muted">pack: ${m.packLabel}</div>
            <button data-dispose="${m.modelId}" class="secondary" style="margin-top:6px; width:100%;">Eliminar</button>
          </div>
        `;
      })
      .join("");

    renderLoadedModelsText(ui, rows);

    ui.loadedModelsPanel.querySelectorAll("button[data-dispose]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const modelId = (btn as HTMLButtonElement).dataset.dispose!;

        await modelManager.disposeModel(modelId);

        interaction.clearSelection();

        refreshLoadedModels();
        await refreshCategories();

        setStatus(ui, `Modelo eliminado: ${modelId}`, "good");
      });
    });
  };

  const refreshCatalog = async () => {
    setBusy(ui, true);
    setProgress(ui, 0);
    setStatus(ui, "Cargando catálogo…", "info");

    try {
      const catalog = await loadCatalog(ui.catalogUrl.value.trim());
      catalogModels = catalog.models;
      renderCatalog(ui, catalogModels);
      setStatus(ui, `Catálogo listo (${catalogModels.length} entradas).`, "good");
      setProgress(ui, 100);
    } catch (e) {
      setStatus(ui, `Error cargando catálogo: ${(e as Error).message}`, "bad");
      setProgress(ui, 0);
    } finally {
      setBusy(ui, false);
    }
  };

  ui.reloadCatalogBtn.addEventListener("click", refreshCatalog);

  // 4) Carga de modelos
  ui.loadModelBtn.addEventListener("click", async () => {
    const pack = catalogModels.find((m) => m.id === ui.modelSelect.value);
    if (!pack) return;

    setBusy(ui, true);
    setProgress(ui, 0);
    setStatus(ui, `Iniciando carga: ${pack.label}`, "info");

    try {
      // ✅ FIX: si no hay modelos cargados, NO llames showAll() (puede colgarse)
      if (ui.replaceMode.checked) {
        const hadAny = modelManager.getLoaded().length > 0;
        if (hadAny) {
          await interaction.showAll().catch((e) => console.warn("showAll skipped:", e));
        }
        interaction.clearSelection();
      }

      await modelManager.loadPack(pack, {
        replace: ui.replaceMode.checked,
        onProgress: (p) => {
          setStatus(ui, p.message, p.stage === "done" ? "good" : "info");
          if (p.file01 === null) setProgress(ui, null);
          else setProgress(ui, Math.round((p.overall01 ?? 0) * 100));
        },
      });

      refreshLoadedModels();
      await refreshCategories();

      await ctx.world.camera.fitToItems();

      setStatus(ui, "Carga finalizada.", "good");
      setProgress(ui, 100);
    } catch (e) {
      setStatus(ui, `Error: ${(e as Error).message}`, "bad");
      setProgress(ui, 0);
    } finally {
      setBusy(ui, false);
    }
  });

  // ✅ Vaciar modelos (await + cancelActiveLoad + showAll solo si había algo)
  ui.clearModelsBtn.addEventListener("click", async () => {
    const hadAny = modelManager.getLoaded().length > 0;

    modelManager.cancelActiveLoad();

    await modelManager.disposeAll();
    refreshLoadedModels();

    if (hadAny) {
      await interaction.showAll().catch((e) => console.warn("showAll skipped:", e));
    }
    interaction.clearSelection();

    await refreshCategories();

    setStatus(ui, "Se eliminaron todos los modelos.", "good");
    setProgress(ui, 0);
  });

  // 2.3 ✅ Botones de cámara
  ui.zoomToFitBtn.addEventListener("click", async () => {
    await ctx.world.camera.fitToItems();
    setStatus(ui, "Zoom to Fit.", "info");
  });

  ui.toggleProjBtn.addEventListener("click", () => {
    const cam = ctx.world.camera;
    const current = cam.projection.current;
    const next = current === "Perspective" ? "Orthographic" : "Perspective";
    cam.projection.set(next);
    setStatus(ui, `Proyección: ${next}`, "info");
  });

  // 2.4 ✅ Isolate / Show All
  ui.isolateBtn.addEventListener("click", async () => {
    try {
      await interaction.isolateSelection();
      setStatus(ui, "Isolate aplicado a la selección.", "good");
    } catch (e) {
      setStatus(ui, `Isolate: ${(e as Error).message}`, "warn");
    }
  });

  ui.showAllBtn.addEventListener("click", async () => {
    await interaction.showAll().catch((e) => console.warn("showAll skipped:", e));
    setStatus(ui, "Show All (visibilidad restaurada).", "good");
  });

  await refreshCatalog();
  refreshLoadedModels();
  await refreshCategories();
}

main().catch((e) => {
  console.error(e);
  alert((e as Error).message);
});
