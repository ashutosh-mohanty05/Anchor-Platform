/**
 * Resizes an image file in the browser (via <canvas>) and returns it as a
 * compact base64 JPEG data URL. Keeps profile-photo uploads small enough
 * to store directly on the Settings document without needing any file
 * storage service.
 */
export function resizeImageToDataUrl(file: File, maxDimension = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Reads a File into an <img>-ready data URL (used to feed the crop dialog). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** Loads a data URL into an <img> element so its natural dimensions are available. */
export function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = dataUrl;
  });
}

/**
 * Crops a loaded image to a square, given the current pan/zoom state from
 * the profile-photo cropper, and returns a compact JPEG data URL at
 * `outputSize` pixels. `offsetX`/`offsetY` are in the same "container
 * pixel" space the cropper UI works in; `scale` is how much larger the
 * image is drawn than the container.
 */
export function cropImageToDataUrl(
  img: HTMLImageElement,
  container: number,
  offsetX: number,
  offsetY: number,
  scale: number,
  outputSize = 480
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  const factor = outputSize / container;
  const drawWidth = img.naturalWidth * (container / Math.min(img.naturalWidth, img.naturalHeight)) * scale * factor;
  const drawHeight = img.naturalHeight * (container / Math.min(img.naturalWidth, img.naturalHeight)) * scale * factor;
  const drawX = offsetX * factor;
  const drawY = offsetY * factor;

  ctx.save();
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.9);
}
