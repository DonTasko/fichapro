"""Percorre a aplicação noutra língua e recolhe os textos ainda por traduzir (chaves generalizadas)."""
import asyncio, json, sys, re
from playwright.async_api import async_playwright
from cloud import Mock, URL, BASE
LANG = sys.argv[1] if len(sys.argv) > 1 else 'es'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/home/claude/ft/i18n/missing.json'
FAKE = open('/home/claude/ft/tests/native.py').read().split('FAKE = """')[1].split('"""')[0]

async def run(b, mode, native=False):
    mock = Mock()
    ctx = await b.new_context(viewport={'width': 1300, 'height': 900})
    await ctx.route(BASE + '/**', mock.handle)
    await ctx.add_init_script(f"localStorage.setItem('fp_lang','{LANG}');" + ("" if mode == 'gate' else f"localStorage.getItem('fp_mode')||localStorage.setItem('fp_mode','\"{mode}\"');"))
    if native: await ctx.add_init_script(FAKE)
    await ctx.add_init_script("window.__collect=1")
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
    await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{I18N.debug.collect=true})")
    await pg.goto(URL); await pg.wait_for_timeout(300)
    await pg.evaluate("I18N.debug.collect=true; I18N.trNode(document.body)")
    ev = pg.evaluate
    async def visit(js, wait=350):
        try: await ev("(() => { " + js + " ; return 0; })()")
        except Exception as e: errs.append('visit: ' + str(e)[:200])
        await pg.wait_for_timeout(wait)
    if mode == 'gate':
        # ecrãs de entrada
        await pg.click('#gCloud'); await pg.wait_for_timeout(200)
        await pg.click('[data-t=signup]'); await pg.wait_for_timeout(200)
        await pg.fill('#gForm [name=email]', 'x@y.pt'); await pg.fill('#gForm [name=password]', 'abcdef1'); await pg.fill('#gForm [name=password2]', 'abcdef2'); await pg.click('#gForm button[type=submit]'); await pg.wait_for_timeout(200)
        await pg.fill('#gForm [name=password2]', 'abcdef1'); await pg.click('#gForm button[type=submit]'); await pg.wait_for_timeout(600)
        await pg.click('#gForm button[type=submit]'); await pg.wait_for_timeout(200)
        await pg.fill('#gForm [name=name]', 'Casa'); await pg.click('#gForm button[type=submit]'); await pg.wait_for_timeout(2500)
        await visit("location.hash='#/configuracoes'", 1500)
        await visit("Gate.newPassword()", 300)

    routes = ['dashboard', 'ingredientes', 'importacao', 'fichas', 'produtos', 'alergenios', 'mao-de-obra', 'custos', 'simulador', 'relatorios', 'configuracoes', 'ficha/nova']
    if mode != 'gate':
        for r in routes: await visit(f"location.hash='#/{r}'", 500)
        # editor de ficha: todos os separadores
        for rid in ['demo-r-lombinho', 'demo-r-molho']:
            await visit(f"location.hash='#/ficha/{rid}'", 500)
            for t in ['geral', 'ingredientes', 'mao', 'energia', 'preco', 'alergenios', 'versoes']:
                await visit(f"document.querySelector('[data-tab={t}]').click()", 300)
        await visit("document.querySelector('[data-tab=preco]').click()")
        await visit("document.querySelector('#pTgtSel').value='custom'; document.querySelector('#pTgtSel').dispatchEvent(new Event('change'))")
        await visit("document.querySelector('[data-tab=versoes]').click(); document.querySelector('[data-cmp]') && document.querySelector('[data-cmp]').click()", 500)
        await visit("document.querySelector('.modal-bg [data-close]') && document.querySelector('.modal-bg [data-close]').click()")
        await visit("document.querySelector('[data-tab=ingredientes]').click(); const i=document.querySelector('#acIn'); i.focus(); i.value='zzzz'; i.dispatchEvent(new Event('input'))")
        await visit("location.hash='#/fichas'", 400)
        await visit("FichaUI.view='table'; Views.fichas(document.querySelector('#view'))")
        await visit("recipeAction('del','demo-r-batata')"); await visit("document.querySelector('.modal-bg [data-close]').click()")
        await visit("recipeAction('del','demo-r-mousse')"); await visit("document.querySelector('.modal-bg [data-close]').click()")
        # ingredientes: formulários e janelas
        await visit("location.hash='#/ingredientes'", 400)
        for js in ["ingredientForm(null, ()=>{})", "document.querySelector('#ingSave').click()", "document.querySelector('.modal-bg [data-close]').click()",
                   "ingredientForm(Repo.get('ingredients','demo-i-010'), ()=>{})", "document.querySelector('[name=purchaseUnit]').value='emb'; document.querySelector('[name=purchaseUnit]').dispatchEvent(new Event('change',{bubbles:true}))", "document.querySelector('.modal-bg [data-close]').click()",
                   "Services.saveIngredient({...Repo.get('ingredients','demo-i-001'), price: 18})", "ingredientHistory(Repo.get('ingredients','demo-i-001'))", "document.querySelector('.modal-bg [data-close]').click()",
                   "ingredientUsage(Repo.get('ingredients','demo-i-014'))", "document.querySelector('.modal-bg [data-close]').click()",
                   "ingredientUsage(Repo.get('ingredients','demo-i-028'))", "document.querySelector('.modal-bg [data-close]').click()",
                   "deleteIngredient(Repo.get('ingredients','demo-i-014'))", "document.querySelector('.modal-bg [data-close]').click()",
                   "Services.saveIngredient({name:'Livre',purchaseUnit:'kg',purchaseQty:1,price:1,vat:6,allergens:[],traces:[]}).then(()=>deleteIngredient(Repo.all('ingredients').find(i=>i.name==='Livre')))", "document.querySelector('.modal-bg [data-close]') && document.querySelector('.modal-bg [data-close]').click()"]:
            await visit(js)
        # importação (assistente completo)
        await visit("location.hash='#/importacao'", 300)
        await pg.set_input_files('#impFile', '/home/claude/ft/tests/fixtures/ingredientes.xlsx'); await pg.wait_for_timeout(500)
        await visit("document.querySelector('#impNext').click()", 500)
        await visit("document.querySelector('#impGo').click()", 1200)
        await visit("location.hash='#/dashboard'"); await visit("location.hash='#/importacao'")
        await visit("Importer.rows=null;document.querySelector('#impPaste').value='a\\tb\\n1\\t2';document.querySelector('#impPasteGo').click()", 300)
        await visit("document.querySelector('#impNext').click()", 300)
        # mão de obra, custos
        await visit("location.hash='#/mao-de-obra'", 300)
        for js in ["staffForm(null, ()=>{})", "document.querySelector('[name=mode]').value='salario'; document.querySelector('#stf').dispatchEvent(new Event('input'))", "document.querySelector('#stSave').click()", "document.querySelector('.modal-bg [data-close]').click()", "document.querySelector('#qmode').value='i'; document.querySelector('#qmode').dispatchEvent(new Event('input'))"]:
            await visit(js)
        await visit("location.hash='#/custos'", 300)
        for js in ["equipForm(null, ()=>{})", "document.querySelector('[name=energyType]').value='outro'; document.querySelector('#eqf').dispatchEvent(new Event('change'))", "document.querySelector('[name=mode]').value='manual'; document.querySelector('#eqf').dispatchEvent(new Event('change'))", "document.querySelector('#eqSave').click()", "document.querySelector('.modal-bg [data-close]').click()",
                   "saveSettings({indirect:{...getSettings().indirect, method:'perDose', includesEnergy:false}}).then(()=>route())", "saveSettings({indirect:{...getSettings().indirect, method:'percent', includesEnergy:true, includesPackaging:true}}).then(()=>route())"]:
            await visit(js, 500)
        for rid in ['demo-r-mousse']:
            await visit(f"location.hash='#/ficha/{rid}'", 500); await visit("document.querySelector('[data-tab=energia]').click()")
        await visit("saveSettings({indirect:{...getSettings().indirect, method:'none', includesEnergy:false, includesPackaging:false}})")
        # simulador
        await visit("Object.assign(Sim,{scope:'demo-r-picanha',adj:[{kind:'cat',ref:'Carnes',pct:15},{kind:'ing',ref:'demo-i-001',pct:5},{kind:'all',pct:3}],elec:10}); location.hash='#/simulador'", 600)
        await visit("Object.assign(Sim,{scope:''}); route()", 400)
        # relatórios: todos
        await visit("location.hash='#/relatorios'", 300)
        for k in ['ficha', 'estiva', 'ingredientes', 'alergenios', 'precos', 'rentaveis', 'fc', 'evolucao', 'antesdepois', 'global']:
            await visit(f"document.querySelector('[data-rep={k}]').click()", 300)
            await visit("I18N.trHTML(Reports.htmlFor(RepUI.key, Repo.get('recipes', RepUI.rec))); Reports.sheetsFor(RepUI.key, Repo.get('recipes', RepUI.rec)).forEach(s=>{tr(s.name); s.rows.forEach(r=>(r||[]).forEach(c=>{const v=typeof c==='object'&&c?c.v:c; if(typeof v==='string') tr(v)}))})")
        await visit("I18N.trHTML(document.createElement('div').outerHTML); Reports.printAllergenSheet(Repo.all('recipes'))", 300)
        await visit("document.body.classList.remove('printing')")
        # alergénios, produtos, estados
        await visit("location.hash='#/alergenios'"); await visit("AlgUI.only='nconf'; AlgUI.filter=7; Views.alergenios(document.querySelector('#view'))")
        await visit("location.hash='#/produtos'"); await visit("ProdUI.status='sempreco'; Views.produtos(document.querySelector('#view'))"); await visit("ProdUI.status='';")
        # configurações e diálogos
        await visit("location.hash='#/configuracoes'", 1200)
        for sel in ['#demoDel', '#wipe']:
            await visit(f"document.querySelector('{sel}') && document.querySelector('{sel}').click()", 300); await visit("document.querySelector('.modal-bg [data-close]') && document.querySelector('.modal-bg [data-close]').click()")
        await visit("document.querySelector('#cfgCountry').value='ES'; document.querySelector('#cfgCountry').dispatchEvent(new Event('change'))", 300)
        await visit("document.querySelector('.modal-bg [data-close]') && document.querySelector('.modal-bg [data-close]').click()")
        # limites do plano e várias mensagens
        await visit("(async()=>{for(let i=0;i<12;i++){const r=newRecipe();r.name='R'+i;try{await Services.saveRecipe(r)}catch(e){toast(e.message,'err')}}})()", 1200)
        await visit("location.hash='#/dashboard'", 400)
        await visit("location.hash='#/ficha/nova'", 300); await visit("document.querySelector('#edSave').click()", 300)
        await visit("Ed.rec.name='X'; Ed.rec.lines=[{id:'q',kind:'ing',refId:'demo-i-001',qty:0,unit:'g'}]; document.querySelector('#edSave').click()", 300)
        await visit("Ed.rec.lines=[{id:'q',kind:'ing',refId:'demo-i-012',qty:1,unit:'kg'}]; UI.dirty=true; renderEditor(document.querySelector('#view'))", 300)
        await visit("document.querySelector('[data-tab=ingredientes]').click()", 300)
        await visit("UI.dirty=true; location.hash='#/dashboard'", 400); await visit("document.querySelector('.modal-bg [data-close]') && document.querySelector('.modal-bg [data-close]').click()")
        # estados de sincronização (modo nuvem)
        if mode == 'cloud':
            for st in ["{online:false,pending:3}", "{online:true,error:'x',pending:0}", "{online:true,error:null,pending:2}", "{online:true,error:null,pending:0,syncing:false}"]:
                await visit(f"Object.assign(Sync.adapter.state,{st}); Sync.render()", 150)
            await visit("Sync.sessionLost()")
    miss = await ev("[...I18N.debug.missing]")
    await ctx.close()
    return miss, errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        allm = set(); allerr = []
        for mode, nat in [('gate', False), ('local', False), ('gate', True)]:
            m, e = await run(b, mode, nat); allm |= set(m); allerr += e
            print(mode, nat, len(m))
        await b.close()
    import os; os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(sorted(allm), open(OUT, 'w'), ensure_ascii=False, indent=0)
    print('total', len(allm)); print('\n'.join(e[:600] for e in allerr[:6]))
asyncio.run(main())
