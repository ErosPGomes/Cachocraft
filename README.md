# Cachocraft

O jogo para quem é apaixonado por cachorro. Você é um cachorro e cuida do seu melhor amigo, o **Paçoca**: brinca, alimenta, conversa e veste os dois com skins de cachorro.

E tem uma regra de ouro: **o que faz mal para um cachorro na vida real também faz mal no jogo.** Comeu chocolate? Perde vida.

> **Versão 3D (mundo de blocos)** na raiz. A versão 2D original continua jogável em [`classico/`](classico/).

Na 3D você cava (segure o clique esquerdo), coloca blocos (clique direito), cria itens no inventário (`I`) com receitas próprias, como palha + osso → ração, e constrói. O motor de blocos foi adaptado do repositório [animation](https://github.com/ErosPGomes/animation). Use `Espaço` para pular e `V` para trocar a distância da câmera.

## Como jogar

A versão 3D usa módulos ES, então precisa de um servidor local (a 2D em `classico/` abre direto):

```bash
python -m http.server 8123
```

e acesse http://localhost:8123.

### Controles (versão 3D)

| Tecla | Ação |
| --- | --- |
| `WASD` | andar (`Shift` corre) |
| `Espaço` | pular |
| Mouse | olhar (clique na tela para travar o ponteiro) |
| Clique esquerdo (segurar) | cavar o bloco |
| Clique direito | colocar bloco ou jogar o item da mão |
| `1`–`9` / rodinha | trocar item da barra |
| `E` | usar, fazer carinho, dar comida, encher potinho |
| `R` | comer / beber |
| `Q` | soltar |
| `I` ou `Tab` | inventário e criação |
| `C` | guarda-roupa |
| `Enter` | conversar com o cachorro |
| `V` | aproximar/afastar a câmera |

Os controles da versão 2D estão na própria tela de `classico/`.

## Receitas

| Ingredientes | Resultado |
| --- | --- |
| 1 tronco | 4 tábuas |
| 1 tábua | 4 gravetos |
| 4 capim | 1 fardo de palha |
| 1 palha + 1 osso | 3 rações |
| 1 osso + 1 cenoura | 2 petiscos |
| 4 rações | 1 bloco de ração |
| 4 ossos | 1 bloco de osso |
| 2 areia | 1 vidro |
| 2 terra + 1 areia | 4 telhas |
| 2 pedregulho + 1 areia | 4 paredes brancas |
| 1 palha + 1 flor vermelha | 2 tapetes de pelo |
| 10 tábuas + 6 telhas | kit casinha de cachorro (monta a casinha na sua frente) |

Ossos saem dos fósseis escondidos na pedra; gravetos e maçãs caem das folhas.

## O que dá pra fazer

- **Buscar graveto**: quebre folhas ou crie gravetos com tábuas e jogue (clique direito). O Paçoca busca e traz de volta.
- **Potinho de água**: pegue a jarra na torneira e encha o potinho azul.
- **Ração de osso e palha**: pegue uma porção no saco e encha o potinho vermelho.
- **Conversar**: o Paçoca entende quase como gente. Dê comandos ("senta", "deita", "dá a pata", "vem", "fica", "me segue", "busca", "larga!"), pergunte como ele está, se pode comer alguma coisa, mude o nome dele ("seu nome agora é Thor") ou diga o seu ("meu nome é Ana").
- **Ele aprende**: se você ensinar que algo faz mal (perguntando no chat ou mandando ele largar), ele passa a recusar aquela comida.
- **Guarda-roupa**: pelagens (Caramelo, Dálmata, Husky, Beagle, Salsicha, Pug...), coleiras e acessórios (bandana, laço, óculos, chapéu, coroa...), para você e para o Paçoca. Compre com **ossinhos** ganhos brincando.
- **Veterinário**: cura você e o Paçoca.

## Comida

| Pode comer | Faz mal (dá dano) |
| --- | --- |
| Ração de osso e palha | Chocolate (teobromina) |
| Petisco natural | Uva (rins) |
| Cenoura | Cebola (anemia) |
| Maçã sem sementes | Biscoito recheado (açúcar, gordura) |
| | Café (cafeína) |
| | Abacate (persina) |
| | Chiclete com xilitol (hipoglicemia) |

## Estrutura

```
index.html        página e interface (versão 3D)
css/style.css     estilos
js/vendor/        Three.js r160
js/world.js       blocos, terreno, pedaços (chunks) e malha com AO
js/textures.js    atlas de texturas procedurais
js/dog3d.js       modelo 3D do cachorro com pele pintada pela skin
js/data.js        catálogo de skins, itens, comidas e receitas
js/draw.js        desenho procedural (ícones e prévia do guarda-roupa)
js/dogbrain.js    conversa: entende frases em português
js/game.js        jogador, IA do Paçoca, inventário, criação, HUD
classico/         backup jogável da versão 2D original
```

O progresso (ossinhos, skins, nomes, o que o Paçoca aprendeu) fica salvo no navegador.
