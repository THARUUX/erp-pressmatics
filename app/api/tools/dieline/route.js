import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { modelId, params = {}, requestType = 'PREVIEW', fileType = 'svg' } = body;

        if (!modelId) {
            return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
        }

        const actionUrl = requestType === 'PREVIEW'
            ? 'https://www.templatemaker.nl/assets/php/action.php?REQUEST=PREVIEW&RESOLUTION=36'
            : 'https://www.templatemaker.nl/assets/php/action.php';

        const formData = new URLSearchParams();
        formData.append('MODEL', modelId);
        formData.append('UNITS', params.UNITS || 'mm');
        formData.append('PAGEPRESET', params.PAGEPRESET || 'Auto');
        formData.append('MARGIN', params.MARGIN !== undefined ? String(params.MARGIN) : '25');

        if (requestType === 'DOWNLOAD') {
            formData.append('DOWNLOAD', '1');
            formData.append('FILETYPE', fileType);
        }

        // Append all model-specific parameters
        Object.entries(params).forEach(([key, val]) => {
            if (key !== 'MODEL' && key !== 'UNITS' && key !== 'PAGEPRESET' && key !== 'MARGIN') {
                formData.append(key, String(val));
            }
        });

        const referer = `https://www.templatemaker.nl/en/${modelId}/`;
        const resp = await fetch(actionUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
                'Referer': referer,
                'Origin': 'https://www.templatemaker.nl',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        if (!resp.ok) {
            return NextResponse.json({ error: `Templatemaker returned status ${resp.status}` }, { status: resp.status });
        }

        if (requestType === 'DOWNLOAD') {
            const blob = await resp.blob();
            const contentDisposition = resp.headers.get('Content-Disposition') || `attachment; filename="${modelId}.${fileType}"`;
            return new NextResponse(blob, {
                headers: {
                    'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
                    'Content-Disposition': contentDisposition,
                },
            });
        }

        const svgContent = await resp.text();

        // Extract preview width and height from <desc id="preview-width"> and <desc id="preview-height">
        let widthMm = 0;
        let heightMm = 0;
        const wMatch = svgContent.match(/<desc id=['"]preview-width['"]>([\d.]+)</);
        const hMatch = svgContent.match(/<desc id=['"]preview-height['"]>([\d.]+)</);

        if (wMatch && wMatch[1]) widthMm = parseFloat(wMatch[1]);
        if (hMatch && hMatch[1]) heightMm = parseFloat(hMatch[1]);

        // Restyle the SVG to match Pressmatics dark glassmorphic design theme
        const customStyle = `<style>
    path, line, rect, circle, polygon, polyline {
      vector-effect: non-scaling-stroke;
    }
    .cut, .cut path, g.cut path, [stroke="#000000"], [stroke="black"], [stroke="#000"] {
      stroke: #f43f5e !important;
      stroke-width: 1.5px !important;
      fill: none !important;
    }
    .fold, .fold path, g.fold path, .crease, .crease path, g.crease path, [stroke="#0000ff"], [stroke="blue"] {
      stroke: #38bdf8 !important;
      stroke-width: 1.5px !important;
      stroke-dasharray: 6 4 !important;
      fill: none !important;
    }
    .mountain, .mountain path, g.mountain path {
      stroke: #0ea5e9 !important;
      stroke-width: 1.5px !important;
      stroke-dasharray: 6 4 !important;
      fill: none !important;
    }
    .valley, .valley path, g.valley path {
      stroke: #38bdf8 !important;
      stroke-width: 1.5px !important;
      stroke-dasharray: 3 3 !important;
      fill: none !important;
    }
    .construction, .construction path, g.construction path {
      stroke: #818cf8 !important;
      stroke-width: 1px !important;
      stroke-dasharray: 2 2 !important;
      fill: none !important;
    }
    text, .text, .labels, .pagetext {
      fill: #e2e8f0 !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-weight: 600 !important;
    }
  </style>`;

        let styledSvg = svgContent
            // Replace background page rectangle with transparent or subtle stroke
            .replace(/<rect class=['"]page['"][^>]*\/>/gi, '')
            // Remove templatemaker.nl branding and permissive license text elements from template UI
            .replace(/<text\b[^>]*>(?:(?!<\/text>)[\s\S])*?(?:templatemaker\.nl|permissive license)(?:(?!<\/text>)[\s\S])*?<\/text>/gi, '')
            // Ensure SVG fills container and maintains viewbox
            .replace(/<svg ([^>]*)/i, (match) => {
                let s = match;
                if (!s.includes('width=')) s += ' width="100%"';
                if (!s.includes('height=')) s += ' height="100%"';
                return s;
            });

        if (styledSvg.includes('</defs>')) {
            styledSvg = styledSvg.replace('</defs>', `${customStyle}\n</defs>`);
        } else if (styledSvg.includes('<defs>')) {
            styledSvg = styledSvg.replace('<defs>', `<defs>${customStyle}`);
        } else {
            styledSvg = styledSvg.replace(/<svg([^>]*)>/i, `<svg$1><defs>${customStyle}</defs>`);
        }

        return NextResponse.json({
            success: true,
            svg: styledSvg,
            rawSvg: svgContent,
            widthMm,
            heightMm,
        });

    } catch (error) {
        console.error('Dieline API error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate dieline' }, { status: 500 });
    }
}
