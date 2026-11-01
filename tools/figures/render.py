import asyncio, sys, pathlib
from playwright.async_api import async_playwright
names = sys.argv[1:] or ['wanderer', 'shade', 'ascendant']
here = pathlib.Path(__file__).parent
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = await b.new_page(viewport={'width': 400, 'height': 800}, device_scale_factor=2)
        for n in names:
            svg = (here / f'{n}.svg').read_text()
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            await pg.screenshot(path=str(here / f'{n}.png'), omit_background=True)
        # contact sheet on a lit background, for judging the shapes
        imgs = ''.join(f'<div style="display:inline-block;width:400px;height:800px;margin:0 10px;background:radial-gradient(circle at 50% 40%,#c9a0ff 0,#5a2d8f 35%,#120a1f 75%)">{(here / f"{n}.svg").read_text()}</div>' for n in names)
        await pg.set_viewport_size({'width': 1300, 'height': 820})
        await pg.set_content(f'<html><body style="margin:0;background:#05070a;padding:10px 0">{imgs}</body></html>')
        await pg.screenshot(path=str(here / 'sheet.png'))
        await b.close()
asyncio.run(main())
