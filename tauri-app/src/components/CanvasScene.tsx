// import { useRef, useEffect } from 'react';
// import { RasterRenderer, LineAlg } from '../lib/raster/RasterRenderer';
//
// interface CanvasSceneProps {
//     // shapes: Shape[];
//     // selectedId: string | null;
//     // onSelect: (id: string | null) => void;
//     // onUpdate: () => void;
//     // overlayTick: number;
//     lineAlg: LineAlg; // 'bresenham' | 'wu'
// }
//
// const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
//     const canvasRef = useRef<HTMLCanvasElement>(null);
//     const containerRef = useRef<HTMLDivElement>(null);
//     const rendererRef = useRef<RasterRenderer | null>(null);
//
//     // Следим за изменением алгоритма
//     useEffect(() => {
//         if (rendererRef.current) {
//             rendererRef.current.setLineAlgorithm(lineAlg);
//         }
//     }, [lineAlg]);
//
//     // Инициализация рендерера и анимационного цикла
//     useEffect(() => {
//         const canvas = canvasRef.current;
//         const container = canvasRef.current;
//
//         if (!canvas || !container) {
//             return;
//         }
//
//         // Создаём экземпляр растеризатора
//         const renderer = new RasterRenderer(canvas);
//         renderer.setLineAlgorithm(lineAlg);
//         rendererRef.current = renderer;
//
//         let raf = 0;
//
//         const resizeRenderer = (w: number, h: number) => {
//             renderer.resizeTo(w, h);
//         };
//
//         // Наблюдатель за изменением размера контейнера
//         const ro = new ResizeObserver(() => {
//             // Ждём следующий кадр, чтобы layout уже точно был пересчитан
//             // requestAnimationFrame(() => {
//             //     resizeRenderer();
//             });
//         });
//
//         if (containerRef.current) {
//             ro.observe(containerRef.current);
//         }
//
//         // Запасной вариант на случай, если окно меняется без срабатывания observer
//         const onWindowResize = () => {
//             requestAnimationFrame(() => {
//                 resizeRenderer();
//             });
//         };
//
//         window.addEventListener("resize", onWindowResize);
//
//         // Ждём следующий кадр, чтобы layout уже точно был пересчитан
//         requestAnimationFrame(() => {
//             resizeRenderer();
//         });
//
//         // Анимационный цикл
//         const frame = () => {
//             const r = rendererRef.current;
//             if (r) {
//                 r.beginFrame(true);  // очистить
//                     // Нарисовать фигуры (Пока фигур нет, этот код закомментирован)
//                     // for (const shape of shapes) {
//                         // shape.drawRaster(r);
//                     // }
//
//                     // Попробуйте нарисвать красный полигон с черной обводкой или что-нибудь ещё
//                 const W = r.width;
//                 const H = r.height;
//                 const minSide = Math.min(W, H);
//
//                 const margin = Math.max(18, Math.round(minSide * 0.06));
//
//                 const black = { r: 0, g: 0, b: 0, a: 255 };
//                 const green = { r: 62, g: 180, b: 120, a: 255 };
//                 const blue = { r: 60, g: 110, b: 220, a: 255 };
//                 const redTransparent = { r: 255, g: 0, b: 0, a: 140 };
//                 const orange = { r: 240, g: 160, b: 60, a: 255 };
//                 const purple = { r: 145, g: 70, b: 210, a: 255 };
//
//                 const triangle = [
//                     { x: margin * 1.2, y: margin * 1.4 },
//                     { x: W * 0.32, y: margin * 1.5 },
//                     { x: W * 0.14, y: H * 0.34 },
//                 ];
//                 r.fillPolygon(triangle, green);
//                 r.strokePolygon(triangle, black, Math.max(6, Math.round(minSide * 0.02)));
//
//                 const square = [
//                     { x: W * 0.56, y: H * 0.16 },
//                     { x: W * 0.84, y: H * 0.16 },
//                     { x: W * 0.84, y: H * 0.42 },
//                     { x: W * 0.56, y: H * 0.42 },
//                 ];
//                 r.fillPolygon(square, blue);
//
//                 // Полупрозрачный круг поверх квадрата — проверка blendPixel
//                 r.fillCircle(W * 0.70, H * 0.29, Math.max(30, minSide * 0.10), redTransparent);
//                 r.strokePolygon(square, black, Math.max(4, Math.round(minSide * 0.012)));
//
//                 // Толстая ломаная
//                 r.strokeLine(W * 0.12, H * 0.72, W * 0.26, H * 0.63, orange, Math.max(12, minSide * 0.025));
//                 r.strokeLine(W * 0.26, H * 0.63, W * 0.40, H * 0.78, orange, Math.max(12, minSide * 0.025));
//                 r.strokeLine(W * 0.40, H * 0.78, W * 0.56, H * 0.68, orange, Math.max(12, minSide * 0.025));
//
//                 // Эти две линии показывают разницу между Брезенхемом и Ву
//                 r.drawLine(W * 0.08, H * 0.08, W * 0.92, H * 0.12, black);
//                 r.drawLine(W * 0.08, H * 0.52, W * 0.92, H * 0.38, purple);
//
//                 // Отдельный круг, чтобы гарантированно закрыть пункт чек-листа
//                 r.fillCircle(W * 0.85, H * 0.70, Math.max(28, minSide * 0.08), {
//                     r: 255,
//                     g: 120,
//                     b: 0,
//                     a: 255,
//                 });
//
//                 r.commit();
//             }
//
//             raf = requestAnimationFrame(frame);
//         };
//
//         raf = requestAnimationFrame(frame);
//
//         return () => {
//             cancelAnimationFrame(raf);
//             ro.disconnect();
//             window.removeEventListener("resize", onWindowResize);
//             renderer.dispose();
//             rendererRef.current = null;
//         };
//     }, [lineAlg]);
//
//     return (
//         <div ref={containerRef} className="canvas-shell">
//             <canvas ref={canvasRef} className="canvas-surface" />
//         </div>
//     );
// }
//
// export default CanvasScene;

