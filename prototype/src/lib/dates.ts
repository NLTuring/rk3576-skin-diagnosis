export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const dateLabel = (value: string, full = false) => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', ...(full ? { year: 'numeric' as const } : {}),
  month: '2-digit', day: '2-digit',
}).format(new Date(value.length === 10 ? value + 'T12:00:00+08:00' : value))
export const shortDate = (value: string) => dateLabel(value).replace(/\//g, '.')
