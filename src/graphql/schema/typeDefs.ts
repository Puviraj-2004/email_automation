export const typeDefs = `#graphql

  enum EmailType {
    PV_EXPERTISE
    LETTRE
    PEC
    OTHER
  }

  enum RunStatus {
    RUNNING
    SUCCESS
    FAILED
  }

  type EmailAccount {
    id:        String!
    label:     String!
    email:     String!
    imapHost:  String!
    imapPort:  Int!
    isActive:  Boolean!
    createdAt: String!
  }

  type EmailAttachment {
    id:        String!
    emailId:   String!
    filename:  String!
    publicUrl: String!
    mimeType:  String!
    fileSize:  Int!
    createdAt: String!
  }

  type Email {
    id:              String!
    accountId:       String!
    subject:         String!
    body:            String!
    fromEmail:       String!
    fromName:        String
    receivedAt:      String!
    emailType:       EmailType!
    expertRef:       String
    sinistreRef:     String
    immatriculation: String
    insuredName:     String
    companyName:     String
    expertFirm:      String
    createdAt:       String!
    attachments:     [EmailAttachment!]!
  }

  type RobotRun {
    id:            String!
    accountId:     String!
    startedAt:     String!
    finishedAt:    String
    status:        RunStatus!
    emailsFetched: Int!
    emailsSkipped: Int!
    errorMessage:  String
    fetchFrom:     String!
    fetchTo:       String!
  }

  type Query {
    emailAccounts: [EmailAccount!]!
    emailAccount(id: String!): EmailAccount

    emails(accountId: String, emailType: EmailType, sinistreRef: String, limit: Int, offset: Int): [Email!]!
    email(id: String!): Email

    robotRuns(limit: Int, offset: Int): [RobotRun!]!
  }

  type Mutation {
    createEmailAccount(label: String!, email: String!, password: String!): EmailAccount!
    updateEmailAccount(id: String!, label: String, password: String, isActive: Boolean): EmailAccount!
    deleteEmailAccount(id: String!): Boolean!

    triggerRobot: Boolean!
  }
`;
