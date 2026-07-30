# Configuração da recuperação de senha

O fluxo de senha usa o Supabase Auth diretamente e não exige migration.

## URLs de autenticação

No Supabase Dashboard, em **Authentication → URL Configuration**:

- Site URL de produção: `https://prumoq.railton.eu.org`
- Redirect URL de produção: `https://prumoq.railton.eu.org/redefinir-senha`
- Redirect URL local: `http://localhost:8081/redefinir-senha`

Se a porta local da PWA for alterada, adicione a URL equivalente à lista de
redirects. Não use wildcard no endereço de produção.

## Variáveis de build

Configure a mesma origem pública, sem barra no final:

```env
EXPO_PUBLIC_PWA_URL=https://prumoq.railton.eu.org
NEXT_PUBLIC_PWA_URL=https://prumoq.railton.eu.org
```

Essas variáveis são incorporadas aos bundles. Depois de alterá-las, gere e
publique novamente as imagens do PWA e do painel.

## Entrega de e-mail

Configure um servidor SMTP próprio em **Authentication → SMTP Settings** antes
de disponibilizar o recurso em produção. O SMTP padrão do Supabase é destinado
a testes e possui limites restritos.

O template **Reset Password** deve manter `{{ .ConfirmationURL }}` como destino
do botão/link de recuperação. O parâmetro `redirectTo` enviado pelos aplicativos
levará o usuário à página `/redefinir-senha` depois que o token for confirmado.

## Verificação manual

1. Solicite a recuperação em `/recuperar-senha`.
2. Abra o e-mail e confirme que o link chega a `/redefinir-senha`.
3. Defina uma senha com pelo menos 8 caracteres.
4. Confirme que a senha antiga não autentica e que a nova funciona.
5. Confirme em outro dispositivo que a sessão anterior foi encerrada.
