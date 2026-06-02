import React from "react";

interface ToolbarProps {
    onAddShape: (type: string) => void;
    onDeletePoint?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAddShape, onDeletePoint }) => {
    const btnStyle: React.CSSProperties = {
        padding: "6px 12px",
        background: "#444",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        whiteSpace: "nowrap",
    };

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: "8px",
                background: "#2a2a3e",
                borderBottom: "1px solid #555",
                alignItems: "center",
            }}
        >
            <button style={btnStyle} onClick={() => onAddShape("rect")}>📦 Прямоугольник</button>
            <button style={btnStyle} onClick={() => onAddShape("line")}>📏 Линия</button>
            <button style={btnStyle} onClick={() => onAddShape("oval")}>🥚 Овал</button>
            <button style={btnStyle} onClick={() => onAddShape("triangle")}>🔺 Треугольник</button>
            <button style={btnStyle} onClick={() => onAddShape("quadraticBezier")}>〰 Квадр. Безье</button>
            <button style={btnStyle} onClick={() => onAddShape("cubicBezier")}>〰 Кубич. Безье</button>
            <button style={btnStyle} onClick={() => onAddShape("pathBezier")}>✨ PathBezier</button>

            <button
                style={{
                    ...btnStyle,
                    background: "#8b3a3a",
                }}
                onClick={() => onDeletePoint?.()}
                title="Удалить последнюю контрольную точку у PathBezier"
            >
                ➖ Удалить точку
            </button>
        </div>
    );
};