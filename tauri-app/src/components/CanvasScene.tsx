import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { RasterRenderer, LineAlg } from "../lib/raster/RasterRenderer";
import { ShapeManager } from "../lib/shapes/ShapeManager";
import { Rect, Line, Oval, Triangle, QuadraticBezier, CubicBezier, PathBezier } from "../lib/shapes";
import { RendererAdapter } from "../lib/shapes/RendererAdapter";
import type { Point } from "../lib/shapes/types";
import type { Shape } from "../lib/shapes/Shape";
import { Toolbar } from "./Toolbar";
import { LayerPanel } from "./LayerPanel";

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx, projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
}

// ──────────────── типы для операций перетаскивания ────────────────
type InteractionMode = 'idle' | 'move' | 'resize' | 'rotate' | 'editPoints';

interface DragState {
    mode: InteractionMode;
    shapeId: string;
    startPointer: Point;                    // физические координаты canvas
    startTransform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
    startBounds?: { minX: number; minY: number; maxX: number; maxY: number };
    handleIndex?: number;                  // для resize/rotate
    controlPointIndex?: number;            // для editPoints
}

// ──────────────── утилита пересчёта координат ────────────────
function getCanvasPoint(
    e: React.MouseEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
    renderer: RasterRenderer
): Point {
    const rect = canvas.getBoundingClientRect();
    const scaleX = renderer.width / rect.width;
    const scaleY = renderer.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
}

// ──────────────── константы визуализации ручек ────────────────
const HANDLE_RADIUS = 6;
const ROTATE_HANDLE_OFFSET = 30;

// Позиции 8 ручек ресайза
function getHandlePositions(bounds: { minX: number; minY: number; maxX: number; maxY: number }): Point[] {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return [
        { x: bounds.minX, y: bounds.minY }, // левый верхний
        { x: cx, y: bounds.minY },          // верхний центр
        { x: bounds.maxX, y: bounds.minY }, // правый верхний
        { x: bounds.maxX, y: cy },          // правый центр
        { x: bounds.maxX, y: bounds.maxY }, // правый нижний
        { x: cx, y: bounds.maxY },          // нижний центр
        { x: bounds.minX, y: bounds.maxY }, // левый нижний
        { x: bounds.minX, y: cy },          // левый центр
    ];
}

function getRotateHandle(bounds: { minX: number; minY: number; maxX: number; maxY: number }): Point {
    const cx = (bounds.minX + bounds.maxX) / 2;
    return { x: cx, y: bounds.minY - ROTATE_HANDLE_OFFSET };
}

// ──────────────── компонент ────────────────
interface CanvasSceneProps {
    lineAlg: LineAlg;
}

