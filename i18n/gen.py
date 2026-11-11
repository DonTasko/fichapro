import json,sys
keys=json.load(open('keys_v1.json'))
d={'es':{},'fr':{},'en':{}}
bad=0
for f in ['t1.tsv','t2.tsv','t3.tsv','t4.tsv']:
    for ln,line in enumerate(open(f,encoding='utf-8')):
        line=line.rstrip('\n')
        if not line.strip(): continue
        p=line.split('\t')
        if len(p)!=4: print('BAD',f,ln,repr(line)); bad+=1; continue
        i=int(p[0]); k=keys[i]
        for lang,v in zip(['es','fr','en'],p[1:]):
            if v.count('{#}')>k.count('{#}'): print('PH',f,i,lang,repr(k),repr(v)); bad+=1
            d[lang][k]=v
for line in open('t5.tsv',encoding='utf-8'):
    p=line.rstrip('\n').split('\t')
    if len(p)==4:
        for lang,v in zip(['es','fr','en'],p[1:]): d[lang][p[0]]=v
for lang in d:
    open(f'../src/06_lang_{lang}.js','w',encoding='utf-8').write(
      f"/* {lang} — gerado de i18n/t*.tsv */\nI18N.add('{lang}', "+json.dumps(d[lang],ensure_ascii=False,indent=0)+");\n")
    print(lang,len(d[lang]))
sys.exit(1 if bad else 0)
