import json

with open('scratch/template_models_meta.json') as f:
    data = json.load(f)

# Mapping categories
CAT_MAP = {
    'cardbox': 'cartons', 'boxlid': 'cartons', 'shallowbox': 'cartons', 'matchbox': 'cartons',
    'mailer': 'cartons', 'counterdisplay': 'cartons', 'milkcarton': 'cartons', 'multisheetbox': 'cartons',
    'bag': 'bags', 'envelope': 'bags', 'pillowpack': 'bags', 'curved': 'bags',
    'tray-insert-rectangle': 'bags', 'nestable-tray': 'bags',
    'round': 'cylindrical', 'ellipse': 'cylindrical', 'cone': 'cylindrical', 'miter': 'cylindrical',
    'mitered-cone': 'cylindrical', 'sphere': 'cylindrical',
    'polygon': 'polygonal', 'polygon-lid': 'polygonal', 'pyramid': 'polygonal', 'polygonal-pyramid': 'polygonal',
    'rhombus': 'polygonal', 'parallelepiped': 'polygonal', 'trapezoid': 'polygonal',
    'cakeslicebox': 'specialty', 'heart': 'specialty', 'starbox': 'specialty', 'star': 'specialty',
    'gemstone': 'specialty', 'egg-shaped-box': 'specialty', 'coffin': 'specialty', 'exploding-box': 'specialty',
    'passepartout': 'specialty', 'platonic-solids': 'specialty', 'soma': 'specialty', 'giftbox': 'cartons'
}

js_out = "// Auto-generated TemplateMaker Models & Diagrams Dataset\n"
js_out += "export const TEMPLATEMAKER_MODELS = {\n"

for k, v in data.items():
    cat = CAT_MAP.get(k, 'specialty')
    title = v['title'] if v['title'] != 'About' else k.replace('-', ' ').title()
    desc = v['desc']
    svg = v['svg_content']
    inputs = v['inputs']
    
    js_out += f"  '{k}': {{\n"
    js_out += f"    id: '{k}',\n"
    js_out += f"    title: {json.dumps(title)},\n"
    js_out += f"    category: '{cat}',\n"
    js_out += f"    desc: {json.dumps(desc)},\n"
    js_out += f"    diagramSvg: {json.dumps(svg)},\n"
    js_out += f"    inputs: {json.dumps(inputs)}\n"
    js_out += "  },\n"

js_out += "};\n"

with open('app/dashboard/tools/components/template_models_data.js', 'w') as out:
    out.write(js_out)

print("Generated template_models_data.js successfully!")
