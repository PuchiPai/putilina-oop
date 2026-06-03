import { Shape } from './Shape';
import type { Transform, Bounds, Point, IRenderer } from './types';

export class Rect extends Shape {
    public width: number;
    public height: number;

    constructor(id: string, transform: Transform, width: number, height: number) {
        super(id, transform);
        this.width = width;
        this.height = height;
    }

    override getCenter(): Point {
        const b = this.getLocalBounds();
        return {
            x: (b.minX + b.maxX) / 2,
            y: (b.minY + b.maxY) / 2
        };
    }

    override getLocalBounds(): Bounds {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        return { minX: -halfW, minY: -halfH, maxX: halfW, maxY: halfH };
    }

    override getBounds(): Bounds {
        const corners: Point[] = [
            { x: -this.width / 2, y: -this.height / 2 },
            { x:  this.width / 2, y: -this.height / 2 },
            { x:  this.width / 2, y:  this.height / 2 },
            { x: -this.width / 2, y:  this.height / 2 },
        ];
        const device = corners.map(p => this.transformPointToDevice(p.x, p.y));
        const xs = device.map(p => p.x);
        const ys = device.map(p => p.y);
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }

    override draw(r: IRenderer): void {
        const corners: Point[] = [
            { x: -this.width / 2, y: -this.height / 2 },
            { x:  this.width / 2, y: -this.height / 2 },
            { x:  this.width / 2, y:  this.height / 2 },
            { x: -this.width / 2, y:  this.height / 2 },
        ];
        const device = corners.map(p => this.transformPointToDevice(p.x, p.y));
        const fill = this.getEffectiveFillColor();
        if (fill) r.fillPolygon(device, fill);
        const stroke = this.getEffectiveStrokeColor();
        if (stroke && this.strokeWidth > 0) r.strokePolygon(device, stroke, this.strokeWidth);
    }

    override hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        return local.x >= -halfW && local.x <= halfW && local.y >= -halfH && local.y <= halfH;
    }

    override clone(): Rect {
        const cloned = new Rect(this.id + '_copy', { ...this.transform }, this.width, this.height);
        cloned.fillColor = this.fillColor ? { ...this.fillColor } : null;
        cloned.fillOpacity = this.fillOpacity;
        cloned.strokeColor = this.strokeColor ? { ...this.strokeColor } : null;
        cloned.strokeWidth = this.strokeWidth;
        cloned.strokeOpacity = this.strokeOpacity;
        return cloned;
    }

    override toJSON(): any {
        return {
            id: this.id, type: 'rect', transform: { ...this.transform },
            width: this.width, height: this.height,
            fillStyle: this.fillColor ? `rgba(${this.fillColor.r},${this.fillColor.g},${this.fillColor.b},${this.fillOpacity})` : null,
            strokeStyle: this.strokeColor ? `rgba(${this.strokeColor.r},${this.strokeColor.g},${this.strokeColor.b},${this.strokeOpacity})` : null,
            strokeWidth: this.strokeWidth,
        };
    }
}