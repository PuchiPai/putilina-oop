export type RGBA = { r: number; g: number; b: number; a: number };
export type LineAlg = 'bresenham' | 'wu';

// Ограничивает значение диапазоном [0, 255] и округляет до целого
export function clampByte(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.min(255, Math.max(0, Math.round(v)));
}

// Преобразует HEX-строку (#RGB или #RRGGBB) в объект RGBA
export function hexToRGBA(hex: string, alpha = 255): RGBA {
    const normalized = hex.trim();
    const raw = normalized.startsWith("#") ? normalized.slice(1) : normalized;

    let r = 0, g = 0, b = 0;

    if (raw.length === 3) {
        r = parseInt(raw[0] + raw[0], 16);
        g = parseInt(raw[1] + raw[1], 16);
        b = parseInt(raw[2] + raw[2], 16);
    } else if (raw.length === 6) {
        r = parseInt(raw.slice(0, 2), 16);
        g = parseInt(raw.slice(2, 4), 16);
        b = parseInt(raw.slice(4, 6), 16);
    } else {
        throw new Error(`Invalid HEX color: ${hex}`);
    }

    if ([r, g, b].some((v) => Number.isNaN(v))) {
        throw new Error(`Invalid HEX color: ${hex}`);
    }

    return { r, g, b, a: clampByte(alpha) };
}

export class RasterRenderer {
    private ctx: CanvasRenderingContext2D;
    private imageData: ImageData | null = null;
    private buf!: Uint8ClampedArray;   // линейный буфер RGBA

    width = 0;   // физическая ширина (пиксели)
    height = 0;  // физическая высота
    dpr = 1;

