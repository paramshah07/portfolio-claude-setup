# Writes scripts/cards/ranks.json: the outlines of the card ranks in EB Garamond SemiBold, as SVG
# paths in font units with y pointing down, so make-card-faces.mjs can set the indices without any font
# installed. EB Garamond is under the SIL Open Font License.
# Run from the repo root with the latin 600 woff from Fontsource:
# uv run --with fonttools scripts/cards/ranks.py eb-garamond-latin-600-normal.woff
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

font = TTFont(sys.argv[1])
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
out = {'unitsPerEm': font['head'].unitsPerEm, 'capHeight': font['OS/2'].sCapHeight, 'glyphs': {}}
for char in 'AKQJ1023456789':
    name = cmap[ord(char)]
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
    box = BoundsPen(glyphs)
    glyphs[name].draw(box)
    # Ink bounds as [left, top, right, bottom], also with y pointing down.
    left, bottom, right, top = box.bounds
    out['glyphs'][char] = {'d': pen.getCommands(), 'advance': glyphs[name].width, 'ink': [round(left), round(-top), round(right), round(-bottom)]}
json.dump(out, open('scripts/cards/ranks.json', 'w'), indent=1)
print('scripts/cards/ranks.json:', ''.join(out['glyphs']))
