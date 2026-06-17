/**
 * impositionLayout.js — Pure calculation engine (no React, no hooks)
 * Extracted from ImpositionVisualizer.js so it can be used server-side
 * (e.g. in @react-pdf/renderer API routes).
 */

/**
 * @param {object} params
 * @param {number} params.ups
 * @param {number} params.paperWidthCm
 * @param {number} params.paperHeightCm
 * @param {number} params.compWidthCm
 * @param {number} params.compHeightCm
 * @param {number} [params.bleedMm=3]
 * @returns {object} layout — same shape as ImpositionVisualizer's useMemo return
 */
export function calculateImpositionLayout({
    ups = 1,
    paperWidthCm,
    paperHeightCm,
    compWidthCm,
    compHeightCm,
    bleedMm = 3,
}) {
    const W = parseFloat(paperWidthCm) || 59.4;
    const H = parseFloat(paperHeightCm) || 84.1;
    const cW = parseFloat(compWidthCm) || 14.8;
    const cH = parseFloat(compHeightCm) || 21.0;
    const bleed = parseFloat(bleedMm) / 10; // mm → cm
    const safeUps = Math.max(1, parseInt(ups) || 1);

    const itemW = cW + 2 * bleed;
    const itemH = cH + 2 * bleed;

    // Portrait-on-landscape preference:
    // When the component is portrait (cH > cW) and the paper is landscape (W > H),
    // prefer a layout that fills the paper height with rows, giving cols per row.
    // e.g. 3 A4 portrait on A1 landscape → rows=2, cols=2 (2 per row).
    const isPortraitOnLandscape = cH > cW && W > H;

    const options = isPortraitOnLandscape
        ? [{ name: 'Standard', itemW, itemH, compW: cW, compH: cH, rotated: false }]
        : [
            { name: 'Standard',      itemW,        itemH,        compW: cW, compH: cH, rotated: false },
            { name: 'Rotated (90°)', itemW: itemH, itemH: itemW, compW: cH, compH: cW, rotated: true  },
          ];

    // For portrait-on-landscape, derive preferred rows from paper height
    const preferredRows = isPortraitOnLandscape
        ? Math.max(1, Math.floor(H / cH))
        : null;

    let best = null;
    let bestScore = -Infinity;

    for (const opt of options) {
        // For portrait-on-landscape: only evaluate the preferred row count
        const colsToTry = isPortraitOnLandscape
            ? [Math.ceil(safeUps / preferredRows)]
            : Array.from({ length: safeUps }, (_, i) => i + 1);

        for (const cols of colsToTry) {
            let totalWidthNeeded = 0;
            let totalHeightNeeded = 0;
            let totalOverflowAmount = 0;
            let fits = true;

            for (let i = 0; i < safeUps; i++) {
                const colIdx = i % cols;
                const rowIdx = Math.floor(i / cols);
                const rightEdge  = (colIdx + 1) * opt.itemW;
                const bottomEdge = (rowIdx + 1) * opt.itemH;

                if (rightEdge  > totalWidthNeeded)  totalWidthNeeded  = rightEdge;
                if (bottomEdge > totalHeightNeeded) totalHeightNeeded = bottomEdge;

                // For portrait-on-landscape use comp dims (no bleed) for fit check
                // since inner cuts between nested A-series sheets have no bleed
                const checkW = isPortraitOnLandscape ? (colIdx + 1) * cW : rightEdge;
                const checkH = isPortraitOnLandscape ? (rowIdx + 1) * cH : bottomEdge;

                if (checkW > W || checkH > H) {
                    fits = false;
                    totalOverflowAmount += Math.max(0, checkW - W) + Math.max(0, checkH - H);
                }
            }

            const score = fits
                ? 10000 - totalWidthNeeded * totalHeightNeeded
                : -10000 - totalOverflowAmount * 100;

            if (best === null || score > bestScore) {
                bestScore = score;
                best = {
                    ...opt,
                    cols,
                    rows: Math.ceil(safeUps / cols),
                    gridW: totalWidthNeeded,
                    gridH: totalHeightNeeded,
                    fits,
                };
            }
        }
    }

    const utilizationPercent = Math.min(100, (safeUps * cW * cH) / (W * H) * 100);

    return {
        W, H, cW, cH, bleed,
        utilizationPercent,
        wastePercent: 100 - utilizationPercent,
        ups: safeUps,
        ...best,
    };
}

/**
 * Returns an array of cell descriptors for the SVG grid.
 * Each descriptor has all the coordinate math pre-computed so the renderer
 * (HTML SVG or @react-pdf Svg) doesn't need to repeat it.
 *
 * @param {object} layout  — result of calculateImpositionLayout()
 * @param {number} svgW    — SVG viewport width  (px or pt)
 * @param {number} svgH    — SVG viewport height (px or pt)
 * @param {number} padding — padding inside SVG viewport
 * @returns {{ cells, scale, offsetX, offsetY, renderedW, renderedH, gridX, gridY }}
 */
export function buildImpositionSVGData(layout, svgW = 450, svgH = 300, padding = 40) {
    const { W, H, cols, rows, itemW, itemH, compW, compH, bleed, fits, ups } = layout;

    const scaleX = (svgW - padding * 2) / W;
    const scaleY = (svgH - padding * 2) / H;
    const scale  = Math.min(scaleX, scaleY);

    const renderedW = W * scale;
    const renderedH = H * scale;
    const offsetX   = (svgW - renderedW) / 2;
    const offsetY   = (svgH - renderedH) / 2;

    const gridW = cols * itemW;
    const gridH = rows * itemH;
    const gridX  = offsetX + (renderedW - gridW * scale) / 2;
    const gridY  = offsetY + (renderedH - gridH * scale) / 2;

    const cells = Array.from({ length: ups }).map((_, i) => {
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);

        const cellX = gridX + colIdx * itemW * scale;
        const cellY = gridY + rowIdx * itemH * scale;
        const cellW = itemW * scale;
        const cellH = itemH * scale;

        const overflow =
            cellX + cellW > offsetX + renderedW + 0.1 ||
            cellY + cellH > offsetY + renderedH + 0.1 ||
            cellX < offsetX - 0.1 ||
            cellY < offsetY - 0.1;

        const finX = cellX + bleed * scale;
        const finY = cellY + bleed * scale;
        const finW = compW * scale;
        const finH = compH * scale;

        return { i, colIdx, rowIdx, cellX, cellY, cellW, cellH, overflow, finX, finY, finW, finH };
    });

    return { cells, scale, offsetX, offsetY, renderedW, renderedH, gridX, gridY, fits };
}