    private canvas: HTMLCanvasElement;
    private _onWindowResize: () => void;
    private lineAlg: LineAlg = 'bresenham';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        this.ctx = ctx;
        this.ctx.imageSmoothingEnabled = false; // отключаем встроенное сглаживание
        this._onWindowResize = () => this.resize();
        window.addEventListener('resize', this._onWindowResize);
        this.resize();
    }

    dispose() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    setLineAlgorithm(a: LineAlg) { this.lineAlg = a; }
    getLineAlgorithm(): LineAlg { return this.lineAlg; }

    // Выбор алгоритма рисования линии
    drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        if (this.lineAlg === 'wu') {
            this.drawLineWu(x0, y0, x1, y1, color);
        } else {
            this.drawLineBrassenham(x0, y0, x1, y1, color);
        }
    }

    // Преобразование (x, y) в индекс в линейном массиве RGBA
    // Формула: I = (y * width + x) * 4
    private idx(x: number, y: number): number {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height || !this.buf) {
            return -1;
        }
        return (iy * this.width + ix) * 4;
    }

    // Прямая запись пикселя (без смешивания)
    setPixel(x: number, y: number, color: RGBA) {
        const i = this.idx(x, y);
        if (i < 0) return;
        this.buf[i] = clampByte(color.r);
        this.buf[i+1] = clampByte(color.g);
        this.buf[i+2] = clampByte(color.b);
        this.buf[i+3] = clampByte(color.a);
    }

    // Альфа-блендинг (Premultiplied Alpha не используется, стандартный Source Over)
    // alphaFactor — дополнительный множитель прозрачности (нужен для алгоритма Ву)
    private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1) {
        const i = this.idx(x, y);
        if (i < 0) return;

        const srcAByte = clampByte(color.a * alphaFactor);
        if (srcAByte <= 0) return;

        const sa = srcAByte / 255;
        const da = this.buf[i + 3] / 255;

        const outA = sa + da * (1 - sa);
        if (outA <= 0) {
            // полностью прозрачный результат
            this.buf[i] = 0; this.buf[i+1] = 0; this.buf[i+2] = 0; this.buf[i+3] = 0;
            return;
        }

        const sr = color.r / 255, sg = color.g / 255, sb = color.b / 255;
        const dr = this.buf[i] / 255, dg = this.buf[i+1] / 255, db = this.buf[i+2] / 255;

        const outR = (sr * sa + dr * da * (1 - sa)) / outA;
        const outG = (sg * sa + dg * da * (1 - sa)) / outA;
        const outB = (sb * sa + db * da * (1 - sa)) / outA;

        this.buf[i] = clampByte(outR * 255);
        this.buf[i+1] = clampByte(outG * 255);
        this.buf[i+2] = clampByte(outB * 255);
        this.buf[i+3] = clampByte(outA * 255);
    }

    // Установка физического размера canvas с учётом devicePixelRatio
    resizeTo(cssW: number, cssH: number) {
        const safeCssW = Math.max(1, Math.round(cssW));
        const safeCssH = Math.max(1, Math.round(cssH));
        this.dpr = window.devicePixelRatio || 1;

        const newWidth = Math.max(1, Math.round(safeCssW * this.dpr));
        const newHeight = Math.max(1, Math.round(safeCssH * this.dpr));

        if (this.width === newWidth && this.height === newHeight && this.imageData) return;

        this.width = newWidth;
        this.height = newHeight;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = `${safeCssW}px`;
        this.canvas.style.height = `${safeCssH}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.imageSmoothingEnabled = false;

        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.buf = this.imageData.data;

        this.beginFrame(true);
        this.commit();
    }

    // Автоматическое определение размера от родительского элемента
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const cssW = rect.width || this.canvas.clientWidth || 1;
        const cssH = rect.height || this.canvas.clientHeight || 1;
        this.resizeTo(cssW, cssH);
    }

    // Очистка буфера (заполнение нулями = полностью прозрачный чёрный)
    beginFrame(clear = true) {
        if (!this.imageData) this.resize();
        if (clear) this.buf.fill(0);
    }

    // Копирование буфера из CPU в GPU
    commit() {
        if (!this.imageData) return;
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    // Алгоритм Брезенхема (целочисленный, только setPixel)
    drawLineBrassenham(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let x0i = Math.round(x0), y0i = Math.round(y0);
        const x1i = Math.round(x1), y1i = Math.round(y1);

        const dx = Math.abs(x1i - x0i);
        const sx = x0i < x1i ? 1 : -1;
        const dy = -Math.abs(y1i - y0i);
        const sy = y0i < y1i ? 1 : -1;
        let err = dx + dy;

        while (true) {
            this.setPixel(x0i, y0i, color);
            if (x0i === x1i && y0i === y1i) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0i += sx; }
            if (e2 <= dx) { err += dx; y0i += sy; }
        }
    }

    // Алгоритм Сяолиня Ву (сглаживание, использует blendPixel)
    drawLineWu(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let xStart = x0, yStart = y0;
        let xEnd = x1, yEnd = y1;

        const steep = Math.abs(yEnd - yStart) > Math.abs(xEnd - xStart);
        const plot = (x: number, y: number, a: number) => {
            if (steep) this.blendPixel(y, x, color, a);
            else this.blendPixel(x, y, color, a);
        };
        const ipart = (x: number) => Math.floor(x);
        const fpart = (x: number) => x - Math.floor(x);
        const rfpart = (x: number) => 1 - fpart(x);

        if (steep) { [xStart, yStart] = [yStart, xStart]; [xEnd, yEnd] = [yEnd, xEnd]; }
        if (xStart > xEnd) { [xStart, xEnd] = [xEnd, xStart]; [yStart, yEnd] = [yEnd, yStart]; }

        const dx = xEnd - xStart;
        const dy = yEnd - yStart;
        if (dx === 0 && dy === 0) { this.blendPixel(x0, y0, color, 1); return; }

        const gradient = dx === 0 ? 1 : dy / dx;

        // обработка первого конца
        let xend = Math.round(xStart);
        let yend = yStart + gradient * (xend - xStart);
        let xgap = rfpart(xStart + 0.5);
        let xpxl1 = xend;
        let ypxl1 = ipart(yend);
        plot(xpxl1, ypxl1, rfpart(yend) * xgap);
        plot(xpxl1, ypxl1 + 1, fpart(yend) * xgap);
        let intery = yend + gradient;

        // обработка второго конца
        xend = Math.round(xEnd);
        yend = yEnd + gradient * (xend - xEnd);
        xgap = fpart(xEnd + 0.5);
        const xpxl2 = xend;
        const ypxl2 = ipart(yend);
        plot(xpxl2, ypxl2, rfpart(yend) * xgap);
        plot(xpxl2, ypxl2 + 1, fpart(yend) * xgap);

        // основной цикл
        for (let x = xpxl1 + 1; x < xpxl2; x++) {
            plot(x, ipart(intery), rfpart(intery));
            plot(x, ipart(intery) + 1, fpart(intery));
            intery += gradient;
        }
    }

    // Закраска горизонтального отрезка (используется для заливки)
    private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
        const yy = Math.round(y);
        if (yy < 0 || yy >= this.height) return;
        let xs = Math.ceil(Math.min(x0, x1));
        let xe = Math.floor(Math.max(x0, x1));
        if (xe < 0 || xs >= this.width) return;
        xs = Math.max(0, xs);
        xe = Math.min(this.width - 1, xe);
        for (let x = xs; x <= xe; x++) {
            this.blendPixel(x, yy, color, 1);
        }
    }

    // Заливка многоугольника методом сканирующей строки (правило чётности)
    fillPolygon(points: { x: number; y: number }[], color: RGBA) {
        if (points.length < 3) return;
        let minY = points[0].y, maxY = points[0].y;
        for (const p of points) {
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
        const yStart = Math.floor(minY);
        const yEnd = Math.ceil(maxY);

        for (let y = yStart; y <= yEnd; y++) {
            const scanY = y + 0.5; // центр пикселя
            const xs: number[] = [];

            for (let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                const intersects = (a.y <= scanY && b.y > scanY) || (b.y <= scanY && a.y > scanY);
                if (!intersects) continue;
                const t = (scanY - a.y) / (b.y - a.y);
                const x = a.x + t * (b.x - a.x);
                xs.push(x);
            }
            xs.sort((p, q) => p - q);
            for (let i = 0; i + 1 < xs.length; i += 2) {
                this.drawHSpan(y, xs[i], xs[i+1], color);
            }
        }
    }

    // Заливка круга (построчное заполнение горизонтальными отрезками)
    fillCircle(cx: number, cy: number, radius: number, color: RGBA) {
        const yStart = Math.ceil(cy - radius);
        const yEnd = Math.floor(cy + radius);
        const r2 = radius * radius;
        for (let y = yStart; y <= yEnd; y++) {
            const dy = y - cy;
            const dx = Math.sqrt(Math.max(0, r2 - dy * dy));
            this.drawHSpan(y, cx - dx, cx + dx, color);
        }
    }

    // Рисование отрезка с заданной толщиной (прямоугольник + круглые концы)
    strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len === 0) {
            this.fillCircle(x0, y0, Math.max(0.5, width / 2), color);
            return;
        }
        const half = width / 2;
        const nx = -dy / len;   // единичная нормаль X
        const ny = dx / len;    // единичная нормаль Y

        // Четыре вершины прямоугольника (тело линии)
        const p1 = { x: x0 + nx * half, y: y0 + ny * half };
        const p2 = { x: x0 - nx * half, y: y0 - ny * half };
        const p3 = { x: x1 - nx * half, y: y1 - ny * half };
        const p4 = { x: x1 + nx * half, y: y1 + ny * half };

        this.fillPolygon([p1, p2, p3, p4], color);
        // Круглые "шапки" для замыкания концов и устранения щелей
        this.fillCircle(x0, y0, half, color);
        this.fillCircle(x1, y1, half, color);
    }

    // Рисование ломаной (или замкнутого многоугольника) с заданной толщиной
    strokePolygon(points: { x: number; y: number }[], color: RGBA, width = 1, closed = true) {
        if (points.length === 0) return;
        if (points.length === 1) {
            this.fillCircle(points[0].x, points[0].y, Math.max(0.5, width / 2), color);
            return;
        }
        // Рисуем отрезки между последовательными вершинами
        for (let i = 0; i < points.length - 1; i++) {
            this.strokeLine(points[i].x, points[i].y, points[i+1].x, points[i+1].y, color, width);
        }
        // Замыкаем контур, если требуется
        if (closed && points.length > 2) {
            this.strokeLine(points[points.length-1].x, points[points.length-1].y, points[0].x, points[0].y, color, width);
        }
        // Дополнительные круги на вершинах для плавных стыков (устраняют "клинья")
        if (width > 1) {
            const half = width / 2;
            for (const p of points) {
                this.fillCircle(p.x, p.y, half, color);
            }
        }
    }
}