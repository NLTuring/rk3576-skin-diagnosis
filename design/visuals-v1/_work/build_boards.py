"""Create static SVG design boards and preview PNGs; no application behavior."""
from pathlib import Path
from html import escape
import base64
import json
from PIL import Image, ImageFont, ImageDraw
import numpy as np
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parents[1]
W, H = 1680, 1120
BG, FG, MUTED, LINE, PAPER, ACCENT = "#F5F2EC", "#292722", "#756F65", "#DDD7CD", "#FFFEFB", "#AC5034"
SOFT = "#EFE4D8"

def uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()

BODY = uri(ROOT / "assets/body-matte.png")
source = Image.open(ROOT / "assets/body-matte.png")
factor = source.width / 1000
arm = source.crop(tuple(round(v*factor) for v in (630, 340, 995, 685)))
pixels = np.array(arm)
regions, count = label(pixels[:, :, 3] > 0)
counts = np.bincount(regions.ravel())
counts[0] = 0
pixels[regions != counts.argmax(), 3] = 0
arm = Image.fromarray(pixels)
arm.save(ROOT / "assets/arm-reference.png")
ARM = uri(ROOT / "assets/arm-reference.png")

class Board:
    def __init__(self, number, name):
        self.number, self.name = number, name
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
            '<defs><radialGradient id="halo"><stop stop-color="#EAE3D7" stop-opacity=".75"/><stop offset="1" stop-color="#F5F2EC" stop-opacity="0"/></radialGradient><linearGradient id="photo" x2="1" y2="1"><stop stop-color="#E4E0D7"/><stop offset="1" stop-color="#F1EEE7"/></linearGradient></defs>']
        self.rect(0,0,W,H,BG)
    def add(self,s): self.parts.append(s)
    def rect(self,x,y,w,h,fill=PAPER,r=0,stroke=None,sw=1):
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{sw}"/>')
    def line(self,x1,y1,x2,y2,color=LINE,sw=1,dash=None):
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>')
    def circle(self,x,y,r,fill,stroke=None,sw=1):
        self.add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{sw}"/>')
    def text(self,x,y,s,size=20,color=FG,weight=400,anchor="start",spacing=0,font=None):
        font=font or "Microsoft YaHei, sans-serif"
        self.add(f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}" dominant-baseline="middle" letter-spacing="{spacing}">{escape(s)}</text>')
    def image(self,x,y,w,h,src,opacity=1):
        self.add(f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{src}" opacity="{opacity}" preserveAspectRatio="xMidYMid meet"/>')
    def path(self,d,color=FG,sw=2,fill="none"):
        self.add(f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>')
    def icon(self,x,y,name,size=24,color=FG):
        paths={
            "plus":"M12 5v14M5 12h14",
            "arrow":"M5 12h14M14 7l5 5-5 5",
            "back":"M19 12H5M10 7l-5 5 5 5",
            "camera":"M3 7h5l2-3h4l2 3h5v13H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
            "image":"M3 3h18v18H3zM4 17l5-6 4 4 3-3 5 6M8 7h.01",
            "calendar":"M4 5h16v16H4zM4 10h16M8 3v5M16 3v5M8 14h3M8 17h6",
            "check":"M5 12l4 4 10-10",
            "chevron":"M8 5l7 7-7 7",
            "settings":"M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
            "compare":"M3 4h7v16H3zM14 4h7v16h-7z",
            "bookmark":"M6 3h12v18l-6-4-6 4z",
            "rotate":"M4 9a8 8 0 1 1 0 7M4 3v6h6",
            "lock":"M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4",
            "eye":"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
        }
        self.add(f'<g transform="translate({x} {y}) scale({size/24})">')
        self.path(paths[name],color,1.6)
        self.add("</g>")
    def pill(self,x,y,w,label,selected=False,h=38):
        self.rect(x,y,w,h,FG if selected else "none",h/2,None if selected else LINE)
        self.text(x+w/2,y+h/2,label,16,PAPER if selected else MUTED,anchor="middle")
    def button(self,x,y,w,label,primary=False,icon=None,h=54):
        self.rect(x,y,w,h,ACCENT if primary else PAPER,8,None if primary else LINE)
        c=PAPER if primary else FG
        if icon:
            self.icon(x+20,y+(h-22)/2,icon,22,c)
            self.text(x+w/2+10,y+h/2,label,19,c,500,anchor="middle")
        else:self.text(x+w/2,y+h/2,label,19,c,500,anchor="middle")
    def chrome(self,active="身体手账"):
        self.circle(87,50,17,"none",ACCENT,2)
        self.path("M87 33v34M70 50h34",ACCENT,1)
        self.circle(95,42,4,ACCENT)
        self.text(120,45,"肤镜",27,FG,600)
        self.text(120,69,"DERMASCOPE",9,MUTED,500,spacing=2,font="Arial")
        for x,label in [(620,"身体手账"),(790,"复查计划"),(960,"家庭成员")]:
            self.text(x,52,label,19,FG if label==active else MUTED,500 if label==active else 400)
            if label==active:self.line(x,96,x+78,96,ACCENT,3)
        self.circle(1452,51,4,"#7C876F")
        self.text(1468,52,"本地档案",16,MUTED)
        self.icon(1574,39,"settings",24,MUTED)
        self.line(64,97,1616,97)
    def footer(self,label):
        self.line(64,1077,1616,1077)
        self.text(80,1099,"概念设计 · 全部为示例内容 · 非真实识别结果",13,MUTED)
        self.text(1600,1099,f"{self.number:02d} / 05  ·  {label}",13,MUTED,anchor="end")
    def title(self,kicker,title,sub):
        self.text(80,143,kicker,15,MUTED)
        self.text(78,205,title,44,FG,300)
        self.text(80,258,sub,19,MUTED)
    def photo(self,x,y,w,h,label="影像位置示意",dark=False):
        self.rect(x,y,w,h,"#302F2C" if dark else "url(#photo)",8)
        col="#918C82" if dark else "#C5BEB0"
        for i in range(1,3):
            self.line(x+w*i/3,y+16,x+w*i/3,y+h-16,col,.65)
            self.line(x+16,y+h*i/3,x+w-16,y+h*i/3,col,.65)
        self.image(x+w*.17,y+h*.10,w*.70,h*.74,ARM,.62 if dark else .9)
        self.rect(x+18,y+h-48,164,30,"#FFFFFF" if not dark else "#4B4943",4)
        self.text(x+100,y+h-32,label,13,MUTED if not dark else "#E1DCD2",anchor="middle")
    def save(self):
        self.parts.append("</svg>")
        path=ROOT/f"{self.number:02d}-{self.name}.svg"
        path.write_text("\n".join(self.parts),encoding="utf-8")
        return path

def home():
    b=Board(1,"身体手账首页"); b.chrome()
    b.text(80,143,"FAMILY SKIN JOURNAL",13,MUTED,spacing=2,font="Arial")
    b.text(78,197,"每一次观察，都有迹可循。",40,FG,300)
    b.text(80,240,"从身体上的一个位置，翻开属于这一处的记录。",18,MUTED)
    b.button(1372,163,228,"记录新变化",True,"plus")
    for x,label,width,selected in [(80,"我",86,True),(178,"妈妈",102,False),(292,"爸爸",102,False)]:
        b.pill(x,284,width,label,selected,42)
    b.circle(431,305,21,"none",LINE); b.icon(419,293,"plus",24,MUTED)
    b.text(80,373,"01 / 身体地图",15,MUTED)
    b.text(80,409,"3 处观察中",23,FG,500)
    b.add('<ellipse cx="512" cy="712" rx="425" ry="370" fill="url(#halo)"/>')
    b.add('<ellipse cx="495" cy="1009" rx="137" ry="14" fill="#D8D0C2" opacity=".35"/>')
    model_x, model_y, model_w, model_h = 260, 300, 470, 714
    b.image(model_x,model_y,model_w,model_h,BODY)
    landmarks=json.loads((ROOT/"assets/body-landmarks.json").read_text())
    def pin(key,label,tx,ty,selected=False,second=""):
        px,py=landmarks[key]; px=model_x+model_w*px; py=model_y+model_h*py
        b.circle(px,py,17,"none",ACCENT if selected else "#A69C8C",1)
        b.circle(px,py,8,ACCENT if selected else "#908576",PAPER,3)
        side=1 if tx>px else -1
        end=tx-12 if side==1 else tx+170
        b.path(f"M{px+side*18} {py} L{px+side*48} {py} L{end} {ty}",ACCENT if selected else "#B7AC9C",1)
        b.text(tx,ty-8,label,19,ACCENT if selected else FG,500)
        b.text(tx,ty+20,second,14,MUTED)
    pin("left_forearm","左前臂 · 外侧",795,530,True,"最近记录 10.09")
    pin("right_upperarm","右上臂",92,492,False,"最近记录 10.06")
    pin("left_shin","左小腿",784,894,False,"下次记录 10.12")
    b.rect(330,1021,322,45,PAPER,22,LINE)
    b.rect(335,1026,80,35,FG,18); b.text(375,1044,"正面",15,PAPER,anchor="middle")
    b.text(458,1044,"背面",15,MUTED,anchor="middle")
    b.line(506,1032,506,1056)
    b.icon(525,1033,"rotate",22,MUTED); b.text(568,1044,"复位",15,MUTED)
    b.text(80,985,"拖动旋转 · 滚轮缩放",14,MUTED)
    b.text(80,1016,"按部位列表查找 →",15,ACCENT)
    b.line(1010,300,1010,1032)
    b.text(1050,315,"这 一 处 的 手 账",14,MUTED,spacing=1)
    b.icon(1537,307,"bookmark",25,ACCENT)
    b.text(1050,362,"左前臂 · 外侧",32,FG,500)
    b.text(1050,399,"我的记录  /  已连续观察 2 次",16,MUTED)
    b.photo(1050,430,550,230)
    b.text(1050,700,"10.09",30,FG,400,font="Georgia")
    b.pill(1178,683,84,"本次",True,30)
    b.text(1050,745,"记录了轻微瘙痒，暂无疼痛。",21)
    b.text(1050,782,"我的备注：运动后更明显。",17,MUTED)
    b.line(1050,816,1600,816)
    b.circle(1060,852,5,ACCENT)
    b.text(1080,852,"10.06",17,FG)
    b.text(1190,852,"第一次记录 · 已保存照片",17,MUTED)
    b.rect(1050,889,550,64,SOFT,8)
    b.icon(1070,909,"calendar",24,ACCENT)
    b.text(1110,921,"10 月 12 日，再记录一次",18,FG)
    b.text(1575,921,"改期",16,ACCENT,anchor="end")
    b.button(1050,977,315,"为这一处复查",True,"camera")
    b.button(1380,977,220,"前后对照",False,"compare")
    b.footer("身体手账首页"); return b.save()

def capture_info():
    b=Board(2,"新检查与症状"); b.chrome()
    b.title("我的手账  /  左前臂外侧  /  新记录","记录今天的变化。","选一张清晰照片，再用几个选项记下此刻的感受。")
    b.pill(1270,158,136,"我 · 左前臂",False,40)
    b.text(1460,179,"第 2 / 3 步",17,MUTED)
    b.rect(80,309,770,61,PAPER,8,LINE)
    b.rect(87,316,226,47,FG,5)
    b.icon(108,329,"image",23,PAPER); b.text(149,340,"导入已有照片",19,PAPER)
    b.icon(349,329,"camera",23,MUTED); b.text(390,340,"摄像头拍摄",19,MUTED)
    b.photo(80,391,770,511)
    b.text(80,941,"保留清晰细节，避免反光和过远拍摄。",17,MUTED)
    b.text(849,941,"重新选择 →",17,ACCENT,anchor="end")
    x=924
    b.text(x,323,"这次有什么感受？",24,FG,500)
    b.text(x,361,"可以选择多个，也可以选择“不确定”。",16,MUTED)
    choices=[("无明显不适",142,False),("痒",68,True),("痛",68,False),("灼热",84,False),("不确定",104,False)]
    xx=x
    for label,width,selected in choices:
        b.pill(xx,390,width,label,selected,43); xx+=width+11
    b.line(x,468,1600,468)
    b.text(x,508,"大约持续多久了？",24,FG,500)
    xx=x
    for label,width,selected in [("刚出现",114,False),("几天",90,True),("几周",90,False),("更久",90,False),("记不清",114,False)]:
        b.pill(xx,550,width,label,selected,43); xx+=width+11
    b.line(x,628,1600,628)
    b.text(x,668,"最近有什么变化？",24,FG,500)
    xx=x
    for label,width,selected in [("基本不变",134,True),("范围扩大",134,False),("有所缓解",134,False),("不确定",108,False)]:
        b.pill(xx,710,width,label,selected,43); xx+=width+11
    b.text(x,807,"补充一句话",19)
    b.text(x+138,807,"可选",15,MUTED)
    b.rect(x,839,676,81,PAPER,8,LINE)
    b.text(x+22,866,"例如：运动后更明显，最近换过护肤用品。",17,"#938B7E")
    b.line(80,978,1600,978)
    b.icon(80,1013,"lock",22,MUTED)
    b.text(117,1024,"照片仅用于本次检查，稍后由你决定是否保存。",17,MUTED)
    b.button(1330,995,270,"查看本次观察",True,"arrow")
    b.footer("新检查 · 照片与症状"); return b.save()

def result():
    b=Board(3,"本次观察与保存"); b.chrome()
    b.title("我的手账  /  左前臂外侧  /  本次观察","把这一次，清楚地记下来。","我 · 左前臂外侧 · 2026 年 10 月 09 日")
    b.pill(1404,161,196,"示例结果 · 非诊断",False,39)
    b.photo(80,312,727,563)
    b.rect(106,339,232,40,PAPER,20)
    b.text(222,360,"原始影像 · 可查看细节",15,MUTED,anchor="middle")
    b.text(80,914,"我的感受",18,MUTED)
    b.pill(190,895,98,"轻微痒",True,37)
    b.pill(300,895,110,"暂无疼痛",False,37)
    b.text(80,964,"“运动后更明显。”",24,FG,300)
    b.text(80,1008,"以上症状由用户记录。",16,MUTED)
    x=877
    b.text(x,325,"可能的方向",16,ACCENT,500)
    b.text(x,372,"湿疹 / 皮炎类表现",32,FG,500)
    b.text(x,417,"需要结合病程和接触情况进一步确认。",19,MUTED)
    b.line(x,450,1600,450)
    b.text(x,488,"为什么会这样提示",21,FG,500)
    b.circle(x+5,534,3,ACCENT)
    b.text(x+22,534,"观察到的皮肤表现，与填写的瘙痒感受相关。",18,MUTED)
    b.circle(x+5,571,3,ACCENT)
    b.text(x+22,571,"仍需了解：是否反复发生、近期接触过什么。",18,MUTED)
    b.text(x,613,"仅凭照片仍无法确认病因，需要时可带记录就医。",16,MUTED)
    b.line(x,649,1600,649)
    b.text(x,687,"下一步，可以这样做",21,FG,500)
    for yy,n,title,sub in [(732,"01","补充信息","把近期变化或新接触的用品记下来。"),(808,"02","安排复查或就医沟通","保留连续记录，便于进一步了解情况。")]:
        b.circle(x+17,yy+7,17,SOFT)
        b.text(x+17,yy+7,n,13,ACCENT,anchor="middle",font="Arial")
        b.text(x+49,yy,title,18,FG,500)
        b.text(x+49,yy+29,sub,16,MUTED)
    b.rect(x,879,723,98,SOFT,8)
    b.rect(x+23,902,22,22,PAPER,4,"#A89C8B",1.5)
    b.text(x+62,913,"将本次照片保存在本地手账",19,FG,500)
    b.text(x+62,947,"不勾选也可以保存症状和文字记录。",16,MUTED)
    b.text(x,1024,"暂不保存",18,MUTED)
    b.button(1279,993,321,"保存本次记录",True,"bookmark")
    b.footer("本次观察 · 照片留存默认不勾选"); return b.save()

def comparison():
    b=Board(4,"前后变化对照"); b.chrome()
    b.title("我的手账  /  左前臂外侧  /  变化对照","同一处，慢慢看见变化。","照片与感受放在一起看，回顾每一次记录。")
    b.rect(1293,161,307,45,PAPER,23,LINE)
    b.rect(1299,167,146,33,FG,17)
    b.text(1372,184,"并排对照",16,PAPER,anchor="middle")
    b.text(1520,184,"滑动对照",16,MUTED,anchor="middle")
    for x,date,label in [(80,"10.06","第一次记录"),(863,"10.09","本次记录")]:
        b.text(x,327,date,32,FG,font="Georgia")
        b.text(x+118,327,label,17,MUTED)
        b.icon(x+704,314,"calendar",23,MUTED)
        b.photo(x,367,737,378,"同部位影像示意")
    b.line(817,370,817,745,"#BDB3A3",1,"4 6")
    b.rect(80,770,1520,49,SOFT,6)
    b.text(104,795,"拍摄角度与光线会影响观感；照片对照不等同于病情结论。",17,MUTED)
    b.text(80,857,"我的感受，也在变化",23,FG,500)
    b.text(80,893,"用户填写的两次记录",15,MUTED)
    for x,title,old,new in [(500,"痒的感受","偶尔痒","偶尔痒"),(888,"疼痛","暂无","暂无"),(1254,"自己的观察","刚发现","基本不变")]:
        b.line(x-29,850,x-29,967)
        b.text(x,860,title,16,MUTED)
        b.text(x,910,old,22,FG)
        b.icon(x+114,897,"arrow",24,MUTED)
        b.text(x+160,910,new,22,FG)
    b.line(80,982,1600,982)
    b.icon(82,1018,"back",22,MUTED)
    b.text(119,1029,"返回这一处的手账",17,MUTED)
    b.button(1320,1000,280,"为这一处再记录",True,"camera")
    b.footer("前后对照 · 占位影像不表达病情变化"); return b.save()

def guided_capture():
    b=Board(5,"复查拍摄引导"); b.chrome()
    b.title("我的手账  /  左前臂外侧  /  复查拍摄","让下一张，更好比较。","沿着上次的构图，记录今天的真实状态。")
    b.pill(1420,161,180,"我 · 左前臂外侧",False,40)
    b.photo(80,310,1000,607,"实时画面位置示意",True)
    b.rect(107,337,216,38,"#55524A",19)
    b.text(215,357,"取景参考  ·  10.06",15,"#EEE8DF",anchor="middle")
    b.path("M309 448v-41h52 M850 448v-41h-52 M309 768v41h52 M850 768v41h-52","#DED6C8",2)
    b.add('<rect x="330" y="425" width="495" height="365" rx="24" fill="none" stroke="#DDD2BD" stroke-width="1.5" stroke-dasharray="9 7" opacity=".7"/>')
    b.circle(580,610,20,"none","#E0D7C8",1)
    b.line(571,610,589,610,"#E0D7C8")
    b.line(580,601,580,619,"#E0D7C8")
    b.text(1130,337,"跟着三个小提示",24,FG,500)
    for yy,n,title,sub in [(409,"01","找到同一处","让部位与上次的参考位置接近。"),(535,"02","保持相近距离","参考轮廓大小，缓慢调整角度。"),(661,"03","等画面清晰","确认稳定、光照均匀后再拍摄。")]:
        b.circle(1149,yy,19,SOFT)
        b.text(1149,yy,n,14,ACCENT,anchor="middle",font="Arial")
        b.text(1183,yy,title,21,FG,500)
        b.text(1130,yy+45,sub,17,MUTED)
    b.line(1130,760,1600,760)
    b.text(1130,804,"上次照片参考",19,FG,500)
    b.rect(1550,787,50,28,ACCENT,14)
    b.circle(1585,801,10,PAPER)
    b.text(1130,851,"参考透明度",16,MUTED)
    b.text(1600,851,"45%",16,MUTED,anchor="end")
    b.line(1130,892,1600,892,LINE,4)
    b.line(1130,892,1342,892,ACCENT,4)
    b.circle(1342,892,9,PAPER,ACCENT,2)
    b.text(1130,935,"参考只用于取景，不会叠入新照片。",16,MUTED)
    b.button(80,976,230,"改用已有照片",False,"image")
    b.circle(580,1009,34,"none",ACCENT,2)
    b.circle(580,1009,26,ACCENT)
    b.icon(568,997,"camera",24,PAPER)
    b.text(639,1010,"拍下本次照片",20,FG,500)
    b.text(1080,1010,"确认照片后，再进入本次观察。",17,MUTED,anchor="end")
    b.footer("复查拍摄 · 半透明构图参考"); return b.save()

def render(paths):
    from playwright.sync_api import sync_playwright
    report=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless=True)
        page=browser.new_page(viewport={"width":W,"height":H},device_scale_factor=1)
        for path in paths:
            page.goto(path.as_uri(),wait_until="load")
            page.evaluate("document.fonts.ready")
            page.screenshot(path=str(path.with_suffix(".png")))
            overflow=page.evaluate("""() => [...document.querySelectorAll('text')].map(n=>({text:n.textContent,box:n.getBoundingClientRect().toJSON()})).filter(o=>o.box.x < 0 || o.box.y < 0 || o.box.right > 1680.5 || o.box.bottom > 1120.5)""")
            report.append({"page":path.name,"textOutsideCanvas":overflow})
        browser.close()
    (ROOT/"layout-check.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    previews=[Image.open(path.with_suffix(".png")).convert("RGB") for path in paths]
    scale=.5; pad=32
    sheet=Image.new("RGB",(1728,1904),"#E5E0D6")
    for i,im in enumerate(previews):
        thumb=im.resize((840,560),Image.Resampling.LANCZOS)
        x=16+(i%2)*856; y=32+(i//2)*624
        sheet.paste(thumb,(x,y))
    draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",25)
    for i,path in enumerate(paths):
        x=16+(i%2)*856; y=32+(i//2)*624+579
        draw.text((x,y),path.stem.replace("-","  ",1),font=font,fill=FG)
    draw.text((915,1415),"肤镜 · 家庭皮肤手账",font=ImageFont.truetype("C:/Windows/Fonts/msyhl.ttc",40),fill=FG)
    draw.text((915,1500),"关键页面视觉方案 / V1",font=font,fill=MUTED)
    draw.text((915,1552),"3D 身体地图 · 观察时间线 · 复查引导",font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",21),fill=MUTED)
    draw.text((915,1610),"静态设计稿，全部为示例内容",font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",21),fill=MUTED)
    sheet.save(ROOT/"00-关键页面总览.png")
    print(json.dumps({"pages":[str(p) for p in paths],"layoutCheck":report},ensure_ascii=False,indent=2))

if __name__ == "__main__":
    render([home(),capture_info(),result(),comparison(),guided_capture()])
