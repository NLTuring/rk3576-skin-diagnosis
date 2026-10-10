# -*- coding: utf-8 -*-
"""内容级预检：加粗标记成对、无残留 Markdown 符号。"""
import io
import sys

sys.path.insert(0, 'tools')
from content import BLOCKS  # noqa

problems = []
texts = []


def collect(v, where):
    if isinstance(v, str):
        texts.append((where, v))
    elif isinstance(v, (list, tuple)):
        for x in v:
            collect(x, where)


for bi, blk in enumerate(BLOCKS):
    kind = blk[0]
    for fi, field in enumerate(blk[1:], 1):
        if isinstance(field, str):
            texts.append(('blk%d.%s.field%d' % (bi, kind, fi), field))
        elif isinstance(field, (list, tuple)):
            collect(field, 'blk%d.%s.field%d' % (bi, kind, fi))

for where, t in texts:
    if t.count('**') % 2:
        problems.append('奇数个 ** -> %s | %s' % (where, t[:70]))
    for bad, name in (('`', '反引号'), ('|', '竖线'), ('###', '井号'),
                      ('[', '方括号'), (']', '方括号')):
        if bad in t:
            problems.append('残留 %s -> %s | %s' % (name, where, t[:70]))

print('检查字符串 %d 条' % len(texts))
if problems:
    print('发现问题 %d 条：' % len(problems))
    for p in problems:
        print('  ' + p)
else:
    print('未发现问题')
