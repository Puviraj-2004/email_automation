export interface SaveAttachmentInput {
  emailId: string;
  filename: string;
  content: Buffer;
  mimeType: string;
  receivedAt: Date;
}