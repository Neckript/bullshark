import { ErrorBoundary as BaseErrorBoundary } from '@/components/error-boundary';
import {
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@sharkord/ui';
import { Bug } from 'lucide-react';
import { type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TErrorBoundaryProps = {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  pluginId: string;
  slotId: string;
};

const copyErrorDetails = (
  error: Error,
  copiedMessage: string,
  errorLabel: string,
  stackLabel: string
) => {
  const errorDetails = `${errorLabel}: ${error.message}\n${stackLabel}: ${error.stack}`;

  navigator.clipboard.writeText(errorDetails);

  toast.success(copiedMessage);
};

const ErrorBoundary = ({
  children,
  onError,
  pluginId,
  slotId
}: TErrorBoundaryProps) => {
  const { t } = useTranslation();

  return (
    <BaseErrorBoundary
      fallback={(error) => (
        <Popover>
          <PopoverTrigger asChild>
            <IconButton
              icon={Bug}
              className="text-destructive border-destructive"
              size="xs"
              title={t('pluginRenderErrorTitle')}
            />
          </PopoverTrigger>
          <PopoverContent className="w-96">
            <div>
              <span className="text-xs text-destructive mb-2 block">
                {t('pluginRenderError', { pluginId, slotId })}
              </span>

              <span className="text-xs text-destructive mb-2 block">
                {t('reportToPluginDeveloper')}
              </span>

              <details>
                <summary className="text-[10px] text-destructive">
                  {t('errorDetails')}
                </summary>

                <div>
                  <span
                    className="text-destructive underline text-xs cursor-pointer"
                    onClick={() => {
                      copyErrorDetails(
                        error,
                        t('errorDetailsCopied'),
                        t('errorLabel'),
                        t('stackLabel')
                      );
                    }}
                  >
                    {t('copyDetails')}
                  </span>

                  <pre className="text-xs text-destructive overflow-auto max-h-48">
                    {error.message}
                    <br />
                    {error.stack}
                  </pre>
                </div>
              </details>
            </div>
          </PopoverContent>
        </Popover>
      )}
      onError={onError}
    >
      {children}
    </BaseErrorBoundary>
  );
};

export { ErrorBoundary };