import { useEffect, useLayoutEffect, useRef } from "react";
import { RasterRenderer, LineAlg } from "../lib/raster/RasterRenderer";

interface CanvasSceneProps {
    lineAlg: LineAlg;
}

const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<RasterRenderer | null>(null);

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.setLineAlgorithm(lineAlg);
        }
    }, [lineAlg]);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;

        if (!canvas || !container) return;

        const renderer = new RasterRenderer(canvas);
        renderer.setLineAlgorithm(lineAlg);
        rendererRef.current = renderer;

        const resizeNow = (w: number, h: number) => {
            renderer.resizeTo(w, h);
        };

        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;

            const { width, height } = entry.contentRect;

            requestAnimationFrame(() => {
                resizeNow(width, height);
            });
        });

        ro.observe(container);

        // Первый resize после layout
        requestAnimationFrame(() => {
            const rect = container.getBoundingClientRect();
            resizeNow(rect.width, rect.height);
        });

        let raf = 0;

        const frame = () => {
            const r = rendererRef.current;
            if (r) {
                r.beginFrame(true);

                const W = r.width;
                const H = r.height;
                const minSide = Math.min(W, H);

                const black = { r: 0, g: 0, b: 0, a: 255 };
                const green = { r: 62, g: 180, b: 120, a: 255 };
                const blue = { r: 60, g: 110, b: 220, a: 255 };
                const redTransparent = { r: 255, g: 0, b: 0, a: 140 };
                const orange = { r: 240, g: 160, b: 60, a: 255 };
                const purple = { r: 145, g: 70, b: 210, a: 255 };

                const pad = Math.max(18, Math.round(minSide * 0.06));

                const triangle = [
                    { x: pad * 1.2, y: pad * 1.4 },
                    { x: W * 0.30, y: pad * 1.5 },
                    { x: W * 0.14, y: H * 0.32 },
                ];
                r.fillPolygon(triangle, green);
                r.strokePolygon(triangle, black, Math.max(6, Math.round(minSide * 0.02)));

                const square = [
                    { x: W * 0.56, y: H * 0.16 },
                    { x: W * 0.84, y: H * 0.16 },
                    { x: W * 0.84, y: H * 0.42 },
                    { x: W * 0.56, y: H * 0.42 },
                ];
                r.fillPolygon(square, blue);

                // Полупрозрачность через blendPixel
                r.fillCircle(W * 0.70, H * 0.29, Math.max(30, minSide * 0.10), redTransparent);
                r.strokePolygon(square, black, Math.max(4, Math.round(minSide * 0.012)));

                // Толстая ломаная
                r.strokeLine(W * 0.12, H * 0.72, W * 0.26, H * 0.63, orange, Math.max(12, minSide * 0.025));
                r.strokeLine(W * 0.26, H * 0.63, W * 0.40, H * 0.78, orange, Math.max(12, minSide * 0.025));
                r.strokeLine(W * 0.40, H * 0.78, W * 0.56, H * 0.68, orange, Math.max(12, minSide * 0.025));

                // Линии для сравнения алгоритмов
                r.drawLine(W * 0.08, H * 0.08, W * 0.92, H * 0.12, black);
                r.drawLine(W * 0.08, H * 0.52, W * 0.92, H * 0.38, purple);

                // Окружность
                r.fillCircle(W * 0.85, H * 0.70, Math.max(28, minSide * 0.08), {
                    r: 255,
                    g: 120,
                    b: 0,
                    a: 255,
                });

                r.commit();
            }

            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            renderer.dispose();
            rendererRef.current = null;
        };
    }, [lineAlg]);

    return (
        <div ref={containerRef} className="canvas-shell">
            <canvas ref={canvasRef} className="canvas-surface" />
        </div>
    );
};

export default CanvasScene;