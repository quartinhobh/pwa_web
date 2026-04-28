# DESIGN.md — Quartinho

Documento de identidade visual e mapa de telas. Este arquivo é o **manual de bordo** entre os tokens definidos na Section 13 do `ROADMAP.md` e o que está implementado em `web/src/`.

> **Hierarquia de fontes da verdade**
> 1. `tailwind.config.js` — tokens de cor e fonte (código).
> 2. `web/src/index.css` + `web/src/styles/animations.css` — base, grain, animações.
> 3. `web/src/components/common/ZineFrame.tsx` + `Button.tsx` + `Modal.tsx` — primitivos.
> 4. **Este arquivo** — descreve a intenção e como compor os primitivos por tela.
> 5. `.claude/ROADMAP.md` Section 13 — registro histórico e regras escritas pelo architect.

Se um valor diverge entre código e doc, **o código vence** e a doc é atualizada na mesma PR.

---

## 1. Identidade visual

### 1.1 Palette (`tailwind.config.js → theme.extend.colors.zine`)

| Token | Hex | Uso |
|---|---|---|
| `zine.mint` | `#98D9C2` | Background primário (hero do evento, cards principais). |
| `zine.periwinkle` | `#8B9FD4` | Background secundário (Header, seções alternadas, lista de locais). |
| `zine.cream` | `#F5F5DC` | Tom papel — bordas, texto sobre cores fortes, frames. |
| `zine.burntYellow` | `#E8A42C` | CTAs principais, acentos `bora`-style, links. |
| `zine.burntOrange` | `#D97642` | CTA alternativo, hover do `burntYellow`, cor de texto-base no body. |

**Variantes dark** (existem mas não são tokens públicos — são detalhes de implementação do `ZineFrame`):

| Token | Hex | Quando aparece |
|---|---|---|
| `zine.mint-dark` | `#2D5A4A` | Substitui `mint` em `html.dark`. |
| `zine.periwinkle-dark` | `#3D4A6B` | Substitui `periwinkle` em `html.dark`. |
| `zine.surface-dark` | `#222222` | Substitui `cream` quando ele aparece como bg em dark. |
| `zine.burntYellow-bright` | `#F4C147` | `burntYellow` em dark. |
| `zine.burntOrange-bright` | `#E8A060` | `burntOrange` em dark. |

**Regras inegociáveis:**
- Nunca `#FFFFFF` ou `#000000`. Texto base é `#1A1A1A` (light) ou `zine.cream` (dark) — definidos em `index.css`.
- Nenhuma cor literal fora destes tokens em componente. Se faltar um tom, abrir conversa com a Section 13 antes de adicionar.
- `theme_color` do PWA = `zine.mint`; `background_color` = `zine.cream`.

### 1.2 Tipografia (`tailwind.config.js → fontFamily`)

| Família | Tailwind | Uso |
|---|---|---|
| `Alfa Slab One` (display) | `font-display` | H1 / títulos de tela / nomes de álbum / "Quartinho" no Header. |
| `Bitter` (body) | `font-body` | Texto corrido, botões, inputs, listas. |
| `Bitter Italic` em `zine.burntYellow` | `font-body italic text-zine-burntYellow` | Acento "bora", links, datas em destaque. |

- Self-hosted em `web/public/fonts/` via `@font-face` (vide `index.css`). Sem CDN do Google Fonts.
- Fallback: `"Alfa Slab One", Georgia, serif` / `"Bitter", Georgia, serif`.

### 1.3 Grain global (`index.css` → `body::after`)

- SVG inline `feTurbulence` — sem PNG.
- Light: `mix-blend-mode: multiply`, `opacity: 0.08`.
- Dark: `mix-blend-mode: screen` (multiply zera contra fundo escuro).
- `pointer-events: none`, `z-index: 9999` — fica acima de tudo, mas não captura cliques.
- Nunca duplicar este efeito em componentes — ele já cobre toda a viewport via `position: fixed`.

### 1.4 Modo dark

- Toggle em `Header.tsx` salvando `quartinho:theme` no `localStorage`.
- Default: respeita `prefers-color-scheme`.
- Implementado via classe `dark` na `<html>` + `darkMode: 'class'` no Tailwind.
- **Não tem dark mode "puro"** — as variantes preservam matiz, são versões de baixa luminância. A leitura é "candlelit print", não "site dark".

---

## 2. Primitivos (`web/src/components/common/`)

