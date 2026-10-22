export interface WhatsAppSession {
  phoneNumber: string;
  userId: string;
  email: string;
  fullName: string;
  username: string;
  authenticatedAt: string;
  /** Identificación por teléfono o sesión manual anterior. */
  autoDetected: boolean;
}
