/** Browser file input. `capture` asks the device for the camera directly;
 * omitting it lets the OS offer the gallery instead. */
function selectImage(useCamera: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ? URL.createObjectURL(file) : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function captureNcPhoto(): Promise<string | null> {
  return selectImage(true);
}

export async function pickNcPhoto(): Promise<string | null> {
  return selectImage(false);
}
