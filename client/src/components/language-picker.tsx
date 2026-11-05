import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { supportedLanguages } from '@/lib/i18n';

export function LanguagePicker() {
  const { i18n } = useTranslation();

  const currentLanguage = supportedLanguages.find(
    (lang) => lang.code === (i18n.resolvedLanguage || i18n.language?.split('-')[0])
  ) || supportedLanguages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="header-icon-button gap-2"
          data-testid="button-language-picker"
          aria-label={`Change language (${currentLanguage.nativeName})`}
        >
          <Globe className="h-5 w-5" aria-hidden="true" />
          <span className="hidden lg:inline">{currentLanguage.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {supportedLanguages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={currentLanguage.code === language.code ? 'bg-accent' : ''}
            data-testid={`menu-item-language-${language.code}`}
          >
            <span className="mr-2">{language.nativeName}</span>
            <span className="text-muted-foreground text-xs">
              {language.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
