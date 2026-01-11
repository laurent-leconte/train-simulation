import { useRef, useEffect, RefObject } from 'react';

/**
 * Hook for managing canvas lifecycle and context
 */
export function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, frameCount: number) => void,
  options: {
    animate?: boolean;
  } = {}
): RefObject<HTMLCanvasElement> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCountRef = useRef(0);
  const animationFrameIdRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Setup canvas for high DPI displays
    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      context.scale(dpr, dpr);

      // Set canvas CSS size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    setupCanvas();

    // Handle resize
    const handleResize = () => {
      setupCanvas();
      draw(context, frameCountRef.current);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const render = () => {
      frameCountRef.current++;
      draw(context, frameCountRef.current);

      if (options.animate) {
        animationFrameIdRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [draw, options.animate]);

  return canvasRef;
}