### 2.1 `ZineFrame` e variantes — `ZineFrame.tsx`

A "moldura dentro da moldura". Toda superfície fechada da UI passa por aqui.

**Props comuns:**
- `bg`: `'mint' | 'periwinkle' | 'cream' | 'burntYellow'` (default `mint`).
- `borderColor`: mesmo enum (default `cream`).
- `wobble`: hover anima ±1.5°.
- `padded`: default `true` (`p-4`); `false` cola conteúdo na borda.
- `noFilter`: desliga o filtro SVG `#zine-wobble` na borda.

**Variantes:**
- `ZineFrame` — borda wobble + padding. Default para cards, hero, seções.
- `ZineFrameNoWobble` — mesma coisa sem o filtro SVG. Use quando o conteúdo precisa ficar **100% nítido** (formulários longos, tabelas admin).
- `ZineBorder` — `padded={false}`. Para wrappers que já têm padding interno.
- `ZineBorderDecorative` — borda wobble como camada `absolute`; **conteúdo não recebe filtro**. Default para letras de música, listas de tracks, qualquer texto longo.

**Regra-mestra (wobble vs. legibilidade):** o wobble é da **borda**, não do **texto**. Quando o conteúdo é majoritariamente leitura (LyricsDisplay, TrackList, formulários, prompts), use `ZineFrameNoWobble` ou `ZineBorderDecorative`. O hover-wobble (`wobble` prop ou classe `hover:wobble`) só deve ser disparado por interação.

**Filtro global:** `<ZineWobbleFilter />` é montado uma vez em `App.tsx`. Não duplicar.

### 2.2 `Button` — `Button.tsx`

- Variante única: `bg-zine-burntYellow` + `text-zine-cream` + borda `border-zine-cream` 4px + filtro wobble por padrão.
- Hover: `bg-zine-burntOrange` + `hover:wobble`.
- Focus visible: `ring-2 ring-zine-burntOrange`.
- `noWobble` desliga o filtro (raro; use só se o botão estiver dentro de um wrapper que já aplica wobble).
- **Sem ladder primary/secondary/ghost.** Se precisar de outro estilo, é um link estilizado ou um botão custom inline — discutir antes de criar variante.

### 2.3 `Modal` — `Modal.tsx`

- Backdrop: `rgba(26, 26, 26, 0.7)`. Nunca preto puro.
- Conteúdo: `ZineFrame bg="cream"` + animação `paper-in`.
- ESC e clique no backdrop fecham. `body.overflow` é travado quando aberto.
- Título opcional em `font-display` `text-zine-burntOrange`.

### 2.4 `LoadingState` / `EventDetailSkeleton` — `LoadingState.tsx`

- Esqueletos no `cream`/`mint` com pulse contido. Não usar spinners.
- Use `<LoadingState />` como fallback de `<Suspense>` para páginas lazy.
- `EventDetailSkeleton` espelha o layout de `Listen`/`EventDetail`.

### 2.5 `StickerLayer` — `StickerLayer.tsx`

- Camada absolute sobre o app. Stickers em `web/src/stickers/`.
- Animações `sticker-spawn` (entrada com bounce) e `sticker-fall` (queda + rotação).
- Cada sticker tem `--sticker-rot` inline; preserva a rotação base entre estados.
- Respeita `prefers-reduced-motion`.

### 2.6 `InstallPrompt` / `UpdatePrompt`

- Banners discretos no canto, compostos via `ZineFrame bg="cream"`.
- `InstallPrompt` aparece via beforeinstallprompt; `UpdatePrompt` quando o SW detecta nova versão.
- Ambos com filtro wobble já aplicado globalmente — nada de wobble extra.

### 2.7 `UserAvatar` — `UserAvatar.tsx`

- Tamanhos `sm` / `md` / `lg`. Sempre redondo, borda `zine.cream`.
- Fallback é a primeira letra do nome em `font-display` sobre `zine.periwinkle`.

### 2.8 `Confetti` / `ZineFrame` decorativos

- `Confetti.tsx` — partículas curtas para confirmações fortes (RSVP, voto). Uso pontual, não decorativo permanente.

---

## 3. Layout & navegação

### 3.1 Shell (`App.tsx`)

