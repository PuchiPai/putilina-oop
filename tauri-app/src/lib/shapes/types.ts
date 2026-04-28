import type { RGBA } from '../raster/RasterRenderer';

/** Трансформация фигуры */
export interface Transform {
    x: number;
    y: number;
    rotation: number; // радианы
    scaleX: number;
    scaleY: number;
}

/** Ограничивающий прямоугольник */
export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** Точка */
export interface Point {
    x: number;
    y: number;
}

/** Интерфейс рендерера (для ослабления связи) */
export interface IRenderer {
    width: number;
    height: number;
    fillPolygon(points: Point[], color: RGBA): void;
    strokePolygon(points: Point[], color: RGBA, width: number, closed?: boolean): void;
    strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width: number): void;
    fillCircle(cx: number, cy: number, radius: number, color: RGBA): void;
    setLineAlgorithm(alg: 'bresenham' | 'wu'): void;
}