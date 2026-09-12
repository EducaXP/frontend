# Assets do Stitch utilizados

A pasta `stitch_educaxp` permanece preservada. As imagens abaixo foram copiadas sem alterar seus bytes; o recorte visual do avatar é feito apenas por CSS.

| Origem em `stitch_educaxp`                                                                  | Destino no frontend                        | Uso                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `image_removebg_preview.png/screen.png`                                                     | `public/assets/educaxp-emblem.png`         | Emblema original no login, menu lateral e cabeçalho móvel                          |
| `friendly_3d_stylized_friendly_student_avatar_headshot_with_headphones_cheerful/screen.png` | `public/assets/student-avatar.png`         | Retrato original na personalização do estudante                                    |
| `educaxp_icon_transparent_vector/code.html`                                                 | `public/icon.svg`                          | SVG exportado, usado como favicon                                                  |
| Mesmo SVG                                                                                   | `public/pwa-192.png`, `public/pwa-512.png` | Ícones de instalação rasterizados do vetor em 192 e 512 px, com margem de proteção |

O nome EducaXP e a assinatura do cabeçalho são texto acessível junto ao emblema. Paleta azul/roxa, superfícies claras e composição das telas seguem as referências exportadas, adaptadas aos dados e fluxos reais da API. Ícones de ação e itens cosméticos são vetoriais locais via Lucide.

O logo completo em canvas branco continua disponível na pasta original. Não é baixado junto com as missões. Nenhuma URL remota de imagem/fontes dos HTMLs exportados foi mantida no aplicativo.

O retrato maior é carregado sob demanda e guardado no cache `educaxp-public-avatar-v1`. Esse cache contém somente o asset público, nunca fotografias pessoais ou respostas da API. Se a imagem original mudar, incremente a versão desse cache ou use um nome de arquivo versionado.
