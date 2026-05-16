import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RasterRenderer, LineAlg } from "../lib/raster/RasterRenderer";
import { ShapeManager } from "../lib/shapes/ShapeManager";
import { Rect, Line, Oval, Triangle, QuadraticBezier, CubicBezier, PathBezier } from "../lib/shapes";
import { RendererAdapter } from "../lib/shapes/RendererAdapter";
import type { Point } from "../lib/shapes/types";

interface CanvasSceneProps {
    lineAlg: LineAlg;
}

const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<RasterRenderer | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [manager] = useState(() => {
        const m = new ShapeManager();
        // ... все фигуры без изменений
        const rect = new Rect("rect1", { x: 200, y: 200, rotation: 0.3, scaleX: 1, scaleY: 1 }, 120, 80);
        rect.fillColor = { r: 70, g: 130, b: 200, a: 200 };
        rect.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
        rect.strokeWidth = 2;
        m.add(rect);

        const oval = new Oval("oval1", { x: 260, y: 200, rotation: 0, scaleX: 1, scaleY: 1 }, 70, 50);
        oval.fillColor = { r: 50, g: 200, b: 100, a: 180 };
        oval.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
        oval.strokeWidth = 1.5;
        m.add(oval);

        const line = new Line("line1", { x: 450, y: 250, rotation: 0, scaleX: 1, scaleY: 1 }, 0, 0, 150, -50);
        line.strokeColor = { r: 0, g: 128, b: 0, a: 255 };
        line.strokeWidth = 10;
        m.add(line);

        const tri = new Triangle("tri1", { x: 150, y: 250, rotation: 0, scaleX: 1, scaleY: 1 }, 0, -40, 40, 30, -40, 30);
        tri.fillColor = { r: 255, g: 160, b: 60, a: 200 };
        tri.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
        tri.strokeWidth = 2;
        m.add(tri);

        const qbez = new QuadraticBezier("qbez1", { x: 300, y: 100, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 0, y: 0 }, { x: 50, y: -80 }, { x: 100, y: 0 });
        qbez.strokeColor = { r: 200, g: 100, b: 200, a: 255 };
        qbez.strokeWidth = 3;
        m.add(qbez);

        const cbez = new CubicBezier("cbez1", { x: 500, y: 100, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 0, y: 0 }, { x: 30, y: -100 }, { x: 70, y: 100 }, { x: 100, y: 0 });
        cbez.strokeColor = { r: 100, g: 200, b: 100, a: 255 };
        cbez.strokeWidth = 3;
        m.add(cbez);

        const path = new PathBezier("path1", { x: 650, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
            [
                { x: -100, y: 0 }, { x: 0, y: -100 },
                { x: 100, y: 50 },
                { x: 10, y: 100 },
                { x: 100, y: -100 },  { x: 200, y: 0 }
            ],
            'catmull', true
        );
        path.strokeColor = { r: 100, g: 150, b: 255, a: 255 };
        path.strokeWidth = 2.5;
        m.add(path);

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

                // Подсветка и контрольные точки выбранной фигуры
                if (selectedId) {
                    const sel = shapes.find(s => s.id === selectedId);
                    if (sel) {
                        const bounds = sel.getBounds();
                        // Рамка
                        const rectPts = [
                            { x: bounds.minX, y: bounds.minY },
                            { x: bounds.maxX, y: bounds.minY },
                            { x: bounds.maxX, y: bounds.maxY },
                            { x: bounds.minX, y: bounds.maxY },
                        ];
                        adapter.strokePolygon(rectPts, { r: 0, g: 150, b: 255, a: 200 }, 2, true);

                        // Ручки ресайза (8 штук)
                        const cx = (bounds.minX + bounds.maxX) / 2;
                        const cy = (bounds.minY + bounds.maxY) / 2;
                        const handles = [
                            { x: bounds.minX, y: bounds.minY }, { x: cx, y: bounds.minY },
                            { x: bounds.maxX, y: bounds.minY }, { x: bounds.maxX, y: cy },
                            { x: bounds.maxX, y: bounds.maxY }, { x: cx, y: bounds.maxY },
                            { x: bounds.minX, y: bounds.maxY }, { x: bounds.minX, y: cy },
                        ];
                        handles.forEach(h => adapter.fillCircle(h.x, h.y, 5, { r: 255, g: 255, b: 255, a: 255 }));

                        // Ручка поворота
                        const rotH = { x: cx, y: bounds.minY - 25 };
                        adapter.fillCircle(rotH.x, rotH.y, 5, { r: 100, g: 255, b: 100, a: 255 });

                        // Контрольные точки (жёлтые) для фигур, имеющих getControlPoints
                        if ('getControlPoints' in sel) {
                            const cpts = (sel as any).getControlPoints() as Point[];
                            const deviceCpts = cpts.map((p: Point) => sel.transformPointToDevice(p.x, p.y));
                            deviceCpts.forEach(p => {
                                adapter.fillCircle(p.x, p.y, 5, { r: 255, g: 255, b: 0, a: 255 });
                            });
                        }
                    }
                }

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
    }, [manager, selectedId, lineAlg]);

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
            setSelectedId(hit.id);

            const bounds = hit.getBounds();
            console.log(`Selected: ${hit.id}`);
            console.log(`  Screen Bounds: minX=${bounds.minX.toFixed(1)}, minY=${bounds.minY.toFixed(1)}, maxX=${bounds.maxX.toFixed(1)}, maxY=${bounds.maxY.toFixed(1)}`);

            const localBounds = hit.getLocalBounds();
            console.log(`  Local Bounds: minX=${localBounds.minX.toFixed(1)}, minY=${localBounds.minY.toFixed(1)}, maxX=${localBounds.maxX.toFixed(1)}, maxY=${localBounds.maxY.toFixed(1)}`);
        } else {
            setSelectedId(null);
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