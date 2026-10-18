# 肤镜 DermaScope · 三维人体空间索引与家庭皮肤观察手账

![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-61DAFB?logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/3D-Three.js%20GLB-000000?logo=threedotjs&logoColor=white)
![Privacy](https://img.shields.io/badge/Architecture-Local--First%20IndexedDB-2E7D32)
![Edge](https://img.shields.io/badge/Edge-RK3576%20Ready-008080)

> 把一处皮肤的变化，写成一本按身体空间位置索引、可精准前后比对的本地隐私手账。

**肤镜（DermaScope）** 是一套面向个人与家庭的皮肤健康观察记录与端侧辅助系统。项目打破传统相册“按时间混杂堆放、复查角度不一致、云端上传有隐私顾虑”的痛点，采用 **Three.js 三维人体空间索引 + 实时半透明叠影对齐拍摄 + 零外部网络请求的本地优先（Local-First）架构**，实现皮肤状态连续追踪。

---

## 核心工程特性

| 模块 | 技术实现与交互能力 | 测试与验证 |
| --- | --- | --- |
| **三维人体空间索引** | 基于 Three.js 加载本地人体 GLB 模型，支持旋转、缩放、正背面切换与射线点选（Raycasting）标定身体部位；法线与深度检测自动隐藏背面及被遮挡书签，并支持 2D 视图降级 | 单元测试 + 浏览器交互测试覆盖 |
| **复查构图叠影相机** | 调用 WebRTC 摄像头复查时，将上一次记录的照片作为可调透明度叠影参考层（Ghost Overlay），辅助用户对齐拍摄距离与角度；底层 Canvas 采样确保叠影像素绝不混入新照片 | 像素级自动化断言验证叠影零污染 |
| **多维前后对照器** | 支持任意两次历史记录的**并排对照、滑动卷帘（Slider）对照与结构化症状差异对比**，直观呈现色素、边界与面积变化趋势 | 19 项单元测试 + 16 项浏览器流程测试通过 |
| **本地优先隐私架构** | 全部观察档案、家庭成员信息与照片存储于浏览器本地 `IndexedDB`；照片留存默认关闭（需显式勾选），运行期**零外部网络请求**，支持 JSON 档案导出与一键彻底擦除 | 运行期网络拦截测试断言（0 外部请求） |

---

## 快速启动

环境要求：Node.js 20+。

```bash
cd prototype
npm ci
npm run dev
```

启动后浏览器访问 `http://127.0.0.1:5173/`（仅绑定本地回环接口以保障隐私安全）。

### 构建与自动化测试

```bash
cd prototype
npm test            # 运行单元测试与浏览器流程验证
npm run build       # TypeScript 类型检查与生产环境打包
npm run preview     # 预览生产构建 (http://127.0.0.1:4173/)
```

---

## 目录结构

```text
rk3576-skin-diagnosis/
├── prototype/      # React + TypeScript + Three.js 本地交互原型源码与测试套件
├── design/         # 纸白/墨黑/暖橙视觉体系规范、关键界面设计与 SVG/PNG 资产
├── docs/           # 产品架构设计、端侧 RK3576 协同方案与领域调研文档
└── tools/          # 文档与工程辅助脚本
```
