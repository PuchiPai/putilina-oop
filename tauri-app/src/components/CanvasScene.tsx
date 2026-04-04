import { useEffect, useLayoutEffect, useRef } from "react";
import { RasterRenderer, LineAlg } from "../lib/raster/RasterRenderer";

interface CanvasSceneProps {
    lineAlg: LineAlg;
}

const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<RasterRenderer | null>(null);

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.setLineAlgorithm(lineAlg);
        }
    }, [lineAlg]);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;

        if (!canvas || !container) return;

        const renderer = new RasterRenderer(canvas);
        renderer.setLineAlgorithm(lineAlg);
        rendererRef.current = renderer;

        const resizeNow = (w: number, h: number) => {
            renderer.resizeTo(w, h);
        };

        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;

            const { width, height } = entry.contentRect;

            requestAnimationFrame(() => {
                resizeNow(width, height);
            });
        });

        ro.observe(container);

        // Первый resize после layout
        requestAnimationFrame(() => {
            const rect = container.getBoundingClientRect();
            resizeNow(rect.width, rect.height);
        });

        let raf = 0;

        const frame = () => {
            const r = rendererRef.current;
            if (r) {
                r.beginFrame(true);

                const W = r.width;
                const H = r.height;
                const minSide = Math.min(W, H);

                const black = { r: 0, g: 0, b: 0, a: 255 };
                const green = { r: 62, g: 180, b: 120, a: 255 };
                const blue = { r: 60, g: 110, b: 220, a: 255 };
                const redTransparent = { r: 255, g: 0, b: 0, a: 140 };
                const orange = { r: 240, g: 160, b: 60, a: 255 };
                const purple = { r: 145, g: 70, b: 210, a: 255 };

                const pad = Math.max(18, Math.round(minSide * 0.06));

                const triangle = [
                    { x: pad * 1.2, y: pad * 1.4 },
                    { x: W * 0.30, y: pad * 1.5 },
                    { x: W * 0.14, y: H * 0.32 },
                ];
                r.fillPolygon(triangle, green);
                r.strokePolygon(triangle, black, Math.max(6, Math.round(minSide * 0.02)));

                const square = [
                    { x: W * 0.56, y: H * 0.16 },
                    { x: W * 0.84, y: H * 0.16 },
                    { x: W * 0.84, y: H * 0.42 },
                    { x: W * 0.56, y: H * 0.42 },
                ];
                r.fillPolygon(square, blue);

                // Полупрозрачность через blendPixel
                r.fillCircle(W * 0.70, H * 0.16, Math.max(30, minSide * 0.10), redTransparent);
                r.strokePolygon(square, black, Math.max(4, Math.round(minSide * 0.012)));

                // Толстая ломаная
                r.strokeLine(W * 0.12, H * 0.72, W * 0.26, H * 0.63, orange, Math.max(12, minSide * 0.025));
                r.strokeLine(W * 0.26, H * 0.63, W * 0.40, H * 0.78, orange, Math.max(12, minSide * 0.025));
                r.strokeLine(W * 0.40, H * 0.78, W * 0.56, H * 0.68, orange, Math.max(12, minSide * 0.025));

                // Линии для сравнения алгоритмов
                r.drawLine(W * 0.08, H * 0.08, W * 0.92, H * 0.12, black);
                r.drawLine(W * 0.08, H * 0.52, W * 0.92, H * 0.38, purple);

                // Окружность
                r.fillCircle(W * 0.85, H * 0.70, Math.max(28, minSide * 0.08), {
                    r: 255,
                    g: 120,
                    b: 0,
                    a: 255,
                });

                r.commit();
            }

            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            renderer.dispose();
            rendererRef.current = null;
        };
    }, [lineAlg]);

    return (
        <div ref={containerRef} className="canvas-shell">
            <canvas ref={canvasRef} className="canvas-surface" />
        </div>
    );
};

export default CanvasScene;