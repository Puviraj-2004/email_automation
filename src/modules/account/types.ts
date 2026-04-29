export interface CreateEmailAccountInput {
  label: string;
  email: string;
  password: string;
}

export interface UpdateEmailAccountInput {
  label?: string;
  password?: string;
  isActive?: boolean;
}