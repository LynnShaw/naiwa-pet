import { getCurrentWindow } from "@tauri-apps/api/window";
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
    void preloadImages(manifest);
  } catch (error) {
    hint.textContent = error instanceof Error ? error.message : "Failed to load pet";
  }
};

void boot();
