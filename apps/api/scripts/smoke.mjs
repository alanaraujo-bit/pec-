/**
 * Teste ponta a ponta contra a API rodando de verdade, com o banco de produção.
 *
 * Não é um teste unitário: percorre exatamente o caminho que o app percorre — cadastro,
 * onboarding, montagem do PC peça por peça, diagnóstico, evento social, reação, feed,
 * ranking e comparação. Se este script passa, o produto funciona de ponta a ponta.
 */

const BASE = process.env.API_URL ?? 'http://localhost:3333';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✖ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

const stamp = Date.now().toString(36);
const PASSWORD = 'senha-de-teste-123';

/**
 * Contas criadas por esta execução.
 *
 * O smoke roda contra o Postgres de produção de propósito — é o que torna o teste real.
 * O preço disso é que cada execução criava gente que nunca saía do banco, e essas contas
 * apareciam no feed de descoberta de usuários de verdade. Agora a execução limpa o que suja.
 */
const created = [];

async function createUser(suffix, displayName) {
  const handle = `smoke_${suffix}_${stamp}`.slice(0, 20);
  const res = await api('POST', '/auth/register', {
    body: {
      email: `${handle}@pece.test`,
      password: PASSWORD,
      handle,
      displayName,
      region: 'BR',
    },
  });
  if (res.status !== 201) throw new Error(`registro falhou: ${JSON.stringify(res.body)}`);
  const user = { token: res.body.token, handle, id: res.body.user.id };
  created.push(user);
  return user;
}

async function addPart(token, rigId, componentId, extra = {}) {
  return api('POST', `/rigs/${rigId}/components`, {
    token,
    body: { componentId, ...extra },
  });
}