```
<ZineWobbleFilter />
<div min-h-screen flex flex-col font-body text-zine-burntOrange>
  <Header />
  <BannerDisplay />     ← banners admin (lazy)
  <main mx-auto max-w-[640px] px-4 py-3>  ← 1240px no /admin
    <Suspense fallback={<LoadingState />}>
      {routes}
    </Suspense>
  </main>
  <Footer />
  <InstallPrompt />
  <UpdatePrompt />
  <StickerLayer />
</div>
```

- **Largura máxima de conteúdo:** `640px` mobile-first em todas as rotas, exceto `/admin` (`1240px` em ≥md).
- Padding interno do `<main>`: `px-4 py-3`.
- `overflow-x-hidden` global no `body` e na div raiz — nada de scroll horizontal.

### 3.2 Header — `components/layout/Header.tsx`

- Background `zine.periwinkle`, borda inferior `border-b-4 border-zine-cream`.
- Logo (`/logo.svg`) + brand-name "Quartinho" em `font-display`.
- **Container queries** (`.header-cq`):
  - `< 380px`: brand escondido (qualquer modo).
  - `380px–500px`: brand visível para usuário comum, escondido em `admin/moderator` (porque há mais itens nav).
  - `≥ 500px`: brand sempre visível.
- Direita: theme toggle (`☾`/`☀`), link `lojinha`, avatar+nome ou botão `entrar`. Botão `admin` extra para `admin/moderator`.

### 3.3 `BannerDisplay` — `components/layout/BannerDisplay.tsx`

- Faixa horizontal abaixo do Header. Banners admin programáveis.
- Compõe `ZineFrame bg="burntYellow"` por padrão; bg pode ser sobrescrito pelo banner.

### 3.4 `Footer` — `components/layout/Footer.tsx`

- `bg-zine-mint` (light) / `bg-zine-mint-dark` (dark), borda superior `cream` 4px.
- Links institucionais e redes. Texto `zine.cream`.

### 3.5 `TabNav` — `components/layout/TabNav.tsx`

- Usado dentro de páginas com seções (Profile, Admin sub-tabs). Não é um nav global.
- Tab ativo: bg `zine.burntYellow`, texto `cream`. Inativo: bg `cream`, texto `burntOrange`.
- Bordas `cream` 4px conforme convenção.

### 3.6 Grid photo-strip

- Para barras informativas (data | hora | CTA), usar `grid-cols-3` com divisores verticais `border-l-2 border-zine-cream` e gap zero. Imita tira de fotos analógica.

---

## 4. Animações (`web/src/styles/animations.css`)

| Classe | Quando usar |
|---|---|
| `wobble` | Trigger único de 200ms. Combine com `hover:` em CTAs. |
| `paper-in` | Entrada de cards e modais (150ms scale + opacity). Default para `<Modal>`. |
| `sticker-spawn` | Entrada de sticker — bounce cubic-bezier(0.34, 1.56, 0.64, 1). |
| `sticker-fall` | Queda do sticker — 1200ms até 120vh com 540° de rotação. |

Todas respeitam `prefers-reduced-motion: reduce` (animações desligadas, não retiradas).

**Filtro SVG** `#zine-wobble` (`feTurbulence` + `feDisplacementMap`) é distinto da animação `wobble`. O filtro distorce **a borda** (estática); a animação **roda** o elemento no hover. Coexistem.

---

## 5. Mapa de telas

Cada subsecção descreve: rota, propósito, frames principais, estados.

### 5.1 `/` — Listen (`pages/Listen.tsx`)

- **Propósito:** evento atual / próximo. Hero da home.
- **Frames:**
  - Intro institucional: `ZineFrame bg="cream" borderColor="burntYellow"`.
  - Badge `ao vivo` ou `próximo evento`: span sólido `burntOrange`/`periwinkle` com `text-cream`, all-caps `font-display`.
  - `AlbumDisplay` — capa + título (próprio frame interno).
  - Bloco data/hora/local: `ZineFrame bg="cream"`.
  - RSVP (`RsvpButton` + `RsvpStatus`) — quando `event.rsvp.enabled`.
  - Links Spotify/extras: pílulas `bg-burntYellow` ou `bg-periwinkle`.
  - `TrackList` — votação inline em eventos `live`, preview em `upcoming`.
  - Link `ver eventos passados →` em italic underline `burntYellow`.
- **Estados:** `loading` → `EventDetailSkeleton`; `error` → texto simples; `!event` → mensagem em frame mint + link archive.
- **Reveal de local:** `event.location` só aparece a partir de `venueRevealDaysBefore` (default 7) ou se `live`.

