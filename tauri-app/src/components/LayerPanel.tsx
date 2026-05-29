import React from 'react';
import type { Shape } from '../lib/shapes/Shape';

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
    return (
        <div style={{
            width: 200,
            borderLeft: '1px solid #555',
            backgroundColor: '#1e1e2f',
            color: '#eee',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'sans-serif',
        }}>
            <div style={{ padding: '8px', borderBottom: '1px solid #555', fontWeight: 'bold' }}>Слои</div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {[...shapes].reverse().map((shape) => (
                    <div
                        key={shape.id}
                        onClick={() => onSelect(shape.id)}
                        style={{
                            padding: '4px 8px',
                            cursor: 'pointer',
                            backgroundColor: shape.id === selectedId ? '#3a3a5a' : 'transparent',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: 14 }}>{shape.id}</span>
                        <div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMoveUp(shape.id); }}
                                title="Поднять"
                                style={{ marginRight: 4, background: '#555', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
                            >↑</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMoveDown(shape.id); }}
                                title="Опустить"
                                style={{ marginRight: 4, background: '#555', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
                            >↓</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(shape.id); }}
                                title="Удалить"
                                style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
                            >✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};