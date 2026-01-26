# 🚀 Guia de Configuração para EAS Build

Este guia explica como configurar as chaves de API (Supabase e Cohere) para funcionarem perfeitamente no build do APK.

## 🔒 Segurança

**IMPORTANTE**: Este projeto não contém chaves de API hardcoded no código. Todas as chaves devem ser configuradas através de variáveis de ambiente. Veja `SECURITY.md` para mais informações.

## 📋 Pré-requisitos

1. Ter uma conta no EAS (Expo Application Services)
2. Ter o EAS CLI instalado: `npm install -g eas-cli`
3. Estar autenticado: `eas login`

## 🔑 Passo 1: Configurar Variáveis de Ambiente no EAS

### Via EAS Environment Variables (Recomendado - Mais Seguro)

**⚠️ IMPORTANTE**: Certifique-se de estar no diretório correto (`Finallypap\Finallypap`):

```powershell
# Navegue para o diretório do projeto
cd C:\PAP\Finallypap\Finallypap

# Verifique se há um arquivo eas.json
dir eas.json
```

Execute os seguintes comandos no terminal:

```bash
# Configurar chave da API Cohere

```

**Nota**: O comando `eas secret:create` está deprecated. Use `eas env:create` em vez disso.

**Onde encontrar as chaves:**
- **Cohere API Key**: Dashboard da Cohere (https://dashboard.cohere.com/)
- **Supabase URL e Anon Key**: Dashboard do Supabase → Settings → API

## 🔧 Passo 2: Verificar Configuração

Verifique se as variáveis estão configuradas:

```bash
# Listar todas as variáveis de ambiente do projeto
eas env:list
```

## 🏗️ Passo 3: Fazer o Build

Agora você pode fazer o build normalmente:

```bash
eas build -p android --profile preview
```

As variáveis de ambiente serão automaticamente injetadas durante o build.

## ✅ Como Funciona

1. **Durante o build**: O EAS lê as variáveis de ambiente configuradas
2. **No código**: O app usa `Constants.expoConfig.extra` para acessar essas variáveis
3. **Fallback**: Se as variáveis não estiverem configuradas, usa os valores padrão (hardcoded)

## 🔒 Segurança

- ✅ As chaves NÃO são commitadas no Git (`.env` está no `.gitignore`)
- ✅ Os secrets do EAS são criptografados e seguros
- ✅ Cada perfil de build (preview, production) pode ter variáveis diferentes

## 🐛 Troubleshooting

### Problema: "API key not found"
**Solução**: Verifique se as variáveis foram criadas corretamente:
```bash
eas env:list
```

### Problema: "Run this command inside a project directory"
**Solução**: Certifique-se de estar no diretório correto:
```bash
# Navegue para o diretório do projeto
cd C:\PAP\Finallypap\Finallypap

# Verifique se há um arquivo eas.json
dir eas.json
```

### Problema: "Build falha"
**Solução**: Certifique-se de que os nomes das variáveis estão corretos:
- `COHERE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Problema: "Variáveis não funcionam no build"
**Solução**: Limpe o cache e tente novamente:
```bash
eas build -p android --profile preview --clear-cache
```

## 📝 Notas Importantes

1. **Valores padrão**: Se você não configurar as variáveis, o app usará os valores hardcoded como fallback
2. **Diferentes ambientes**: Você pode ter diferentes valores para `preview` e `production`
3. **Atualização**: Se mudar as variáveis, precisa fazer um novo build

## 🔄 Atualizar Variáveis

Para atualizar uma variável existente:

```bash
# Deletar a variável antiga
eas env:delete --name COHERE_API_KEY

# Criar com o novo valor
eas env:create --name COHERE_API_KEY --value "nova-chave-aqui" --scope project
```

## 📚 Referências

- [EAS Build Environment Variables](https://docs.expo.dev/build-reference/variables/)
- [EAS Secrets](https://docs.expo.dev/build-reference/secrets/)
