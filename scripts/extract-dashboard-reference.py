"""Extract the exact user-provided reference artwork, not a static dashboard.
Usage: python3 scripts/extract-dashboard-reference.py /absolute/reference.png
Outputs SVG containers holding the original cropped PNG pixels. No text/data/chart
screenshots are used as UI. Background-only crops contain no controls or values.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import base64,io,json,hashlib,sys
src=Path(sys.argv[1]);im=Image.open(src).convert('RGB')
out=Path('public/dashboard-reference');out.mkdir(parents=True,exist_ok=True)
crops={
'wordmark':(24,22,195,68),'gear':(24,22,67,67),
'car':(299,252,345,297),'wrench':(554,250,601,297),
'calendar':(823,249,870,296),'document':(1111,248,1158,296),'gauge':(1394,247,1447,298),
'chart':(300,389,352,436),'garage':(1091,389,1141,433),
'appointment':(294,707,341,756),'activity':(766,705,813,757),'documents':(1248,705,1299,757),
'car-badge':(1115,451,1178,514),'check-badge':(1256,760,1299,804),
'crown':(32,755,81,807),'wave':(475,127,531,184),
'plane':(1490,129,1532,171),'garage-button':(1312,132,1349,166),'search':(294,24,330,60),
'nav-home':(26,111,62,148),'nav-car':(25,168,64,204),'nav-service':(24,219,64,259),
'nav-calendar':(24,270,64,308),'nav-expenses':(24,320,64,360),'nav-reports':(24,372,64,412),
'nav-history':(24,421,64,460),'nav-documents':(25,470,63,509),'nav-gps':(24,515,64,552),
'nav-bell':(24,557,64,597),'nav-settings':(23,600,65,639),'nav-support':(22,642,66,683),
'nav-account':(24,686,64,727),
'download':(1589,763,1629,804),'header-wave':(847,0,1245,84),'welcome-wave':(650,85,1265,222),
}
opaque={'header-wave','welcome-wave'}
circles={'car-badge','check-badge'}
for name,box in crops.items():
 crop=im.crop(box);rgb=np.array(crop).astype(float);h,w=rgb.shape[:2]
 if name in opaque:
  asset=crop.convert('RGBA')
 elif name in circles:
  y,x=np.ogrid[:h,:w];radius=min(h,w)/2-1
  alpha=np.clip(radius-np.sqrt((x-(w-1)/2)**2+(y-(h-1)/2)**2),0,1)
  asset=Image.fromarray(np.dstack((rgb,np.round(alpha*255))).astype('uint8'))
 else:
  # Remove only the local background; original foreground pixels and glow remain.
  corners=[np.median(p.reshape(-1,3),axis=0) for p in [rgb[:3,:3],rgb[:3,-3:],rgb[-3:,:3],rgb[-3:,-3:]]]
  x=np.linspace(0,1,w)[None,:,None];y=np.linspace(0,1,h)[:,None,None]
  bg=(corners[0]*(1-x)+corners[1]*x)*(1-y)+(corners[2]*(1-x)+corners[3]*x)*y
  alpha=np.max(np.maximum(rgb-bg,0)/np.maximum(255-bg,1),axis=2)
  alpha=np.where(alpha<0.025,0,alpha)
  fg=np.clip((rgb-bg*(1-alpha[:,:,None]))/np.maximum(alpha[:,:,None],0.001),0,255)
  asset=Image.fromarray(np.dstack((fg,np.round(alpha*255))).astype('uint8'))
 png=io.BytesIO();asset.save(png,format='PNG',optimize=True)
 encoded=base64.b64encode(png.getvalue()).decode()
 (out/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><image width="{w}" height="{h}" href="data:image/png;base64,{encoded}"/></svg>\n')
 # QA contact sheet uses the same extracted pixels, outside production output.
 if name not in opaque:
  bgqa=Image.new('RGBA',(96,96),'#111a30');thumb=asset.copy();thumb.thumbnail((68,68));bgqa.alpha_composite(thumb,((96-thumb.width)//2,(96-thumb.height)//2));bgqa.convert('RGB').save('/tmp/ref-asset-'+name+'.png')
(out/'provenance.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sourceSize':list(im.size),'cropCoordinates':crops,'note':'Extracted icon artwork only; application text, records and charts remain native and interactive.'},indent=2))
# Inspect extraction edges before integrating.
from PIL import ImageDraw
names=[n for n in crops if n not in opaque];sheet=Image.new('RGB',(8*110,((len(names)+7)//8)*120),'#080d1b');draw=ImageDraw.Draw(sheet)
for i,name in enumerate(names):
 x=i%8*110;y=i//8*120;sheet.paste(Image.open('/tmp/ref-asset-'+name+'.png'),(x,y));draw.text((x+2,y+98),name,fill='#c4d8ff')
sheet.save('/tmp/reference-assets.png')
print('Extracted',len(crops),'reference assets')
