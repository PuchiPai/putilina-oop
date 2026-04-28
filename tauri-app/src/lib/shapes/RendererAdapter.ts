import { RasterRenderer, type RGBA } from '../raster/RasterRenderer';
import type { IRenderer, Point } from './types';

export class RendererAdapter implements IRenderer {
    constructor(private raster: RasterRenderer) {}

    get width(): number { return this.raster.width; }
    get height(): number { return this.raster.height; }

    fillPolygon(points: Point[], color: RGBA): void {
        this.raster.fillPolygon(points, color);
    }

    strokePolygon(points: Point[], color: RGBA, width: number, closed = true): void {
        this.raster.strokePolygon(points, color, width, closed);
    }

    strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width: number): void {
        this.raster.strokeLine(x0, y0, x1, y1, color, width);
    }

    fillCircle(cx: number, cy: number, radius: number, color: RGBA): void {
        this.raster.fillCircle(cx, cy, radius, color);
    }

    setLineAlgorithm(alg: 'bresenham' | 'wu'): void {
        this.raster.setLineAlgorithm(alg);
    }
}