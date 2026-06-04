import { Rect, Line, Oval, Triangle, QuadraticBezier, CubicBezier, PathBezier } from "./index";
import type { Shape } from "./Shape";
import type { Transform } from "./types";

type JsonShape = any;

type Rgba = { r: number; g: number; b: number; a: number };

function parseRgba(value?: string | null): Rgba | null {
    if (!value) return null;

    const m = value.match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/
    );
    if (!m) return null;

    const r = Math.max(0, Math.min(255, Number(m[1])));
    const g = Math.max(0, Math.min(255, Number(m[2])));
    const b = Math.max(0, Math.min(255, Number(m[3])));
    const aRaw = m[4];

    let a = 255;
    if (aRaw !== undefined) {
        const n = Number(aRaw);
        a = n <= 1 ? Math.round(n * 255) : Math.round(n);
    }

    return { r, g, b, a };
}

function applyCommonStyle(shape: Shape, data: JsonShape): void {
    const fill = parseRgba(data.fillStyle);
    const stroke = parseRgba(data.strokeStyle);

    if (fill) {
        shape.fillColor = { r: fill.r, g: fill.g, b: fill.b, a: fill.a };
        shape.fillOpacity = fill.a;
    }

    if (stroke) {
        shape.strokeColor = { r: stroke.r, g: stroke.g, b: stroke.b, a: stroke.a };
        shape.strokeOpacity = stroke.a;
    }

    if (typeof data.strokeWidth === "number") {
        shape.strokeWidth = data.strokeWidth;
    }
}

export function shapeFromJSON(data: JsonShape): Shape | null {
    if (!data || !data.type) return null;

    const transform: Transform = {
        x: data.transform?.x ?? 0,
        y: data.transform?.y ?? 0,
        rotation: data.transform?.rotation ?? 0,
        scaleX: data.transform?.scaleX ?? 1,
        scaleY: data.transform?.scaleY ?? 1,
    };

    let shape: Shape | null = null;

    switch (data.type) {
        case "rect":
            shape = new Rect(data.id, transform, data.width ?? 100, data.height ?? 60);
            break;

        case "oval":
            shape = new Oval(data.id, transform, data.radiusX ?? 50, data.radiusY ?? 50);
            break;

        case "line": {
            const tx = transform.x;
            const ty = transform.y;

            shape = new Line(
                data.id,
                transform,
                (data.x1 ?? 0) - tx,
                (data.y1 ?? 0) - ty,
                (data.x2 ?? 0) - tx,
                (data.y2 ?? 0) - ty
            );
            break;
        }

        case "triangle": {
            const pts = data.points ?? [
                { x: 0, y: -40 },
                { x: 40, y: 30 },
                { x: -40, y: 30 },
            ];

            // ВАЖНО: у Triangle конструктор сам центрирует точки,
            // поэтому transform передаём с x=0,y=0, а не сохранённый transform целиком.
            const triTransform: Transform = {
                x: 0,
                y: 0,
                rotation: transform.rotation,
                scaleX: transform.scaleX,
                scaleY: transform.scaleY,
            };

            shape = new Triangle(
                data.id,
                triTransform,
                pts[0].x, pts[0].y,
                pts[1].x, pts[1].y,
                pts[2].x, pts[2].y
            );
            break;
        }

        case "quadratic-bezier":
        case "quad":
            shape = new QuadraticBezier(
                data.id,
                transform,
                data.p0 ?? { x: 0, y: 0 },
                data.p1 ?? { x: 50, y: -80 },
                data.p2 ?? { x: 100, y: 0 }
            );
            break;

        case "cubic-bezier":
        case "cubic":
            shape = new CubicBezier(
                data.id,
                transform,
                data.p0 ?? { x: 0, y: 0 },
                data.p1 ?? { x: 30, y: -100 },
                data.p2 ?? { x: 70, y: 100 },
                data.p3 ?? { x: 100, y: 0 }
            );
            break;

        case "path-bezier":
        case "path":
            shape = new PathBezier(
                data.id,
                transform,
                data.points ?? [],
                data.mode ?? "polyline",
                data.closed ?? false
            );
            break;

        default:
            return null;
    }

    applyCommonStyle(shape, data);
    return shape;
}