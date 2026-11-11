import asyncio, json
from playwright.async_api import async_playwright
from cloud import Mock, URL, BASE, check, F
FAKE = """
window.__calls = [];
window.FichaProAndroid = {
  info(){ return JSON.stringify({platform:'android', version:'1.0'}); },
  setAds(on){ __calls.push(['setAds', on]); },
  showInterstitial(){ __calls.push(['interstitial']); },
  print(t){ __calls.push(['print', t]); },
  manageSubscriptions(){ __calls.push(['manage']); },
  getProducts(id){ __calls.push(['getProducts']); setTimeout(()=>FichaProNative.resolve(id, JSON.stringify({data:[{basePlanId:'mensal',title:'Mensal',price:'4,99 €',period:'por mês'},{basePlanId:'anual',title:'Anual',price:'49,90 €',period:'por ano',freeTrial:'7 dias grátis'}]})), 50); },
  purchase(id, bp, acc, prof){ __calls.push(['purchase', bp, acc, prof]); setTimeout(()=>{ FichaProNative.resolve(id, JSON.stringify({data:true})); FichaProNative.purchases(JSON.stringify([{purchaseToken:'tok-123', productId:'fichapro_pro', accountId: acc, acknowledged:false}])); }, 50); },
  queryPurchases(id){ __calls.push(['queryPurchases']); setTimeout(()=>FichaProNative.resolve(id, JSON.stringify({data:[]})), 20); },
  saveFile(id, name, mime, b64){ __calls.push(['saveFile', name, mime, b64.length]); setTimeout(()=>FichaProNative.resolve(id, JSON.stringify({data:true})), 20); },
  printHtml(id, title, html){ __calls.push(['printHtml', title, html.length, html.includes('print-doc')]); setTimeout(()=>FichaProNative.resolve(id, JSON.stringify({data:true})), 20); },
};
"""
async def main():
    mock = Mock(); verified = []
    orig = mock.handle
    async def handle(route):
        if '/functions/v1/play-billing/verify' in route.request.url:
            body = json.loads(route.request.post_data); verified.append(body)
            mock.tenants[body['tenantId']]['plan'] = 'active'; mock.tenants[body['tenantId']]['paid_until'] = '2099-01-01T00:00:00+00:00'
            return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'plan': 'active'}))
        return await orig(route)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 412, 'height': 900}); await ctx.route(BASE + '/**', handle)
        await ctx.add_init_script(FAKE); await ctx.add_init_script("localStorage.getItem('fp_lang')||localStorage.setItem('fp_lang','pt')")
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(600)
        await pg.click('#gCloud'); await pg.click('[data-t=signup]')
        await pg.fill('#gForm [name=email]', 'a@b.pt'); await pg.fill('#gForm [name=password]', 'segredo1'); await pg.fill('#gForm [name=password2]', 'segredo1'); await pg.click('#gForm button[type=submit]'); await pg.wait_for_timeout(500)
        await pg.fill('#gForm [name=name]', 'Teste'); await pg.click('#gForm button[type=submit]'); await pg.wait_for_timeout(2500)
        calls = await pg.evaluate('__calls')
        check(['setAds', True] in calls, 'plano gratuito: pede anúncios à app')
        check(await pg.evaluate("document.body.classList.contains('native-app')"), 'modo app nativa detetado')
        await pg.evaluate("location.hash='#/configuracoes'"); await pg.wait_for_timeout(800)
        txt = await pg.inner_text('#plan')
        check('4,99 €' in txt and '49,90 €' in txt, 'preços do Google Play mostrados')
        await pg.click('[data-bp=anual]'); await pg.wait_for_timeout(1500)
        calls = await pg.evaluate('__calls'); tid = list(mock.tenants)[0]
        check(any(c[0] == 'purchase' and c[1] == 'anual' and c[2] == tid for c in calls), 'compra lançada com o id do estabelecimento')
        check(verified and verified[0]['purchaseToken'] == 'tok-123', 'compra enviada para validação no servidor')
        check(await pg.evaluate('Plan.isPro()') and ['setAds', False] in await pg.evaluate('__calls'), 'plano Pro ativo e anúncios desligados')
        await pg.evaluate("location.hash='#/relatorios'"); await pg.wait_for_timeout(400)
        await pg.click('#rxl'); await pg.wait_for_timeout(300); await pg.click('#rpdf'); await pg.wait_for_timeout(300)
        calls = await pg.evaluate('__calls')
        check(any(c[0] == 'saveFile' and c[1].endswith('.xlsx') and c[3] > 1000 for c in calls), 'exportação Excel passa pela app (guardar ficheiro)')
        check(any(c[0] == 'printHtml' and c[3] for c in calls), 'impressão/PDF passa pela app com o documento completo')
        check(not any(c[0] == 'interstitial' for c in calls), 'sem anúncios intersticiais no plano Pro')
        print('\n'.join(errs) or 'sem erros JS'); print('FALHAS:', F[0])
        await b.close()
asyncio.run(main())
