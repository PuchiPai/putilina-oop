import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RasterRenderer, LineAlg } from "../lib/raster/RasterRenderer";
import { ShapeManager } from "../lib/shapes/ShapeManager";
import { Rect, Line, Oval } from "../lib/shapes";
import { RendererAdapter } from "../lib/shapes/RendererAdapter";

interface CanvasSceneProps {
    lineAlg: LineAlg;
}

const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<RasterRenderer | null>(null);
    const [manager] = useState(() => {
        const m = new ShapeManager();

        // Прямоугольник (синий, повёрнут)
        const rect = new Rect(
            "rect1",
            { x: 200, y: 200, rotation: 0.3, scaleX: 1, scaleY: 1 },
            120, 80
        );
        rect.fillColor = { r: 70, g: 130, b: 200, a: 200 };
        rect.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
        rect.strokeWidth = 2;
        m.add(rect);

        // Овал (зелёный, перекрывает правую половину прямоугольника)
        const oval = new Oval(
            "oval1",
            { x: 260, y: 200, rotation: 0, scaleX: 1, scaleY: 1 },
            70, 50
        );
        oval.fillColor = { r: 50, g: 200, b: 100, a: 180 };
        oval.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
        oval.strokeWidth = 1.5;
        m.add(oval);

        // Линия (красная, отдельно)
        const line = new Line(
            "line1",
            { x: 450, y: 250, rotation: 0, scaleX: 1, scaleY: 1 },
            0, 0, 150, -50
        );
        line.strokeColor = { r: 0, g: 128, b: 0, a: 255 };
        line.strokeWidth = 10;
        m.add(line);

        return m;
    });

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
        const adapter = new RendererAdapter(renderer);

        const resizeNow = (w: number, h: number) => renderer.resizeTo(w, h);
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            requestAnimationFrame(() => resizeNow(width, height));
        });
        ro.observe(container);
        requestAnimationFrame(() => {
            const rect = container.getBoundingClientRect();
            resizeNow(rect.width, rect.height);
        });

        let raf = 0;
        const frame = () => {
            const r = rendererRef.current;
            if (r) {
                r.beginFrame(true);
                const shapes = manager.getShapes();
                shapes.forEach(shape => shape.draw(adapter));
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
    }, [manager, lineAlg]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        if (!canvas || !renderer) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = renderer.width / rect.width;
        const scaleY = renderer.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        const shapes = manager.getShapes();
        const hit = [...shapes].reverse().find(s => s.hitTest(canvasX, canvasY));

        if (hit) {
            manager.select(hit.id);

            const bounds = hit.getBounds();
            console.log(`Selected: ${hit.id}`);
            console.log(`  Screen Bounds: minX=${bounds.minX.toFixed(1)}, minY=${bounds.minY.toFixed(1)}, maxX=${bounds.maxX.toFixed(1)}, maxY=${bounds.maxY.toFixed(1)}`);

            const localBounds = hit.getLocalBounds();
            console.log(`  Local Bounds: minX=${localBounds.minX.toFixed(1)}, minY=${localBounds.minY.toFixed(1)}, maxX=${localBounds.maxX.toFixed(1)}, maxY=${localBounds.maxY.toFixed(1)}`);
        } else {
            manager.clearSelection();
            console.log("No hit");
        }
    };

    return (
        <div ref={containerRef} className="canvas-shell">
            <canvas ref={canvasRef} className="canvas-surface" onClick={handleCanvasClick} />
        </div>
    );
};

export default CanvasScene;