async function main() {
  console.log(`Pecê — teste ponta a ponta contra ${BASE}\n`);

  // -------------------------------------------------------------------------
  section('Saúde e catálogo');

  const health = await api('GET', '/health');
  check('API responde', health.status === 200);
  check('catálogo populado', health.body?.components > 100, `${health.body?.components} componentes`);

  const cats = await api('GET', '/catalog/categories');
  check('categorias disponíveis', cats.body.categories.length === 17);

  const brands = await api('GET', '/catalog/GPU/brands');
  check(
    'navegação guiada: marcas de GPU',
    brands.body.brands.some((b) => b.brand === 'NVIDIA'),
  );

  const families = await api('GET', '/catalog/GPU/brands/NVIDIA/families');
  check('navegação guiada: famílias', families.body.families.length >= 3);

  const models = await api(
    'GET',
    `/catalog/GPU/brands/NVIDIA/families/${encodeURIComponent('GeForce RTX 40')}/models`,
  );
  check('navegação guiada: modelos exatos', models.body.models.length >= 5);
  check(
    'modelo traz specs estruturadas',
    models.body.models[0]?.spec?.kind === 'GPU' && typeof models.body.models[0].spec.vramGb === 'number',
  );

  const search = await api('GET', '/catalog/search?q=4070');
  check('busca textual funciona', search.body.results.length >= 2);

  // -------------------------------------------------------------------------
  section('Cadastro e onboarding');

  const alan = await createUser('alan', 'Alan');
  check('cadastro cria conta', Boolean(alan.token));

  const meBefore = await api('GET', '/auth/me', { token: alan.token });
  check('conta nova pede onboarding', meBefore.body.needsOnboarding === true);

  const profileRes = await api('PUT', '/me/profile', {
    token: alan.token,
    body: {
      workloads: [
        { kind: 'aaa-gaming', weight: 3 },
        { kind: 'streaming', weight: 1 },
      ],
      resolution: '1080p',
      targetFps: 144,
      budgetTier: 'moderate',
      budgetAmount: 3500,
      currency: 'BRL',
      priorities: ['value-for-money'],
      expertise: 'beginner',
    },
  });
  check('onboarding salva o perfil', profileRes.status === 200);
  check('perfil volta normalizado', profileRes.body.profile.resolution === '1080p');

  const meAfter = await api('GET', '/auth/me', { token: alan.token });
  check('onboarding concluído', meAfter.body.needsOnboarding === false);

  // -------------------------------------------------------------------------
  section('Montagem do PC (desequilibrado de propósito)');

  const rigRes = await api('POST', '/rigs', {
    token: alan.token,
    body: { name: 'PC Principal', kind: 'desktop' },
  });
  check('máquina criada', rigRes.status === 201);
  check('primeira máquina vira a principal', rigRes.body.rig.isPrimary === true);
  const rigId = rigRes.body.rig.id;

  // Processador de 2020 com placa de vídeo de topo: gargalo clássico.
  const parts = [
    'cpu-i5-10400f',
    'gpu-rtx-4080-super',
    'mb-msi-b560m-pro',
    'sto-kingston-nv2-1tb',
    'psu-corsair-rm850x',
    'cool-cm-hyper212',
    'case-corsair-4000d-airflow',
  ];
  for (const id of parts) {
    const res = await addPart(alan.token, rigId, id);
    if (res.status !== 201) throw new Error(`falha ao adicionar ${id}: ${JSON.stringify(res.body)}`);
  }
  // Um pente só: gargalo invisível de canal simples.
  await addPart(alan.token, rigId, 'ram-corsair-veng-ddr4-16-3200', { quantity: 1 });

  const rigDetail = await api('GET', `/rigs/${rigId}`, { token: alan.token });
  check('máquina tem 8 peças', rigDetail.body.rig.components.length === 8);
  check('quantidade é respeitada', rigDetail.body.rig.components.some((c) => c.quantity === 1));

  // -------------------------------------------------------------------------
  section('Inteligência');

  const intel = await api('GET', `/rigs/${rigId}/intelligence`, { token: alan.token });
  check('diagnóstico gerado', intel.status === 200);

  const d = intel.body.diagnosis;
  const cpuBottleneck = d.findings.find((f) => f.id === 'bottleneck-cpu');
  check('gargalo de processador detectado', Boolean(cpuBottleneck));
  check(
    'achado tem o quê / por quê / como',
    Boolean(cpuBottleneck?.what && cpuBottleneck?.why && cpuBottleneck?.how),
  );
  check(
    'achado tem camada técnica para o avançado',
    (cpuBottleneck?.technical?.length ?? 0) >= 3,
  );
  check('canal simples de memória detectado', d.findings.some((f) => f.id === 'memory-single-channel'));
  check('estimativa de FPS presente', typeof d.performance.fps?.fps === 'number');
  check('GPU é explicitamente aprovada', d.approved.some((a) => a.category === 'GPU'));

  const score = intel.body.score;
  check('Setup Score calculado', score.total > 0 && score.total <= 100);
  check('score tem 5 dimensões explicadas', score.dimensions.length === 5 && score.dimensions.every((x) => x.reason));

  const scenarios = intel.body.scenarios;
  check('cenários de upgrade gerados', scenarios.length >= 1);
  check(
    'nenhum cenário incompatível com a placa-mãe',
    scenarios.every((s) => s.compatibility.level !== 'blocked'),
  );
  check(
    'todo cenário tem ganho e custo',
    scenarios.every((s) => s.gainPercent >= 8 && s.estimatedCost > 0),
  );
  check(
    'cenário respeita o soquete LGA1200',
    scenarios.every((s) => s.component.spec.socket === 'LGA1200'),
    scenarios.map((s) => `${s.component.model}:${s.component.spec.socket}`).join(', '),
  );

  // -------------------------------------------------------------------------
  section('PC saudável não recebe recomendação de compra');

  const bia = await createUser('bia', 'Bia');
  await api('PUT', '/me/profile', {
    token: bia.token,
    body: {
      workloads: [{ kind: 'aaa-gaming', weight: 3 }],
      resolution: '1440p',
      targetFps: 75,
      budgetTier: 'moderate',
      budgetAmount: null,
      currency: 'BRL',
      priorities: ['value-for-money'],
      expertise: 'intermediate',
    },
  });

  const biaRig = await api('POST', '/rigs', { token: bia.token, body: { name: 'Setup da Bia' } });
  const biaRigId = biaRig.body.rig.id;
  for (const id of [
    'cpu-r7-7800x3d',
    'gpu-rtx-4070-super',
    'mb-msi-b650-tomahawk',
    'sto-samsung-990pro-1tb',
    'psu-corsair-rm750x',
    'cool-deepcool-ak620',
    'case-corsair-4000d-airflow',
  ]) {
    await addPart(bia.token, biaRigId, id);
  }
  await addPart(bia.token, biaRigId, 'ram-corsair-veng-ddr5-16-6000', { quantity: 2 });

  const biaIntel = await api('GET', `/rigs/${biaRigId}/intelligence`, { token: bia.token });
  check('veredito saudável', biaIntel.body.diagnosis.verdict === 'healthy', biaIntel.body.diagnosis.headline);
  check(
    'diz explicitamente para não fazer upgrade',
    /não precisa fazer upgrade/i.test(biaIntel.body.diagnosis.headline),
  );
  check('nenhum cenário de compra é oferecido', biaIntel.body.scenarios.length === 0);

  // -------------------------------------------------------------------------
  section('Valor estimado e privacidade');

  const value = await api('GET', `/rigs/${rigId}/value`, { token: alan.token });
  check('valor estimado calculado', value.body.value.total > 0);
  check('valor vem como faixa, não número exato', value.body.value.rangeLow < value.body.value.rangeHigh);
  check('sugestão de venda por peça', value.body.selling.length > 0);

  const valueAsOther = await api('GET', `/rigs/${rigId}/value`, { token: bia.token });
  check('valor é privado por padrão', valueAsOther.status === 403);

  await api('PATCH', `/rigs/${rigId}`, { token: alan.token, body: { showValue: true } });
  const valueShared = await api('GET', `/rigs/${rigId}/value`, { token: bia.token });
  check('valor aparece depois do dono liberar', valueShared.status === 200);

  await api('PATCH', `/rigs/${rigId}`, { token: alan.token, body: { visibility: 'PRIVATE' } });
  const privateRig = await api('GET', `/rigs/${rigId}`, { token: bia.token });
  check('máquina privada bloqueia terceiros', privateRig.status === 403);
  await api('PATCH', `/rigs/${rigId}`, { token: alan.token, body: { visibility: 'PUBLIC' } });

  // -------------------------------------------------------------------------
  section('Evolução do PC');

  const beforeUpgrade = await api('GET', `/rigs/${rigId}/intelligence`, { token: alan.token });
  const scoreBefore = beforeUpgrade.body.score.total;

  const currentCpu = rigDetail.body.rig.components.find((c) => c.component.category === 'CPU');
  const upgrade = await addPart(alan.token, rigId, 'cpu-i7-10700k', {
    replacesRigComponentId: currentCpu.id,
    paidAmount: 900,
    paidCurrency: 'BRL',
  });
  check('troca de peça registrada', upgrade.status === 201);
  check('retrato gravado na troca', upgrade.body.snapshot !== null);

  const afterUpgrade = await api('GET', `/rigs/${rigId}/intelligence`, { token: alan.token });
  check(
    'score sobe após resolver o gargalo',
    afterUpgrade.body.score.total > scoreBefore,
    `${scoreBefore} → ${afterUpgrade.body.score.total}`,
  );

  const history = await api('GET', `/rigs/${rigId}/history`, { token: alan.token });
  check('histórico tem retratos', history.body.snapshots.length >= 2);
  check('linha de evolução registra a troca', history.body.evolution.length === 1);
  check(
    'evolução mostra peça anterior e nova',
    history.body.evolution[0]?.from?.model === 'Core i5-10400F' &&
      history.body.evolution[0]?.to?.model === 'Core i7-10700K',
  );

  const stillOne = await api('GET', `/rigs/${rigId}`, { token: alan.token });
  check(
    'peça substituída sai da análise',
    stillOne.body.rig.components.filter((c) => c.component.category === 'CPU').length === 1,
  );

  // -------------------------------------------------------------------------
  section('Social');

  const event = await api('POST', '/events', {
    token: alan.token,
    body: {
      kind: 'UPGRADE',
      title: 'Troquei o processador: i5-10400F → i7-10700K',
      body: 'O gargalo sumiu e o score subiu.',
      rigId,
      payload: { from: 'Core i5-10400F', to: 'Core i7-10700K', scoreDelta: afterUpgrade.body.score.total - scoreBefore },
    },
  });
  check('evento publicado', event.status === 201);
  const eventId = event.body.event.id;

  const react = await api('PUT', `/events/${eventId}/reaction`, { token: bia.token, body: { kind: 'LOVE' } });
  check('reação registrada', react.body.reactions.LOVE === 1);

  const changed = await api('PUT', `/events/${eventId}/reaction`, { token: bia.token, body: { kind: 'LIKE' } });
  check('trocar reação substitui, não soma', changed.body.reactions.LOVE === 0 && changed.body.reactions.LIKE === 1);

  const comment = await api('POST', `/events/${eventId}/comments`, {
    token: bia.token,
    body: { body: 'Boa! Quanto ficou o FPS?' },
  });
  check('comentário criado', comment.status === 201);

  const reply = await api('POST', `/events/${eventId}/comments`, {
    token: alan.token,
    body: { body: 'Subiu bastante em 1080p.', parentId: comment.body.comment.id },
  });
  check('resposta aninhada criada', reply.status === 201);

  const comments = await api('GET', `/events/${eventId}/comments`);
  check('comentário traz suas respostas', comments.body.comments[0]?.replies?.length === 1);

  await api('PUT', `/users/${alan.handle}/follow`, { token: bia.token });
  const feed = await api('GET', '/feed', { token: bia.token });
  check('feed traz inteligência pessoal no topo', feed.body.personal !== null);
  check('inteligência pessoal tem status em uma linha', typeof feed.body.personal.status === 'string');
  check('feed traz eventos de quem se segue', feed.body.events.some((e) => e.id === eventId));
  check(
    'feed mostra a reação do próprio usuário',
    feed.body.events.find((e) => e.id === eventId)?.viewerReaction === 'LIKE',
  );

  // -------------------------------------------------------------------------
  section('Perfil, ranking e comparação');

  const profilePage = await api('GET', `/users/${alan.handle}`, { token: bia.token });
  check('perfil público carrega', profilePage.status === 200);
  check('perfil lista as máquinas', profilePage.body.rigs.length === 1);
  check('perfil mostra Setup Score', profilePage.body.rigs[0].setupScore > 0);
  check('perfil mostra que está sendo seguido', profilePage.body.isFollowing === true);

  const rankings = await api('GET', '/rankings', { token: bia.token });
  check('ranking retorna posições', rankings.body.entries.length >= 2);
  check(
    'ranking ordenado por Setup Score, não por preço',
    rankings.body.entries.every((e, i, arr) => i === 0 || arr[i - 1].setupScore >= e.setupScore),
  );

  const compare = await api('GET', `/rigs/${rigId}/compare/${biaRigId}`, { token: alan.token });
  check('comparação PC vs PC funciona', compare.status === 200);
  check('comparação traz linhas comparáveis', compare.body.comparison.rows.length >= 5);
  check('comparação declara um vencedor com justificativa', Boolean(compare.body.comparison.verdict.reasoning));

  // -------------------------------------------------------------------------
  section('Marketplace');

  const biaDetail = await api('GET', `/rigs/${biaRigId}`, { token: bia.token });
  const biaGpu = biaDetail.body.rig.components.find((c) => c.component.category === 'GPU');
  const biaCooler = biaDetail.body.rig.components.find((c) => c.component.category === 'COOLER');

  const draft = await api('GET', `/rigs/${biaRigId}/components/${biaGpu.id}/listing-draft`, {
    token: bia.token,
  });
  check('rascunho de anúncio traz a faixa sugerida', draft.status === 200 && draft.body.draft !== null);
  check(
    'faixa de venda é faixa, não preço único',
    draft.body.draft.guidance.suggestedLow < draft.body.draft.guidance.suggestedHigh,
  );
  check('título do anúncio vem do catálogo', /RTX 4070/i.test(draft.body.draft.title));

  const draftAsOther = await api('GET', `/rigs/${biaRigId}/components/${biaGpu.id}/listing-draft`, {
    token: alan.token,
  });
  check('rascunho de venda é só do dono', draftAsOther.status === 403);

  const fairPrice = Math.round(
    (draft.body.draft.guidance.suggestedLow + draft.body.draft.guidance.suggestedHigh) / 2,
  );
  const listed = await api('POST', '/market', {
    token: bia.token,
    body: { rigComponentId: biaGpu.id, askingPrice: fairPrice },
  });
  const listingId = listed.body?.listing?.id;
  check('anúncio criado', listed.status === 201 && Boolean(listingId));
  check('preço dentro da faixa é lido como justo', listed.body.listing.priceAssessment.fairness === 'in-range');
  check('anúncio guarda a faixa que gerou o preço', listed.body.listing.priceAssessment.suggestedLow > 0);

  const dupeListing = await api('POST', '/market', {
    token: bia.token,
    body: { rigComponentId: biaGpu.id, askingPrice: fairPrice },
  });
  check('peça não pode ter dois anúncios abertos', dupeListing.status === 409);

  const foreignListing = await api('POST', '/market', {
    token: alan.token,
    body: { rigComponentId: biaGpu.id, askingPrice: 100 },
  });
  check('não dá para anunciar peça de outro', foreignListing.status === 403);

  const shelf = await api('GET', '/market?category=GPU');
  check('vitrine lista o anúncio', shelf.status === 200 && shelf.body.listings.some((l) => l.id === listingId));
  const shelfOther = await api('GET', '/market?category=CPU');
  check('filtro de categoria funciona', !shelfOther.body.listings.some((l) => l.id === listingId));

  const shelfCombined = await api('GET', `/market?category=GPU&brand=${encodeURIComponent(shelf.body.listings[0].component.brand)}`);
  check(
    'dois filtros ao mesmo tempo continuam valendo os dois',
    shelfCombined.body.listings.every((l) => l.component.category === 'GPU'),
    shelfCombined.body.listings.map((l) => l.component.category).join(','),
  );
  const shelfConflicting = await api('GET', '/market?category=GPU&search=990%20PRO');
  check(
    'filtro que se contradiz devolve vazio, e não o filtro errado',
    shelfConflicting.body.listings.length === 0,
    `${shelfConflicting.body.listings.length} anúncios`,
  );

  const detail = await api('GET', `/market/${listingId}`, { token: alan.token });
  check('detalhe do anúncio abre para qualquer pessoa', detail.status === 200);
  check('comprador não é tratado como vendedor', detail.body.isSeller === false);
  check('anúncio mostra quem vende', detail.body.listing.seller.handle === bia.handle);

  // A regra que manda no produto, verificada de ponta a ponta.
  const intelAfterListing = await api('GET', `/rigs/${biaRigId}/intelligence`, { token: bia.token });
  check('anunciar peça não muda o veredito do engine', intelAfterListing.body.diagnosis.verdict === 'healthy');
  check('anunciar peça não faz aparecer cenário de compra', intelAfterListing.body.scenarios.length === 0);

  const valueStillPrivate = await api('GET', `/rigs/${biaRigId}/value`, { token: alan.token });
  check('anunciar uma peça não expõe o valor do PC', valueStillPrivate.status === 403);

  const biaEvents = await api('GET', `/users/${bia.handle}`, { token: bia.token });
  check(
    'anunciar não publica evento sem consentimento',
    !(biaEvents.body.events ?? []).some((e) => e.kind === 'SALE'),
  );

  const overpriced = await api('PATCH', `/market/${listingId}`, {
    token: bia.token,
    body: { askingPrice: Math.round(draft.body.draft.guidance.suggestedHigh * 2) },
  });
  check('preço muito acima da faixa é apontado', overpriced.body.listing.priceAssessment.fairness === 'far-above-range');
  check('mas o preço exagerado é aceito — o engine avalia, não proíbe', overpriced.status === 200);

  const foreignEdit = await api('PATCH', `/market/${listingId}`, {
    token: alan.token,
    body: { askingPrice: 1 },
  });
  check('não dá para editar anúncio de outro', foreignEdit.status === 403);

  const withdrawn = await api('DELETE', `/market/${listingId}`, { token: bia.token });
  check('anúncio pode ser retirado do ar', withdrawn.status === 204);
  const shelfAfter = await api('GET', '/market?category=GPU');
  check('anúncio retirado some da vitrine', !shelfAfter.body.listings.some((l) => l.id === listingId));
  const reactivated = await api('PATCH', `/market/${listingId}`, {
    token: bia.token,
    body: { status: 'active' },
  });
  check('anúncio retirado pode voltar', reactivated.body.listing.status === 'active');

  // Venda de verdade: a peça sai da análise e entra na história.
  const coolerListing = await api('POST', '/market', {
    token: bia.token,
    body: { rigComponentId: biaCooler.id, askingPrice: 200 },
  });
  const coolerListingId = coolerListing.body.listing.id;
  const sold = await api('PATCH', `/market/${coolerListingId}`, {
    token: bia.token,
    body: { status: 'sold', removeFromRig: true, publishEvent: true },
  });
  check('venda registrada', sold.body.listing.status === 'sold' && Boolean(sold.body.listing.soldAt));

  const afterSale = await api('GET', `/rigs/${biaRigId}`, { token: bia.token });
  check(
    'peça vendida sai da máquina',
    !afterSale.body.rig.components.some((c) => c.id === biaCooler.id),
  );
  const historyAfterSale = await api('GET', `/rigs/${biaRigId}/history`, { token: bia.token });
  check(
    'a venda vira retrato no histórico',
    historyAfterSale.body.snapshots.some((s) => s.trigger === 'component-sold'),
  );

  const soldEvents = await api('GET', `/users/${bia.handle}`, { token: bia.token });
  check(
    'com consentimento, a venda aparece no perfil',
    (soldEvents.body.events ?? []).some((e) => e.kind === 'SALE'),
  );

  const reopen = await api('PATCH', `/market/${coolerListingId}`, {
    token: bia.token,
    body: { status: 'active' },
  });
  check('venda é definitiva — não dá para reabrir o anúncio vendido', reopen.status === 409);

  // Anúncio órfão: a peça saiu do PC por outro caminho que não a venda.
  const biaCase = afterSale.body.rig.components.find((c) => c.component.category === 'CASE');
  const caseListing = await api('POST', '/market', {
    token: bia.token,
    body: { rigComponentId: biaCase.id, askingPrice: 350 },
  });
  const caseListingId = caseListing.body.listing.id;
  await api('DELETE', `/rigs/${biaRigId}/components/${biaCase.id}`, { token: bia.token });
  const orphan = await api('GET', `/market/${caseListingId}`);
  check(
    'peça removida da máquina não fica anunciada',
    orphan.body.listing.status === 'withdrawn',
    orphan.body.listing.status,
  );

  const allAsOther = await api('GET', '/market?status=all', { token: alan.token });
  check(
    'status=all não expõe anúncio vendido ou retirado de outra pessoa',
    !allAsOther.body.listings.some((l) => l.seller.handle === bia.handle),
  );
  const allAsOwner = await api('GET', '/market?status=all', { token: bia.token });
  check(
    'o vendedor vê o próprio histórico de anúncios',
    allAsOwner.body.listings.some((l) => l.id === coolerListingId),
  );

  // -------------------------------------------------------------------------
  section('Segurança');

  const noAuth = await api('GET', '/rigs');
  check('rota protegida exige login', noAuth.status === 401);

  const otherRig = await api('DELETE', `/rigs/${biaRigId}`, { token: alan.token });
  check('não dá para apagar máquina de outro', otherRig.status === 403);

  const badLogin = await api('POST', '/auth/login', {
    body: { email: `${alan.handle}@pece.test`, password: 'senha-errada' },
  });
  check('senha errada é rejeitada', badLogin.status === 401);

  const goodLogin = await api('POST', '/auth/login', {
    body: { email: `${alan.handle}@pece.test`, password: 'senha-de-teste-123' },
  });
  check('login correto devolve token', goodLogin.status === 200 && Boolean(goodLogin.body.token));

  const dupe = await api('POST', '/auth/register', {
    body: {
      email: `${alan.handle}@pece.test`,
      password: 'outra-senha-123',
      handle: `outro_${stamp}`.slice(0, 20),
      displayName: 'Outro',
    },
  });
  check('e-mail duplicado é rejeitado', dupe.status === 409);

  // -------------------------------------------------------------------------
  section('Apagar a conta');

  const guest = await createUser('guest', 'Convidada');
  const guestRig = await api('POST', '/rigs', { token: guest.token, body: { name: 'PC da Convidada' } });
  await addPart(guest.token, guestRig.body.rig.id, 'cpu-r7-7800x3d');
  await api('POST', '/events', {
    token: guest.token,
    body: { kind: 'BUILD', title: 'Montagem nova', rigId: guestRig.body.rig.id },
  });

  const wrongPassword = await api('DELETE', '/me', {
    token: guest.token,
    body: { password: 'não-é-essa' },
  });
  check('apagar a conta exige a senha certa', wrongPassword.status === 401);

  const noPassword = await api('DELETE', '/me', { token: guest.token });
  check('apagar a conta sem confirmar senha é recusado', noPassword.status === 400);

  const erased = await api('DELETE', '/me', { token: guest.token, body: { password: PASSWORD } });
  check('a pessoa consegue apagar a própria conta', erased.status === 204);

  const gone = await api('GET', `/users/${guest.handle}`);
  check('perfil apagado não existe mais', gone.status === 404);

  const feedAfterErase = await api('GET', '/feed');
  check(
    'o que a conta apagada publicou sai do feed junto',
    !feedAfterErase.body.events.some((e) => e.author.handle === guest.handle),
  );

}

/**
 * Remove as contas que esta execução criou.
 *
 * Roda mesmo quando o teste falha no meio: teste que quebra e deixa sujeira em produção
 * é pior do que teste que quebra. Usa a mesma rota que qualquer pessoa usaria para apagar
 * a própria conta — sem porta dos fundos.
 */
async function cleanup() {
  let removed = 0;
  for (const user of created) {
    try {
      const res = await api('DELETE', '/me', { token: user.token, body: { password: PASSWORD } });
      if (res.status === 204 || res.status === 404) removed += 1;
    } catch {
      // Rede caindo na limpeza não pode mascarar o resultado do teste.
    }
  }
  if (created.length > 0) {
    console.log(`\nLimpeza: ${removed}/${created.length} contas de teste removidas.`);
  }
}

try {
  await main();
} catch (err) {
  console.error('\nErro fatal:', err.message);
  failed += 1;
} finally {
  await cleanup();
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed} passaram, ${failed} falharam`);
process.exit(failed > 0 ? 1 : 0);
