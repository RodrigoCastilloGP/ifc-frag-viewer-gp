import type { CatalogModel } from "./catalog";

export type StatusKind = "info" | "good" | "warn" | "bad";

export type UIRefs = {
  viewer: HTMLDivElement;

  catalogUrl: HTMLInputElement;
  reloadCatalogBtn: HTMLButtonElement;

  modelSelect: HTMLSelectElement;
  replaceMode: HTMLInputElement;

  loadModelBtn: HTMLButtonElement;
  clearModelsBtn: HTMLButtonElement;

  progressBar: HTMLProgressElement;
  statusText: HTMLDivElement;

  zoomToFitBtn: HTMLButtonElement;
  toggleProjBtn: HTMLButtonElement;
  isolateBtn: HTMLButtonElement;
  showAllBtn: HTMLButtonElement;

  selectionInfo: HTMLDivElement;
  propsPanel: HTMLPreElement;

  categoriesPanel: HTMLDivElement;
  loadedModelsPanel: HTMLDivElement;
};

function mustGet<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`No se encontró elemento DOM: ${selector}`);
  return el as T;
}

export function getUI(): UIRefs {
  return {
    viewer: mustGet<HTMLDivElement>("#viewer"),

    catalogUrl: mustGet<HTMLInputElement>("#catalogUrl"),
    reloadCatalogBtn: mustGet<HTMLButtonElement>("#reloadCatalogBtn"),

    modelSelect: mustGet<HTMLSelectElement>("#modelSelect"),
    replaceMode: mustGet<HTMLInputElement>("#replaceMode"),

    loadModelBtn: mustGet<HTMLButtonElement>("#loadModelBtn"),
    clearModelsBtn: mustGet<HTMLButtonElement>("#clearModelsBtn"),

    progressBar: mustGet<HTMLProgressElement>("#progressBar"),
    statusText: mustGet<HTMLDivElement>("#statusText"),

    zoomToFitBtn: mustGet<HTMLButtonElement>("#zoomToFitBtn"),
    toggleProjBtn: mustGet<HTMLButtonElement>("#toggleProjBtn"),
    isolateBtn: mustGet<HTMLButtonElement>("#isolateBtn"),
    showAllBtn: mustGet<HTMLButtonElement>("#showAllBtn"),

    selectionInfo: mustGet<HTMLDivElement>("#selectionInfo"),
    propsPanel: mustGet<HTMLPreElement>("#propsPanel"),

    categoriesPanel: mustGet<HTMLDivElement>("#categoriesPanel"),
    loadedModelsPanel: mustGet<HTMLDivElement>("#loadedModelsPanel"),
  };
}

export function setStatus(ui: UIRefs, msg: string, kind: StatusKind = "info") {
  ui.statusText.textContent = msg;
  ui.statusText.className = `status ${kind}`;
}

export function setProgress(ui: UIRefs, percent: number | null) {
  if (percent === null) {
    // modo indeterminado (si el server no manda content-length)
    ui.progressBar.removeAttribute("value");
    return;
  }
  ui.progressBar.value = Math.max(0, Math.min(100, percent));
}

export function setBusy(ui: UIRefs, busy: boolean) {
  ui.loadModelBtn.disabled = busy;
  ui.reloadCatalogBtn.disabled = busy;
  ui.clearModelsBtn.disabled = busy;
  ui.modelSelect.disabled = busy;
}

export function renderCatalog(ui: UIRefs, models: CatalogModel[]) {
  ui.modelSelect.innerHTML = "";
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.label} (${m.fragments.length} FRAG)`;
    ui.modelSelect.appendChild(opt);
  }
}

export function renderSelection(ui: UIRefs, header: string, props: unknown) {
  ui.selectionInfo.textContent = header;
  ui.propsPanel.textContent = JSON.stringify(props ?? {}, null, 2);
}

export function renderCategoriesText(ui: UIRefs, html: string) {
  ui.categoriesPanel.innerHTML = html;
}

export function renderLoadedModelsText(ui: UIRefs, html: string) {
  ui.loadedModelsPanel.innerHTML = html;
}
