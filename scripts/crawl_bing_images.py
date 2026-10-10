# -*- coding: utf-8 -*-
"""
从 Bing 图片搜索批量下载图片（简单版）。

用法：
    python scripts/crawl_bing_images.py --query "皮肤病图片" --out data/derma_raw --max 200

参数：
    --query   搜索词（必填，支持中文）
    --out     保存目录（默认 data/images）
    --max     最多下载多少张（默认 100）
    --min-kb  小于该体积的图片丢弃（默认 8，用于过滤占位图与图标）
    --timeout 单次请求超时秒数（默认 15）

实现要点：
    · Bing 的图片结果内嵌在 <a class="iusc" ... m="{...}"> 的 m 属性里，
      属性值是 HTML 转义过的 JSON，取出其中 murl 字段即原图地址；
    · 翻页靠 first 参数，步长 35（first=1, 36, 71, ...）；
    · 按原图 URL 去重，按响应 Content-Type 判断扩展名，失败带退避重试；
    · 每次请求之间 sleep，避免给目标站点造成压力。

⚠ 使用须知：
    1. 请自行确认你的抓取行为符合目标站点的服务条款与 robots 约定；
    2. 抓下来的图片仅适合人工浏览、检索与筛选，**不能作为临床判读依据，
       也不建议直接用于训练**——它们的类别标签来自搜索关键词、没有医学校验，
       版权归属也不明确。正式数据集请使用 ISIC / HAM10000 等
       有明确许可的公开数据。
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from html import unescape
from urllib.parse import urlencode, urlparse

import requests

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

SEARCH_API = 'https://cn.bing.com/images/search'
HEADERS = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                   'AppleWebKit/537.36 (KHTML, like Gecko) '
                   'Chrome/124.0 Safari/537.36'),
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

# 结果页里原图地址所在的属性：m="{&quot;murl&quot;:...}"
# 不依赖属性先后顺序，只要属性名是 m 且值是以 { 开头的转义 JSON 即可。
M_ATTR_RE = re.compile(r'\sm="(\{[^"]+\})"')

CT_EXT = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/avif': '.avif',
}


def search_html(query, first, session, timeout):
    """取一页搜索结果 HTML。"""
    params = {'q': query, 'form': 'HDRSC2', 'first': first, 'count': 35}
    resp = session.get(SEARCH_API + '?' + urlencode(params),
                       headers=HEADERS, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def extract_image_urls(html):
    """从结果页里抽出所有原图地址（按出现顺序，已去重）。"""
    urls, seen = [], set()
    for raw in M_ATTR_RE.findall(html):
        try:
            meta = json.loads(unescape(raw))
        except json.JSONDecodeError:
            continue
        murl = meta.get('murl')
        if murl and murl not in seen:
            seen.add(murl)
            urls.append(murl)
    return urls


def guess_ext(content_type, url):
    """先按响应内容类型判断扩展名，再退回按 URL 后缀判断。"""
    ct = (content_type or '').split(';')[0].strip().lower()
    if ct in CT_EXT:
        return CT_EXT[ct]
    path = urlparse(url).path.lower()
    for ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'):
        if path.endswith(ext):
            return '.jpg' if ext == '.jpeg' else ext
    return None


def build_name(prefix, index, url, ext):
    """文件名：可读前缀 + 序号 + URL 短哈希（保证不重名、可追溯到来源）。"""
    digest = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
    return '%s_%04d_%s%s' % (prefix, index, digest, ext)


def download_one(session, url, out_dir, prefix, index, min_bytes, timeout,
                 retries=2):
    """下载单张图片。成功返回落盘路径，失败或不合格返回 None。"""
    last_error = None
    for attempt in range(retries + 1):
        try:
            resp = session.get(url, headers=HEADERS, timeout=timeout,
                               stream=True)
            with resp:
                resp.raise_for_status()
                ctype = resp.headers.get('Content-Type', '')
                if not ctype.lower().startswith('image/'):
                    return None
                ext = guess_ext(ctype, url)
                if ext is None:
                    return None
                data = resp.content
            if len(data) < min_bytes:
                return None
            path = os.path.join(out_dir, build_name(prefix, index, url, ext))
            with open(path, 'wb') as f:
                f.write(data)
            return path
        except requests.RequestException as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.0 * (attempt + 1))  # 退避重试
    if last_error:
        return None
    return None


def crawl(query, out_dir, max_count, min_kb, timeout):
    os.makedirs(out_dir, exist_ok=True)
    prefix = re.sub(r'[^\w\u4e00-\u9fff]+', '_', query).strip('_') or 'img'
    min_bytes = int(min_kb * 1024)

    session = requests.Session()
    seen = set()
    saved = 0
    first = 1
    page = 0

    while saved < max_count:
        page += 1
        try:
            html = search_html(query, first, session, timeout)
        except requests.RequestException as exc:
            print('第 %d 页请求失败：%s' % (page, exc))
            break

        fresh = [u for u in extract_image_urls(html) if u not in seen]
        if not fresh:
            print('第 %d 页没有新的图片地址，停止。' % page)
            break
        print('第 %d 页：解析到 %d 个新地址' % (page, len(fresh)))

        for url in fresh:
            if saved >= max_count:
                break
            seen.add(url)
            got = download_one(session, url, out_dir, prefix, saved + 1,
                               min_bytes, timeout)
            if got:
                saved += 1
                print('  [%d/%d] %s' % (saved, max_count, os.path.basename(got)))
            time.sleep(0.3)  # 每张之间稍作停顿

        first += 35
        time.sleep(1.0)  # 每页之间停顿

    print('\n完成：共保存 %d 张到 %s' % (saved, os.path.abspath(out_dir)))


def main():
    ap = argparse.ArgumentParser(
        description='从 Bing 图片搜索批量下载图片。'
                    '不带参数直接运行，即按默认搜索词下载。')
    ap.add_argument('--query', default='皮肤病图片',
                    help='搜索词（默认：皮肤病图片）')
    ap.add_argument('--out', default='data/images', help='保存目录')
    ap.add_argument('--max', type=int, default=30, help='最多下载张数（默认 30）')
    ap.add_argument('--min-kb', type=float, default=8, help='小于该体积的丢弃')
    ap.add_argument('--timeout', type=float, default=15, help='单次请求超时秒数')
    args = ap.parse_args()

    print('搜索词：%s' % args.query)
    print('保存到：%s' % os.path.abspath(args.out))
    print('最多下载：%d 张\n' % args.max)

    crawl(args.query, args.out, args.max, args.min_kb, args.timeout)


if __name__ == '__main__':
    main()
