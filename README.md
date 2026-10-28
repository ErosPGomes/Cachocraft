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

### Controles

| Tecla | Ação |
| --- | --- |
| `WASD` / setas | andar (`Shift` corre) |
| `E` ou `Espaço` | pegar, usar, fazer carinho, dar comida |
| Clique | jogar o que está na boca |
| `R` | comer / beber |
| `Q` | soltar |
| `Enter` | conversar com o cachorro |
| `C` | guarda-roupa |

No celular: arraste no lado esquerdo da tela para andar e toque no lado direito para usar/jogar.

## O que dá pra fazer

- **Buscar graveto**: sacuda uma árvore, pegue o graveto e jogue. O Paçoca busca e traz de volta.
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
index.html        página e interface
css/style.css     estilos
js/data.js        catálogo de skins e itens
js/draw.js        desenho procedural (canvas)
js/dogbrain.js    conversa: entende frases em português
js/game.js        mundo, jogador, IA do cachorro, HUD
```

O progresso (ossinhos, skins, nomes, o que o Paçoca aprendeu) fica salvo no navegador.
