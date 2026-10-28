'use strict';
// "Cérebro" do cachorro: entende frases em português e responde quase como gente.
// respond() devolve { text, action?, dogName?, playerName?, learn?, happy? }.

const DogBrain = (() => {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

  // Base de conhecimento sobre comida (ordem importa: o mais específico primeiro).
  const KB = [
    { re: /osso cozido|osso de frango|ossinho de frango|osso de churrasco/, bad: true, txt: 'Osso cozido lasca e pode machucar minha boca e minha barriga! Só a ração de osso e palha de Cachocraft é segura.' },
    { re: /macadamia|nozes|castanha/, bad: true, txt: 'Macadâmia me deixa fraco e tremendo. Nozes e castanhas em geral não são pra mim.' },
    { re: /chocolate|cacau|brigadeiro|bombom|nutella/, id: 'chocolate', bad: true, txt: 'Chocolate NÃO! Tem teobromina, que meu corpo de cachorro não consegue eliminar. Dá tremedeira e pode afetar meu coração.' },
    { re: /\buvas?\b|\bpassas?\b/, id: 'uva', bad: true, txt: 'Uva e uva-passa fazem muito mal: podem estragar meus rins, mesmo em pouca quantidade.' },
    { re: /cebola|\balho\b|cebolinha|tempero/, id: 'cebola', bad: true, txt: 'Cebola e alho estragam meu sangue e me dão anemia. Nada de comida temperada pra mim!' },
    { re: /biscoito|bolacha|cookie|\bbolo\b|\bdoces?\b|acucar|sobremesa|recheado/, id: 'biscoito', bad: true, txt: 'Biscoito de gente tem muito açúcar e gordura, às vezes até chocolate ou xilitol. Prefiro petisco de cachorro!' },
    { re: /\bcafe|cafeina|energetico|cha preto|refrigerante|\bcoca\b/, id: 'cafe', bad: true, txt: 'Cafeína deixa meu coração disparado e pode dar convulsão. Café é só pra humano!' },
    { re: /abacate|guacamole/, id: 'abacate', bad: true, txt: 'Abacate tem persina, e o caroço pode entalar na minha barriga. Melhor não.' },
    { re: /chiclete|xilitol|\bbala\b|adocante/, id: 'chiclete', bad: true, txt: 'Xilitol é perigosíssimo! Derruba minha glicose rapidinho e pode lesar meu fígado.' },
    { re: /alcool|cerveja|vinho|cachaca|caipirinha/, bad: true, txt: 'Álcool nunca! Até um pouquinho pode me intoxicar feio.' },
    { re: /\bleite\b|queijo|sorvete|lactose|iogurte/, bad: true, txt: 'Muitos cães têm intolerância à lactose... Leite pode me dar dor de barriga. Sorvete então, nem pensar!' },
    { re: /racao|osso e palha|palha/, id: 'racao', txt: 'Ração de osso e palha é a MELHOR coisa do mundo! Pode encher meu potinho sempre.' },
    { re: /cenoura/, id: 'cenoura', txt: 'Cenoura pode sim! É crocante e ajuda a limpar meus dentes.' },
    { re: /\bmacas?\b/, id: 'maca', txt: 'Maçã pode, mas sem as sementes e sem o miolo, tá?' },
    { re: /banana/, txt: 'Banana pode, um pedacinho de vez em quando. Tem bastante açúcar!' },
    { re: /melancia/, txt: 'Melancia sem sementes e sem casca é refrescante! Pode sim.' },
    { re: /frango|\bcarnes?\b|peixe/, txt: 'Carne cozida sem tempero e sem osso pode! Nada de sal, alho ou cebola.' },
    { re: /pipoca/, txt: 'Pipoca pura, sem sal e sem manteiga, um pouquinho pode. Com sal e manteiga, não!' },
    { re: /arroz|abobora|batata doce/, txt: 'Cozido e sem tempero, pode sim, em pouquinha quantidade.' },
    { re: /petisco/, id: 'petisco', txt: 'Petisco natural pra cachorro? SIM! Com moderação, mas SIM!' },
  ];

  const ACTIONS = [
    { re: /\b(larga|solta|cospe|cuspa)\b|deixa isso|para com isso|nao come|nao coma|tira da boca|^(nao+|pare|para|chega)$/, action: 'drop', say: [''] },
    { re: /\b(senta|sentado|sentar)\b/, action: 'sit', say: ['*senta bonitinho* Assim, {p}?', 'Sentei! Ganho petisco?', '*bumbum no chão* Pronto!'] },
    { re: /\b(deita|deitado|deitar)\b/, action: 'lie', say: ['*deita e cruza as patinhas*', 'Deitei. Esse chão tá fresquinho!', '*plof* Deitado!'] },
    { re: /\b(rola|rolar|gira|girar)\b|finge de morto|fingir de morto/, action: 'roll', say: ['*rola na grama* Wiii!', 'Rolei! Fiquei cheio de grama, hehe.', '*gira de barriga pra cima*'] },
    { re: /\b(pata|patinha|cumprimenta)\b|toca aqui/, action: 'paw', say: ['*levanta a patinha* Toca aqui!', 'Pata! Prazer, {p}!', '*oferece a pata com cara séria*'] },
    { re: /\b(pula|pular|salta|dança|danca|dancar)\b/, action: 'jump', say: ['*pula em duas patas* Olha eu!', 'Boing! Boing!', '*dancinha de cachorro*'] },
    { re: /\b(busca|buscar|traz|traga|pega|pegar)\b/, action: 'fetch', say: ['Vou buscar! *dispara*', 'Deixa comigo!', 'GRAVETO! *corre*'] },
    { re: /\b(vem|aqui|junto|volta)\b|chega mais|vem ca/, action: 'come', say: ['Tô indo! *corre com a língua pra fora*', 'Chegando, {p}!', '*vem correndo e derrapa*'] },
    { re: /\b(fica|espera|parado|aguarda|quieto)\b/, action: 'stay', say: ['*fica paradinho* ...mas não demora, tá?', 'Ok, fico aqui. Bem quietinho.', 'Ficando! *olhinhos acompanhando você*'] },
    { re: /\b(segue|vamos|bora|passear|passeio|acompanha)\b/, action: 'follow', say: ['Passeio?! PASSEIO! Vamos!', 'Tô do seu lado, {p}!', '*cola em você* Pra onde vamos?'] },
    { re: /vai brincar|pode ir|\blivre\b|a vontade|liberado|solto/, action: 'free', say: ['Oba! Vou cheirar tudo por aí!', 'Liberdade! *sai saltitando*'] },
    { re: /\b(dorme|dormir|nana|soneca|descansa|descansar)\b/, action: 'sleep', say: ['*boceja* Uma soneca cai bem... zzz', '*dá três voltinhas e deita* Boa noite, {p}.'] },
    { re: /\b(uiva|uivo|uivar)\b/, action: 'bark', say: ['Auuuuuuuuu!'] },
    { re: /\b(late|latir|au)\b|faz au/, action: 'bark', say: ['AU AU!', 'Au! Au! Auuu!', '*latido orgulhoso* AU!'] },
  ];

  function mood(c) {
    if (c.sick) return '*ganido* Não tô bem... acho que comi algo que não devia. Me leva no veterinário?';
    if (c.hunger < 30) return 'Tô com FOME! Enche meu potinho com ração de osso e palha? Por favorzinho?';
    if (c.thirst < 30) return 'Tô com sede... pega água na torneira e enche meu potinho?';
    if (c.health < 60) return 'Tô meio fraquinho ainda... mas com você do lado fico melhor.';
    if (c.happy > 70) return 'Tô ÓTIMO! Melhor dia da minha vida! (Todo dia é o melhor dia.)';
    if (c.happy < 35) return 'Tô meio entediado... joga um graveto? Faz um carinho?';
    return 'Tô bem! Mas um carinho atrás da orelha ia cair bem...';
  }

  const TALK = [
    { re: /^(oi+|ola|e ai|eai|opa|salve|hey|bom dia|boa tarde|boa noite)\b/, say: () => pick(['Au! Oi, {p}! *abana o rabo inteiro*', 'OI! Você voltou! *pula de alegria*', 'Oi oi oi! Que bom te ver, {p}!']), happy: 3 },
    { re: /qual (e )?(o )?seu nome|como (voce )?se chama|quem e voce/, say: () => 'Eu sou {n}! O melhor cachorro de Cachocraft. *estufa o peito*' },
    { re: /quem sou eu|sabe (o )?meu nome|qual (e )?(o )?meu nome/, say: c => c.playerName ? 'Você é {p}! Meu humano favorito. Ou cachorro favorito. Os dois!' : 'Você é meu melhor amigo! Mas ainda não sei seu nome... me conta? Diz "meu nome é..."' },
    { re: /idade|quantos anos/, say: () => 'Tenho 3 anos de cachorro. Isso dá uns 28 de humano, eu acho. Matemática não é meu forte.' },
    { re: /raca|que cachorro (voce )?e/, say: c => `Minha pelagem é ${c.coatName}! Linda, né? Dá pra trocar no guarda-roupa.` },
    { re: /o que (voce )?(mais )?gosta|oque (voce )?gosta|favorit|preferid/, say: () => pick(['Graveto! E ração de osso e palha! E você! Não necessariamente nessa ordem.', 'Gosto de correr atrás de graveto, de carinho na barriga e de água fresquinha no potinho.']) },
    { re: /como (voce )?(esta|ta|vai)|tudo bem|ta bem|esta bem|ta feliz|esta feliz|beleza/, say: mood },
    { re: /fome|comer|comida|almoco|jantar/, say: c => c.hunger < 50 ? 'Fome? SIM! Põe ração de osso e palha no meu potinho? O saco fica do lado da casinha.' : 'Comi faz pouco, tô de boa. Mas um petisquinho eu nunca recuso!' },
    { re: /sede|\bagua\b|beber/, say: c => c.thirst < 50 ? 'Tô com sede! Pega a jarra na torneira e enche meu potinho, por favor!' : 'Tô hidratado! Meu potinho tá ótimo.' },
    { re: /bom (garoto|menino|cachorro|cao)|boa (garota|menina|cachorra)|lind[oa]|fof[oa]|te amo|amo voce|gosto de voce|melhor amigo|quem e (um|o) bom/, say: () => pick(['EU! EU SOU! *gira em círculos*', '*derrete de felicidade* Também te amo, {p}!', '*lambeijo* Você é o melhor!', '*abana tanto o rabo que quase cai*']), happy: 12 },
    { re: /\b(feio|chato|burro|mau|ruim|idiota|bobo)\b/, say: () => pick(['*orelhas pra baixo* ...poxa.', '*olhinhos tristes* Eu fiz algo errado?']), happy: -10 },
    { re: /\b(gato|gata|gatinho|miau)\b/, say: () => pick(['GATO?! ONDE?! *rosnado baixinho*', 'Gatos... eles me olham como se soubessem de algo.']) },
    { re: /banho|shampoo/, say: () => pick(['Banho?! *finge que não ouviu*', 'Eu... acabei de lembrar que tenho um compromisso. Bem longe da banheira.']) },
    { re: /veterinario|vacina|medico|doutor/, say: c => c.sick ? 'Sim... me leva no veterinário. Fica ali do lado direito do parque.' : 'O veterinário é legal e me dá petisco. Mas a agulha... não gosto da agulha.' },
    { re: /graveto|bolinha|brinquedo|brincar|brinca/, say: () => pick(['BRINCAR?! Joga um graveto! Eu busco! Eu sempre busco!', 'Sacode uma árvore que cai graveto. Aí é só jogar! *treme de ansiedade*']), happy: 4 },
    { re: /piada|conta algo|historia|me conta/, say: () => pick(['Por que o cachorro sentou na sombra? Porque não queria virar cachorro-quente! Au au au!', 'Um dia eu persegui meu próprio rabo por meia hora. Quase peguei. QUASE.', 'O carteiro passou aqui ontem. Eu lati. Ele foi embora. Salvei a casa de novo.']) },
    { re: /carteiro/, say: () => 'O carteiro é meu arqui-inimigo. Ele vem TODO dia. Suspeito.' },
    { re: /esquilo|passaro|pombo/, say: () => '*vira a cabeça na hora* ESQUILO?! ...ah, não tem. Pegadinha. Muito engraçado, {p}.' },
    { re: /(voce )?(me )?entende|sabe falar|fala portugues/, say: () => 'Entendo quase tudo! Só não entendo por que vocês jogam o graveto se querem ele de volta.' },
    { re: /obrigad|valeu/, say: () => 'De nada! Agora... aquele petisco? *olhar pidão*' },
    { re: /tchau|ate logo|adeus|fui/, say: () => pick(['Já vai?! *choraminga* Volta logo!', 'Tchau, {p}! Vou ficar te esperando na porta.']) },
    { re: /desculpa|perdao/, say: () => '*lambida* Já esqueci! Cachorro não guarda mágoa.', happy: 8 },
  ];

  const FALLBACK = [
    '*inclina a cabeça* Hmm? Não entendi tudo, mas gostei do seu tom!',
    'Au? Não peguei direito... isso tem a ver com petisco?',
    '*abana o rabo* Concordo! ...com o quê mesmo?',
    '*inclina a cabeça pro outro lado* Fala de novo, mais devagar?',
  ];

  function respond(raw, c) {
    const t = norm(raw);
    const out = r => ({ ...r, text: (r.text || '').replaceAll('{n}', c.dogName).replaceAll('{p}', r.playerName || c.playerName || 'humano') });

    let m = raw.match(/(?:seu nome (?:agora )?(?:é|e)|vou te chamar de|te chamar de|você se chama|voce se chama)\s+([A-Za-zÀ-ÿ]{2,14})/i);
    if (m) {
      const name = cap(m[1]);
      return out({ dogName: name, happy: 5, text: `${name}? Gostei! Agora eu sou ${name}! *abana o rabo*` });
    }
    m = raw.match(/(?:meu nome (?:é|e)|me chamo|pode me chamar de)\s+([A-Za-zÀ-ÿ]{2,14})/i);
    if (m) {
      const name = cap(m[1]);
      return out({ playerName: name, happy: 3, text: `${name}! Prazer, ${name}! Vou lembrar pra sempre. Ou até ver um esquilo.` });
    }

    for (const a of ACTIONS) if (a.re.test(t)) return out({ action: a.action, text: pick(a.say) });

    const food = KB.find(k => k.re.test(t));
    if (food) {
      if (food.bad && food.id && !c.learned.includes(food.id))
        return out({ learn: food.id, text: food.txt + ' Vou lembrar disso, não vou comer!' });
      return out({ text: food.txt });
    }

    if (/pode comer|posso (te )?dar|faz mal|e toxic|e venenos/.test(t))
      return out({ text: 'Hmm, disso eu não tenho certeza... Na dúvida, pergunta pro veterinário! Ração de osso e palha é sempre segura.' });

    for (const i of TALK) if (i.re.test(t)) return out({ text: i.say(c), happy: i.happy });

    if (t.includes(norm(c.dogName))) return out({ text: '*orelhas em pé* Me chamou? Tô aqui, {p}!' });
    return out({ text: pick(FALLBACK) });
  }

  return { respond, norm };
})();
