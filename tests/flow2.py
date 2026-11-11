import asyncio
from playwright.async_api import async_playwright
URL='file:///home/claude/ft/dist/FichaPro.html'
F=[0]
def check(c,m):
    print(('ok   - ' if c else 'FAIL - ')+m); F[0]+= (not c)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=await b.new_page(viewport={'width':1300,'height':900}); await pg.add_init_script("localStorage.getItem('fp_mode')||localStorage.setItem('fp_mode','\"local\"')"); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(1200)
    ev=pg.evaluate
    # XLSX ida e volta com o leitor nativo
    r=await ev("""(async()=>{const blob=IO.writeXlsx([{name:'A',rows:[['Nome','Preço'],['Pão de ló "especial" & cia',{v:12.5,t:'eur'}],['Ç ã é',3]]},{name:'B',rows:[['x']]}]);const s=await IO.readXlsx(await blob.arrayBuffer());return s.map(x=>[x.name,x.rows])})()""")
    check(r[0][1][1]==['Pão de ló "especial" & cia',12.5] and r[0][1][2]==['Ç ã é',3] and r[1][0]=='B', f'XLSX escrito → lido pelo leitor nativo: {r[0][1]}')
    # formulário de ingrediente: validação
    await ev("location.hash='#/ingredientes'"); await pg.wait_for_timeout(300)
    await pg.click('#inew'); await pg.wait_for_timeout(200)
    await pg.click('#ingSave'); await pg.wait_for_timeout(200)
    check(await pg.locator('#ingf [name=name].bad').count()==1 and await pg.locator('#ingf [name=price].bad').count()==1, 'validação: nome e preço obrigatórios')
    await pg.fill('#ingf [name=name]','Camarão 30/40'); await pg.fill('#ingf [name=price]','45'); await pg.fill('#ingf [name=purchaseQty]','2'); await pg.fill('#ingf [name=wastePct]','40')
    check(await pg.input_value('#ingf [name=yieldPct]')=='60', 'rendimento sincronizado com desperdício (60)')
    await pg.check('#ingf [name=a_2]'); await pg.click('#ingSave'); await pg.wait_for_timeout(300)
    ing=await ev("Repo.all('ingredients').find(i=>i.name==='Camarão 30/40')")
    check(ing and ing['allergens']==[2] and ing['wastePct']==40, 'ingrediente criado com crustáceos e 40 % desperdício')
    # duplicado manual
    await pg.click('#inew'); await pg.wait_for_timeout(200)
    await pg.fill('#ingf [name=name]','camarão 30/40'); await pg.fill('#ingf [name=price]','1'); await pg.click('#ingSave'); await pg.wait_for_timeout(300)
    check(await pg.locator('.modal-b:has-text("Já existe um ingrediente semelhante")').count()==1, 'aviso de duplicado na criação manual')
    await pg.click('.modal.small [data-close].btn'); await pg.wait_for_timeout(100); await pg.keyboard.press('Escape')
    # eliminar ingrediente usado → bloqueado
    await ev("deleteIngredient(Repo.get('ingredients','demo-i-014'))"); await pg.wait_for_timeout(200)
    check(await pg.locator('.modal h2:has-text("Não é possível eliminar")').count()==1, 'eliminar ingrediente em uso é bloqueado'); await pg.keyboard.press('Escape')
    # ficha: mão de obra modo individual
    await ev("location.hash='#/ficha/demo-r-picanha'"); await pg.wait_for_timeout(300)
    await pg.click('[data-tab=mao]'); await pg.wait_for_timeout(200)
    l1=await ev("edCompute().c.ownLabor")
    await pg.click('[name=lmode][value=individual]'); await pg.wait_for_timeout(200)
    await pg.fill('tr[data-ll="0"] [data-llf=count]','2'); await pg.wait_for_timeout(200)
    l2=await ev("edCompute().c.ownLabor")
    check(abs(l1-l2)<1e-9, f'modo individual: 2 pessoas não duplicam o custo ({l1:.4f} = {l2:.4f})')
    await pg.click('[name=lmode][value=simultaneo]'); await pg.wait_for_timeout(200)
    l3=await ev("edCompute().c.ownLabor"); check(abs(l3-2*l1)<1e-9, 'modo simultâneo com 2 pessoas = dobro')
    check(await ev("UI.dirty"), 'editor marcado com alterações por guardar')
    # alergénios: remover automático
    await pg.click('[data-tab=alergenios]'); await pg.wait_for_timeout(200)
    await ev("location.hash='#/ficha/demo-r-mousse'"); await pg.wait_for_timeout(400)
    if await pg.locator('.modal [data-ok]').count(): await pg.click('.modal [data-ok]'); await pg.wait_for_timeout(400)
    check('mousse' in await ev("location.hash"), 'sair com alterações pede confirmação e navega')
    await pg.click('[data-tab=alergenios]'); await pg.wait_for_timeout(200)
    await pg.uncheck('[data-ap="3"]'); await pg.wait_for_timeout(200)
    a=await ev("edCompute().c.allergens")
    check(3 not in a['present'] and a['removedAuto']==[3], 'remoção manual de alergénio automático registada')
    check(await pg.locator('text=Removido manualmente').count()==1, 'aviso visual de remoção manual')
    await pg.check('[data-at="1"]'); await pg.wait_for_timeout(200)
    check(1 in (await ev("edCompute().c.allergens"))['traces'], 'contaminação cruzada manual (glúten)')
    await pg.check('#algConf'); await pg.click('#edSave'); await pg.wait_for_timeout(400)
    check(await ev("Repo.get('recipes','demo-r-mousse').allergenOverrides.confirmed"), 'confirmação de alergénios gravada')
    # versões e comparação
    await pg.click('[data-tab=versoes]'); await pg.wait_for_timeout(200)
    n=await pg.locator('[data-cmp]').count(); check(n>=2, f'{n} versões listadas')
    await pg.locator('[data-cmp]').last.click(); await pg.wait_for_timeout(300)
    check(await pg.locator('.modal h2:has-text("Comparar")').count()==1, 'comparação de versões abre'); await pg.keyboard.press('Escape')
    # eliminar ficha usada como intermédia → bloqueado
    await ev("recipeAction('del','demo-r-batata')"); await pg.wait_for_timeout(200)
    check(await pg.locator('.modal h2:has-text("Não é possível eliminar")').count()==1, 'eliminar preparação intermédia em uso é bloqueado'); await pg.keyboard.press('Escape')
    # produtos: preço inline
    await ev("location.hash='#/produtos'"); await pg.wait_for_timeout(300)
    i=pg.locator('tr[data-id="demo-r-bacalhau"] [data-sp]'); await i.fill('19,90'); await i.press('Tab'); await pg.wait_for_timeout(400)
    check(await ev("Repo.get('recipes','demo-r-bacalhau').salePrice")==19.9, 'preço alterado na tabela de produtos')
    await pg.click('tr[data-id="demo-r-frango"] [data-rec]'); await pg.wait_for_timeout(400)
    fr=await ev("(()=>{const x=computeAll().find(x=>x.r.id==='demo-r-frango');return [x.r.salePrice,x.p.recommended.gross]})()")
    check(abs(fr[0]-fr[1])<0.001, 'botão aplica o preço recomendado')
    # configurações: base total
    await ev("saveSettings({fcBase:'total',roundingEnabled:false})")
    v=await ev("(()=>{const x=computeAll().find(x=>x.r.id==='demo-r-picanha');return [x.c.perDose.total,x.p.recommended.net]})()")
    check(abs(v[1]-v[0]/0.30)<1e-9, 'base custo total: PV s/IVA = custo total / 30 %')
    await ev("saveSettings({fcBase:'materias',roundingEnabled:true})")
    # mobile menu
    m=await b.new_page(viewport={'width':390,'height':844}); await m.add_init_script("localStorage.getItem('fp_mode')||localStorage.setItem('fp_mode','\"local\"')"); await m.goto(URL); await m.wait_for_timeout(1000)
    await m.click('#menuBtn'); await m.wait_for_timeout(300)
    check(await m.evaluate("document.querySelector('#sidebar').classList.contains('open')"), 'menu lateral abre no telemóvel')
    await m.click('#nav a[href="#/fichas"]'); await m.wait_for_timeout(400)
    check(not await m.evaluate("document.querySelector('#sidebar').classList.contains('open')") and 'fichas' in await m.evaluate('location.hash'), 'navegação no telemóvel fecha o menu')
    print('\n'.join('JS ERROR '+e for e in errs) or 'sem erros JS'); print('FALHAS:',F[0])
    await b.close()
asyncio.run(main())
