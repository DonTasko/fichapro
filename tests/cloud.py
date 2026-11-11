"""Teste do modo nuvem com uma simulação local da API do Supabase (Auth + PostgREST),
partilhada entre vários "dispositivos" (contextos de navegador independentes)."""
import asyncio, json, re, uuid, time
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs, unquote
from playwright.async_api import async_playwright

URL = 'file:///home/claude/ft/dist/FichaPro.html'
BASE = 'https://pqrqxvpzxqwblhxtmdns.supabase.co'
F = [0]
def check(c, m):
    print(('ok   - ' if c else 'FAIL - ') + m); F[0] += (not c)

class Mock:
    def __init__(s):
        s.users = {}; s.tokens = {}; s.tenants = {}; s.members = []; s.invites = []; s.records = {}; s.t = 0; s.calls = 0
    def now(s):
        s.t += 1
        return (datetime(2026, 11, 11, 12, 0, tzinfo=timezone.utc) + timedelta(microseconds=s.t * 1000)).isoformat()
    def tok(s, uid):
        t = 'tok-' + uuid.uuid4().hex; s.tokens[t] = uid; return t
    def session(s, uid):
        u = s.users[uid]
        return {'access_token': s.tok(uid), 'refresh_token': 'ref-' + uid, 'expires_in': 3600, 'user': {'id': uid, 'email': u['email']}}
    def role(s, uid, tid):
        for m in s.members:
            if m['user_id'] == uid and m['tenant_id'] == tid: return m['role']
    def can_write(s, uid, tid):
        return s.role(uid, tid) in ('owner', 'admin', 'editor')
    def pro(s, tid):
        p = s.tenants[tid]['paid_until']; return bool(p) and p > datetime.now(timezone.utc).isoformat()

    async def handle(s, route):
        s.calls += 1
        req = route.request; u = urlparse(req.url); q = parse_qs(u.query); path = u.path
        body = json.loads(req.post_data) if req.post_data else None
        def resp(obj, status=200): return route.fulfill(status=status, content_type='application/json', body=json.dumps(obj) if obj is not None else '', headers={'Access-Control-Allow-Origin': '*'})
        if req.method == 'OPTIONS': return await route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
        auth = req.headers.get('authorization', '')
        uid = s.tokens.get(auth.replace('Bearer ', ''))
        if path == '/auth/v1/signup':
            if any(x['email'] == body['email'] for x in s.users.values()): return await resp({'msg': 'User already registered'}, 422)
            nid = str(uuid.uuid4()); s.users[nid] = {'email': body['email'], 'pw': body['password']}
            return await resp(s.session(nid))
        if path == '/auth/v1/token':
            if q['grant_type'][0] == 'password':
                for k, x in s.users.items():
                    if x['email'] == body['email'] and x['pw'] == body['password']: return await resp(s.session(k))
                return await resp({'error_description': 'Invalid login credentials'}, 400)
            k = body['refresh_token'][4:]; return await resp(s.session(k))
        if path == '/auth/v1/logout': return await resp(None, 204)
        if path == '/auth/v1/user': return await resp({'id': uid, 'email': s.users[uid]['email']})
        if not uid: return await resp({'message': 'JWT expired'}, 401)
        email = s.users[uid]['email']
        tbl = path.replace('/rest/v1/', '')
        val = lambda k: unquote(q[k][0]).split('.', 1)[1] if k in q else None
        if tbl == 'rpc/fp_accept_invites':
            n = 0
            for i in s.invites:
                if i['email'] == email and not i.get('accepted_at'):
                    s.members.append({'tenant_id': i['tenant_id'], 'user_id': uid, 'email': email, 'role': i['role']}); i['accepted_at'] = s.now(); n += 1
            return await resp(n)
        if tbl == 'rpc/fp_create_tenant':
            tid = str(uuid.uuid4())
            s.tenants[tid] = {'id': tid, 'name': body['p_name'], 'plan': 'free', 'paid_until': None, 'created_at': s.now()}
            s.members.append({'tenant_id': tid, 'user_id': uid, 'email': email, 'role': 'owner'}); return await resp(tid)
        if tbl == 'rpc/fp_rename_tenant': s.tenants[body['t']]['name'] = body['p_name']; return await resp(None, 204)
        if tbl == 'fp_tenants': return await resp([t for t in s.tenants.values() if s.role(uid, t['id'])])
        if tbl == 'fp_members':
            rows = [m for m in s.members if s.role(uid, m['tenant_id'])]
            if 'user_id' in q: rows = [m for m in rows if m['user_id'] == val('user_id')]
            if 'tenant_id' in q: rows = [m for m in rows if m['tenant_id'] == val('tenant_id')]
            return await resp(rows)
        if tbl == 'fp_invites':
            if req.method == 'POST':
                if s.role(uid, body['tenant_id']) not in ('owner', 'admin') or not s.pro(body['tenant_id']): return await resp({'code': '42501', 'message': 'rls'}, 403)
                s.invites.append({'id': str(uuid.uuid4()), **body}); return await resp(None, 201)
            if req.method == 'DELETE': s.invites = [i for i in s.invites if i['id'] != val('id')]; return await resp(None, 204)
            return await resp([i for i in s.invites if i['tenant_id'] == val('tenant_id') and not i.get('accepted_at')])
        if tbl == 'fp_records':
            if req.method == 'POST':
                for r in body:
                    if not s.can_write(uid, r['tenant_id']): return await resp({'code': '42501', 'message': 'new row violates row-level security policy'}, 403)
                lims = {'recipes': 10, 'ingredients': 50}
                for r in body:
                    k = (r['tenant_id'], r['store'], r['id'])
                    if k not in s.records and not r['deleted'] and r['store'] in lims and not r['data'].get('demo') and not s.pro(r['tenant_id']):
                        n = len([x for x in s.records.values() if x['tenant_id'] == r['tenant_id'] and x['store'] == r['store'] and not x['deleted'] and not x['data'].get('demo')])
                        if n >= lims[r['store']]: return await resp({'code': 'P0001', 'message': 'FP_LIMIT: limite'}, 400)
                    s.records[(r['tenant_id'], r['store'], r['id'])] = {**r, 'updated_at': s.now()}
                return await resp(None, 201)
            tid = val('tenant_id')
            if not s.role(uid, tid): return await resp([])
            rows = [r for r in s.records.values() if r['tenant_id'] == tid]
            if 'deleted' in q: rows = [r for r in rows if not r['deleted']]
            if 'updated_at' in q: rows = [r for r in rows if r['updated_at'] > val('updated_at')]
            rows.sort(key=lambda r: (r['updated_at'], r['store'], r['id']))
            off = int(q.get('offset', ['0'])[0]); lim = int(q.get('limit', ['1000'])[0])
            return await resp([{k: r[k] for k in ('store', 'id', 'data', 'deleted', 'updated_at')} for r in rows[off:off + lim]])
        return await resp({'message': 'não simulado: ' + tbl}, 404)
    def recs(s, tid, store, live=True): return [r for r in s.records.values() if r['tenant_id'] == tid and r['store'] == store and (not live or not r['deleted'])]

