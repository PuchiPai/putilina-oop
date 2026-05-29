import React from 'react';

interface ToolbarProps {
    onAddShape: (type: string) => void;
    onDeletePoint?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAddShape, onDeletePoint }) => {
    const btnStyle = {
        padding: '6px 12px',
        marginRight: 8,
        background: '#444',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
    };

    return (
        <div style={{ display: 'flex', gap: 8, padding: '8px', background: '#2a2a3e', borderBottom: '1px solid #555' }}>
            <button style={btnStyle} onClick={() => onAddShape('rect')}>📦 Прямоугольник</button>
            <button style={btnStyle} onClick={() => onAddShape('line')}>📏 Линия</button>
            <button style={btnStyle} onClick={() => onAddShape('oval')}>🥚 Овал</button>
            <button style={btnStyle} onClick={() => onAddShape('triangle')}>🔺 Треугольник</button>
            <button style={btnStyle} onClick={() => onAddShape('quadraticBezier')}>〰 Квадр. Безье</button>
            <button style={btnStyle} onClick={() => onAddShape('cubicBezier')}>〰 Кубич. Безье</button>
            <button style={btnStyle} onClick={() => onAddShape('pathBezier')}>✨ Bezier</button>
            <button style={btnStyle} onClick={() => onDeletePoint?.()}>➖ Удалить точку</button>
        </div>
    );
};