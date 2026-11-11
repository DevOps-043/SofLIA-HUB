export * from '../../shared/legacy-communication';
export interface WhatsAppSetupProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  embedded?: boolean;
}
