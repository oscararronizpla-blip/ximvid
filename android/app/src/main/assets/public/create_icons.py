from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    img = Image.new('RGB', (size, size), color='#0a1628')
    draw = ImageDraw.Draw(img)
    text = 'X'
    font_size = size // 2
    draw.text((size//4, size//8), text, fill='#ffffff')
    img.save(filename)

create_icon(512, 'icon-512.png')
create_icon(192, 'icon-192.png')
print("Icons created!")
