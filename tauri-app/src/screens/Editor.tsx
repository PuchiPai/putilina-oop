import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, MousePointer, Square, Circle } from "lucide-react";
import CanvasScene from "../components/CanvasScene";

export default function Editor() {
    const navigate = useNavigate();
    const params = useParams<{ id?: string }>();
    const rawId = params.id ?? "new";
    // const projectIdDisplay = rawId === "new" ? "Новый" : rawId;

    const [lineAlg, setLineAlg] = useState<"bresenham" | "wu">("bresenham");
    const [activeTool, setActiveTool] = useState<"select" | "square" | "circle">("select");

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
                <div>
                    <button className="btn">
                        <Save size={18} />
                        Сохранить
                    </button>
                </div>
            </div>

            <div className="editor-body">
                <aside className="editor-tools" aria-label="Инструменты">
                    <button
                        className={"tool-btn" + (activeTool === "select" ? " active" : "")}
                        title="Выбор"
                        onClick={() => setActiveTool("select")}
                    ><MousePointer size={18} /></button>
                    <button
                        className={"tool-btn" + (activeTool === "square" ? " active" : "")}
                        title="Квадрат"
                        onClick={() => setActiveTool("square")}
                    ><Square size={18} /></button>
                    <button
                        className={"tool-btn" + (activeTool === "circle" ? " active" : "")}
                        title="Круг"
                        onClick={() => setActiveTool("circle")}
                    ><Circle size={18} /></button>
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
                            <CanvasScene lineAlg={lineAlg} />
                        </div>
                    </div>
                </main>

                <aside className="editor-props">
                    <h3>Свойства</h3>
                    <p className="muted">Здесь будут настройки (цвет, размер ...)</p>
                </aside>
            </div>
        </div>
    );
}