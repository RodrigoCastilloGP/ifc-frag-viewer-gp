import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import type { ViewerContext } from "./viewer";
import type { LoadedModelInfo } from "./model-manager";

export type SelectionPayload = {
  modelId: string;
  localId: number;
  modelMeta?: LoadedModelInfo;
  itemData?: any;
};

export class InteractionManager {
  private highlighter: any = null;
  private hoverer: any = null;
  private hider: OBC.Hider;

  // ✅ Evita "constructor(private ...)" por erasableSyntaxOnly
  private ctx: ViewerContext;
  private getMeta: (modelId: string) => LoadedModelInfo | undefined;

  constructor(
    ctx: ViewerContext,
    getMeta: (modelId: string) => LoadedModelInfo | undefined,
  ) {
    this.ctx = ctx;
    this.getMeta = getMeta;

    // Hider lo obtenemos desde components (multi-model)
    this.hider = this.ctx.components.get(OBC.Hider);
  }

  async init(onSelection: (sel: SelectionPayload | null) => void) {
    // Raycaster para el world (requisito para interacción)
    this.ctx.components.get(OBC.Raycasters).get(this.ctx.world);

    // Highlighter (click select)
    this.highlighter = this.ctx.components.get(OBCF.Highlighter);
    await this.highlighter.setup({ world: this.ctx.world });

    // Estilos básicos
    this.highlighter.styles.set("select", {
      color: new THREE.Color("#ff8800"),
      opacity: 0.85,
      transparent: true,
    });

    this.highlighter.styles.set("hover", {
      color: new THREE.Color("#3aa0ff"),
      opacity: 0.55,
      transparent: true,
    });

    // Hoverer (hover highlight)
    this.hoverer = this.ctx.components.get(OBCF.Hoverer);
    this.hoverer.world = this.ctx.world;
    this.hoverer.enabled = true;
    this.hoverer.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#3aa0ff"),
      transparent: true,
      opacity: 0.35,
      depthTest: false,
    });

    // Evento selección
    this.highlighter.events.select.onHighlight.add(async (modelIdMap: OBC.ModelIdMap) => {
      const entries = Object.entries(modelIdMap).filter(
        ([, set]) => set && (set as Set<number>).size,
      );

      if (entries.length === 0) {
        onSelection(null);
        return;
      }

      const [modelId, set] = entries[0] as [string, Set<number>];
      const localId = [...set][0];

      const model = (this.ctx.fragments.list as any).get(modelId);
      let itemData: any = undefined;

      // getItemsData está en FragmentsModel
      if (model?.getItemsData) {
        const dataArr = await model.getItemsData([localId]);
        itemData = Array.isArray(dataArr) ? dataArr[0] : dataArr;
      }

      onSelection({
        modelId,
        localId,
        modelMeta: this.getMeta(modelId),
        itemData,
      });
    });

    this.highlighter.events.select.onClear.add(() => onSelection(null));
  }

  async isolateSelection() {
    if (!this.highlighter) throw new Error("Highlighter no inicializado.");

    const sel = this.highlighter.selection.select as OBC.ModelIdMap;
    if (!sel || OBC.ModelIdMapUtils.isEmpty(sel)) {
      throw new Error("No hay selección para aislar.");
    }

    await this.hider.isolate(sel);
  }

  async showAll() {
    await this.hider.set(true);
  }

  clearSelection() {
    if (!this.highlighter) return;
    this.highlighter.clear("select");
  }

  async isolate(modelIdMap: OBC.ModelIdMap) {
    await this.hider.isolate(modelIdMap);
  }
}
