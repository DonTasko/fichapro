# FichaPro para Android

App nativa (Kotlin) que contém a aplicação web (`../index.html`, copiado automaticamente para
`app/src/main/assets/www/` em cada compilação). Inclui:

- **Subscrições Google Play** (Play Billing Library 9.1) — plano Pro, sem anúncios e sem limites.
- **AdMob** (Google Mobile Ads 25.5 + consentimento RGPD via UMP) — banner e intersticial ocasional no plano gratuito.
- Impressão/PDF, gravação de ficheiros (Excel, CSV, cópias), seleção de ficheiros (importação, fotografias).

Requisitos: Android Studio recente, JDK 17, Android SDK 36. minSdk 26 (Android 8.0), targetSdk 36.

## 1. Abrir e testar

1. Android Studio → **Open** → pasta `android/` deste repositório.
2. Se o Android Studio propuser atualizar o Android Gradle Plugin/Gradle, aceite.
3. Correr em modo *debug*: usa automaticamente os **IDs de anúncios de teste** da Google.

## 2. Antes de publicar (uma vez)

| O quê | Onde |
|---|---|
| `applicationId` (`pt.lappsstudio.fichapro`) | `app/build.gradle.kts` — **não pode mudar depois da 1.ª publicação**. Se mudar, alterar também `PLAY_PACKAGE_NAME` na Edge Function. |
| App ID e blocos de anúncios AdMob | `gradle.properties` (`admobAppId`, `admobBannerId`, `admobInterstitialId`) — criar a app e 2 blocos (Banner e Intersticial) na consola AdMob |
| Mensagem de consentimento RGPD | AdMob → Privacidade e mensagens → criar mensagem RGPD para a app |
| Chave de assinatura | Build → Generate Signed App Bundle (guardar o `.jks` em local seguro, nunca no Git) |

## 3. Subscrição na Play Console

1. Criar a app e carregar um AAB num canal de **teste interno** (a faturação só funciona com a app publicada num canal).
2. **Monetizar → Produtos → Subscrições → Criar**: ID do produto **`fichapro_pro`**.
3. Criar planos base, por exemplo **`mensal`** (renovação mensal) e **`anual`** (renovação anual), definir preços e ativá-los.
   Opcional: oferta com período gratuito (ex.: 7 dias) — a app mostra-a automaticamente.
4. **Definições → Testes de licenças**: adicionar o seu email para comprar sem ser cobrado.

## 4. Validação no servidor (Supabase)

A app **não** ativa o plano sozinha: envia o token de compra para a Edge Function `play-billing`,
que confirma a compra junto da Google, faz o *acknowledge* (obrigatório em 3 dias) e ativa o plano Pro do estabelecimento.

1. Google Cloud (projeto ligado à Play Console): ativar **Google Play Android Developer API**; criar uma **conta de serviço** e uma chave JSON.
2. Play Console → **Utilizadores e autorizações** → convidar o email da conta de serviço com permissão para *ver dados financeiros* e *gerir encomendas e subscrições*.
3. Supabase → Edge Functions → Secrets:
   - `GOOGLE_SERVICE_ACCOUNT` = conteúdo completo do JSON
   - `PLAY_PACKAGE_NAME` = `pt.lappsstudio.fichapro`
   - `RTDN_KEY` = um texto aleatório longo
4. **Notificações em tempo real** (renovações, cancelamentos, reembolsos): Google Cloud → Pub/Sub → criar tópico e uma
   subscrição *push* para `https://pqrqxvpzxqwblhxtmdns.supabase.co/functions/v1/play-billing/rtdn?key=O_SEU_RTDN_KEY`;
   dar ao `google-play-developer-notifications@system.gserviceaccount.com` permissão de publicação no tópico;
   Play Console → Monetizar → Configuração da monetização → indicar o tópico.

## Planos

| | Gratuito | Pro |
|---|---|---|
| Fichas técnicas | até 10 | ilimitadas |
| Ingredientes | até 50 | ilimitados |
| Anúncios (app Android) | sim | não |
| Equipa (convidar utilizadores) | não | sim |

Os limites estão na tabela `fp_plan_limits` (servidor) e em `Plan.LIMITS` (`src/37_native.js` no projeto web). Os dados de demonstração não contam.
