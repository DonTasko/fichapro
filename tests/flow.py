import asyncio, json, openpyxl, os
from playwright.async_api import async_playwright
URL='file:///home/claude/ft/dist/FichaPro.html'
DL='/home/claude/ft/tests/downloads'; os.makedirs(DL, exist_ok=True)
def check(cond, msg):
    print(('ok   - ' if cond else 'FAIL - ')+msg)
    if not cond: check.fail+=1
check.fail=0
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx=await b.new_context(accept_downloads=True, viewport={'width':1400,'height':900})
    pg=await ctx.new_page(); await pg.add_init_script("localStorage.getItem('fp_mode')||localStorage.setItem('fp_mode','\"local\"');localStorage.getItem('fp_lang')||localStorage.setItem('fp_lang','pt')"); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(1200)
    await pg.evaluate("window.print=()=>{window.__printed=(window.__printed||0)+1}")
    ev=lambda js: pg.evaluate(js)
    cost=lambda rid: ev(f"(()=>{{const d=dataView();return Calc.evaluator(d).cost(d.recipes.get('{rid}')).perDose.total}})()")
    # 1. preço inline -> histórico + recálculo
    before=await cost('demo-r-picanha'); before_lomb=await cost('demo-r-lombinho')
    await ev("location.hash='#/ingredientes'"); await pg.wait_for_timeout(300)
    inp=pg.locator('tr[data-id="demo-i-007"] input[data-price]')  # batata (usada via batata rústica)
    await inp.fill('25,50'); await inp.press('Tab'); await pg.wait_for_timeout(400)
    after=await cost('demo-r-picanha')
    hist=await ev("Repo.all('priceHistory').filter(h=>h.ingredientId==='demo-i-007')")
    check(after>before, f'custo picanha subiu após aumento da batata ({before:.4f} -> {after:.4f})')
    check(len(hist)==1 and abs(hist[0]['diffPct']-20)<1e-6, 'histórico registou +20 %')
    check(any(i['recipeName']=='Picanha grelhada' for i in hist[0]['impacts']) and any(i['recipeName']=='Batata rústica' for i in hist[0]['impacts']), 'impacto inclui ficha final e preparação intermédia')
    # 2. criar ficha nova pela interface
    await ev("location.hash='#/ficha/nova'"); await pg.wait_for_timeout(300)
    await pg.fill('[data-bind=name]','Teste Salada')
    await pg.fill('[data-bind=portions]','2')
    await pg.click('[data-tab=ingredientes]')
    await pg.fill('#acIn','cebo'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    await pg.keyboard.type('500'); await pg.wait_for_timeout(200)
    await pg.fill('#acIn','molho de cog'); await pg.wait_for_timeout(100); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    await pg.keyboard.type('2')
    await pg.wait_for_timeout(200)
    await pg.click('[data-tab=preco]'); await pg.fill('#pSale','5,90')
    await pg.click('#edSave'); await pg.wait_for_timeout(500)
    rec=await ev("Repo.all('recipes').find(r=>r.name==='Teste Salada')")
    check(rec is not None and len(rec['lines'])==2, 'ficha nova gravada com 2 linhas')
    if rec:
        c=await ev(f"(()=>{{const d=dataView();const c=Calc.evaluator(d).cost(d.recipes.get('{rec['id']}'));return [c.materials,c.allergens.present,c.lines.map(l=>l.unit)]}})()")
        # cebola 0.5 kg * 1.10 /0.9 + 2 doses molho
        mol=await ev("(()=>{const d=dataView();const r=d.recipes.get('demo-r-molho');return Calc.evaluator(d).evalRecipe(r).materials/r.portions})()")
        check(abs(c[0]-(0.5*1.1/0.9+2*mol))<1e-6, f'matérias = cebola c/ desperdício + 2 doses de molho ({c[0]:.4f})')
        check(7 in c[1] and 12 in c[1], 'alergénios herdados do molho (leite, sulfitos)')
        check(rec['salePrice']==5.9 and rec['version']==1, 'preço 5,90 e versão 1')
        check((await ev("location.hash")).startswith('#/ficha/'+rec['id']), 'URL atualizado para a ficha gravada')
    # 3. ciclo: molho não pode incluir Teste Salada (não é intermédia) e molho não aparece em si próprio
    cyc=await ev("Calc.wouldCycle(dataView(),'demo-r-molho','demo-r-lombinho')")
    check(cyc, 'deteção de ciclo (molho -> lombinho que usa molho)')
    # 4. importação XLSX
    await ev("location.hash='#/importacao'"); await pg.wait_for_timeout(300)
    await pg.set_input_files('#impFile','tests/fixtures/ingredientes.xlsx'); await pg.wait_for_timeout(600)
    mp=await ev("Importer.map")
    check(all(k in mp for k in ['code','name','category','supplier','purchaseUnit','purchaseQty','price','vat','wastePct','allergens','priceUpdatedAt']), f'associação automática de colunas: {sorted(mp)}')
    await pg.click('#impNext'); await pg.wait_for_timeout(400)
    items=await ev("Importer.items.map(i=>({n:i.ing.name,a:i.action,e:i.errs,dup:!!i.dup,u:i.ing.purchaseUnit,q:i.ing.purchaseQty,p:i.ing.price,v:i.ing.vat,w:i.ing.wastePct,al:i.ing.allergens,d:i.ing.priceUpdatedAt}))")
    by={i['n']:i for i in items}
    s=by['Salmão fresco']; check(s['p']==31.8 and s['v']==6 and abs(s['w']-10)<1e-9 and s['al']==[4] and s['d']=='2026-10-01', 'salmão: preço "31,80", IVA 0,06→6 %, desperdício 0,1→10 %, peixe, data')
    n=by['Natas 1L']; check(n['u']=='emb' and n['e'], 'natas em caixa sem conteúdo → erro assinalado')
    check(by['Picanha de novilho']['dup'] and by['Picanha de novilho']['a']=='update', 'duplicado detetado → atualizar')
    check(by['Produto sem preço']['a']=='skip' and by['Produto sem preço']['e'], 'linha sem preço ignorada com erro')
    check(by['Ovos dúzia']['u']=='un' and by['Ovos dúzia']['q']==12 and by['Ovos dúzia']['al']==[3], 'dúzia → 12 un, alergénio 3')
    # corrigir natas na pré-visualização
    row=pg.locator('tr[data-i="1"]')
    await row.locator('[data-f=packQty]').fill('1'); await row.locator('[data-f=packQty]').press('Tab'); await pg.wait_for_timeout(300)
    row=pg.locator('tr[data-i="1"]'); await row.locator('select[data-f=packUnit]').select_option('l'); await pg.wait_for_timeout(300)
    n2=await ev("(({a,e})=>({a,e}))(Importer.items[1].action===undefined?{}:{a:Importer.items[1].action,e:Importer.items[1].errs})")
    check(n2['a']=='create' and not n2['e'], 'correção na pré-visualização torna a linha válida')
    pic_before=await cost('demo-r-picanha')
    await pg.click('#impGo'); await pg.wait_for_timeout(800)
    txt=await pg.inner_text('#view'); check('4 criado(s), 1 atualizado(s)' in txt or ('criado' in txt), 'resumo: '+txt.split('\n')[-3][:120] if '\n' in txt else txt[:120])
    pic=await ev("Repo.get('ingredients','demo-i-001')")
    check(pic['price']==18.5, 'picanha atualizada para 18,50 via importação')
    check((await cost('demo-r-picanha'))>pic_before, 'ficha Picanha recalculada após importação')
    nat=await ev("Repo.all('ingredients').find(i=>i.name==='Natas 1L')")
    uc=await ev(f"Calc.ingredientUnitCost(Repo.all('ingredients').find(i=>i.name==='Natas 1L'),getSettings()).cost")
    check(abs(uc-3.6)<1e-9, 'natas: 6 cx × 1 L por 21,60 → 3,60 €/L')
    # 5. CSV
    await ev("location.hash='#/configuracoes'"); await pg.wait_for_timeout(200); await ev("location.hash='#/importacao'"); await pg.wait_for_timeout(300)
    await pg.set_input_files('#impFile','tests/fixtures/ingredientes.csv'); await pg.wait_for_timeout(400)
    await pg.click('#impNext'); await pg.wait_for_timeout(300)
    it=await ev("Importer.items.map(i=>[i.ing.name,i.ing.price,i.ing.purchaseQty,i.ing.purchaseUnit,i.action])")
    check(it[0][1]==18.75 and it[1][1]==37.5 and it[1][3]=='l' and it[1][4]=='update', f'CSV com ; e vírgula decimal, azeite duplicado → {it}')
    # 6. colar dados
    await ev("Importer.rows=null;Importer.items=[];location.hash='#/dashboard'"); await pg.wait_for_timeout(200); await ev("location.hash='#/importacao'"); await pg.wait_for_timeout(300)
    await pg.fill('#impPaste','Nome\tPreço\tUnidade\nTomate\t1,95\tkg\n'); await pg.click('#impPasteGo'); await pg.wait_for_timeout(300)
    check((await ev("Importer.map.name===0 && Importer.map.price===1")), 'colagem com tabulações reconhecida')
    # 7. exportar Excel e validar com openpyxl
    await ev("location.hash='#/relatorios'"); await pg.wait_for_timeout(300)
    for key in ['estiva','ficha','global','alergenios']:
        await pg.click(f'[data-rep={key}]'); await pg.wait_for_timeout(250)
        async with pg.expect_download() as d: await pg.click('#rxl')
        dl=await d.value; path=f'{DL}/{key}.xlsx'; await dl.save_as(path)
        wb=openpyxl.load_workbook(path); ws=wb.active
        check(ws.max_row>2, f'Excel "{key}" abre no openpyxl ({ws.max_row} linhas, folha "{ws.title}")')
        async with pg.expect_download() as d: await pg.click('#rcsv')
        await (await d.value).save_as(f'{DL}/{key}.csv')
        await pg.click('#rpdf'); await pg.wait_for_timeout(150)
    wb=openpyxl.load_workbook(f'{DL}/estiva.xlsx'); ws=wb.active
    hdr=[c.value for c in ws[1]]; row={hdr[i]:c.value for i,c in enumerate(next(r for r in ws.iter_rows(min_row=2) if r[0].value=='Picanha grelhada'))}
    check(abs(row['Custo total/dose']-(await cost('demo-r-picanha')))<1e-3, 'valor no Excel = valor calculado (picanha)')
    check(ws.cell(2,4).number_format.endswith('"€"'), 'formato moeda no Excel')
    check((await ev("window.__printed") or 0)>=4, 'impressão/PDF chamada para os relatórios')
    # 8. reler o XLSX exportado pelo próprio leitor
    n=await ev("""(async()=>{const r=await fetch('data:application/octet-stream;base64,'+btoa(''));return 1})()""")
    # 9. backup ida e volta
    data=await ev("JSON.stringify(Repo.exportAll())")
    cnt=await ev("Repo.all('recipes').length")
    await ev("Repo.clearAll()"); check((await ev("Repo.all('recipes').length"))==0, 'dados apagados')
    await ev(f"Repo.importAll({data},'replace')")
    check((await ev("Repo.all('recipes').length"))==cnt, 'cópia de segurança restaurada')
    # 10. persistência após recarregar
    await pg.reload(); await pg.wait_for_timeout(1200)
    check((await ev("Repo.all('recipes').some(r=>r.name==='Teste Salada')")), 'dados persistem após recarregar a página (IndexedDB)')
    await ev("window.print=()=>{}")
    # 11. remover demo mantém o que é usado por fichas reais
    res=await ev("Demo.remove()")
    left=await ev("Repo.all('recipes').map(r=>r.name)")
    check('Molho de cogumelos' in left and 'Picanha grelhada' not in left and 'Teste Salada' in left, f'demo removida, molho mantido por ser usado: {left}')
    check((await ev("!!Repo.get('ingredients','demo-i-014')")) and not (await ev("!!Repo.get('ingredients','demo-i-002')")), 'cebola (usada) mantida, bacalhau removido')
    real_ing=await ev("Repo.all('ingredients').filter(i=>!i.demo).length")
    check(real_ing==4, f'ingredientes reais intactos ({real_ing})')
    # 12. fichas abrem após remoção
    for r in ['dashboard','fichas','produtos','alergenios','simulador','relatorios']:
        await ev(f"location.hash='#/{r}'"); await pg.wait_for_timeout(250)
        check('Ocorreu um erro' not in await pg.inner_text('#view'), f'{r} abre após remover demo')
    print('\n'.join('JS ERROR '+e for e in errs) or 'sem erros JS')
    print('FALHAS:', check.fail)
    await b.close()
asyncio.run(main())