export const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<RasterRenderer | null>(null);
    const adapterRef = useRef<RendererAdapter | null>(null);

    // Менеджер фигур
    const [manager] = useState(() => {
        const m = new ShapeManager();
        // Вставляем те же фигуры, что и раньше (можно скопировать из предыдущего кода)
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

        const qbez = new QuadraticBezier("qbez1", { x: 300, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
            { x: 0, y: 0 }, { x: 50, y: -80 }, { x: 100, y: 0 });
        qbez.strokeColor = { r: 200, g: 100, b: 200, a: 255 };
        qbez.strokeWidth = 3;
        m.add(qbez);

        const cbez = new CubicBezier("cbez1", { x: 500, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
            { x: 0, y: 0 }, { x: 30, y: -100 }, { x: 70, y: 100 }, { x: 100, y: 0 });
        cbez.strokeColor = { r: 100, g: 200, b: 100, a: 255 };
        cbez.strokeWidth = 3;
        m.add(cbez);

        const path = new PathBezier("path1", { x: 650, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
            [
                { x: -100, y: 0 }, { x: 0, y: -100 },
                { x: 100, y: 50 },
                { x: 10, y: 100 },
                { x: 100, y: -100 }, { x: 200, y: 0 }
            ],
            'catmull', true
        );
        path.strokeColor = { r: 100, g: 150, b: 255, a: 255 };
        path.strokeWidth = 2.5;
        m.add(path);

        return m;
    });

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    // для доступа в замыкании анимации без пересоздания обработчиков
    const dragStateRef = useRef<DragState | null>(null);
    useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

    const selectedShape = selectedId
        ? manager.getShapes().find(s => s.id === selectedId) ?? null
        : null;

    const [, setTick] = useState(0);
    const forceUpdate = () => setTick(t => t + 1);

    // ──────────────────── обработчики указателя ────────────────────
    const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        if (!canvas || !renderer) return;

        const point = getCanvasPoint(e, canvas, renderer);
        const shapes = manager.getShapes();

        // 1. Если есть выбранная фигура, проверяем, не попали ли в ручки / контрольные точки
        if (selectedShape) {
            const bounds = selectedShape.getBounds();
            const handles = getHandlePositions(bounds);
            // Ручка поворота
            const rotH = getRotateHandle(bounds);
            if (Math.hypot(point.x - rotH.x, point.y - rotH.y) < HANDLE_RADIUS + 2) {
                setDragState({
                    mode: 'rotate',
                    shapeId: selectedId!,
                    startPointer: point,
                    startTransform: { ...selectedShape.transform },
                });
                canvas.setPointerCapture(e.pointerId);
                return;
            }

            // Ручки ресайза
            for (let i = 0; i < handles.length; i++) {
                if (Math.hypot(point.x - handles[i].x, point.y - handles[i].y) < HANDLE_RADIUS + 2) {
                    setDragState({
                        mode: 'resize',
                        shapeId: selectedId!,
                        startPointer: point,
                        startTransform: { ...selectedShape.transform },
                        startBounds: { ...bounds },
                        handleIndex: i,
                    });
                    canvas.setPointerCapture(e.pointerId);
                    return;
                }
            }

            // Контрольные точки (если есть)
            if ('getControlPoints' in selectedShape) {
                const cpts = (selectedShape as any).getControlPoints() as Point[];
                const deviceCpts = cpts.map((p: Point) => selectedShape.transformPointToDevice(p.x, p.y));
                for (let i = 0; i < deviceCpts.length; i++) {
                    if (Math.hypot(point.x - deviceCpts[i].x, point.y - deviceCpts[i].y) < HANDLE_RADIUS + 2) {
                        setDragState({
                            mode: 'editPoints',
                            shapeId: selectedId!,
                            startPointer: point,
                            startTransform: { ...selectedShape.transform },
                            controlPointIndex: i,
                        });
                        canvas.setPointerCapture(e.pointerId);
                        return;
                    }
                }
            }
        }

        // 2. Hit-test объектов (с верхнего к нижнему)
        let hitShape: Shape | null = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].hitTest(point.x, point.y)) {
                hitShape = shapes[i];
                break;
            }
        }

        if (hitShape) {
            setSelectedId(hitShape.id);
            manager.select(hitShape.id);
            // Начать перемещение
            setDragState({
                mode: 'move',
                shapeId: hitShape.id,
                startPointer: point,
                startTransform: { ...hitShape.transform },
            });
            canvas.setPointerCapture(e.pointerId);
        } else {
            setSelectedId(null);
            manager.clearSelection();
        }
    }, [selectedId, selectedShape, manager]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        if (!canvas || !renderer) return;

        const point = getCanvasPoint(e, canvas, renderer);
        const ds = dragStateRef.current;
        if (!ds) return;

        const shape = manager.getShapes().find(s => s.id === ds.shapeId);
        if (!shape) return;

        const dx = point.x - ds.startPointer.x;
        const dy = point.y - ds.startPointer.y;

        switch (ds.mode) {
            case 'move': {
                shape.transform.x = ds.startTransform.x + dx;
                shape.transform.y = ds.startTransform.y + dy;
                break;
            }
            case 'rotate': {
                const center = shape.getCenter();
                const startAngle = Math.atan2(ds.startPointer.y - center.y, ds.startPointer.x - center.x);
                const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
                shape.transform.rotation = ds.startTransform.rotation + (currentAngle - startAngle);
                break;
            }
            case 'resize': {
                if (ds.handleIndex === undefined || !ds.startBounds) break;
                // Переводим движения в локальную систему исходной трансформации
                const inv = shape.getDeviceToLocalMatrix();
                if (!inv) break;
                const localStart = shape.transformPointToLocal(ds.startPointer.x, ds.startPointer.y);
                const localCurrent = shape.transformPointToLocal(point.x, point.y);
                if (!localStart || !localCurrent) break;

                const dLocalX = localCurrent.x - localStart.x;
                const dLocalY = localCurrent.y - localStart.y;
                const b = ds.startBounds;
                let newMinX = b.minX, newMinY = b.minY, newMaxX = b.maxX, newMaxY = b.maxY;

                switch (ds.handleIndex) {
                    case 0: newMinX += dLocalX; newMinY += dLocalY; break;
                    case 1: newMinY += dLocalY; break;
                    case 2: newMaxX += dLocalX; newMinY += dLocalY; break;
                    case 3: newMaxX += dLocalX; break;
                    case 4: newMaxX += dLocalX; newMaxY += dLocalY; break;
                    case 5: newMaxY += dLocalY; break;
                    case 6: newMinX += dLocalX; newMaxY += dLocalY; break;
                    case 7: newMinX += dLocalX; break;
                }

                // Минимальный размер
                const minSize = 10;
                if (newMaxX - newMinX < minSize) {
                    if ([0, 6, 7].includes(ds.handleIndex)) newMinX = newMaxX - minSize;
                    else newMaxX = newMinX + minSize;
                }
                if (newMaxY - newMinY < minSize) {
                    if ([0, 1, 2].includes(ds.handleIndex)) newMinY = newMaxY - minSize;
                    else newMaxY = newMinY + minSize;
                }

                shape.setBounds(newMinX, newMinY, newMaxX, newMaxY);
                break;
            }
            case 'editPoints': {
                if (ds.controlPointIndex === undefined) break;
                const localPt = shape.transformPointToLocal(point.x, point.y);
                if (!localPt) break;
                if ('setControlPoint' in shape) {
                    (shape as any).setControlPoint(ds.controlPointIndex, localPt);
                }
                break;
            }
        }
    }, [manager]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) canvas.releasePointerCapture(e.pointerId);
        setDragState(null);
    }, []);

    // ──────────────────── клавиша Delete ────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
                manager.remove(selectedId);
                setSelectedId(null);
                manager.clearSelection();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedId, manager]);

    // ──────────────────── цикл рендеринга ────────────────────
    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const renderer = new RasterRenderer(canvas);
        renderer.setLineAlgorithm(lineAlg);
        rendererRef.current = renderer;
        const adapter = new RendererAdapter(renderer);
        adapterRef.current = adapter;

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

                // Подсветка выбранной фигуры
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

                        // Ручки ресайза
                        const handles = getHandlePositions(bounds);
                        handles.forEach(h => adapter.fillCircle(h.x, h.y, HANDLE_RADIUS, { r: 255, g: 255, b: 255, a: 255 }));

                        // Ручка поворота
                        const rotH = getRotateHandle(bounds);
                        adapter.fillCircle(rotH.x, rotH.y, HANDLE_RADIUS, { r: 100, g: 255, b: 100, a: 255 });

                        // Контрольные точки (жёлтые) для фигур с getControlPoints
                        if ('getControlPoints' in sel) {
                            const cpts = (sel as any).getControlPoints() as Point[];
                            const deviceCpts = cpts.map((p: Point) => sel.transformPointToDevice(p.x, p.y));
                            deviceCpts.forEach(p => {
                                adapter.fillCircle(p.x, p.y, HANDLE_RADIUS, { r: 255, g: 255, b: 0, a: 255 });
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

    // ──────────────────── методы для панели слоёв ────────────────────
    const handleLayerSelect = (id: string) => {
        setSelectedId(id);
        manager.select(id);
    };

    const handleLayerUp = (id: string) => {
        manager.moveUp(id);
        forceUpdate();
    };

    const handleLayerDown = (id: string) => {
        manager.moveDown(id);
        forceUpdate();
    };

    const handleLayerDelete = (id: string) => {
        manager.remove(id);
        if (selectedId === id) setSelectedId(null);
        manager.clearSelection();
        forceUpdate();
    };

    const handleAddShape = (type: string) => {
        const id = `shape-${Date.now()}`;
        const defaultTransform = { x: 300, y: 200, rotation: 0, scaleX: 1, scaleY: 1 };
        let newShape: Shape | null = null;

        switch (type) {
            case 'rect':
                newShape = new Rect(id, defaultTransform, 100, 60);
                newShape.fillColor = { r: 100, g: 150, b: 200, a: 200 };
                break;
            case 'line':
                newShape = new Line(id, defaultTransform, 0, 0, 100, 0);
                newShape.strokeColor = { r: 200, g: 100, b: 100, a: 255 };
                newShape.strokeWidth = 4;
                break;
            case 'oval':
                newShape = new Oval(id, defaultTransform, 50, 40);
                newShape.fillColor = { r: 100, g: 200, b: 100, a: 200 };
                break;
            case 'triangle':
                newShape = new Triangle(id, defaultTransform, 0, -40, 40, 30, -40, 30);
                newShape.fillColor = { r: 255, g: 180, b: 60, a: 200 };
                break;
            case 'quadraticBezier':
                newShape = new QuadraticBezier(id, defaultTransform,
                    { x: 0, y: 0 }, { x: 50, y: -80 }, { x: 100, y: 0 }
                );
                newShape.strokeColor = { r: 200, g: 100, b: 200, a: 255 };
                newShape.strokeWidth = 3;
                break;
            case 'cubicBezier':
                newShape = new CubicBezier(id, defaultTransform,
                    { x: 0, y: 0 }, { x: 30, y: -100 }, { x: 70, y: 100 }, { x: 100, y: 0 }
                );
                newShape.strokeColor = { r: 100, g: 200, b: 100, a: 255 };
                newShape.strokeWidth = 3;
                break;
            case 'pathBezier':
                const pts = [
                    { x: -50, y: 0 }, { x: 0, y: -50 }, { x: 50, y: 0 },
                    { x: 30, y: 30 }, { x: -30, y: 30 }
                ];
                newShape = new PathBezier(id, defaultTransform, pts, 'catmull', true);
                newShape.strokeColor = { r: 100, g: 150, b: 255, a: 255 };
                newShape.strokeWidth = 2.5;
                break;
            default:
                return;
        }
        if (newShape) {
            manager.add(newShape);
            setSelectedId(id);
            manager.select(id);
            forceUpdate(); // чтобы панель слоёв обновилась
        }
    };

    const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!selectedId || !selectedShape) return;
        if (!(selectedShape instanceof PathBezier)) return;

        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        if (!canvas || !renderer) return;

        const point = getCanvasPoint(e, canvas, renderer);
        const localPt = selectedShape.transformPointToLocal(point.x, point.y);
        if (!localPt) return;

        const pts = selectedShape.getControlPoints(); // локальные опорные точки
        const n = pts.length;
        if (n === 0) {
            selectedShape.addPoint(localPt);
            forceUpdate();
            return;
        }
        if (n === 1) {
            selectedShape.addPoint(localPt);
            forceUpdate();
            return;
        }

        // Ищем ближайший сегмент в локальных координатах
        let minDist = Infinity;
        let insertIndex = 0; // после точки с этим индексом вставим новую
        for (let i = 0; i < n - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dist = pointToSegmentDist(localPt.x, localPt.y, a.x, a.y, b.x, b.y);
            if (dist < minDist) {
                minDist = dist;
                insertIndex = i;
            }
        }
        // Если путь замкнут, проверяем последний сегмент (от последней точки к первой)
        if (selectedShape.closed) {
            const a = pts[n - 1];
            const b = pts[0];
            const dist = pointToSegmentDist(localPt.x, localPt.y, a.x, a.y, b.x, b.y);
            if (dist < minDist) {
                minDist = dist;
                insertIndex = n - 1; // после последней точки, т.е. между последней и первой
            }
        }

        // Вставляем новую точку после insertIndex
        selectedShape.addPoint(localPt, insertIndex + 1);
        forceUpdate();
    }, [selectedId, selectedShape, forceUpdate]);

    const handleDeletePoint = () => {
        if (!selectedId || !selectedShape || !(selectedShape instanceof PathBezier)) return;
        const pts = selectedShape.getControlPoints();
        if (pts.length > 0) {
            selectedShape.removePoint(pts.length - 1); // удаляем последнюю
            forceUpdate();
        }
    };

    // ──────────────────── рендер ────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <Toolbar onAddShape={handleAddShape} onDeletePoint={handleDeletePoint} />
            <div style={{ flex: 1, display: 'flex' }}>
                <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
                    <canvas
                        ref={canvasRef}
                        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onDoubleClick={handleCanvasDoubleClick}

                    />
                </div>
                <LayerPanel
                    shapes={manager.getShapes()}
                    selectedId={selectedId}
                    onSelect={handleLayerSelect}
                    onMoveUp={handleLayerUp}
                    onMoveDown={handleLayerDown}
                    onDelete={handleLayerDelete}
                />
            </div>
        </div>
    );
};

export default CanvasScene;