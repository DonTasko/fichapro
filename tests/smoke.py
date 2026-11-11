import asyncio, sys, json
from playwright.async_api import async_playwright
URL = 'file:///home/claude/ft/dist/FichaPro.html'
ROUTES = ['dashboard','ingredientes','importacao','fichas','produtos','alergenios','mao-de-obra','custos','simulador','relatorios','configuracoes','ficha/demo-r-picanha','ficha/nova']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1400,'height':900}); await pg.add_init_script("localStorage.getItem('fp_mode')||localStorage.setItem('fp_mode','\"local\"')")
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' else None)
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        for r in ROUTES:
            await pg.evaluate(f"location.hash='#/{r}'"); await pg.wait_for_timeout(400)
            txt = await pg.inner_text('#view')
            bad = 'Ocorreu um erro' in txt
            print(r, 'ERRO' if bad else 'ok', len(txt))
            if bad: print(txt[:400])
            await pg.screenshot(path=f'shots/{r.replace("/","_")}.png', full_page=True)
        print('\n'.join(errs) or 'sem erros JS')
        await b.close()
asyncio.run(main())
