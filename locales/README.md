# Sistema de Internacionalização (i18n)

Este projeto usa `react-i18next` e `expo-localization` para suportar múltiplos idiomas.

## Idiomas Suportados

- **Português (pt)** - Idioma padrão para dispositivos portugueses
- **Inglês (en)** - Idioma padrão para outros dispositivos

## Estrutura de Arquivos

```
locales/
├── pt/
│   ├── common.json      # Traduções comuns (tabs, botões, etc)
│   └── workouts.json    # Traduções relacionadas a treinos
├── en/
│   ├── common.json
│   └── workouts.json
└── README.md
```

## Como Usar

### 1. Usar traduções em componentes

```typescript
import { useTranslation } from '../../hooks/useTranslation';

export default function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <Text>{t('home')}</Text>  // Mostra "Início" ou "Home"
  );
}
```

### 2. Usar traduções de outros namespaces

```typescript
const { t } = useTranslation();

// Namespace padrão (common)
<Text>{t('home')}</Text>

// Outro namespace (workouts)
<Text>{t('workout', { ns: 'workouts' })}</Text>
```

### 3. Mudar o idioma

```typescript
import { changeLanguage } from '../../lib/i18n';

// Mudar para português
await changeLanguage('pt');

// Mudar para inglês
await changeLanguage('en');
```

### 4. Obter idioma atual

```typescript
import { getCurrentLanguage } from '../../lib/i18n';

const currentLang = getCurrentLanguage(); // 'pt' ou 'en'
```

## Adicionar Novas Traduções

1. Adicione a chave em ambos os arquivos JSON (pt e en):
   - `locales/pt/common.json`
   - `locales/en/common.json`

2. Use a tradução no componente:
   ```typescript
   <Text>{t('novaChave')}</Text>
   ```

## Detecção Automática

O sistema detecta automaticamente o idioma do dispositivo na primeira inicialização:
- Dispositivos portugueses → Português
- Outros dispositivos → Inglês

O idioma escolhido é salvo no AsyncStorage e mantido entre sessões.

