import * as OBC from "@thatopen/components";
import { resolvePublicUrl } from "./url";

export type AppWorld = OBC.SimpleWorld<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBC.SimpleRenderer
>;

export type ViewerContext = {
  components: OBC.Components;
  world: AppWorld;
  fragments: OBC.FragmentsManager;
};

export async function initViewer(
  container: HTMLElement,
  onSoftWarning?: (msg: string) => void,
): Promise<ViewerContext> {
  const components = new OBC.Components();

  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();

  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = null;

  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.OrthoPerspectiveCamera(components);

  // Cámara inicial (no depende del modelo)
  await world.camera.controls.setLookAt(12, 10, 12, 0, 0, 0);

  components.init();
  components.get(OBC.Grids).create(world);

  // Fragments Manager + worker local (public/worker/worker.mjs)
  const fragments = components.get(OBC.FragmentsManager);
  const workerUrl = resolvePublicUrl("worker/worker.mjs");
  fragments.init(workerUrl);

  // Optimización recomendada: update al terminar movimiento de cámara
  world.camera.controls.addEventListener("rest", () => fragments.core.update(true));

  // ✅ Cache de objetos por modelId para poder removerlos aunque el evento deleted no traiga "value"
  const objectByModelId = new Map<string, any>();

  // Cuando entra un modelo: úsalo con la cámara, cachea su object y agrégalo a la escena
  fragments.list.onItemSet.add((ev: any) => {
    const model = ev?.value;
    const modelId = String(ev?.key ?? model?.modelId ?? "");

    try {
      if (modelId && model?.object) {
        objectByModelId.set(modelId, model.object);
      }

      if (model?.useCamera) model.useCamera(world.camera.three);
      if (model?.object) world.scene.three.add(model.object);

      fragments.core.update(true);
    } catch (e) {
      console.error("Error in onItemSet handler:", e);
    }
  });

  // Cuando se elimina: quítalo de la escena (hardening real)
  fragments.list.onItemDeleted.add((ev: any) => {
    try {
      // Algunos builds/eventos no mandan value; intentamos sacar el id de varias formas
      const modelId = String(ev?.key ?? ev?.id ?? ev?.item?.id ?? "");

      const cachedObj = modelId ? objectByModelId.get(modelId) : undefined;
      const valueObj = ev?.value?.object;

      if (cachedObj) {
        world.scene.three.remove(cachedObj);
        objectByModelId.delete(modelId);
      } else if (valueObj) {
        world.scene.three.remove(valueObj);
      } else {
        // No pudimos obtener object; no rompemos el flujo
        console.warn("onItemDeleted: no object found for event", ev);
      }

      fragments.core.update(true);
    } catch (e) {
      // Nunca dejes que esto tumbe el cleanup
      console.error("Error in onItemDeleted handler:", e);
    }
  });

  // Mantén setup de WASM de WebIFC (tu Fase 1), pero si falla NO tumba el viewer.
  const ifcLoader = components.get(OBC.IfcLoader);
  const wasmPath = resolvePublicUrl("wasm/");

  try {
    await ifcLoader.setup({ wasm: { path: wasmPath, absolute: true } });
  } catch (e) {
    onSoftWarning?.(
      `⚠️ WebIFC WASM no disponible (${wasmPath}). Conversión IFC→FRAG deshabilitada, pero FRAG viewer sigue OK.`,
    );
  }

  return { components, world, fragments };
}
