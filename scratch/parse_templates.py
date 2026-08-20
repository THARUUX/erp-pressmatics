import glob
import os
import re
import json

files = glob.glob('templatemaker_sourcecode/en/*/index.html')
print(f"Total template index files found: {len(files)}")

models_data = {}
for f in sorted(files):
    model_key = f.split('/')[-2]
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        html = fp.read()
    
    # Title
    h2_match = re.search(r'<h2>(.*?)</h2>', html)
    h2_title = h2_match.group(1) if h2_match else model_key
    
    # Description
    desc_match = re.search(r'<div id="description">(.*?)</div>', html, re.DOTALL)
    desc_text = ""
    if desc_match:
        desc_text = re.sub(r'<[^>]+>', ' ', desc_match.group(1)).strip()
        desc_text = " ".join(desc_text.split())
    
    # Explanation SVG diagram inside col-explanation
    exp_svg = ""
    col_exp_match = re.search(r'<div class="column" id="col-explanation">(.*?)</div>\s*<div class="column" id="col-form">', html, re.DOTALL)
    if col_exp_match:
        svg_m = re.search(r'<svg.*?</svg>', col_exp_match.group(1), re.DOTALL)
        if svg_m:
            exp_svg = svg_m.group(0)
    if not exp_svg:
        # Fallback search for viewBox 0 0 600
        svg_m = re.search(r'<svg[^>]*viewBox="0 0 6[0-9]{2}.*?</svg>', html, re.DOTALL)
        if svg_m:
            exp_svg = svg_m.group(0)
    
    # Form Parameters inside fieldset (excluding MODEL, DOWNLOAD, SHOWTILES, UNITS, PAGEPRESET, REQUEST, etc)
    inputs = []
    # Find all input rows
    rows = re.findall(r'<div class="form-row[^"]*">(.*?)</div>', html, re.DOTALL)
    for row in rows:
        label_m = re.search(r'<label[^>]*>(.*?)</label>', row, re.DOTALL)
        input_m = re.search(r'<input[^>]*name="([^"]+)"[^>]*>', row)
        select_m = re.search(r'<select[^>]*name="([^"]+)"[^>]*>', row)
        
        if not label_m:
            continue
            
        label = re.sub(r'<[^>]+>', '', label_m.group(1)).strip()
        name = ""
        val = ""
        input_type = "measure"
        
        if input_m:
            name_m = re.search(r'name="([^"]+)"', row)
            val_m = re.search(r'value="([^"]*)"', row)
            type_m = re.search(r'data-type="([^"]+)"', row) or re.search(r'type="([^"]+)"', row)
            
            if name_m: name = name_m.group(1)
            if val_m: val = val_m.group(1)
            if type_m: input_type = type_m.group(1)
        elif select_m:
            name = select_m.group(1)
            input_type = "select"
            
        if name in ['MODEL', 'DOWNLOAD', 'SHOWTILES', 'UNITS', 'PAGEPRESET', 'PAGEWIDTH', 'PAGEHEIGHT', 'RESOLUTION', 'DASHIFY', 'PERFORATION', 'BRIDGE2PERFRATIO', 'LAYOUT', 'REQUEST']:
            continue
            
        if name and label:
            inputs.append({
                'name': name,
                'label': label,
                'default': val,
                'type': input_type
            })
            
    models_data[model_key] = {
        'id': model_key,
        'title': h2_title,
        'desc': desc_text,
        'has_svg': bool(exp_svg),
        'svg_content': exp_svg,
        'inputs': inputs
    }

with open('scratch/template_models_meta.json', 'w') as out:
    json.dump(models_data, out, indent=2)

print("Saved template_models_meta.json successfully!")
for k, v in list(models_data.items())[:5]:
    print(f"Model: {k} ({v['title']})")
    print(f"  Inputs: {[i['name'] + '=' + i['default'] for i in v['inputs']]}")
