import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Save,
    MousePointer,
    Square,
    Circle,
    Slash,
    Triangle,
    Spline,
    Waypoints,
    VectorSquare
} from "lucide-react";
import CanvasScene, { CanvasSceneHandle } from "../components/CanvasScene";
import type { Shape } from "../lib/shapes/Shape";
import { useRef } from "react";
import { useEffect } from "react";

type CanvasTool =
    | "select"
    | "rect"
    | "oval"
    | "line"
    | "triangle"
    | "quadraticBezier"
    | "cubicBezier"
    | "pathBezier";
type LineAlg = "bresenham" | "wu";

type Rgba = { r: number; g: number; b: number; a: number };

function rgbaToHex(color?: Rgba) {
    if (!color) return "#000000";
    const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function hexToRgba(hex: string, a = 255): Rgba {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b, a };
}

export default function Editor() {
    const navigate = useNavigate();
    const params = useParams<{ id?: string }>();
    const rawId = params.id ?? "new";

    const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");
    const [activeTool, setActiveTool] = useState<CanvasTool>("select");
    const [selectedShape, setSelectedShape] = useState<Shape | null>(null);

    const [, forcePanelUpdate] = useState(0);

    const canvasRef = useRef<CanvasSceneHandle>(null);

    const handleSelectionChange = useCallback((shape: Shape | null) => {
        setSelectedShape(shape);
        forcePanelUpdate(v => v + 1);
    }, []);

    const updateSelectedShape = useCallback((mutator: (shape: Shape) => void) => {
        if (!selectedShape) return;
        mutator(selectedShape);
        forcePanelUpdate(v => v + 1);
    }, [selectedShape]);

    const handleSave = useCallback(() => {
        // Заглушка под сохранение проекта
        console.log("Save project:", rawId);
    }, [rawId]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && e.key.toLowerCase() === "z") {
                e.preventDefault();

                if (e.shiftKey) {
                    canvasRef.current?.redo(); // Ctrl+Shift+Z = redo
                } else {
                    canvasRef.current?.undo(); // Ctrl+Z = undo
                }
            }

            if (isCtrl && e.key.toLowerCase() === "y") {
                e.preventDefault();
                canvasRef.current?.redo();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    return (
        <div className="editor-root">
            <div className="editor-top">
                <div className="editor-top-left">
                    <button onClick={() => navigate(-1)} className="btn small">
                        <ArrowLeft size={18} />
                        Назад
                    </button>
                    <h2 className="editor-title">
                        {rawId === "new" ? "Создание нового проекта" : `Редактирование проекта №${rawId}`}
                    </h2>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn" onClick={handleSave}>
                        <Save size={18} />
                        Сохранить
                    </button>
                </div>
            </div>

            <div className="editor-body">
                <aside className="editor-tools" aria-label="Инструменты">

                    <button
                        className={"tool-btn" + (activeTool === "select" ? " active" : "")}
                        onClick={() => setActiveTool("select")}
                        title="Выбор"
                    >
                        <MousePointer size={18} />
                    </button>

                    <button
                        className={"tool-btn" + (activeTool === "rect" ? " active" : "")}
                        onClick={() => setActiveTool("rect")}
                        title="Прямоугольник"
                    >
                        <Square size={18} />
                    </button>

                    <button
                        className={"tool-btn" + (activeTool === "oval" ? " active" : "")}
                        onClick={() => setActiveTool("oval")}
                        title="Овал"
                    >
                        <Circle size={18} />
                    </button>

                    <button
                        className={"tool-btn" + (activeTool === "line" ? " active" : "")}
                        onClick={() => setActiveTool("line")}
                        title="Линия"
                    >
                        <Slash size={18} />
                    </button>

                    <button
                        className={"tool-btn" + (activeTool === "triangle" ? " active" : "")}
                        onClick={() => setActiveTool("triangle")}
                        title="Треугольник"
                    >
                        <Triangle size={18} />
                    </button>

                    <button
                        className={"tool-btn" + (activeTool === "quadraticBezier" ? " active" : "")}
                        onClick={() => setActiveTool("quadraticBezier")}
                        title="Квадратичная Безье"
                    >
                        <Spline size={18} />
                    </button>

                    <button
                        className={"tool-btn" + (activeTool === "cubicBezier" ? " active" : "")}
                        onClick={() => setActiveTool("cubicBezier")}
                        title="Кубическая Безье"
                    >
                        <Waypoints size={18} />
                    </button>

                    <button
                        className={"tool-btn" + (activeTool === "pathBezier" ? " active" : "")}
                        onClick={() => setActiveTool("pathBezier")}
                        title="Path Bezier"
                    >
                        <VectorSquare size={18} />
                    </button>

                    <button
                        className="tool-btn"
                        onClick={() => {
                            const shape = selectedShape;

                            if (!shape) return;

                            if (shape.constructor?.name !== "PathBezier") return;

                            const path = shape as any;
                            const pts = path.getControlPoints?.();

                            if (!pts || pts.length === 0) return;

                            // удаляем последнюю точку (пока так)
                            path.removePoint(pts.length - 1);

                            forcePanelUpdate(v => v + 1);
                        }}
                        title="Удалить точку PathBezier"
                    >
                        ✖
                    </button>

                </aside>

                <main className="editor-canvas">
                    <div className="canvas-inner">
                        <div className="canvas-toolbar">
                            <button
                                className={"btn small" + (lineAlg === "bresenham" ? " active-btn" : "")}
                                onClick={() => setLineAlg("bresenham")}
                            >
                                Брезенхем
                            </button>
                            <button
                                className={"btn small" + (lineAlg === "wu" ? " active-btn" : "")}
                                onClick={() => setLineAlg("wu")}
                            >
                                Ву
                            </button>
                        </div>

                        <div className="canvas-stage">
                            <CanvasScene
                                ref={canvasRef}
                                lineAlg={lineAlg}
                                activeTool={activeTool}
                                onSelectionChange={handleSelectionChange}
                            />
                        </div>
                    </div>
                </main>

                <aside className="editor-props">
                    <h3>Свойства</h3>

                    {!selectedShape ? (
                        <p className="muted">Ничего не выбрано</p>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            <div>
                                <div className="muted">ID</div>
                                <div>{selectedShape.id}</div>
                            </div>

                            <label style={{ display: "grid", gap: 4 }}>
                                X
                                <input
                                    type="number"
                                    value={selectedShape.transform.x}
                                    onChange={(e) =>
                                        updateSelectedShape(shape => {
                                            shape.transform.x = Number(e.target.value);
                                        })
                                    }
                                />
                            </label>

                            <label style={{ display: "grid", gap: 4 }}>
                                Y
                                <input
                                    type="number"
                                    value={selectedShape.transform.y}
                                    onChange={(e) =>
                                        updateSelectedShape(shape => {
                                            shape.transform.y = Number(e.target.value);
                                        })
                                    }
                                />
                            </label>

                            <label style={{ display: "grid", gap: 4 }}>
                                Поворот (градусы)
                                <input
                                    type="number"
                                    value={Math.round((selectedShape.transform.rotation * 180) / Math.PI)}
                                    onChange={(e) =>
                                        updateSelectedShape(shape => {
                                            shape.transform.rotation = (Number(e.target.value) * Math.PI) / 180;
                                        })
                                    }
                                />
                            </label>

                            <label style={{ display: "grid", gap: 4 }}>
                                Scale X
                                <input
                                    type="number"
                                    step="0.1"
                                    value={selectedShape.transform.scaleX}
                                    onChange={(e) =>
                                        updateSelectedShape(shape => {
                                            shape.transform.scaleX = Number(e.target.value);
                                        })
                                    }
                                />
                            </label>

                            <label style={{ display: "grid", gap: 4 }}>
                                Scale Y
                                <input
                                    type="number"
                                    step="0.1"
                                    value={selectedShape.transform.scaleY}
                                    onChange={(e) =>
                                        updateSelectedShape(shape => {
                                            shape.transform.scaleY = Number(e.target.value);
                                        })
                                    }
                                />
                            </label>

                            {"fillColor" in selectedShape && (selectedShape as any).fillColor && (
                                <label style={{ display: "grid", gap: 4 }}>
                                    Заливка
                                    <input
                                        type="color"
                                        value={rgbaToHex((selectedShape as any).fillColor)}
                                        onChange={(e) =>
                                            updateSelectedShape(shape => {
                                                (shape as any).fillColor = hexToRgba(e.target.value, 255);
                                            })
                                        }
                                    />
                                </label>
                            )}

                            {"strokeColor" in selectedShape && (selectedShape as any).strokeColor && (
                                <label style={{ display: "grid", gap: 4 }}>
                                    Обводка
                                    <input
                                        type="color"
                                        value={rgbaToHex((selectedShape as any).strokeColor)}
                                        onChange={(e) =>
                                            updateSelectedShape(shape => {
                                                (shape as any).strokeColor = hexToRgba(e.target.value, 255);
                                            })
                                        }
                                    />
                                </label>
                            )}

                            {"strokeWidth" in selectedShape && (
                                <label style={{ display: "grid", gap: 4 }}>
                                    Толщина линии
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={(selectedShape as any).strokeWidth ?? 1}
                                        onChange={(e) =>
                                            updateSelectedShape(shape => {
                                                (shape as any).strokeWidth = Number(e.target.value);
                                            })
                                        }
                                    />
                                </label>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}