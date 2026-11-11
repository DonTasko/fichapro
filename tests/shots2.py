import asyncio
from playwright.async_api import async_playwright
URL='file:///home/claude/ft/dist/FichaPro.html'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=await b.new_page(viewport={'width':1400,'height':900}); await pg.add_init_script("localStorage.getItem('fp_mode')||localStorage.setItem('fp_mode','\"local\"');localStorage.getItem('fp_lang')||localStorage.setItem('fp_lang','pt')"); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(1200)
    await pg.evaluate("location.hash='#/ficha/demo-r-lombinho'"); await pg.wait_for_timeout(400)
    for t in ['ingredientes','mao','energia','preco','alergenios','versoes']:
        await pg.click(f'[data-tab={t}]'); await pg.wait_for_timeout(250)
        await pg.screenshot(path=f'shots/tab_{t}.png', full_page=True)
    # simulador
    await pg.evaluate("Object.assign(Sim,{adj:[{kind:'cat',ref:'Carnes',pct:15}],elec:10,priceDelta:1});location.hash='#/simulador'"); await pg.wait_for_timeout(400)
    await pg.screenshot(path='shots/sim.png', full_page=True)
    # modal ingrediente
    await pg.evaluate("location.hash='#/ingredientes'"); await pg.wait_for_timeout(300)
    await pg.click('tr[data-id="demo-i-010"] [data-act=edit]'); await pg.wait_for_timeout(300)
    await pg.screenshot(path='shots/ingmodal.png')
    await pg.keyboard.press('Escape')
    # impressão: renderizar como PDF
    await pg.evaluate("window.print=()=>{}; Reports.printRecipe(Repo.get('recipes','demo-r-lombinho'))"); await pg.wait_for_timeout(200)
    await pg.emulate_media(media='print'); await pg.pdf(path='shots/ficha.pdf', format='A4', print_background=True)
    await pg.emulate_media(media='screen')
    await pg.evaluate("document.body.classList.remove('printing'); Reports.printAllergenSheet(computeAll().filter(x=>x.r.sellable!==false).map(x=>x.r))"); await pg.wait_for_timeout(200)
    await pg.emulate_media(media='print'); await pg.pdf(path='shots/alergenios.pdf', format='A4', print_background=True)
    await pg.emulate_media(media='screen'); await pg.evaluate("document.body.classList.remove('printing')")
    # mobile
    m=await b.new_page(viewport={'width':390,'height':844}); await m.add_init_script("localStorage.getItem('fp_mode')||localStorage.setItem('fp_mode','\"local\"');localStorage.getItem('fp_lang')||localStorage.setItem('fp_lang','pt')"); await m.goto(URL+'#/produtos'); await m.wait_for_timeout(1200)
    await m.screenshot(path='shots/mobile.png', full_page=False)
    print(errs or 'sem erros')
    await b.close()
asyncio.run(main())
