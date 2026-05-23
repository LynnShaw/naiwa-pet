import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import "./styles.css";

type PetManifest = {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  idleFrame: string;
  framePattern: string;
  audio: string;
};

const DEFAULT_PET_ID = "naiwa";
const APP_NAME = "奶蛙";
const PET_SIZE_OPTIONS = [
  { id: "max", label: "超大号", width: 360, height: 480 },
  { id: "large", label: "大号", width: 240, height: 320 },
  { id: "medium", label: "中号", width: 180, height: 240 },
  { id: "small", label: "小号", width: 120, height: 160 },
  { id: "tiny", label: "极小", width: 90, height: 120 },
  { id: "mini", label: "迷你", width: 60, height: 80 },
] as const;

type PetSizeId = (typeof PET_SIZE_OPTIONS)[number]["id"];

const appWindow = getCurrentWindow();
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

const pet = document.createElement("img");
pet.className = "pet";
pet.alt = "Naiwa desktop pet";
pet.draggable = false;

const hint = document.createElement("div");
hint.className = "loading";
hint.textContent = "Loading...";

app.append(hint, pet);

const isPetSizeId = (value: string | null): value is PetSizeId =>
  PET_SIZE_OPTIONS.some((size) => size.id === value);

const getPetSize = (sizeId: PetSizeId) => PET_SIZE_OPTIONS.find((size) => size.id === sizeId) ?? PET_SIZE_OPTIONS[0];

const getInitialPetSizeId = (): PetSizeId => {
  const size = new URLSearchParams(window.location.search).get("size");
  return isPetSizeId(size) ? size : "medium";
};

let currentPetSizeId: PetSizeId = getInitialPetSizeId();
let contextMenuPromise: Promise<Menu> | null = null;
let lastContextMenuPosition = { x: 64, y: 64 };
const petSizeItems = new Map<PetSizeId, CheckMenuItem>();

const syncPetSizeChecks = async () => {
  await Promise.all(
    PET_SIZE_OPTIONS.map((size) => petSizeItems.get(size.id)?.setChecked(size.id === currentPetSizeId)),
  );
};

const setPetSize = async (sizeId: PetSizeId) => {
  const size = getPetSize(sizeId);

  currentPetSizeId = sizeId;
  await appWindow.setSize(new LogicalSize(size.width, size.height));
  await syncPetSizeChecks();
};

const createAnotherPet = () => {
  const size = getPetSize(currentPetSizeId);
  const label = `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const window = new WebviewWindow(label, {
    url: `/?size=${currentPetSizeId}`,
    title: APP_NAME,
    width: size.width,
    height: size.height,
    x: lastContextMenuPosition.x + 24,
    y: lastContextMenuPosition.y + 24,
    resizable: false,
    decorations: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    shadow: false,
  });

  window.once("tauri://error", (event) => {
    console.error("Failed to create pet window", event.payload);
  });
};

const createContextMenu = async () => {
  const addPetItem = await MenuItem.new({
    id: "add-pet",
    text: "再来一只",
    action: createAnotherPet,
  });

  const sizeItems = await Promise.all(
    PET_SIZE_OPTIONS.map(async (size) => {
      const item = await CheckMenuItem.new({
        id: `pet-size-${size.id}`,
        text: size.label,
        checked: size.id === currentPetSizeId,
        action: () => {
          void setPetSize(size.id);
        },
      });

      petSizeItems.set(size.id, item);
      return item;
    }),
  );

  // 1. 尺寸设定只包含尺寸相关的选项
  const sizeMenu = await Submenu.new({
    id: "pet-size-menu",
    text: "尺寸设定",
    items: sizeItems, 
  });

  // 2. 在根菜单中组合“再来一只”、“分隔符”和“尺寸设定”子菜单
  return Menu.new({ 
    items: [
      addPetItem, 
      await PredefinedMenuItem.new({ item: "Separator" }), 
      sizeMenu
    ] 
  });
};

const getContextMenu = () => {
  contextMenuPromise ??= createContextMenu();
  return contextMenuPromise;
};

const enableContextMenu = () => {
  app.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    lastContextMenuPosition = { x: event.screenX, y: event.screenY };

    const menu = await getContextMenu();
    await syncPetSizeChecks();
    await menu.popup(new LogicalPosition(event.clientX, event.clientY), appWindow);
  });
};

const loadManifest = async (petId: string): Promise<PetManifest> => {
  const response = await fetch(`/pets/${petId}/manifest.json`);
  if (!response.ok) {
    throw new Error(`Failed to load pet manifest: ${response.status}`);
  }

  return response.json() as Promise<PetManifest>;
};

const formatFramePath = (manifest: PetManifest, index: number) => {
  const frameIndex = String(index).padStart(4, "0");
  return `/pets/${manifest.id}/${manifest.framePattern.replace("{index}", frameIndex)}`;
};

const preloadImages = async (manifest: PetManifest) => {
  const promises = Array.from({ length: manifest.frameCount }, (_, index) => {
    const image = new Image();
    image.decoding = "async";
    image.src = formatFramePath(manifest, index);
    return image.decode().catch(() => undefined);
  });

  await Promise.all(promises);
};

const loadImage = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

const createPetPlayer = async (manifest: PetManifest) => {
  const audio = new Audio(`/pets/${manifest.id}/${manifest.audio}`);
  audio.preload = "auto";

  const idleSrc = `/pets/${manifest.id}/${manifest.idleFrame}`;
  let animationFrame = 0;
  let playing = false;
  let startTime = 0;

  const setIdle = () => {
    playing = false;
    window.cancelAnimationFrame(animationFrame);
    pet.src = idleSrc;
  };

  const render = (now: number) => {
    const elapsed = now - startTime;
    const frame = Math.floor((elapsed / 1000) * manifest.fps);

    if (frame >= manifest.frameCount) {
      setIdle();
      return;
    }

    pet.src = formatFramePath(manifest, frame);
    animationFrame = window.requestAnimationFrame(render);
  };

  const play = async () => {
    window.cancelAnimationFrame(animationFrame);
    audio.pause();
    audio.currentTime = 0;
    playing = true;
    startTime = performance.now();
    pet.src = formatFramePath(manifest, 0);
    animationFrame = window.requestAnimationFrame(render);

    try {
      await audio.play();
    } catch {
      // Browser policies should allow click-triggered playback, but animation still works if audio is blocked.
    }
  };

  audio.addEventListener("ended", () => {
    if (!playing) {
      audio.currentTime = 0;
    }
  });

  setIdle();

  return play;
};

const enableWindowDrag = () => {
  pet.addEventListener("pointerdown", async (event) => {
    if (event.button !== 0) {
      return;
    }

    await appWindow.startDragging();
  });
};

const boot = async () => {
  try {
    const manifest = await loadManifest(DEFAULT_PET_ID);
    document.documentElement.style.setProperty("--pet-aspect", `${manifest.width} / ${manifest.height}`);
    pet.style.aspectRatio = `${manifest.width} / ${manifest.height}`;
    const idleSrc = `/pets/${manifest.id}/${manifest.idleFrame}`;
    await loadImage(idleSrc);
    pet.src = idleSrc;
    const play = await createPetPlayer(manifest);

    hint.remove();
    pet.classList.add("is-ready");
    pet.addEventListener("click", play);
    enableWindowDrag();
    enableContextMenu();
    void preloadImages(manifest);
  } catch (error) {
    hint.textContent = error instanceof Error ? error.message : "Failed to load pet";
  }
};

void boot();
