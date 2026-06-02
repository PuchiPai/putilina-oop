import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { RasterRenderer, LineAlg } from "../lib/raster/RasterRenderer";
import { RendererAdapter } from "../lib/shapes/RendererAdapter";
import { ShapeManager } from "../lib/shapes/ShapeManager";
import { Rect, Line, Oval, Triangle, QuadraticBezier, CubicBezier, PathBezier } from "../lib/shapes";
import type { Point, Bounds } from "../lib/shapes/types";
import type { Shape } from "../lib/shapes/Shape";
import { LayerPanel } from "./LayerPanel";
import { mat3, type Mat3 } from "../lib/math/mat3";

type CanvasTool = "select" | "rect" | "oval" | "line" | "triangle" | "quadraticBezier" | "cubicBezier" | "pathBezier";

interface CanvasSceneProps {
    lineAlg: LineAlg;
    activeTool: CanvasTool;
    onSelectionChange?: (shape: Shape | null) => void;
}

// вспомогательные функции
function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx, projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
}

// константы
const HANDLE_SIZE = 8;
const ROTATION_HANDLE_DISTANCE = 40;
const MIN_SIZE = 10;

// типы
type EditorMode = "idle" | "move" | "resize" | "rotate" | "editPoints" | "addPoint";
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

interface ShapeStartData {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    width?: number;
    height?: number;
    startLocalBounds?: Bounds;
    startInvMatrix?: Mat3;
}

interface HistoryState {
    shapes: Shape[];
    selectedShapeId: string | null;
}

// утилиты координат
function getDeviceCoordinates(clientX: number, clientY: number, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
        x: (clientX - rect.left) * dpr,
        y: (clientY - rect.top) * dpr,
    };
}

// создание фигуры по инструменту
function createShapeByTool(tool: CanvasTool, id: string, point: Point): Shape | null {
    const transform = { x: point.x, y: point.y, rotation: 0, scaleX: 1, scaleY: 1 };
    switch (tool) {
        case "rect": {
            const r = new Rect(id, transform, 100, 60);
            r.fillColor = { r: 100, g: 150, b: 200, a: 200 };
            r.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
            r.strokeWidth = 2;
            return r;
        }
        case "oval": {
            const o = new Oval(id, transform, 50, 50);
            o.fillColor = { r: 100, g: 200, b: 100, a: 200 };
            o.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
            o.strokeWidth = 2;
            return o;
        }
        case "line": {
            const l = new Line(id, transform, 0, 0, 150, 0);
            l.strokeColor = { r: 0, g: 128, b: 0, a: 255 };
            l.strokeWidth = 4;
            return l;
        }
        case "triangle": {
            const tri = new Triangle(id, transform, 0, -40, 40, 30, -40, 30);
            tri.fillColor = { r: 255, g: 160, b: 60, a: 200 };
            tri.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
            tri.strokeWidth = 2;
            return tri;
        }
        case "quadraticBezier": {
            const q = new QuadraticBezier(id, transform, { x: 0, y: 0 }, { x: 50, y: -80 }, { x: 100, y: 0 });
            q.strokeColor = { r: 200, g: 100, b: 200, a: 255 };
            q.strokeWidth = 3;
            return q;
        }
        case "cubicBezier": {
            const c = new CubicBezier(id, transform, { x: 0, y: 0 }, { x: 30, y: -100 }, { x: 70, y: 100 }, { x: 100, y: 0 });
            c.strokeColor = { r: 100, g: 200, b: 100, a: 255 };
            c.strokeWidth = 3;
            return c;
        }
        case "pathBezier": {
            const p = new PathBezier(
                id,
                transform,
                [
                    { x: -50, y: 0 },
                    { x: 0, y: -50 },
                    { x: 50, y: 0 },
                    { x: 30, y: 30 },
                    { x: -30, y: 30 }
                ],
                "catmull",
                true
            );
            p.strokeColor = { r: 100, g: 150, b: 255, a: 255 };
            p.strokeWidth = 2.5;
            return p;
        }
        default:
            return null;
    }
}

