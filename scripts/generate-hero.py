"""Rebuild the 90-frame local scroll film from the approved campaign still.
An art-directed composited animation, not a claim of physical fluid simulation.
Dependencies: pillow numpy imageio-ffmpeg. Run from repository root.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import numpy as np, math, subprocess
import imageio_ffmpeg
base=Image.open('public/images/hero.jpg').convert('RGB')
w,h=base.size
cap_box=(946,115,1128,243)
cap=base.crop(cap_box).convert('RGBA')
mask=Image.new('L',cap.size,0);d=ImageDraw.Draw(mask);d.rounded_rectangle((1,1,cap.width-1,cap.height-1),radius=9,fill=255)
cap.putalpha(mask.filter(ImageFilter.GaussianBlur(.7)))
# Reconstruct the small background region behind the lifting cap from its lit edges.
back=np.array(base).copy()
for y in range(112,244):
    left=back[y,938].astype(float);right=back[y,1136].astype(float)
    for x in range(944,1130):
        f=(x-938)/(1136-938);back[y,x]=left*(1-f)+right*f
clean=Image.fromarray(back)
label_box=(939,345,1084,447)
label=base.crop(label_box)
def arabic_frame(frame):
    mirrored=ImageOps.mirror(frame)
    mirrored.paste(label,(w-label_box[2],label_box[1]))
    return mirrored
arabic_frame(base).save('public/images/hero-ar.jpg',quality=92)
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
p=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-s','960x536','-pix_fmt','rgb24','-r','30','-i','-','-an','-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','public/images/hero-scroll.mp4'],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
par=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-s','960x536','-pix_fmt','rgb24','-r','30','-i','-','-an','-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','public/images/hero-scroll-ar.mp4'],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
for i in range(90):
    t=i/89
    lift=max(0,min(1,(t-.3)/.2));lift=lift*lift*(3-2*lift)
    frame=base.copy() if lift==0 else clean.copy()
    if lift:
        frame.paste(cap,(946,115-round(64*lift)),cap)
    if .5<t<.94:
        fluid=Image.new('RGBA',base.size,(0,0,0,0));draw=ImageDraw.Draw(fluid)
        intensity=min(1,(t-.5)/.12)*min(1,(.94-t)/.16)
        ytop=244-64*lift
        draw.line([(1033,ytop),(1035,ytop+20),(1034,256)],fill=(234,173,56,int(190*intensity)),width=5)
        draw.line([(1034,ytop),(1036,256)],fill=(255,226,137,int(215*intensity)),width=1)
        draw.ellipse((1019,253,1054,260),fill=(224,162,37,int(70*intensity)))
        frame=Image.alpha_composite(frame.convert('RGBA'),fluid.filter(ImageFilter.GaussianBlur(.5))).convert('RGB')
    p.stdin.write(frame.resize((960,536),Image.Resampling.LANCZOS).tobytes())
    par.stdin.write(arabic_frame(frame).resize((960,536),Image.Resampling.LANCZOS).tobytes())
p.stdin.close();p.wait();par.stdin.close();par.wait()
print('90-frame scroll film generated')
