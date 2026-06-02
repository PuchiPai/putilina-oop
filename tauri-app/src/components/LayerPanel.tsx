import React from "react";
import type { Shape } from "../lib/shapes/Shape";

interface LayerPanelProps {
    shapes: Shape[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onDelete: (id: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
                                                          shapes,
                                                          selectedId,
                                                          onSelect,
                                                          onMoveUp,
                                                          onMoveDown,
                                                          onDelete,
                                                      }) => {
    const panelStyle: React.CSSProperties = {
        width: 240,
        borderLeft: "1px solid #555",
        backgroundColor: "#1e1e2f",
        color: "#eee",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
    };

    const buttonStyle: React.CSSProperties = {
        background: "#555",
        color: "#fff",
        border: "none",
        borderRadius: 3,
        cursor: "pointer",
        padding: "2px 6px",
        fontSize: 12,
    };

    const deleteStyle: React.CSSProperties = {
        ...buttonStyle,
        background: "#c0392b",
    };

    return (
        <div style={panelStyle}>
            <div
                style={{
                    padding: "8px",
                    borderBottom: "1px solid #555",
                    fontWeight: "bold",
                }}
            >
                Слои
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
                {[...shapes].reverse().map((shape, index) => {
                    const isSelected = shape.id === selectedId;
                    const layerNumber = shapes.length - index;

                    return (
                        <div
                            key={shape.id}
                            onClick={() => onSelect(shape.id)}
                            style={{
                                padding: "6px 8px",
                                cursor: "pointer",
                                backgroundColor: isSelected ? "#3a3a5a" : "transparent",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>Слой {layerNumber}</div>
                                <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {shape.id}
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveUp(shape.id);
                                    }}
                                    title="Поднять выше"
                                    style={buttonStyle}
                                >
                                    ↑
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveDown(shape.id);
                                    }}
                                    title="Опустить ниже"
                                    style={buttonStyle}
                                >
                                    ↓
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(shape.id);
                                    }}
                                    title="Удалить"
                                    style={deleteStyle}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};