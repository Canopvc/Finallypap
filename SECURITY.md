# 🔒 Guia de Segurança - Chaves de API

Este projeto **NÃO** contém chaves de API hardcoded no código. Todas as chaves são gerenciadas através de variáveis de ambiente.

## ✅ O que está configurado

1. **Todas as chaves usam variáveis de ambiente**
   - Supabase: `SUPABASE_URL` e `SUPABASE_ANON_KEY`
   - Cohere: `COHERE_API_KEY`

2. **Arquivos ignorados pelo Git**
   - `.env` e `.env.*` estão no `.gitignore`
   - Nenhuma chave será commitada acidentalmente

3. **Fallback seguro**
   - O código usa `Constants.expoConfig.extra` (EAS Build)
   - Ou `process.env` (desenvolvimento local)
   - Se não encontrar, mostra apenas um aviso em desenvolvimento

## 📝 Como configurar

### Para desenvolvimento local:

1. Crie um arquivo `.env` na raiz do projeto:
```env
COHERE_API_KEY=sua-chave-cohere-aqui
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

2. O arquivo `.env` já está no `.gitignore`, então não será commitado.

### Para builds de produção:

Configure as variáveis no EAS Build:
```bash
eas env:create --name COHERE_API_KEY --value "sua-chave" --scope project
eas env:create --name SUPABASE_URL --value "sua-url" --scope project
eas env:create --name SUPABASE_ANON_KEY --value "sua-chave" --scope project
```

Veja `EAS_BUILD_SETUP.md` para instruções detalhadas.

## ⚠️ Importante

- **NUNCA** commite arquivos `.env` no Git
- **NUNCA** coloque chaves hardcoded no código
- **SEMPRE** use variáveis de ambiente
- Se encontrar alguma chave no código, remova imediatamente

## 🔍 Verificação

Para verificar se há chaves no código:
```bash
# Buscar por padrões de chaves JWT
grep -r "eyJ" --include="*.ts" --include="*.tsx" --include="*.js" .

# Buscar por URLs do Supabase
grep -r "supabase.co" --include="*.ts" --include="*.tsx" .
```

Se encontrar algo, remova e use variáveis de ambiente!