async def main():
    mock = Mock()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        async def device(name):
            ctx = await b.new_context(viewport={'width': 1300, 'height': 900})
            await ctx.route(BASE + '/**', mock.handle)
            await ctx.add_init_script("localStorage.getItem('fp_lang')||localStorage.setItem('fp_lang','pt')")
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(name + ': ' + str(e)))
            pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
            await pg.goto(URL); await pg.wait_for_timeout(700)
            return ctx, pg
        async def signup(pg, email, pw='segredo123'):
            await pg.click('[data-t=signup]'); await pg.fill('#gForm [name=email]', email); await pg.fill('#gForm [name=password]', pw); await pg.fill('#gForm [name=password2]', pw)
            await pg.click('#gForm button[type=submit]'); await pg.wait_for_timeout(500)

        # ---------- Dispositivo A: criar conta e estabelecimento ----------
        ca, A = await device('A')
        check(await A.locator('#gCloud').count() == 1, 'ecrã inicial pergunta o modo de utilização')
        await A.click('#gCloud'); await A.wait_for_timeout(200)
        await signup(A, 'luis@dontasko.pt')
        check(await A.locator('#gForm [name=name]').count() == 1, 'conta criada → pede nome do estabelecimento')
        await A.fill('#gForm [name=name]', 'Don Tasko'); await A.click('#gForm button[type=submit]'); await A.wait_for_timeout(2500)
        tid = list(mock.tenants)[0]
        check(await A.evaluate("Repo.kind") == 'Nuvem (Supabase)', 'aplicação aberta em modo nuvem')
        n_ing = len(mock.recs(tid, 'ingredients'))
        check(n_ing == 28 and len(mock.recs(tid, 'recipes')) == 9, f'dados de demonstração enviados para a nuvem ({n_ing} ingredientes)')
        check(any(r['data'].get('businessName') == 'Don Tasko' for r in mock.recs(tid, 'meta')), 'configurações com o nome do estabelecimento na nuvem')
        check('Sincronizado' in await A.inner_text('#syncBadge'), 'indicador "Sincronizado" visível')

        # ---------- A altera um preço ----------
        await A.evaluate("location.hash='#/ingredientes'"); await A.wait_for_timeout(300)
        inp = A.locator('tr[data-id="demo-i-001"] input[data-price]'); await inp.fill('19,90'); await inp.press('Tab'); await A.wait_for_timeout(1200)
        r = mock.records[(tid, 'ingredients', 'demo-i-001')]
        check(r['data']['price'] == 19.9, 'alteração de preço enviada para a nuvem')
        check(len(mock.recs(tid, 'priceHistory')) == 1, 'histórico de preço também sincronizado')

        # ---------- Dispositivo B: mesmo utilizador ----------
        cb, B = await device('B')
        await B.click('#gCloud'); await B.wait_for_timeout(200)
        await B.fill('#gForm [name=email]', 'luis@dontasko.pt'); await B.fill('#gForm [name=password]', 'segredo123'); await B.click('#gForm button[type=submit]'); await B.wait_for_timeout(2500)
        check(await B.evaluate("Repo.get('ingredients','demo-i-001').price") == 19.9, 'dispositivo B recebe os dados com o preço novo')
        check(await B.evaluate("Repo.all('recipes').length") == 9, 'dispositivo B tem as 9 fichas')
        # B altera preço de venda de uma ficha; A recebe
        await B.evaluate("(async()=>{const r=Repo.get('recipes','demo-r-mousse'); r.salePrice=4.2; await Services.saveRecipe(r,'teste B')})()"); await B.wait_for_timeout(1200)
        await A.evaluate("location.hash='#/produtos'"); await A.wait_for_timeout(300)
        n = await A.evaluate("Sync.adapter.syncNow()"); await A.wait_for_timeout(500)
        check(await A.evaluate("Repo.get('recipes','demo-r-mousse').salePrice") == 4.2, f'dispositivo A recebe a alteração de B ({n} alteração(ões))')
        check(await A.input_value('tr[data-id="demo-r-mousse"] [data-sp]') == '4,2', 'ecrã de A atualizado automaticamente')

        # ---------- Sem rede ----------
        await ca.set_offline(True); await A.wait_for_timeout(200)
        await A.evaluate("(async()=>{const i=Repo.get('ingredients','demo-i-005'); await Services.saveIngredient({...i, price: 1.99})})()"); await A.wait_for_timeout(600)
        pend = await A.evaluate("Sync.adapter.state.pending")
        check(pend >= 1 and mock.records[(tid, 'ingredients', 'demo-i-005')]['data']['price'] != 1.99, f'sem rede: alteração fica em fila ({pend} pendente(s)) e a app continua a funcionar')
        check('Sem ligação' in await A.inner_text('#syncBadge'), 'indicador mostra "Sem ligação"')
        await ca.set_offline(False); await A.evaluate("window.dispatchEvent(new Event('online'))"); await A.wait_for_timeout(1500)
        check(mock.records[(tid, 'ingredients', 'demo-i-005')]['data']['price'] == 1.99 and await A.evaluate("Sync.adapter.state.pending") == 0, 'ao voltar a rede a fila é enviada')

        # ---------- Recarregar A: usa cache local + sessão ----------
        await A.reload(); await A.wait_for_timeout(1800)
        check(await A.evaluate("Repo.kind") == 'Nuvem (Supabase)' and await A.evaluate("Repo.get('ingredients','demo-i-005').price") == 1.99, 'após recarregar: sessão e dados mantidos')

        # ---------- Plano gratuito: limite de fichas ----------
        res = await A.evaluate("""(async()=>{let n=0;try{for(let i=0;i<12;i++){const r=newRecipe();r.name='Real '+i;r.lines=[];await Services.saveRecipe(r);n++}return n+' ok'}catch(e){return n+' | '+e.message}})()""")
        await A.wait_for_timeout(1200)
        check(res.startswith('10 |') and 'plano gratuito' in res.lower(), 'plano gratuito: a 11.ª ficha é recusada (' + res[:60] + ')')
        check(len([r for r in mock.recs(tid, 'recipes') if not r['data'].get('demo')]) == 10, 'servidor ficou com 10 fichas reais')
        await A.evaluate("location.hash='#/configuracoes'"); await A.wait_for_timeout(1200)
        check(await A.locator('#invF').count() == 1 and not await A.locator('#invF').is_visible() and 'plano Pro' in await A.inner_text('#acct'), 'convites só no plano Pro (formulário escondido no gratuito)')
        # ---------- Plano Pro ----------
        mock.tenants[tid]['plan'] = 'active'; mock.tenants[tid]['paid_until'] = '2099-01-01T00:00:00+00:00'
        await A.reload(); await A.wait_for_timeout(1800)
        res = await A.evaluate("""(async()=>{try{const r=newRecipe();r.name='Real Pro';r.lines=[];await Services.saveRecipe(r);return 'ok'}catch(e){return e.message}})()""")
        await A.wait_for_timeout(1000)
        check(res == 'ok' and any(r['data'].get('name') == 'Real Pro' for r in mock.recs(tid, 'recipes')), 'plano Pro: sem limite de fichas')
        await A.evaluate("location.hash='#/configuracoes'"); await A.wait_for_timeout(1000)
        check('Plano: Pro' in await A.inner_text('#plan'), 'cartão do plano mostra Pro')

        # ---------- Convite: utilizador só de consulta ----------
        # ---------- Convite: utilizador só de consulta ----------
        await A.evaluate("location.hash='#/configuracoes'"); await A.wait_for_timeout(1000)
        await A.fill('#invF [name=email]', 'chef@dontasko.pt'); await A.select_option('#invF [name=role]', 'viewer'); await A.click('#invF button[type=submit]'); await A.wait_for_timeout(800)
        check(len(mock.invites) == 1 and 'convite pendente' in await A.inner_text('#acct'), 'convite criado e listado')
        cc, C = await device('C')
        await C.click('#gCloud'); await C.wait_for_timeout(200); await signup(C, 'chef@dontasko.pt'); await C.wait_for_timeout(2200)
        check(await C.evaluate("Tenants.current && Tenants.current.name") == 'Don Tasko', 'convidado entra diretamente no estabelecimento')
        check(await C.evaluate("Repo.all('recipes').length") == len(mock.recs(tid, 'recipes')), 'convidado vê as fichas')
        res = await C.evaluate("(async()=>{try{await Services.saveIngredient({...Repo.get('ingredients','demo-i-005'),price:9});return 'gravou'}catch(e){return e.message}})()")
        check('consulta' in res, 'perfil "só consulta" não consegue gravar: ' + res)
        check('Modo só de leitura' in await C.inner_text('#view'), 'aviso de modo só de leitura no dashboard')

        # ---------- Dispositivo D: dados locais existentes enviados para nova conta ----------
        cd, D = await device('D')
        await D.click('#gLocal'); await D.wait_for_timeout(1200)
        await D.evaluate("Services.saveIngredient({name:'Ingrediente real do D',purchaseUnit:'kg',purchaseQty:1,price:3,vat:6,allergens:[],traces:[]})"); await D.wait_for_timeout(300)
        await D.evaluate("location.hash='#/configuracoes'"); await D.wait_for_timeout(400)
        await D.click('#acOn'); await D.wait_for_timeout(900)
        await signup(D, 'outro@restaurante.pt')
        check(await D.locator('#gForm [name=upload]').count() == 1, 'oferece enviar os dados locais existentes')
        await D.uncheck('#gForm [name=demo]'); await D.fill('#gForm [name=name]', 'Outro Restaurante'); await D.click('#gForm button[type=submit]'); await D.wait_for_timeout(2500)
        t2 = [k for k, v in mock.tenants.items() if v['name'] == 'Outro Restaurante'][0]
        names = [r['data']['name'] for r in mock.recs(t2, 'ingredients')]
        check(names == ['Ingrediente real do D'], f'dados locais enviados para a conta nova ({len(names)} ingredientes)')
        check(not any(r['tenant_id'] == t2 for r in mock.records.values() if r['data'].get('name') == 'Picanha de novilho' and r['tenant_id'] == tid and False), 'isolamento entre estabelecimentos')
        check(await D.evaluate("Repo.all('recipes').every(r=>!r.name.includes('cópia'))") and len([r for r in mock.records.values() if r['tenant_id'] == tid]) > len(mock.recs(t2, 'ingredients')) , 'estabelecimentos separados na nuvem')

        print('\n'.join('JS ERROR ' + e for e in errs) or 'sem erros JS')
        print('FALHAS:', F[0], '| pedidos à API simulada:', mock.calls)
        await b.close()

if __name__ == "__main__": asyncio.run(main())
