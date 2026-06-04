import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft, Save, MousePointer, Square, Circle,
    Slash, Triangle, Spline, Waypoints, VectorSquare
} from "lucide-react";
import CanvasScene from "../components/CanvasScene";
import { ShapeManager } from "../lib/shapes/ShapeManager";
import type { Shape } from "../lib/shapes/Shape";
import { saveProject, loadProject, loadProjectIndex, saveProjectIndex } from "../lib/projectStorage";

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

export default function Editor() {
    const navigate = useNavigate();
    const params = useParams<{ id?: string }>();
    const rawId = params.id ?? "new";

    const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");
    const [activeTool, setActiveTool] = useState<CanvasTool>("select");
    const [selectedShape, setSelectedShape] = useState<Shape | null>(null);

    // Единый менеджер фигур – принадлежит Editor
    const managerRef = useRef<ShapeManager>(new ShapeManager());
    const manager = managerRef.current;

    const [, setRefreshTick] = useState(0);
    const forceUpdate = () => setRefreshTick(t => t + 1);

    // Загрузка проекта при открытии
    useEffect(() => {
        const load = async () => {
            if (rawId === "new") return;
            const data = await loadProject(rawId);
            if (data) {
                setLineAlg(data.lineAlgorithm ?? "bresenham");
                manager.loadFromJSON(data.shapes);
                forceUpdate();
            }
        };
        load();
    }, [rawId]);

    // Сохранение проекта
    const handleSave = useCallback(async () => {
        try {
            const projectId = rawId === "new" ? Date.now().toString() : rawId;
            const now = new Date().toISOString();

            const projectData = {
                id: projectId,
                name: `Проект ${projectId}`,
                createdAt: now,
                modifiedAt: now,
                lineAlgorithm: lineAlg,
                shapes: manager.getShapes().map(s => s.toJSON()),
            };

            await saveProject(projectId, projectData);

            const index = await loadProjectIndex();
            const entry = {
                id: projectId,
                name: projectData.name,
                lastModified: now,
                shapeCount: projectData.shapes.length,
            };

            const existingIdx = index.findIndex((p: any) => p.id === projectId);
            if (existingIdx >= 0) index[existingIdx] = entry;
            else index.push(entry);

            await saveProjectIndex(index);

            navigate("/");
        } catch (err) {
            console.error("Сохранение не удалось:", err);
            alert(`Не удалось сохранить проект: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [rawId, lineAlg, manager, navigate]);

    // Обработчик изменения выделения (для панели свойств)
    const handleSelectionChange = useCallback((shape: Shape | null) => {
        setSelectedShape(shape);
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
                    <button className={"tool-btn" + (activeTool === "select" ? " active" : "")}
                            onClick={() => setActiveTool("select")} title="Выбор">
                        <MousePointer size={18} />
                    </button>
                    <button className={"tool-btn" + (activeTool === "rect" ? " active" : "")}
                            onClick={() => setActiveTool("rect")} title="Прямоугольник">
                        <Square size={18} />
                    </button>
                    <button className={"tool-btn" + (activeTool === "oval" ? " active" : "")}
                            onClick={() => setActiveTool("oval")} title="Овал">
                        <Circle size={18} />
                    </button>
                    <button className={"tool-btn" + (activeTool === "line" ? " active" : "")}
                            onClick={() => setActiveTool("line")} title="Линия">
                        <Slash size={18} />
                    </button>
                    <button className={"tool-btn" + (activeTool === "triangle" ? " active" : "")}
                            onClick={() => setActiveTool("triangle")} title="Треугольник">
                        <Triangle size={18} />
                    </button>
                    <button className={"tool-btn" + (activeTool === "quadraticBezier" ? " active" : "")}
                            onClick={() => setActiveTool("quadraticBezier")} title="Квадратичная Безье">
                        <Spline size={18} />
                    </button>
                    <button className={"tool-btn" + (activeTool === "cubicBezier" ? " active" : "")}
                            onClick={() => setActiveTool("cubicBezier")} title="Кубическая Безье">
                        <Waypoints size={18} />
                    </button>
                    <button className={"tool-btn" + (activeTool === "pathBezier" ? " active" : "")}
                            onClick={() => setActiveTool("pathBezier")} title="Path Bezier">
                        <VectorSquare size={18} />
                    </button>
                </aside>

                <main className="editor-canvas">
                    <div className="canvas-inner">
                        <div className="canvas-toolbar">
                            <button className={"btn small" + (lineAlg === "bresenham" ? " active-btn" : "")}
                                    onClick={() => setLineAlg("bresenham")}>
                                Брезенхем
                            </button>
                            <button className={"btn small" + (lineAlg === "wu" ? " active-btn" : "")}
                                    onClick={() => setLineAlg("wu")}>
                                Ву
                            </button>
                        </div>
                        <div className="canvas-stage">
                            <CanvasScene
                                lineAlg={lineAlg}
                                activeTool={activeTool}
                                manager={manager}
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
                            <div>
                                <div className="muted">Тип</div>
                                <div>{selectedShape.constructor.name}</div>
                            </div>
                            {/* Здесь можно добавить больше свойств */}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}