// получение углов bounding box в экранных координатах (вращающаяся рамка)
function getShapeBoundsCorners(shape: Shape): Point[] {
    const local = shape.getLocalBounds();
    const corners: Point[] = [
        { x: local.minX, y: local.minY },
        { x: local.maxX, y: local.minY },
        { x: local.maxX, y: local.maxY },
        { x: local.minX, y: local.maxY },
    ];
    return corners.map(p => shape.transformPointToDevice(p.x, p.y));
}

// определение ручки под курсором
function getHandleAtPoint(shape: Shape, px: number, py: number): ResizeHandle | "rotate" | null {
    const corners = getShapeBoundsCorners(shape);
    const handles: [ResizeHandle, Point][] = [
        ["nw", corners[0]],
        ["n", { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }],
        ["ne", corners[1]],
        ["e", { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 }],
        ["se", corners[2]],
        ["s", { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 }],
        ["sw", corners[3]],
        ["w", { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 }],
    ];

    for (const [handle, pos] of handles) {
        if (Math.hypot(px - pos.x, py - pos.y) <= HANDLE_SIZE) return handle;
    }

    // ручка поворота
    const topCenter = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
    const dir = Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x);
    const normal = { x: -Math.sin(dir), y: Math.cos(dir) };
    const rx = topCenter.x + normal.x * ROTATION_HANDLE_DISTANCE;
    const ry = topCenter.y + normal.y * ROTATION_HANDLE_DISTANCE;
    if (Math.hypot(px - rx, py - ry) <= HANDLE_SIZE) return "rotate";
    return null;
}

// индекс контрольной точки под курсором
function getPointIndexAtPosition(shape: Shape, px: number, py: number): number | null {
    if (!("getControlPoints" in shape)) return null;
    const pts = (shape as any).getControlPoints() as Point[];
    for (let i = 0; i < pts.length; i++) {
        const d = shape.transformPointToDevice(pts[i].x, pts[i].y);
        if (Math.hypot(px - d.x, py - d.y) <= HANDLE_SIZE + 2) return i;
    }
    return null;
}

function getResizeAnchor(bounds: Bounds, handle: ResizeHandle): Point {
    switch (handle) {
        case "nw": return { x: bounds.maxX, y: bounds.maxY };
        case "n": return { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY };
        case "ne": return { x: bounds.minX, y: bounds.maxY };
        case "e": return { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 };
        case "se": return { x: bounds.minX, y: bounds.minY };
        case "s": return { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY };
        case "sw": return { x: bounds.maxX, y: bounds.minY };
        case "w": return { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 };
        default: return { x: bounds.minX, y: bounds.minY };
    }
}

function solveTranslationKeepingAnchor(
    shape: Shape,
    anchorLocal: Point,
    anchorDevice: Point,
    scaleX: number,
    scaleY: number
): Point {
    const r = shape.transform.rotation;
    const cos = Math.cos(r);
    const sin = Math.sin(r);

    const sx = anchorLocal.x * scaleX;
    const sy = anchorLocal.y * scaleY;

    const rotatedX = cos * sx - sin * sy;
    const rotatedY = sin * sx + cos * sy;

    return {
        x: anchorDevice.x - rotatedX,
        y: anchorDevice.y - rotatedY,
    };
}

