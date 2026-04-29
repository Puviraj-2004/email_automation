interface ImapHostConfig {
  host: string;
  port: number;
  tls: boolean;
}

const IMAP_HOST_MAP: Record<string, ImapHostConfig> = {
  'gopservices.fr': { host: 'mail.gopservices.fr', port: 993, tls: true },
  'garage-ravier.fr': { host: 'mail.garage-ravier.fr', port: 993, tls: true },
  'gmail.com': { host: 'imap.gmail.com', port: 993, tls: true },
  'outlook.com': { host: 'outlook.office365.com', port: 993, tls: true },
  'hotmail.com': { host: 'outlook.office365.com', port: 993, tls: true },
};

export function resolveImapConfig(email: string): ImapHostConfig {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) throw new Error(`[ImapConfig] Invalid email: ${email}`);

  const hostConfig = IMAP_HOST_MAP[domain];
  if (!hostConfig) {
    throw new Error(
      `[ImapConfig] No IMAP config for domain "${domain}". Add it to src/config/imapHosts.ts`,
    );
  }
  return hostConfig;
}