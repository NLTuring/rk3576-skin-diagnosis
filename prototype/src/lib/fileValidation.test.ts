import { describe, expect, it } from 'vitest'
import { validateImageFile } from './fileValidation'

const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])
describe('image input boundary', () => {
  it('accepts matching raster content and rejects SVG disguised as JPEG', async () => {
    await expect(validateImageFile(new File([png], 'sample.png', {type:'image/png'}))).resolves.toBeUndefined()
    await expect(validateImageFile(new File(['<svg/>'], 'fake.jpg', {type:'image/jpeg'}))).rejects.toThrow()
  })
  it('rejects files outside the allowed formats or size budget', async () => {
    await expect(validateImageFile(new File([png], 'data.txt', {type:'text/plain'}))).rejects.toThrow()
    await expect(validateImageFile(new File([new Uint8Array(13 * 1024 * 1024)], 'big.png', {type:'image/png'}))).rejects.toThrow()
    await expect(validateImageFile(new File([], 'empty.png', {type:'image/png'}))).rejects.toThrow()
  })
})
