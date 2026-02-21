import { useEffect, useRef } from "react";

export default function EnergyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1); // low-res for perf + grain look
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Pre-create an offscreen grain tile for performance
    const tileSize = 128;
    const tile = document.createElement("canvas");
    tile.width = tileSize;
    tile.height = tileSize;
    const tileCtx = tile.getContext("2d")!;

    const drawGrainTile = () => {
      const imageData = tileCtx.createImageData(tileSize, tileSize);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 18; // very subtle alpha
      }
      tileCtx.putImageData(imageData, 0, 0);
    };

    let frame = 0;

    const render = () => {
      frame++;

      // Regenerate grain every 3 frames (~20fps grain flicker)
      if (frame % 3 === 0) {
        drawGrainTile();
      }

      ctx.clearRect(0, 0, w, h);

      // Base background
      ctx.fillStyle = "hsl(220 12% 18%)";
      ctx.fillRect(0, 0, w, h);

      // Slow-moving radial glows
      const t = Date.now() * 0.0002;

      const gx1 = w * (0.2 + Math.sin(t) * 0.05);
      const gy1 = h * (0.8 + Math.cos(t * 0.7) * 0.05);
      const grad1 = ctx.createRadialGradient(gx1, gy1, 0, gx1, gy1, w * 0.5);
      grad1.addColorStop(0, "hsla(75, 38%, 42%, 0.05)");
      grad1.addColorStop(1, "transparent");
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      const gx2 = w * (0.8 + Math.cos(t * 1.3) * 0.05);
      const gy2 = h * (0.2 + Math.sin(t * 0.9) * 0.05);
      const grad2 = ctx.createRadialGradient(gx2, gy2, 0, gx2, gy2, w * 0.4);
      grad2.addColorStop(0, "hsla(75, 30%, 50%, 0.035)");
      grad2.addColorStop(1, "transparent");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      // Tile the grain across the canvas
      const pat = ctx.createPattern(tile, "repeat");
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
      }

      animId = requestAnimationFrame(render);
    };

    drawGrainTile();
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
