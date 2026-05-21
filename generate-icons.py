from PIL import Image, ImageDraw
import os

os.makedirs('icons', exist_ok=True)

COLORS = [
    (255, 68, 68),   # red
    (255, 204, 0),   # yellow
    (68, 204, 68),   # green
    (68, 136, 255),  # blue
    (204, 68, 255),  # purple
    (255, 136, 68),  # orange
    (255, 220, 0),   # gold
    (255, 180, 200), # pink
]

def draw_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded rectangle background
    margin = size * 0.08
    radius = size * 0.20
    d.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=(55, 138, 221, 255)
    )

    # 3x3 grid of colored circles
    grid = 3
    gap = size * 0.18
    r = size * 0.075
    ox = size * 0.25
    oy = size * 0.29

    for row in range(grid):
        for col in range(grid):
            color = COLORS[(row * grid + col) % len(COLORS)]
            cx = ox + col * gap
            cy = oy + row * gap
            d.ellipse(
                [cx - r, cy - r, cx + r, cy + r],
                fill=color,
                outline=(255, 255, 255, 80),
                width=max(1, int(size * 0.01))
            )

    return img

for size in [192, 512]:
    icon = draw_icon(size)
    path = f'icons/icon-{size}.png'
    icon.save(path)
    print(f'Saved {path} ({size}x{size})')

print('Done!')