### 5.2 `/archive` — Archive (`pages/Archive.tsx`)

- **Propósito:** lista de eventos passados.
- **Frames:** cada evento é um `EventCard` que internamente compõe `ZineFrame bg="mint"`.
- **Navegação:** clicar no card chama callback que `navigate(/event/:id)`.

### 5.3 `/event/:eventId` — EventDetail (`pages/EventDetail.tsx`)

- **Propósito:** evento individual (passado ou futuro).
- **Layout:** mesmo esqueleto de Listen, sem badge ao-vivo. Inclui `CommentsSection`, fotos (`PhotoGallery`), votos finalizados (`VoteResults`).

### 5.4 `/chat` e `/chat/:eventId` — LiveChat (`pages/LiveChat.tsx`)

- **Propósito:** chat realtime durante evento ao vivo.
- **Frames:** lista de mensagens em `ZineFrameNoWobble bg="cream"` (legibilidade); cada `ChatMessage` é um bloco interno; `ChatInput` é uma pílula `bg-cream` com borda wobble + `Button`.

### 5.5 `/locais` — Bares (`pages/Bares.tsx`)

- **Propósito:** locais sugeridos pela comunidade.
- **Frames:** `BarList` com `BarCard`s (`ZineFrame bg="periwinkle"`).
- Header da página: `<h1>locais</h1>` em `font-display text-3xl text-burntOrange` com filtro wobble inline.
- Tabs de status: `SuggestionStatusTabs` (pending/approved/rejected).
- Filtros e busca: inputs com filtro wobble aplicado.
- **Copy:** sempre `local`/`locais` no usuário-final (NUNCA `bar`/`bares`). Internamente os arquivos podem manter o nome `Bares.tsx` por compatibilidade — só a UI é `local`.

### 5.6 `/local/:id` — BarDetail (`pages/BarDetail.tsx`)

- **Propósito:** detalhe de local + comentários + feedback.
- **Frames:** card hero `ZineFrame bg="mint"`, comentários em `cream`, `BarFeedbackButtons` (👍 / 👎 / ❤️) como pílulas `burntYellow`.

### 5.7 `/novo-local` — NovoBar (`pages/NovoBar.tsx`)

- **Propósito:** form de sugestão de novo local.
- **Frames:** `BarSuggestionForm` em `ZineFrameNoWobble bg="cream"` (form longo, não distorcer).
- `AddressAutocomplete` para endereço; `MbResultsList` para resultados.

### 5.8 `/sugerir-disco` — SugerirDisco (`pages/SugerirDisco.tsx`)

- **Propósito:** form de sugestão de álbum.
- **Frames:** `AlbumSuggestionForm` em `ZineFrameNoWobble bg="cream"`. Busca MusicBrainz inline.

### 5.9 `/profile` — Profile (`pages/Profile.tsx`)

- **Propósito:** perfil próprio. Edição de displayName, avatar, username, RSVPs, votos.
- **Frames:** múltiplos `ZineFrame bg="periwinkle"` (seções) + `cream` (forms internos).
- `PhotoUpload` para avatar; redirect para `/u/:username` ao salvar.

### 5.10 `/u/:username` — PublicProfile (`pages/PublicProfile.tsx`)

- **Propósito:** perfil público read-only.
- **Frames:** `ZineFrame bg="mint"` para card principal.

### 5.11 `/user/:id` — UserRedirect

- Resolve uid → username e redireciona para `/u/:username`. Não tem UI dedicada (loading curto).

### 5.12 `/links` — Links (`pages/Links.tsx`)

- **Propósito:** linktree-like institucional. Configurado pelo admin via `LinkTreePanel`.
- **Frames:** lista de pílulas `bg-burntYellow text-cream border-cream`, uma por link.

### 5.13 `/lojinha` — Shop (`pages/Shop.tsx`)

- **Propósito:** loja de produtos físicos.
- **Frames:** grid de produtos em `ZineFrame bg="mint"`; modal de produto em `Modal`.

### 5.14 `/admin-login` — AdminLogin (`pages/AdminLogin.tsx`)

- **Propósito:** entrada de admin via email/senha.
- **Frames:** `ZineFrame bg="periwinkle"` central com form `cream` interno + `Button`.

### 5.15 `/admin` — Admin (`pages/Admin.tsx` → `AdminPanel`)

