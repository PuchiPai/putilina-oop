import { mat3, type Mat3 } from '../math/mat3';
import type { RGBA } from '../raster/RasterRenderer';
import type { Transform, Bounds, Point, IRenderer } from './types';

export abstract class Shape {
    public id: string;
    public transform: Transform;

    // Стили
    public fillColor: RGBA | null;
    public fillOpacity: number;
    public strokeColor: RGBA | null;
    public strokeWidth: number;
    public strokeOpacity: number;

    constructor(id: string, transform: Transform) {
        this.id = id;
        this.transform = { ...transform };

        // Значения по умолчанию
        this.fillColor = { r: 200, g: 200, b: 200, a: 255 };
        this.fillOpacity = 1.0;
        this.strokeColor = { r: 0, g: 0, b: 0, a: 255 };
        this.strokeWidth = 1;
        this.strokeOpacity = 1.0;
    }

    getLocalToDeviceMatrix(): Mat3 {
        return mat3.fromTransform(
            this.transform.x,
            this.transform.y,
            this.transform.rotation,
            this.transform.scaleX,
            this.transform.scaleY
        );
    }

    getDeviceToLocalMatrix(): Mat3 | null {
        const m = this.getLocalToDeviceMatrix();
        return mat3.invert(m);
    }

    transformPointToDevice(px: number, py: number): Point {
        const m = this.getLocalToDeviceMatrix();
        const res = mat3.transformPoint(m, px, py);
        return { x: res.x, y: res.y };
    }

    transformPointToLocal(px: number, py: number): Point | null {
        const inv = this.getDeviceToLocalMatrix();
        if (!inv) return null;
        const res = mat3.transformPoint(inv, px, py);
        return { x: res.x, y: res.y };
    }

    getCenter(): Point {
        const b = this.getBounds();
        return {
            x: (b.minX + b.maxX) / 2,
            y: (b.minY + b.maxY) / 2,
        };
    }

    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
        const localBounds = this.getLocalBounds();
        const localWidth = localBounds.maxX - localBounds.minX;
        const localHeight = localBounds.maxY - localBounds.minY;

        if (localWidth === 0 || localHeight === 0) return;

        const newWidth = maxX - minX;
        const newHeight = maxY - minY;

        const scaleX = newWidth / localWidth;
        const scaleY = newHeight / localHeight;

        const newCenterX = (minX + maxX) / 2;
        const newCenterY = (minY + maxY) / 2;

        this.transform.x = newCenterX;
        this.transform.y = newCenterY;
        this.transform.scaleX = scaleX;
        this.transform.scaleY = scaleY;
    }

    setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
        this.resizeFromDeviceAABB(minX, minY, maxX, maxY);
    }

    getEffectiveFillColor(): RGBA | null {
        if (!this.fillColor) return null;
        return {
            ...this.fillColor,
            a: Math.round(this.fillColor.a * this.fillOpacity),
        };
    }

    getEffectiveStrokeColor(): RGBA | null {
        if (!this.strokeColor) return null;
        return {
            ...this.strokeColor,
            a: Math.round(this.strokeColor.a * this.strokeOpacity),
        };
    }

    // Абстрактные методы
    abstract draw(r: IRenderer): void;
    abstract hitTest(px: number, py: number): boolean;
    abstract getBounds(): Bounds;
    abstract getLocalBounds(): Bounds;
    abstract clone(): Shape;
    abstract toJSON(): any;
}