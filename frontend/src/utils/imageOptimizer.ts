/**
 * 6-step Image Processing Pipeline (Browser-side)
 * 1. Loads photo into a hidden in-memory canvas
 * 2. Shrinks to 1800px tall
 * 3. Converts to grayscale and applies filters (brightness, contrast)
 * 4. Exports to JPEG (q=0.82)
 * 5. Recursive size-guarding loop (reduce height if file size > original)
 * 6. Return Blob
 */
export async function optimizeImage(file: File): Promise<{ 
  blob: Blob; 
  timeTakenMs: number;
  stats: any;
}> {
  const startTime = Date.now();
  let currentMaxHeight = 1800;
  const originalSize = file.size;
  let iterations = 1;

  const runPipeline = async (maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        
        let width = img.width;
        let height = img.height;
        
        if (height > maxHeight) {
          const ratio = width / height;
          height = maxHeight;
          width = Math.round(maxHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context not available'));
        }

        // Apply filters: grayscale(1) brightness(0.92) contrast(2.8) brightness(1.12)
        // We combine the brightness: 0.92 * 1.12 = 1.0304
        ctx.filter = 'grayscale(100%) brightness(103%) contrast(280%)';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/jpeg',
          0.82
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Failed to load image'));
      };
      
      img.src = objUrl;
    });
  };

  let optimizedBlob = await runPipeline(currentMaxHeight);
  
  // Recursive size guard
  while (optimizedBlob.size > originalSize && currentMaxHeight > 1000) {
    currentMaxHeight -= 200;
    iterations++;
    optimizedBlob = await runPipeline(currentMaxHeight);
  }

  const timeTakenMs = Date.now() - startTime;
  
  return { 
    blob: optimizedBlob, 
    timeTakenMs,
    stats: {
      originalSize,
      optimizedSize: optimizedBlob.size,
      heightFloor: currentMaxHeight,
      iterations,
      overheadMs: timeTakenMs,
      sizeGuard: optimizedBlob.size <= originalSize ? 'cleared' : 'bypassed'
    }
  };
}