- **Propósito:** dashboard admin/mod. Largura aumenta para `1240px`.
- **Frames:** `AdminPanel` orquestra sub-painéis (`Album/Bar/Banner/Chat/EmailTemplates/LinkTree/Moderation/Newsletter/Photo/Rsvp/Shop/Sticker/Users`).
- Acesso negado: `ZineFrame bg="periwinkle"` central com mensagem.
- Cada sub-panel é independente e usa `ZineFrameNoWobble` + tabelas/forms — wobble distrai em UI densa.

### 5.16 `/reset-password` — ResetPassword (`pages/ResetPassword.tsx`)

- **Propósito:** fluxo de reset Firebase Auth.
- **Frames:** `ZineFrame bg="cream"` central com form e estados (loading, sucesso, erro).

### 5.17 `/__dev-login` (DEV-only)

- Bypass de auth em desenvolvimento. Sem styling especial — utilitário interno.

---

## 6. Estados padronizados

Toda tela deve cobrir explicitamente:

| Estado | Padrão visual |
|---|---|
| **Loading** | `<LoadingState />` ou skeleton específico (`EventDetailSkeleton`). Nunca spinner. |
| **Empty** | `ZineFrame bg="mint"` central, `font-display` no título + texto explicativo + CTA. |
| **Error** | Texto `text-zine-burntOrange` simples ou `ZineFrame bg="cream" borderColor="burntOrange"` com mensagem. |
| **Auth-required** | Botão `entrar` (Header) + Modal de login (`LoginModal`) ou redirect para `/admin-login`. |
| **Offline** | Service worker serve `offline.html`. Hooks (`useOfflineSync`) sincronizam votos pendentes ao voltar. |

---

## 7. Regras inegociáveis (PR checklist)

Toda PR que toca `.tsx`, `.css`, `tailwind.config.js` deve passar por este checklist:

- [ ] Nenhuma cor literal fora dos tokens `zine.*`. Sem `#fff`, `#000`, `#ffffff`, `#000000`, `bg-white`, `bg-black`, `text-white`, `text-black`.
- [ ] Nenhuma fonte fora de `font-display` / `font-body`.
- [ ] Bordas usam `border-zine-cream` (ou variant) via `ZineFrame`/`Button`. Nada de `border-black`, `border-gray-*`.
- [ ] Bordas decorativas via `feTurbulence` (filter `#zine-wobble`) — nunca `border-image` PNG.
- [ ] Texto longo (forms, listas, letras) **não** está dentro de um frame com filtro wobble aplicado ao conteúdo. Use `ZineFrameNoWobble` ou `ZineBorderDecorative`.
- [ ] Animações respeitam `prefers-reduced-motion: reduce`.
- [ ] Largura de conteúdo respeita `max-w-[640px]` (`max-w-[1240px]` apenas em `/admin`).
- [ ] Nenhum scroll horizontal (`overflow-x-hidden` mantido no body).
- [ ] Copy em pt-BR, lower-case predominante, `local/locais` em vez de `bar/bares`.
- [ ] Botões via `<Button>` quando possível; links com aparência de botão usam o mesmo conjunto de classes (`bg-zine-burntYellow text-zine-cream border-4 border-zine-cream`).
- [ ] Modais via `<Modal>` (já compõe backdrop `rgba(26,26,26,0.7)` + `paper-in`).
- [ ] PWA: `theme_color` continua `zine.mint`.

---

## 8. Decisões fechadas (não reabrir sem motivo forte)

- **5 tokens de cor.** Adicionar um sexto requer revisão da Section 13 + alinhamento com o usuário.
- **Sem ladder primary/secondary/ghost** em `Button`. Variante única.
- **Filtro SVG, não PNG**, para borda e grain.
- **Self-hosted fonts**, não Google Fonts CDN.
- **Dark mode é luminância reduzida**, não inversão de paleta.
- **`local/locais` user-facing**, mesmo que arquivos legados se chamem `Bares.tsx`/`BarCard.tsx` etc.

---

## 9. Quando atualizar este documento

- Adição/remoção de primitivo em `components/common/`.
- Mudança em `tailwind.config.js → theme.extend.colors.zine` ou `fontFamily`.
- Nova rota em `App.tsx` (adicionar à seção 5).
- Mudança estrutural em `index.css` (grain, base, container queries).
- Nova animação em `styles/animations.css`.

Atualize na **mesma PR** que muda o código. Doc-drift é bug.
