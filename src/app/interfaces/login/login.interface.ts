export interface ILoginRequest {
  username: number;
  password: string;
  rememberMe: boolean;
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: IUser;
}

export interface IUser {
  idEmployee: number;
  username: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface ILogoutRequest {
  refreshToken: string;
}