// ========== компонент ==========
export const CanvasScene = ({ lineAlg, activeTool, onSelectionChange }: CanvasSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<RasterRenderer | null>(null);
    const adapterRef = useRef<RendererAdapter | null>(null);

    // менеджер фигур
    const managerRef = useRef<ShapeManager>(new ShapeManager());
    const manager = managerRef.current;

    const [shapes, setShapes] = useState<Shape[]>([]);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [mode, setMode] = useState<EditorMode>("idle");
    const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
    const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | "rotate" | null>(null);
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
    const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
    const [addPointPosition, setAddPointPosition] = useState<Point | null>(null);
    const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });

    const isAddPointMode = mode === "addPoint";

    // история
    const historyRef = useRef<HistoryState[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const startDataRef = useRef<ShapeStartData | null>(null);
    const startPointRef = useRef<Point | null>(null);
    const editPointIndexRef = useRef<number | null>(null);
    const rotateCenterRef = useRef<Point | null>(null);

    // обновить React состояние из менеджера
    const syncShapes = useCallback(() => {
        setShapes(manager.getShapes());
    }, [manager]);

    // добавить в историю
    const addToHistory = useCallback(() => {
        const state: HistoryState = {
            shapes: manager.getShapes().map(s => s.clone()),
            selectedShapeId: selectedShapeId,
        };
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(state);
        historyIndexRef.current++;
    }, [manager, selectedShapeId]);

    // undo/redo
    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current--;
        const state = historyRef.current[historyIndexRef.current];
        manager.loadFromJSON(state.shapes.map(s => s.toJSON()));
        setSelectedShapeId(state.selectedShapeId);
        syncShapes();
    }, [manager, syncShapes]);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current++;
        const state = historyRef.current[historyIndexRef.current];
        manager.loadFromJSON(state.shapes.map(s => s.toJSON()));
        setSelectedShapeId(state.selectedShapeId);
        syncShapes();
    }, [manager, syncShapes]);

    // создание фигуры
    const addShape = useCallback((tool: CanvasTool, point: Point) => {
        const id = `shape-${Date.now()}`;
        const shape = createShapeByTool(tool, id, point);
        if (!shape) return;
        manager.add(shape);
        setSelectedShapeId(id);
        onSelectionChange?.(shape);
        syncShapes();
        addToHistory();
    }, [manager, onSelectionChange, syncShapes, addToHistory]);

    // удаление выбранной
    const deleteSelected = useCallback(() => {
        if (!selectedShapeId) return;
        manager.remove(selectedShapeId);
        setSelectedShapeId(null);
        syncShapes();
        addToHistory();
    }, [selectedShapeId, manager, syncShapes, addToHistory]);

    // слои
    const moveUp = (id: string) => {
        manager.moveUp(id);
        syncShapes();
        addToHistory();
    };
    const moveDown = (id: string) => {
        manager.moveDown(id);
        syncShapes();
        addToHistory();
    };

    // указатели
    const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const point = getDeviceCoordinates(e.clientX, e.clientY, canvas);
        (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);

        if (activeTool !== "select") {
            addShape(activeTool, point);
            return;
        }

        const selectedShape = selectedShapeId ? manager.getShapes().find(s => s.id === selectedShapeId) : null;

        if (selectedShape) {
            const handle = getHandleAtPoint(selectedShape, point.x, point.y);
            if (handle === "rotate") {
                setMode("rotate");
                startPointRef.current = point;
                startDataRef.current = {
                    x: selectedShape.transform.x,
                    y: selectedShape.transform.y,
                    scaleX: selectedShape.transform.scaleX,
                    scaleY: selectedShape.transform.scaleY,
                    rotation: selectedShape.transform.rotation,
                };
                const corners = getShapeBoundsCorners(selectedShape);
                const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
                const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
                rotateCenterRef.current = { x: cx, y: cy };
                return;
            } else if (handle) {
                setMode("resize");
                setResizeHandle(handle);
                startPointRef.current = point;
                const localBounds = selectedShape.getLocalBounds();
                const invMatrix = selectedShape.getDeviceToLocalMatrix();
                startDataRef.current = {
                    x: selectedShape.transform.x,
                    y: selectedShape.transform.y,
                    scaleX: selectedShape.transform.scaleX,
                    scaleY: selectedShape.transform.scaleY,
                    rotation: selectedShape.transform.rotation,
                    width: localBounds.maxX - localBounds.minX,
                    height: localBounds.maxY - localBounds.minY,
                    startLocalBounds: { ...localBounds },
                    startInvMatrix: invMatrix ?? undefined,
                };
                return;
            }

            // контрольные точки
            const ptIndex = getPointIndexAtPosition(selectedShape, point.x, point.y);
            if (ptIndex !== null) {
                setMode("editPoints");
                editPointIndexRef.current = ptIndex;
                startPointRef.current = point;
                return;
            }

            if (selectedShape.hitTest(point.x, point.y)) {
                setMode("move");
                startPointRef.current = point;
                startDataRef.current = {
                    x: selectedShape.transform.x,
                    y: selectedShape.transform.y,
                    scaleX: selectedShape.transform.scaleX,
                    scaleY: selectedShape.transform.scaleY,
                    rotation: selectedShape.transform.rotation,
                };
                return;
            }
        }

        // hit-test объектов
        const shapes = manager.getShapes();
        let hitShape: Shape | null = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].hitTest(point.x, point.y)) {
                hitShape = shapes[i];
                break;
            }
        }

        if (hitShape) {
            setSelectedShapeId(hitShape.id);
            setMode("move");
            startPointRef.current = point;
            startDataRef.current = {
                x: hitShape.transform.x,
                y: hitShape.transform.y,
                scaleX: hitShape.transform.scaleX,
                scaleY: hitShape.transform.scaleY,
                rotation: hitShape.transform.rotation,
            };
            onSelectionChange?.(hitShape);
        } else {
            setSelectedShapeId(null);
            onSelectionChange?.(null);
        }
    }, [activeTool, addShape, selectedShapeId, manager, onSelectionChange]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const point = getDeviceCoordinates(e.clientX, e.clientY, canvas);
        setCursorPos(point);

        const selectedShape = selectedShapeId ? manager.getShapes().find(s => s.id === selectedShapeId) : null;

        // режим добавления точки
        if (isAddPointMode && selectedShape instanceof PathBezier) {
            setAddPointPosition(point);
            return;
        } else {
            setAddPointPosition(null);
        }

        if (!selectedShape) {
            setHoveredHandle(null);
            setHoveredPointIndex(null);
            const hovered = manager.getShapes().slice().reverse().find(s => s.hitTest(point.x, point.y));
            setHoveredShapeId(hovered?.id ?? null);
            return;
        }

        if (mode === "idle") {
            setHoveredHandle(getHandleAtPoint(selectedShape, point.x, point.y));
            setHoveredPointIndex(getPointIndexAtPosition(selectedShape, point.x, point.y));
        }

        if (mode === "move" && startPointRef.current && startDataRef.current) {
            const dx = point.x - startPointRef.current.x;
            const dy = point.y - startPointRef.current.y;
            selectedShape.transform.x = startDataRef.current.x + dx;
            selectedShape.transform.y = startDataRef.current.y + dy;
            syncShapes();
        } else if (mode === "resize" && startPointRef.current && startDataRef.current && resizeHandle) {
            const sd = startDataRef.current;
            if (sd.width === undefined || sd.height === undefined || !sd.startLocalBounds || !sd.startInvMatrix) return;

            const oldW = sd.width;
            const oldH = sd.height;
            if (oldW <= 0 || oldH <= 0) return;

            // движение мыши в локальных координатах фигуры
            const inv = sd.startInvMatrix;
            const localStart = mat3.transformPoint(inv, startPointRef.current.x, startPointRef.current.y);
            const localCurrent = mat3.transformPoint(inv, point.x, point.y);
            const dLocalX = localCurrent.x - localStart.x;
            const dLocalY = localCurrent.y - localStart.y;

            // считаем новую ширину/высоту в локальных координатах
            let newW = oldW;
            let newH = oldH;

            switch (resizeHandle) {
                case "nw":
                    newW = oldW - dLocalX;
                    newH = oldH - dLocalY;
                    break;
                case "n":
                    newH = oldH - dLocalY;
                    break;
                case "ne":
                    newW = oldW + dLocalX;
                    newH = oldH - dLocalY;
                    break;
                case "e":
                    newW = oldW + dLocalX;
                    break;
                case "se":
                    newW = oldW + dLocalX;
                    newH = oldH + dLocalY;
                    break;
                case "s":
                    newH = oldH + dLocalY;
                    break;
                case "sw":
                    newW = oldW - dLocalX;
                    newH = oldH + dLocalY;
                    break;
                case "w":
                    newW = oldW - dLocalX;
                    break;
            }

            // минимальный размер
            newW = Math.max(MIN_SIZE, newW);
            newH = Math.max(MIN_SIZE, newH);

            // новые масштабы
            const newScaleX = sd.scaleX * (newW / oldW);
            const newScaleY = sd.scaleY * (newH / oldH);

            // фиксируем опорную точку, чтобы фигура не "прыгала"
            const anchorLocal = getResizeAnchor(sd.startLocalBounds, resizeHandle);
            const anchorDevice = selectedShape.transformPointToDevice(anchorLocal.x, anchorLocal.y);

            const newTranslation = solveTranslationKeepingAnchor(
                selectedShape,
                anchorLocal,
                anchorDevice,
                newScaleX,
                newScaleY
            );

            selectedShape.transform.scaleX = newScaleX;
            selectedShape.transform.scaleY = newScaleY;
            selectedShape.transform.x = newTranslation.x;
            selectedShape.transform.y = newTranslation.y;

            syncShapes();
        } else if (mode === "rotate" && startPointRef.current && startDataRef.current && rotateCenterRef.current) {
            const cx = rotateCenterRef.current.x;
            const cy = rotateCenterRef.current.y;
            const startAngle = Math.atan2(startPointRef.current.y - cy, startPointRef.current.x - cx);
            const currentAngle = Math.atan2(point.y - cy, point.x - cx);
            selectedShape.transform.rotation = startDataRef.current.rotation + (currentAngle - startAngle);
            syncShapes();
        } else if (mode === "editPoints" && editPointIndexRef.current !== null && startPointRef.current) {
            const localPt = selectedShape.transformPointToLocal(point.x, point.y);
            if (localPt) {
                (selectedShape as any).setControlPoint(editPointIndexRef.current, localPt);
                syncShapes();
            }
        }
    }, [mode, resizeHandle, selectedShapeId, manager, syncShapes, isAddPointMode]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        if (mode !== "idle") addToHistory();
        setMode("idle");
        setResizeHandle(null);
        startPointRef.current = null;
        startDataRef.current = null;
        editPointIndexRef.current = null;
        rotateCenterRef.current = null;
    }, [mode, addToHistory]);

    // двойной клик – добавить точку в PathBezier
    const onDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || !selectedShapeId) return;
        const shape = manager.getShapes().find(s => s.id === selectedShapeId);
        if (!(shape instanceof PathBezier)) return;
        const point = getDeviceCoordinates(e.clientX, e.clientY, canvas);
        const localPt = shape.transformPointToLocal(point.x, point.y);
        if (!localPt) return;
        shape.insertPointNear(localPt);
        syncShapes();
        addToHistory();
    }, [selectedShapeId, manager, syncShapes, addToHistory]);

    // клавиатура
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedShapeId) deleteSelected();
            } else if (e.ctrlKey && e.key === "z") {
                e.preventDefault();
                e.shiftKey ? redo() : undo();
            } else if (e.key === "Escape") {
                if (isAddPointMode) setMode("idle");
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [selectedShapeId, deleteSelected, undo, redo, isAddPointMode]);

    // рендеринг
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
        const ro = new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry) return;
            requestAnimationFrame(() => resizeNow(entry.contentRect.width, entry.contentRect.height));
        });
        ro.observe(container);
        requestAnimationFrame(() => {
            const rect = container.getBoundingClientRect();
            resizeNow(rect.width, rect.height);
        });

        let raf = 0;
        const frame = () => {
            const r = rendererRef.current;
            const a = adapterRef.current;
            if (!r || !a) return;
            r.beginFrame(true);

            // фигуры
            for (const shape of manager.getShapes()) {
                shape.draw(a);
            }

            // выделение и ручки
            if (selectedShapeId) {
                const sel = manager.getShapes().find(s => s.id === selectedShapeId);
                if (sel) {
                    // рамка (поворачивающийся прямоугольник)
                    const corners = getShapeBoundsCorners(sel);
                    a.strokePolygon(corners, { r: 0, g: 120, b: 220, a: 200 }, 2, true);

                    // ручки (8 штук: углы и середины сторон)
                    const nw = corners[0];
                    const ne = corners[1];
                    const se = corners[2];
                    const sw = corners[3];
                    const n = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 };
                    const e = { x: (ne.x + se.x) / 2, y: (ne.y + se.y) / 2 };
                    const s = { x: (se.x + sw.x) / 2, y: (se.y + sw.y) / 2 };
                    const w = { x: (sw.x + nw.x) / 2, y: (sw.y + nw.y) / 2 };
                    const handlePositions = [nw, n, ne, e, se, s, sw, w];
                    for (const pos of handlePositions) {
                        a.fillPolygon([
                            { x: pos.x - HANDLE_SIZE / 2, y: pos.y - HANDLE_SIZE / 2 },
                            { x: pos.x + HANDLE_SIZE / 2, y: pos.y - HANDLE_SIZE / 2 },
                            { x: pos.x + HANDLE_SIZE / 2, y: pos.y + HANDLE_SIZE / 2 },
                            { x: pos.x - HANDLE_SIZE / 2, y: pos.y + HANDLE_SIZE / 2 },
                        ], { r: 255, g: 255, b: 255, a: 255 });
                    }

                    // ручка поворота
                    const topCenter = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 };
                    const dir = Math.atan2(ne.y - nw.y, ne.x - nw.x);
                    const normal = { x: -Math.sin(dir), y: Math.cos(dir) };
                    const rx = topCenter.x + normal.x * ROTATION_HANDLE_DISTANCE;
                    const ry = topCenter.y + normal.y * ROTATION_HANDLE_DISTANCE;
                    a.fillCircle(rx, ry, HANDLE_SIZE / 2, { r: 100, g: 255, b: 100, a: 255 });

                    // контрольные точки
                    if ("getControlPoints" in sel) {
                        const cpts = (sel as any).getControlPoints() as Point[];
                        cpts.forEach(p => {
                            const d = sel.transformPointToDevice(p.x, p.y);
                            a.fillCircle(d.x, d.y, 5, { r: 255, g: 255, b: 0, a: 255 });
                        });
                    }
                }
            }

            r.commit();
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            renderer.dispose();
        };
    }, [manager, lineAlg, selectedShapeId]);

    // обновление курсора
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let cursor = "default";
        if (isAddPointMode) cursor = "crosshair";
        else if (hoveredHandle && hoveredHandle !== "rotate") {
            const map: Record<string, string> = {
                nw: "nwse-resize",
                n: "ns-resize",
                ne: "nesw-resize",
                e: "ew-resize",
                se: "nwse-resize",
                s: "ns-resize",
                sw: "nesw-resize",
                w: "ew-resize",
            };
            cursor = map[hoveredHandle] || "default";
        } else if (hoveredHandle === "rotate") cursor = "grab";
        else if (hoveredPointIndex !== null) cursor = "crosshair";
        canvas.style.cursor = cursor;
    }, [hoveredHandle, hoveredPointIndex, isAddPointMode]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            <div style={{ flex: 1, display: "flex" }}>
                <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
                    <canvas
                        ref={canvasRef}
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            touchAction: "none",
                            cursor: activeTool === "select" ? "default" : "crosshair",
                        }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onDoubleClick={onDoubleClick}
                    />
                    <div style={{ position: "absolute", bottom: 5, right: 10, color: "#aaa", fontSize: 12 }}>
                        X: {cursorPos.x.toFixed(0)}, Y: {cursorPos.y.toFixed(0)}
                    </div>
                </div>
                <LayerPanel
                    shapes={manager.getShapes()}
                    selectedId={selectedShapeId}
                    onSelect={(id) => {
                        setSelectedShapeId(id);
                        onSelectionChange?.(manager.getShapes().find(s => s.id === id) ?? null);
                    }}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    onDelete={(id) => {
                        manager.remove(id);
                        if (selectedShapeId === id) setSelectedShapeId(null);
                        syncShapes();
                        addToHistory();
                    }}
                />
            </div>
        </div>
    );
};

export default CanvasScene;