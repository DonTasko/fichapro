# FichaPro — Fichas técnicas & Food Cost

Aplicação web para restaurantes, hotéis, cafés, pastelarias e catering: fichas técnicas (estivas), gestão e importação de ingredientes, cálculo de custos de produção, alergénios e sugestão de preços de venda.

Tudo num único ficheiro (`index.html`), sem dependências externas e sem servidor. Os dados ficam guardados no navegador (IndexedDB).

## Como usar

- Abrir `index.html` no navegador (Chrome, Edge, Firefox ou Safari recentes), ou
- Publicar com GitHub Pages (Settings → Pages → branch `main`, pasta `/`).

Na primeira abertura são carregados dados de demonstração (preços fictícios), que podem ser eliminados em **Configurações**.

## Funcionalidades

- Dashboard com indicadores e gráficos
- Ingredientes: unidades, embalagens, IVA, desperdício/rendimento, alergénios, histórico de preços
- Importação de Excel (.xlsx), CSV e colagem a partir de folha de cálculo, com associação de colunas, pré-visualização e deteção de duplicados
- Fichas técnicas com preparações intermédias (sub-receitas), fotografia, tempos, versões
- Mão de obra (tempos simultâneos ou individuais), energia por equipamento, custos indiretos sem duplicação
- Preços sugeridos (económico, recomendado, premium) com IVA por categoria e arredondamento comercial
- 14 alergénios (Reg. UE 1169/2011), contaminação cruzada, ficha para clientes
- Simulador de cenários
- 10 relatórios com impressão/PDF, Excel e CSV
- Cópias de segurança (exportar/importar JSON)

## Avisos

- Os dados ficam apenas no navegador onde a aplicação é usada. Exporte cópias de segurança regularmente.
- A identificação de alergénios é um apoio e deve ser confirmada pelo responsável.
- As taxas de IVA predefinidas são exemplos; confirme-as com o seu contabilista.
- Margens e lucros apresentados são estimativas por produto, não o lucro líquido do negócio.
