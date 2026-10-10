export async function validateImageFile(file: File): Promise<void> {
  if (!file.size || file.size > 12 * 1024 * 1024) throw new Error('请选择大小不超过 12 MB 的图片。')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('支持 JPG、PNG 或 WebP 图片，请重新选择。')
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => header[i] === v)
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
  const webp = String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP'
  if (!(file.type === 'image/png' && png || file.type === 'image/jpeg' && jpeg || file.type === 'image/webp' && webp)) {
    throw new Error('图片内容与格式不符，或文件已损坏。')
  }
}
