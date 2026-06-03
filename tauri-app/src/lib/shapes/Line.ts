import { Shape } from './Shape';
import type {Transform, Bounds, IRenderer, Point} from './types';


export class Line extends Shape {
    public x1: number;
    public y1: number;
    public x2: number;
    public y2: number;

    constructor(id: string, transform: Transform, x1: number, y1: number, x2: number, y2: number) {
        super(id, transform);

        // ВАЖНО: только локальные координаты
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }

    override getCenter(): Point {
        return {
            x: (this.x1 + this.x2) / 2,
            y: (this.y1 + this.y2) / 2
        };
    }

    override draw(r: IRenderer): void {
        const p1 = this.transformPointToDevice(this.x1, this.y1);
        const p2 = this.transformPointToDevice(this.x2, this.y2);
        const stroke = this.getEffectiveStrokeColor();
        if (stroke && this.strokeWidth > 0) {
            r.strokeLine(p1.x, p1.y, p2.x, p2.y, stroke, this.strokeWidth);
        }
    }
    override hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const dx = this.x2 - this.x1, dy = this.y2 - this.y1;
        const lenSq = dx*dx + dy*dy;
        let t = ((local.x - this.x1) * dx + (local.y - this.y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = this.x1 + t * dx, projY = this.y1 + t * dy;
        const dist = Math.hypot(local.x - projX, local.y - projY);
        const threshold = Math.max(5, this.strokeWidth/2 + 2);
        return dist <= threshold;
    }
    override getLocalBounds(): Bounds {
        return {
            minX: Math.min(this.x1, this.x2),
            minY: Math.min(this.y1, this.y2),
            maxX: Math.max(this.x1, this.x2),
            maxY: Math.max(this.y1, this.y2),
        };
    }
    override getBounds(): Bounds {
        const p1 = this.transformPointToDevice(this.x1, this.y1);
        const p2 = this.transformPointToDevice(this.x2, this.y2);
        return {
            minX: Math.min(p1.x, p2.x),
            minY: Math.min(p1.y, p2.y),
            maxX: Math.max(p1.x, p2.x),
            maxY: Math.max(p1.y, p2.y),
        };
    }

    override setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
        if (maxX < minX) [minX, maxX] = [maxX, minX];
        if (maxY < minY) [minY, maxY] = [maxY, minY];
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        this.transform.x = cx; this.transform.y = cy;
        this.x1 = minX - cx; this.y1 = minY - cy;
        this.x2 = maxX - cx; this.y2 = maxY - cy;
    }
    override clone(): Line {
        const cloned = new Line(
            this.id + '_copy',
            { ...this.transform },
            this.x1,   // не прибавляем transform, т.к. x1 уже локальное смещение
            this.y1,
            this.x2,
            this.y2
        );
        cloned.fillColor = this.fillColor ? { ...this.fillColor } : null;
        cloned.fillOpacity = this.fillOpacity;
        cloned.strokeColor = this.strokeColor ? { ...this.strokeColor } : null;
        cloned.strokeWidth = this.strokeWidth;
        cloned.strokeOpacity = this.strokeOpacity;
        return cloned;
    }

    override toJSON(): any {
        const absX1 = this.x1 + this.transform.x;
        const absY1 = this.y1 + this.transform.y;
        const absX2 = this.x2 + this.transform.x;
        const absY2 = this.y2 + this.transform.y;
        return {
            id: this.id,
            type: 'line',
            transform: { ...this.transform },
            x1: absX1, y1: absY1,
            x2: absX2, y2: absY2,
            strokeStyle: this.strokeColor ? `rgba(${this.strokeColor.r},${this.strokeColor.g},${this.strokeColor.b},${this.strokeOpacity})` : null,
            strokeWidth: this.strokeWidth,
        };
    }
}